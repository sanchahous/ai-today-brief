import { describe, expect, it, vi } from 'vitest';

vi.mock('../gemini-models', () => ({
  resolveGeminiModelQueue: vi.fn(),
}));
vi.mock('../summarize', () => ({
  generateWithModelQueue: vi.fn(),
}));

import { resolveGeminiModelQueue } from '../gemini-models';
import { generateWithModelQueue } from '../summarize';
import { generateWithGemini } from './gemini-provider';
import { ProviderUnavailableError } from './types';

describe('generateWithGemini', () => {
  it('throws ProviderUnavailableError when no API key is configured', async () => {
    await expect(generateWithGemini('prompt', { apiKey: '' })).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('resolves the model queue then normalizes the result into ProviderCallResult', async () => {
    vi.mocked(resolveGeminiModelQueue).mockResolvedValue(['gemini-3.5-flash', 'gemini-3.5-pro']);
    vi.mocked(generateWithModelQueue).mockResolvedValue({
      text: 'hello from gemini',
      model: 'gemini-3.5-pro',
      usage: { promptTokens: 100, outputTokens: 50, estimated: false },
    });

    const result = await generateWithGemini('prompt', { apiKey: 'key-123' });

    expect(result).toEqual({
      text: 'hello from gemini',
      provider: 'gemini',
      model: 'gemini-3.5-pro',
      usage: { promptTokens: 100, outputTokens: 50, costUsd: null, costSource: 'estimated' },
    });
    expect(generateWithModelQueue).toHaveBeenCalledWith(
      'prompt',
      'key-123',
      ['gemini-3.5-flash', 'gemini-3.5-pro'],
      2,
      undefined,
      undefined,
      undefined,
    );
  });

  it('defaults maxModelAttempts to 2 but respects an explicit override', async () => {
    vi.mocked(resolveGeminiModelQueue).mockResolvedValue(['gemini-3.5-flash']);
    vi.mocked(generateWithModelQueue).mockResolvedValue({
      text: 'ok',
      model: 'gemini-3.5-flash',
      usage: null,
    });

    await generateWithGemini('prompt', { apiKey: 'key', maxModelAttempts: 5 });

    expect(generateWithModelQueue).toHaveBeenCalledWith(
      'prompt',
      'key',
      ['gemini-3.5-flash'],
      5,
      undefined,
      undefined,
      undefined,
    );
  });
});
