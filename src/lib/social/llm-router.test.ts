import { describe, expect, it, vi } from 'vitest';
import {
  generateSocialJson,
  rankLocalModelIds,
  rankSocialOpenRouterModels,
  resolveSocialProviderOrder,
} from './llm-router';
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
    expect(ranked[0]).toBe('deepseek/deepseek-v4-flash');
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
