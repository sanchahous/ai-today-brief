import { describe, expect, it, vi, afterEach } from 'vitest';
import { generateWithVision, isVisionProviderRole } from './vision';
import { ProviderUnavailableError } from './types';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isVisionProviderRole', () => {
  it('recognises weekly and daily image critic roles', () => {
    expect(isVisionProviderRole('weekly.image_critic')).toBe(true);
    expect(isVisionProviderRole('daily.image_critic')).toBe(true);
    expect(isVisionProviderRole('weekly.master_writer')).toBe(false);
  });
});

describe('generateWithVision', () => {
  it('throws ProviderUnavailableError when no keys are configured', async () => {
    await expect(
      generateWithVision(
        'weekly.image_critic',
        { prompt: 'rate', imageBytes: Buffer.from('abc') },
        {},
      ),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it('returns Gemini text when the API responds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"overall":90,"blockers":[]}' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
        }),
      })),
    );
    const result = await generateWithVision(
      'weekly.image_critic',
      { prompt: 'rate this', imageBytes: Buffer.from('fake') },
      { GEMINI_API_KEY: 'test-key' },
    );
    expect(result.provider).toBe('gemini');
    expect(result.text).toContain('overall');
  });

  it('falls back to OpenRouter when Gemini fails', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('generativelanguage')) {
        return { ok: false, status: 500, text: async () => 'boom' };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"overall":70,"blockers":[]}' } }],
          model: 'google/gemini-2.5-flash',
          usage: { prompt_tokens: 1, completion_tokens: 2, cost: 0.002 },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await generateWithVision(
      'daily.image_critic',
      { prompt: 'rate', imageBytes: Buffer.from('x') },
      { GEMINI_API_KEY: 'g', OPEN_ROUTER_API_KEY: 'or' },
    );
    expect(result.provider).toBe('openrouter');
    expect(result.usage.costSource).toBe('reported');
  });
});
