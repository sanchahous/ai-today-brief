import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../pipeline/openrouter-summarize', () => ({
  generateWithOpenRouterChain: vi.fn(),
}));

// Wraps the real loadProviderRegistry (pass-through by default) the same way
// pipeline/card-image.test.ts does -- most tests here never touch it (no
// `db` option), the Phase 5 describe block below overrides it explicitly.
vi.mock('../../../pipeline/providers/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../pipeline/providers/registry')>();
  return { ...actual, loadProviderRegistry: vi.fn(actual.loadProviderRegistry) };
});

import {
  generateSocialJson,
  rankLocalModelIds,
  rankSocialOpenRouterModels,
  resolveSocialProviderOrder,
} from './llm-router';
import { generateWithOpenRouterChain } from '../../../pipeline/openrouter-summarize';
import { loadProviderRegistry } from '../../../pipeline/providers/registry';
import type { OpenRouterModelRecord } from '../../../pipeline/openrouter-models';

function model(
  id: string,
  created: number,
  overrides: Partial<OpenRouterModelRecord> = {},
): OpenRouterModelRecord {
  return {
    id,
    created,
    context_length: 128_000,
    supported_parameters: ['response_format', 'structured_outputs'],
    architecture: { modality: 'text->text' },
    expiration_date: null,
    ...overrides,
  };
}

describe('resolveSocialProviderOrder', () => {
  it('defaults to openrouter first for both roles -- gemini dropped from rotation (2026-08-06)', () => {
    expect(resolveSocialProviderOrder('writer', {})).toEqual(['openrouter', 'ollama']);
    expect(resolveSocialProviderOrder('critic', {})).toEqual(['openrouter', 'ollama']);
  });

  it('still accepts gemini when explicitly configured back in', () => {
    expect(
      resolveSocialProviderOrder('writer', { SOCIAL_WRITER_PROVIDER_ORDER: 'gemini,openrouter' }),
    ).toEqual(['gemini', 'openrouter']);
  });

  it('filters invalid values and deduplicates configured providers', () => {
    expect(
      resolveSocialProviderOrder('critic', {
        SOCIAL_CRITIC_PROVIDER_ORDER: 'ollama,invalid,openrouter,ollama',
      }),
    ).toEqual(['ollama', 'openrouter']);
  });
});

describe('rankSocialOpenRouterModels', () => {
  const now = 1_784_000_000;
  const catalog = [
    model('~openai/gpt-latest', now - 1_000),
    model('~openai/gpt-mini-latest', now - 900),
    model('openai/gpt-5.6-terra-pro', now - 450),
    model('openai/gpt-5.6-terra', now - 500),
    model('openai/gpt-5.5-terra', now - 10_000),
    model('openai/gpt-4o', now - 50_000_000),
    model('~anthropic/claude-sonnet-latest', now - 2_000),
    model('deepseek/deepseek-v4-pro', now - 3_000),
    model('deepseek/deepseek-v4-flash', now - 2_900),
    model('qwen/qwen3.7-max', now - 2_800),
    model('vendor/model:free', now - 100),
    model('openai/gpt-coder-latest', now - 50),
  ];

  it('builds a current, provider-diverse critic queue', () => {
    expect(rankSocialOpenRouterModels(catalog, 'critic')).toEqual([
      'openai/gpt-5.6-terra',
      '~anthropic/claude-sonnet-latest',
      'deepseek/deepseek-v4-pro',
      'qwen/qwen3.7-max',
    ]);
  });

  it('skips OpenAI instead of falling back to Sol when standard Terra is absent', () => {
    const withoutTerra = catalog.filter((entry) => !/-terra$/.test(entry.id));
    const ranked = rankSocialOpenRouterModels(withoutTerra, 'critic');
    expect(ranked[0]).toBe('~anthropic/claude-sonnet-latest');
    expect(ranked).not.toContain('~openai/gpt-latest');
    expect(ranked.some((id) => id.includes('sol'))).toBe(false);
  });

  it('selects an efficient current model for the writer fallback', () => {
    const ranked = rankSocialOpenRouterModels(catalog, 'writer');
    expect(ranked[0]).toBe('~openai/gpt-mini-latest');
    expect(ranked).not.toContain('openai/gpt-4o');
  });
});

describe('rankLocalModelIds', () => {
  it('selects the newest and largest installed local text model first', () => {
    expect(
      rankLocalModelIds([
        'qwen3:30b-a3b',
        'qwen3.6:27b',
        'qwen3.6:35b-a3b-q4_K_M',
        'nomic-embed-text:latest',
      ]),
    ).toEqual(['qwen3.6:35b-a3b-q4_K_M', 'qwen3.6:27b', 'qwen3:30b-a3b']);
  });
});

describe('generateSocialJson', () => {
  it('falls back to the next provider and records the successful model', async () => {
    const openrouter = vi.fn(async () => {
      throw new Error('429');
    });
    const gemini = vi.fn(async () => ({
      text: '{"score":97,"flags":[]}',
      model: 'gemini-3.5-flash',
    }));
    const parse = (raw: string) => JSON.parse(raw) as { score: number; flags: string[] };

    const result = await generateSocialJson('critic', 'audit', parse, {
      env: { SOCIAL_CRITIC_PROVIDER_ORDER: 'openrouter,gemini' },
      deps: {
        generators: { openrouter, gemini } as never,
      },
    });

    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-3.5-flash');
    expect(result.fallbackUsed).toBe(true);
    expect(result.attempts.map((attempt) => attempt.status)).toEqual(['failed', 'success']);
  });

  it('treats schema-invalid output as a failed attempt', async () => {
    const parse = (raw: string) => {
      const value = JSON.parse(raw) as { text?: unknown };
      if (typeof value.text !== 'string') throw new SyntaxError('missing text');
      return value.text;
    };
    const result = await generateSocialJson('writer', 'write', parse, {
      env: { SOCIAL_WRITER_PROVIDER_ORDER: 'gemini,openrouter' },
      deps: {
        generators: {
          gemini: vi.fn(async () => ({ text: '{}', model: 'gemini-3.5-flash' })),
          openrouter: vi.fn(async () => ({
            text: '{"text":"ready"}',
            model: '~openai/gpt-mini-latest',
          })),
        } as never,
      },
    });
    expect(result.value).toBe('ready');
    expect(result.provider).toBe('openrouter');
  });

  it('preserves model-level fallback metadata from a provider queue', async () => {
    const result = await generateSocialJson('writer', 'write', JSON.parse, {
      env: { SOCIAL_WRITER_PROVIDER_ORDER: 'gemini' },
      deps: {
        generators: {
          gemini: vi.fn(async () => ({
            text: '{"text":"ready"}',
            model: 'gemini-3.1-flash-lite',
            fallbackUsed: true,
          })),
        } as never,
      },
    });
    expect(result.fallbackUsed).toBe(true);
  });

  it('ignores excludeProviders rather than leaving zero candidates', async () => {
    // If the writer already used the only other configured provider, forcing the
    // critic to avoid it too would guarantee failure. Falling back to the same
    // provider is preferable to no critic opinion at all.
    const gemini = vi.fn(async () => ({
      text: '{"score":90,"flags":[]}',
      model: 'gemini-3.5-flash',
    }));
    const result = await generateSocialJson(
      'critic',
      'audit',
      (raw) => JSON.parse(raw) as { score: number; flags: string[] },
      {
        env: { SOCIAL_CRITIC_PROVIDER_ORDER: 'gemini' },
        excludeProviders: ['gemini'],
        deps: { generators: { gemini } as never },
      },
    );
    expect(result.provider).toBe('gemini');
    expect(gemini).toHaveBeenCalledTimes(1);
  });

  it('retries an excluded provider once every independent one has also failed', async () => {
    // Writer already used openrouter, so critic prefers gemini for independence.
    // Gemini is globally out of quota today -- if openrouter (the excluded,
    // shared provider) is otherwise healthy, the critic should still get an
    // opinion instead of failing solely because its first choice is down.
    const gemini = vi.fn(async () => {
      throw new Error('429 quota exceeded');
    });
    const openrouter = vi.fn(async () => ({
      text: '{"score":85,"flags":[]}',
      model: 'qwen/qwen3.7-flash',
    }));
    const result = await generateSocialJson(
      'critic',
      'audit',
      (raw) => JSON.parse(raw) as { score: number; flags: string[] },
      {
        env: { SOCIAL_CRITIC_PROVIDER_ORDER: 'openrouter,gemini' },
        excludeProviders: ['openrouter'],
        deps: { generators: { gemini, openrouter } as never },
      },
    );
    expect(result.provider).toBe('openrouter');
    expect(result.attempts.map((attempt) => attempt.provider)).toEqual(['gemini', 'openrouter']);
    expect(gemini).toHaveBeenCalledTimes(1);
    expect(openrouter).toHaveBeenCalledTimes(1);
  });
});

// --- Phase 5: real (non-injected) OpenRouter path, migrated onto the registry's http-provider adapter ---

describe('generateSocialJson real OpenRouter path (Phase 5)', () => {
  afterEach(() => {
    vi.mocked(generateWithOpenRouterChain).mockReset();
    vi.mocked(loadProviderRegistry).mockClear();
  });

  const catalogModel = (id: string): OpenRouterModelRecord => ({
    id,
    created: 1_784_000_000,
    context_length: 128_000,
    supported_parameters: ['response_format', 'structured_outputs'],
    architecture: { modality: 'text->text' },
    expiration_date: null,
  });

  it('routes the default (no db) writer call through the value-ranked queue, never touching the DB registry', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue({
      text: '{"text":"ready"}',
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash',
      usage: null,
    });

    const result = await generateSocialJson(
      'writer',
      'write',
      (raw) => JSON.parse(raw) as { text: string },
      {
        env: { SOCIAL_WRITER_PROVIDER_ORDER: 'openrouter', OPEN_ROUTER_API_KEY: 'test-key' },
        deps: { fetchOpenRouterModels: async () => [catalogModel('deepseek/deepseek-v4-flash')] },
      },
    );

    expect(result.provider).toBe('openrouter');
    expect(result.value.text).toBe('ready');
    expect(loadProviderRegistry).not.toHaveBeenCalled();
    expect(vi.mocked(generateWithOpenRouterChain).mock.calls[0]?.[1]?.modelQueue).toEqual([
      'deepseek/deepseek-v4-flash',
    ]);
    expect(
      vi
        .mocked(generateWithOpenRouterChain)
        .mock.calls[0]?.[1]?.extraBodyForModel?.('deepseek/deepseek-v4-flash'),
    ).toEqual({
      max_tokens: 4_096,
      reasoning: { effort: 'low', exclude: true },
    });
  });

  it('bounds the live social model queue and allows an explicit one-model budget', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue({
      text: '{"text":"ready"}',
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash',
      usage: null,
    });

    await generateSocialJson('writer', 'write', (raw) => JSON.parse(raw) as { text: string }, {
      env: {
        SOCIAL_WRITER_PROVIDER_ORDER: 'openrouter',
        SOCIAL_OPENROUTER_MODEL_ATTEMPTS: '1',
        OPEN_ROUTER_API_KEY: 'test-key',
      },
      deps: {
        fetchOpenRouterModels: async () => [
          catalogModel('deepseek/deepseek-v4-flash'),
          catalogModel('qwen/qwen3.7-flash'),
          catalogModel('~openai/gpt-mini-latest'),
        ],
      },
    });

    expect(vi.mocked(generateWithOpenRouterChain).mock.calls[0]?.[1]?.modelQueue).toEqual([
      '~openai/gpt-mini-latest',
    ]);
  });

  it('routes through an owner-configured DB HTTP provider (e.g. NIM) for social.critic instead of the value-ranked default when db is supplied', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue({
      text: '{"score":90,"flags":[]}',
      provider: 'openrouter',
      model: 'deepseek-ai/deepseek-v4-pro',
      usage: null,
    });
    vi.mocked(loadProviderRegistry).mockResolvedValue({
      chainForRole: (role) =>
        role === 'social.critic'
          ? [
              {
                entry: { kind: 'http', id: 'nim' },
                http: {
                  id: 'nim',
                  apiKey: 'nim-key',
                  baseUrl: 'https://integrate.api.nvidia.com/v1',
                  modelQueue: ['deepseek-ai/deepseek-v4-pro'],
                },
              },
            ]
          : [],
    });
    const fetchOpenRouterModelsMock = vi.fn();
    const fakeDb = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { chain: [{ kind: 'http', id: 'nim' }] },
              error: null,
            })),
          })),
        })),
      })),
    } as never;

    const result = await generateSocialJson(
      'critic',
      'audit',
      (raw) => JSON.parse(raw) as { score: number; flags: string[] },
      {
        env: { SOCIAL_CRITIC_PROVIDER_ORDER: 'openrouter' },
        deps: { fetchOpenRouterModels: fetchOpenRouterModelsMock },
        db: fakeDb,
      },
    );

    // Stable slot name -- see resolveSocialDbHttpProvider's doc comment.
    expect(result.provider).toBe('openrouter');
    expect(result.value.score).toBe(90);
    expect(fetchOpenRouterModelsMock).not.toHaveBeenCalled();
    expect(vi.mocked(generateWithOpenRouterChain).mock.calls[0]?.[1]?.apiKey).toBe('nim-key');
    expect(vi.mocked(generateWithOpenRouterChain).mock.calls[0]?.[1]?.modelQueue).toEqual([
      'deepseek-ai/deepseek-v4-pro',
    ]);
    expect(
      vi
        .mocked(generateWithOpenRouterChain)
        .mock.calls[0]?.[1]?.extraBodyForModel?.('deepseek-ai/deepseek-v4-pro'),
    ).toEqual({
      max_tokens: 2_048,
      reasoning: { effort: 'low', exclude: true },
    });
  });

  it('does not mistake the registry default chain for an owner DB override', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue({
      text: '{"text":"ready"}',
      provider: 'openrouter',
      model: '~openai/gpt-mini-latest',
      usage: null,
    });
    vi.mocked(loadProviderRegistry).mockResolvedValue({
      chainForRole: () => [
        {
          entry: { kind: 'http', id: 'openrouter' },
          http: {
            id: 'openrouter',
            apiKey: 'test-key',
            baseUrl: 'https://openrouter.ai/api/v1',
            modelQueue: ['deepseek/deepseek-v4-pro'],
          },
        },
      ],
    });
    const fakeDb = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
    } as never;

    await generateSocialJson('writer', 'write', (raw) => JSON.parse(raw) as { text: string }, {
      env: { SOCIAL_WRITER_PROVIDER_ORDER: 'openrouter', OPEN_ROUTER_API_KEY: 'test-key' },
      deps: {
        fetchOpenRouterModels: async () => [
          catalogModel('~openai/gpt-mini-latest'),
          catalogModel('deepseek/deepseek-v4-flash'),
        ],
      },
      db: fakeDb,
    });

    expect(loadProviderRegistry).not.toHaveBeenCalled();
    expect(vi.mocked(generateWithOpenRouterChain).mock.calls[0]?.[1]?.modelQueue).toEqual([
      '~openai/gpt-mini-latest',
      'deepseek/deepseek-v4-flash',
    ]);
  });
});
