import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateWithOpenRouterChain,
  resolveOpenRouterApiKey,
  resolveOpenRouterMaxTokens,
  parseChatCompletionUsage,
} from './openrouter-summarize';
import { consumeFreeModelSlot, resetFreeModelRateLimiter } from './openrouter-free-limiter';
import { OpenRouterLimitError, OpenRouterLimitKind } from './openrouter-errors';
import { OpenRouterStallError } from './openrouter-adaptive';
import { OpenRouterIncompleteJsonError } from './openrouter-brief-json';

const VALID_JSON = JSON.stringify({
  title_en: 'AI Brief',
  title_uk: 'AI Бриф',
  intro_en: 'Today.',
  intro_uk: 'Сьогодні.',
  items: [{ ref: 1, category_slug: 'models', title_en: 'Test', title_uk: 'Тест',
    summary_en: 'Summary.', summary_uk: 'Підсумок.',
    why_matters_en: '', why_matters_uk: '', deep_dive_en: '', deep_dive_uk: '',
    takeaways_en: [], takeaways_uk: [], tools_mentioned: [] }],
});

describe('resolveOpenRouterApiKey', () => {
  it('returns OPEN_ROUTER_API_KEY when set', () => {
    expect(resolveOpenRouterApiKey({ OPEN_ROUTER_API_KEY: 'sk-abc' })).toBe('sk-abc');
  });

  it('falls back to OPENROUTER_API_KEY', () => {
    expect(resolveOpenRouterApiKey({ OPENROUTER_API_KEY: 'sk-xyz' })).toBe('sk-xyz');
  });

  it('prefers OPEN_ROUTER_API_KEY over OPENROUTER_API_KEY', () => {
    expect(
      resolveOpenRouterApiKey({ OPEN_ROUTER_API_KEY: 'sk-primary', OPENROUTER_API_KEY: 'sk-fallback' }),
    ).toBe('sk-primary');
  });

  it('returns null when both are missing', () => {
    expect(resolveOpenRouterApiKey({})).toBeNull();
  });

  it('returns null for blank strings', () => {
    expect(resolveOpenRouterApiKey({ OPEN_ROUTER_API_KEY: '   ' })).toBeNull();
  });
});

describe('parseChatCompletionUsage', () => {
  it('extracts real billed cost when the provider reports it', () => {
    expect(
      parseChatCompletionUsage({
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        cost: 0.4321,
      }),
    ).toEqual({ promptTokens: 100, completionTokens: 50, totalTokens: 150, costUsd: 0.4321 });
  });

  it('returns null when cost is missing (no real usage reported)', () => {
    expect(parseChatCompletionUsage({ prompt_tokens: 100 })).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(parseChatCompletionUsage(undefined)).toBeNull();
    expect(parseChatCompletionUsage(null)).toBeNull();
  });
});

describe('resolveOpenRouterMaxTokens', () => {
  it('uses a credit-safe default that still exceeds observed master output', () => {
    expect(resolveOpenRouterMaxTokens({})).toBe(32768);
  });

  it('accepts a positive override and rejects invalid values', () => {
    expect(resolveOpenRouterMaxTokens({ OPENROUTER_MAX_TOKENS: '24000' })).toBe(24000);
    expect(resolveOpenRouterMaxTokens({ OPENROUTER_MAX_TOKENS: 'invalid' })).toBe(32768);
  });
});

describe('generateWithOpenRouterChain', () => {
  const mockCallModel = vi.fn<(key: string, modelId: string, p: string) => Promise<string>>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns result from first successful model', async () => {
    mockCallModel.mockResolvedValueOnce(VALID_JSON);
    const result = await generateWithOpenRouterChain('prompt', {
      apiKey: 'sk-test',
      modelQueue: ['deepseek/v4-pro', 'qwen/qwen3'],
      callModel: mockCallModel,
    });
    expect(result.provider).toBe('openrouter');
    expect(result.model).toBe('deepseek/v4-pro');
    expect(result.text).toBe(VALID_JSON);
    expect(mockCallModel).toHaveBeenCalledTimes(1);
  });

  it('skips first model on OpenRouterLimitError and uses second', async () => {
    mockCallModel.mockRejectedValueOnce(
      new OpenRouterLimitError(OpenRouterLimitKind.rate_limit, 'deepseek/v4-pro', 'rate limited'),
    );
    mockCallModel.mockResolvedValueOnce(VALID_JSON);
    const result = await generateWithOpenRouterChain('prompt', {
      apiKey: 'sk-test',
      modelQueue: ['deepseek/v4-pro', 'qwen/qwen3'],
      callModel: mockCallModel,
    });
    expect(result.model).toBe('qwen/qwen3');
    expect(mockCallModel).toHaveBeenCalledTimes(2);
  });

  it('skips model on OpenRouterIncompleteJsonError and tries next', async () => {
    mockCallModel.mockRejectedValueOnce(
      new OpenRouterIncompleteJsonError('deepseek/v4-pro', 100, 'items missing'),
    );
    mockCallModel.mockResolvedValueOnce(VALID_JSON);
    const result = await generateWithOpenRouterChain('prompt', {
      apiKey: 'sk-test',
      modelQueue: ['deepseek/v4-pro', 'qwen/qwen3'],
      callModel: mockCallModel,
    });
    expect(result.model).toBe('qwen/qwen3');
  });

  it('skips model on OpenRouterStallError and tries next', async () => {
    mockCallModel.mockRejectedValueOnce(
      new OpenRouterStallError('idle', 'deepseek/v4-pro', 'idle 50s'),
    );
    mockCallModel.mockResolvedValueOnce(VALID_JSON);
    const result = await generateWithOpenRouterChain('prompt', {
      apiKey: 'sk-test',
      modelQueue: ['deepseek/v4-pro', 'qwen/qwen3'],
      callModel: mockCallModel,
    });
    expect(result.model).toBe('qwen/qwen3');
  });

  it('throws after all models fail', async () => {
    mockCallModel.mockRejectedValue(new Error('all failed'));
    await expect(
      generateWithOpenRouterChain('prompt', {
        apiKey: 'sk-test',
        modelQueue: ['model-a', 'model-b'],
        callModel: mockCallModel,
      }),
    ).rejects.toThrow();
    expect(mockCallModel).toHaveBeenCalledTimes(2);
  });

  it('throws immediately when apiKey is missing', async () => {
    await expect(
      generateWithOpenRouterChain('prompt', {
        apiKey: undefined,
        modelQueue: ['model-a'],
        callModel: mockCallModel,
      }),
    ).rejects.toThrow('OPEN_ROUTER_API_KEY');
    expect(mockCallModel).not.toHaveBeenCalled();
  });

  it('uses custom resolveQueue when modelQueue not provided', async () => {
    mockCallModel.mockResolvedValueOnce(VALID_JSON);
    const resolveQueue = vi.fn(async () => ['custom/model']);
    const result = await generateWithOpenRouterChain('prompt', {
      apiKey: 'sk-test',
      resolveQueue,
      callModel: mockCallModel,
    });
    expect(resolveQueue).toHaveBeenCalledWith('sk-test');
    expect(result.model).toBe('custom/model');
  });

  it('includes credits hint in error when insufficient_credits', async () => {
    mockCallModel.mockRejectedValue(
      new OpenRouterLimitError(
        OpenRouterLimitKind.insufficient_credits,
        'model-a',
        'no credits',
      ),
    );
    await expect(
      generateWithOpenRouterChain('prompt', {
        apiKey: 'sk-test',
        modelQueue: ['model-a'],
        callModel: mockCallModel,
      }),
    ).rejects.toThrow(/credit/i);
  });

  it('skips a :free model when the account-wide 20/min limiter is full', async () => {
    resetFreeModelRateLimiter();
    const now = Date.now();
    while (consumeFreeModelSlot(now)) {
      /* fill the window */
    }

    mockCallModel.mockResolvedValueOnce(VALID_JSON);
    const result = await generateWithOpenRouterChain('prompt', {
      apiKey: 'sk-test',
      modelQueue: ['vendor/model:free', 'vendor/paid'],
      callModel: mockCallModel,
    });
    expect(result.model).toBe('vendor/paid');
    expect(mockCallModel).toHaveBeenCalledTimes(1);
    expect(mockCallModel).toHaveBeenCalledWith('sk-test', 'vendor/paid', 'prompt', 1);
    resetFreeModelRateLimiter();
  });
});

describe('generateWithOpenRouterChain truncation retry', () => {
  // Regression: a cut-off answer used to drop the queue onto the next model.
  // On 2026-08-28 a writer call was cut off for $0.025 and the fallback that
  // caught it cost $0.34 for the same prompt.
  const truncated = (modelId: string) =>
    new OpenRouterIncompleteJsonError(modelId, 120, 'truncated', 'length');

  it('retries the same model once with a wider budget before advancing', async () => {
    const seen: Array<{ model: string; attempt: number }> = [];
    const callModel = vi.fn(async (_k: string, model: string, _p: string, attempt = 1) => {
      seen.push({ model, attempt });
      if (model === 'm1' && attempt === 1) throw truncated('m1');
      return '{"ok":true}';
    });

    const result = await generateWithOpenRouterChain('prompt', {
      apiKey: 'sk-test',
      modelQueue: ['m1', 'm2'],
      callModel,
      validateResponse: (_m, text) => text,
      extraBodyForModel: (_m, attempt) => ({ max_tokens: attempt > 1 ? 8_192 : 4_096 }),
      retryTruncatedOnce: true,
    });

    expect(seen).toEqual([
      { model: 'm1', attempt: 1 },
      { model: 'm1', attempt: 2 },
    ]);
    expect(result.model).toBe('m1');
  });

  it('advances to the next model when the wider retry is also cut off', async () => {
    const seen: string[] = [];
    const callModel = vi.fn(async (_k: string, model: string, _p: string, attempt = 1) => {
      seen.push(`${model}#${attempt}`);
      if (model === 'm1') throw truncated('m1');
      return '{"ok":true}';
    });

    const result = await generateWithOpenRouterChain('prompt', {
      apiKey: 'sk-test',
      modelQueue: ['m1', 'm2'],
      callModel,
      validateResponse: (_m, text) => text,
      retryTruncatedOnce: true,
    });

    expect(seen).toEqual(['m1#1', 'm1#2', 'm2#1']);
    expect(result.model).toBe('m2');
  });

  it('does not retry when the caller has not opted in', async () => {
    const seen: string[] = [];
    const callModel = vi.fn(async (_k: string, model: string, _p: string, attempt = 1) => {
      seen.push(`${model}#${attempt}`);
      if (model === 'm1') throw truncated('m1');
      return '{"ok":true}';
    });

    await generateWithOpenRouterChain('prompt', {
      apiKey: 'sk-test',
      modelQueue: ['m1', 'm2'],
      callModel,
      validateResponse: (_m, text) => text,
    });

    expect(seen).toEqual(['m1#1', 'm2#1']);
  });

  it('never mutates the queue array it was handed', async () => {
    const queue = ['m1', 'm2'];
    const callModel = vi.fn(async (_k: string, model: string, _p: string, attempt = 1) => {
      if (model === 'm1' && attempt === 1) throw truncated('m1');
      return '{"ok":true}';
    });

    await generateWithOpenRouterChain('prompt', {
      apiKey: 'sk-test',
      modelQueue: queue,
      callModel,
      validateResponse: (_m, text) => text,
      retryTruncatedOnce: true,
    });

    expect(queue).toEqual(['m1', 'm2']);
  });
});
