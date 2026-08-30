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
  DEFAULT_SOCIAL_MAX_PRICE_PER_MILLION,
  generateSocialJson,
  rankLocalModelIds,
  rankSocialOpenRouterModels,
  resolveSocialMaxPricePerMillion,
  resolveSocialProviderOrder,
  socialBlendedPricePerMillion,
} from './llm-router';
import { generateWithOpenRouterChain } from '../../../pipeline/openrouter-summarize';
import { loadProviderRegistry } from '../../../pipeline/providers/registry';
import type { OpenRouterModelRecord } from '../../../pipeline/openrouter-models';

/** Catalog prices are per-token strings, exactly as OpenRouter serves them. */
function priced(promptPerM: number, completionPerM: number) {
  return { prompt: String(promptPerM / 1_000_000), completion: String(completionPerM / 1_000_000) };
}

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
    // A cheap default keeps every unrelated fixture inside the price ceiling;
    // tests that care about price pass an explicit `pricing`.
    pricing: priced(0.5, 1.5),
    ...overrides,
  };
}

function scored(
  id: string,
  intelligence: number,
  created: number,
  overrides: Partial<OpenRouterModelRecord> = {},
): OpenRouterModelRecord {
  return model(id, created, {
    benchmarks: { artificial_analysis: { intelligence_index: intelligence } },
    ...overrides,
  });
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
    scored('~openai/gpt-latest', 60, now - 1_000),
    scored('~openai/gpt-mini-latest', 55, now - 900),
    scored('openai/gpt-5.6-terra-pro', 45, now - 450),
    scored('openai/gpt-5.6-terra', 48, now - 500),
    scored('openai/gpt-5.5-terra', 40, now - 10_000),
    scored('openai/gpt-4o', 15, now - 50_000_000),
    scored('~anthropic/claude-sonnet-latest', 50, now - 2_000),
    scored('anthropic/claude-sonnet-4.5', 42, now - 2_100),
    scored('deepseek/deepseek-v4-pro', 38, now - 3_000),
    scored('deepseek/deepseek-v4-flash', 36, now - 2_900),
    scored('qwen/qwen3.7-max', 35, now - 2_800),
    scored('vendor/model:free', 32, now - 100, { pricing: priced(0, 0) }),
    scored('openai/gpt-coder-latest', 25, now - 50),
  ];

  it('builds a quality-ranked, family-diverse critic queue and drops aliases', () => {
    expect(rankSocialOpenRouterModels(catalog, 'critic')).toEqual([
      'openai/gpt-5.6-terra',
      'anthropic/claude-sonnet-4.5',
      'deepseek/deepseek-v4-pro',
      'qwen/qwen3.7-max',
      'vendor/model:free',
    ]);
  });

  it('does not fall back to an OpenAI alias when the scored OpenAI ids are gone', () => {
    const withoutOpenai = catalog.filter(
      (entry) => !entry.id.replace(/^~/, '').startsWith('openai/'),
    );
    const ranked = rankSocialOpenRouterModels(withoutOpenai, 'critic');
    expect(ranked[0]).toBe('anthropic/claude-sonnet-4.5');
    expect(ranked.some((id) => id.startsWith('~'))).toBe(false);
    expect(ranked.some((id) => id.includes('sol'))).toBe(false);
  });

  it('selects the highest-quality in-ceiling model for the writer, not a ~alias', () => {
    const ranked = rankSocialOpenRouterModels(catalog, 'writer');
    expect(ranked[0]).toBe('openai/gpt-5.6-terra');
    expect(ranked).not.toContain('~openai/gpt-mini-latest');
    expect(ranked).not.toContain('openai/gpt-4o');
  });

  // Regression: the anthropic writer lane was ~anthropic/claude-fable-latest
  // ($10/M in, $50/M out) purely because the `~*-latest` bonus tied with
  // sonnet-latest and `created` broke the tie. Twelve of those calls were
  // $4.66 of a $9.16 two-day OpenRouter bill (2026-08-28).
  it('keeps the priciest frontier alias out of the queue entirely', () => {
    const withFable = [
      ...catalog,
      scored('~anthropic/claude-fable-latest', 70, now - 100, { pricing: priced(10, 50) }),
    ];

    for (const role of ['writer', 'critic'] as const) {
      const ranked = rankSocialOpenRouterModels(withFable, role);
      expect(ranked).not.toContain('~anthropic/claude-fable-latest');
      expect(ranked).toContain('anthropic/claude-sonnet-4.5');
    }
  });

  it('prefers the cheaper sibling when two models tie on quality', () => {
    const twins = [
      scored('deepseek/deepseek-v4-pro', 40, now - 3_000, { pricing: priced(2.0, 6.0) }),
      scored('deepseek/deepseek-v4.1-pro', 40, now - 3_000, { pricing: priced(0.2, 0.6) }),
    ];
    expect(rankSocialOpenRouterModels(twins, 'critic')).toEqual(['deepseek/deepseek-v4.1-pro']);
  });

  it('drops a model that publishes no price rather than assuming it is free', () => {
    const unpriced = [scored('deepseek/deepseek-v4-pro', 40, now - 3_000, { pricing: undefined })];
    expect(rankSocialOpenRouterModels(unpriced, 'writer')).toEqual([]);
  });

  it('honours an owner-set ceiling', () => {
    // Every paid catalog fixture blends to $0.60/M, so a $0.40 ceiling clears them all.
    const ranked = rankSocialOpenRouterModels(catalog, 'critic', 0.4);
    expect(ranked).toEqual(['vendor/model:free']);
    expect(resolveSocialMaxPricePerMillion({ SOCIAL_LLM_MAX_PRICE_PER_MILLION: '1.25' })).toBe(1.25);
    expect(resolveSocialMaxPricePerMillion({})).toBe(DEFAULT_SOCIAL_MAX_PRICE_PER_MILLION);
    expect(resolveSocialMaxPricePerMillion({ SOCIAL_LLM_MAX_PRICE_PER_MILLION: 'nonsense' })).toBe(
      DEFAULT_SOCIAL_MAX_PRICE_PER_MILLION,
    );
  });
});

describe('socialBlendedPricePerMillion', () => {
  it('weights the input rate 9:1, matching a prompt-heavy social call', () => {
    expect(socialBlendedPricePerMillion(model('x/y', 1, { pricing: priced(10, 50) }))).toBeCloseTo(
      14,
      6,
    );
    expect(
      socialBlendedPricePerMillion(model('x/y', 1, { pricing: priced(0.75, 4.5) })),
    ).toBeCloseTo(1.125, 6);
  });

  it('returns null for missing or malformed pricing', () => {
    expect(socialBlendedPricePerMillion(model('x/y', 1, { pricing: undefined }))).toBeNull();
    expect(
      socialBlendedPricePerMillion(model('x/y', 1, { pricing: { prompt: 'free', completion: '0' } })),
    ).toBeNull();
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
            model: 'deepseek/deepseek-v4-flash',
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

describe('generateSocialJson cost accounting', () => {
  afterEach(() => {
    vi.mocked(generateWithOpenRouterChain).mockReset();
  });

  const catalog = [
    scored('deepseek/deepseek-v4-flash', 40, 1_784_000_000, { pricing: priced(0.75, 4.5) }),
  ];

  const run = (env: Record<string, string | undefined> = {}) =>
    generateSocialJson('writer', 'write me a post', (raw) => JSON.parse(raw) as { text: string }, {
      env: {
        SOCIAL_WRITER_PROVIDER_ORDER: 'openrouter',
        OPEN_ROUTER_API_KEY: 'test-key',
        ...env,
      },
      deps: { fetchOpenRouterModels: async () => catalog },
    });

  // Regression: the ledger used to rebuild cost from `prompt.length / 4` at a
  // hardcoded $0.3/$1 per M and count only the winning attempt. Against the
  // 2026-08-28 bill that reported $0.65 for a day OpenRouter charged $8.74.
  it('books OpenRouter reported cost for the winner plus every discarded attempt', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue({
      text: '{"text":"ready"}',
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash',
      usage: { promptTokens: 52_324, completionTokens: 1_857, totalTokens: 54_181, costUsd: 0.0475 },
      discardedUsage: [
        { promptTokens: 29_661, completionTokens: 4_096, totalTokens: 33_757, costUsd: 0.5014 },
      ],
    });

    const result = await run();

    expect(result.usage.estimatedCostUsd).toBeCloseTo(0.5489, 6);
    expect(result.usage.promptTokens).toBe(81_985);
    expect(result.usage.outputTokens).toBe(5_953);
  });

  it('prices a token-reporting provider that omits cost at the configured rate', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue({
      text: '{"text":"ready"}',
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash',
      usage: null,
      discardedUsage: [],
    });

    // No usage at all -- falls back to the char heuristic rather than booking $0.
    const result = await run();
    expect(result.usage.estimatedCostUsd).toBeGreaterThan(0);
    expect(result.usage.promptTokens).toBe(Math.ceil('write me a post'.length / 4));
  });
});

// --- Phase 5: real (non-injected) OpenRouter path, migrated onto the registry's http-provider adapter ---

describe('generateSocialJson real OpenRouter path (Phase 5)', () => {
  afterEach(() => {
    vi.mocked(generateWithOpenRouterChain).mockReset();
    vi.mocked(loadProviderRegistry).mockClear();
  });

  const catalogModel = (id: string, intelligence = 40): OpenRouterModelRecord =>
    scored(id, intelligence, 1_784_000_000);

  it('routes the default (no db) writer call through the catalog-ranked queue, never touching the DB registry', async () => {
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
        .mock.calls[0]?.[1]?.extraBodyForModel?.('deepseek/deepseek-v4-flash', 1),
    ).toMatchObject({
      max_tokens: 8_192,
      reasoning: { effort: 'low', exclude: true },
      provider: { sort: 'price' },
    });
    // A cut-off answer re-queues the same model with room to finish rather
    // than dropping to the next, pricier one.
    expect(
      vi.mocked(generateWithOpenRouterChain).mock.calls[0]?.[1]?.retryTruncatedOnce,
    ).toBe(true);
    expect(
      vi
        .mocked(generateWithOpenRouterChain)
        .mock.calls[0]?.[1]?.extraBodyForModel?.('deepseek/deepseek-v4-flash', 2),
    ).toMatchObject({ max_tokens: 16_384 });
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
          catalogModel('deepseek/deepseek-v4-flash', 50),
          catalogModel('qwen/qwen3.7-flash', 40),
          catalogModel('~openai/gpt-mini-latest', 99),
        ],
      },
    });

    expect(vi.mocked(generateWithOpenRouterChain).mock.calls[0]?.[1]?.modelQueue).toEqual([
      'deepseek/deepseek-v4-flash',
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
        .mock.calls[0]?.[1]?.extraBodyForModel?.('deepseek-ai/deepseek-v4-pro', 1),
    ).toMatchObject({
      max_tokens: 6_144,
      reasoning: { effort: 'low', exclude: true },
    });
    expect(
      vi
        .mocked(generateWithOpenRouterChain)
        .mock.calls[0]?.[1]?.extraBodyForModel?.('deepseek-ai/deepseek-v4-pro', 1),
    ).not.toHaveProperty('provider');
  });

  it('does not mistake the registry default chain for an owner DB override', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue({
      text: '{"text":"ready"}',
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash',
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
          catalogModel('~openai/gpt-mini-latest', 99),
          catalogModel('deepseek/deepseek-v4-flash', 40),
        ],
      },
      db: fakeDb,
    });

    expect(loadProviderRegistry).not.toHaveBeenCalled();
    expect(vi.mocked(generateWithOpenRouterChain).mock.calls[0]?.[1]?.modelQueue).toEqual([
      'deepseek/deepseek-v4-flash',
    ]);
  });
});
