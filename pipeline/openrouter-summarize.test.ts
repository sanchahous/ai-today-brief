import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateWithOpenRouterChain,
  resolveOpenRouterApiKey,
} from './openrouter-summarize';
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

  it('uses first model from queue only (does not re-call after success)', async () => {
    mockCallModel.mockResolvedValue(VALID_JSON);
    await generateWithOpenRouterChain('prompt', {
      apiKey: 'sk-test',
      modelQueue: ['m1', 'm2', 'm3'],
      callModel: mockCallModel,
    });
    expect(mockCallModel).toHaveBeenCalledTimes(1);
    expect(mockCallModel).toHaveBeenCalledWith('sk-test', 'm1', 'prompt');
  });
});
