import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../openrouter-summarize', () => ({
  generateWithOpenRouterChain: vi.fn(),
}));

import { generateWithOpenRouterChain } from '../openrouter-summarize';
import {
  generateWithHttpProviderChain,
  NIM_HTTP_DEFAULTS,
  OPENROUTER_HTTP_DEFAULTS,
} from './http-provider';

afterEach(() => {
  vi.mocked(generateWithOpenRouterChain).mockReset();
});

function mockChainResult(overrides: Partial<Awaited<ReturnType<typeof generateWithOpenRouterChain>>> = {}) {
  return {
    text: 'hello',
    provider: 'openrouter' as const,
    model: 'vendor/model',
    usage: null,
    ...overrides,
  };
}

describe('generateWithHttpProviderChain', () => {
  it('appends /chat/completions to the configured base URL and forwards the API key/model queue', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue(mockChainResult());

    await generateWithHttpProviderChain('prompt', {
      id: 'nim',
      apiKey: 'nvapi-test',
      modelQueue: ['moonshotai/kimi-k3', 'deepseek-ai/deepseek-v4'],
      ...NIM_HTTP_DEFAULTS,
    });

    expect(generateWithOpenRouterChain).toHaveBeenCalledWith(
      'prompt',
      expect.objectContaining({
        apiKey: 'nvapi-test',
        modelQueue: ['moonshotai/kimi-k3', 'deepseek-ai/deepseek-v4'],
        requestConfig: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', headers: undefined },
      }),
    );
  });

  it('strips trailing slashes from the base URL before appending the path', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue(mockChainResult());

    await generateWithHttpProviderChain('prompt', {
      id: 'nim',
      apiKey: 'k',
      modelQueue: ['m'],
      baseUrl: 'https://integrate.api.nvidia.com/v1/',
    });

    expect(generateWithOpenRouterChain).toHaveBeenCalledWith(
      'prompt',
      expect.objectContaining({
        requestConfig: expect.objectContaining({ url: 'https://integrate.api.nvidia.com/v1/chat/completions' }),
      }),
    );
  });

  it('normalizes the result into ProviderCallResult, tagging the provider id (not always "openrouter")', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue(
      mockChainResult({
        model: 'moonshotai/kimi-k3',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30, costUsd: 0.05 },
      }),
    );

    const result = await generateWithHttpProviderChain('prompt', {
      id: 'nim',
      apiKey: 'k',
      modelQueue: ['moonshotai/kimi-k3'],
      ...NIM_HTTP_DEFAULTS,
    });

    expect(result.provider).toBe('nim');
    expect(result.model).toBe('moonshotai/kimi-k3');
    // NIM doesn't report real cost (reportsCost: false) -- even though the
    // mocked upstream result carries a costUsd, it must not leak through.
    expect(result.usage.costUsd).toBeNull();
    expect(result.usage.costSource).toBe('estimated');
    expect(result.usage.promptTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(20);
  });

  it('passes real reported cost through when reportsCost is true (OpenRouter)', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue(
      mockChainResult({
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30, costUsd: 0.05 },
      }),
    );

    const result = await generateWithHttpProviderChain('prompt', {
      id: 'openrouter',
      apiKey: 'k',
      modelQueue: ['vendor/model'],
      ...OPENROUTER_HTTP_DEFAULTS,
    });

    expect(result.usage.costUsd).toBe(0.05);
    expect(result.usage.costSource).toBe('reported');
  });

  it('defaults to a generic pass-through validator, not the brief-JSON one', async () => {
    vi.mocked(generateWithOpenRouterChain).mockImplementation(async (_prompt, options) => {
      // Exercise the validator the same way the real chain would.
      const validated = options?.validateResponse?.('vendor/model', '  plain text, not JSON  ', null);
      return mockChainResult({ text: validated ?? '' });
    });

    const result = await generateWithHttpProviderChain('prompt', {
      id: 'nim',
      apiKey: 'k',
      modelQueue: ['m'],
      baseUrl: 'https://integrate.api.nvidia.com/v1',
    });

    expect(result.text).toBe('plain text, not JSON');
  });

  it('omits the usage field entirely for a provider that does not report cost -- regression test for the live NIM finding (2026-08-06)', async () => {
    // NVIDIA NIM validates request bodies strictly and returns HTTP 400
    // "Unsupported parameter(s): `usage`" for any request carrying OpenRouter's
    // `usage: { include: true }` field -- unlike OpenRouter itself, it does not
    // silently ignore unknown top-level params. reportsCost: false must
    // suppress the field entirely (as `undefined`, so JSON.stringify drops the
    // key), not merely ignore the field in the response.
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue(mockChainResult());

    await generateWithHttpProviderChain('prompt', {
      id: 'nim',
      apiKey: 'k',
      modelQueue: ['m'],
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      reportsCost: false,
    });

    const call = vi.mocked(generateWithOpenRouterChain).mock.calls[0]!;
    const extraBody = call[1]?.extraBodyForModel?.('m');
    expect(extraBody).toHaveProperty('usage', undefined);
    expect(JSON.stringify(extraBody)).not.toContain('usage');
  });

  it('leaves usage alone for a provider that does report cost (OpenRouter)', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue(mockChainResult());

    await generateWithHttpProviderChain('prompt', {
      id: 'openrouter',
      apiKey: 'k',
      modelQueue: ['m'],
      ...OPENROUTER_HTTP_DEFAULTS,
    });

    const call = vi.mocked(generateWithOpenRouterChain).mock.calls[0]!;
    const extraBody = call[1]?.extraBodyForModel?.('m');
    expect(extraBody).toBeUndefined();
  });

  it('preserves a caller-supplied extraBodyForModel alongside the usage suppression', async () => {
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue(mockChainResult());

    await generateWithHttpProviderChain(
      'prompt',
      { id: 'nim', apiKey: 'k', modelQueue: ['m'], baseUrl: 'https://integrate.api.nvidia.com/v1' },
      { extraBodyForModel: () => ({ reasoning: { effort: 'low' } }) },
    );

    const call = vi.mocked(generateWithOpenRouterChain).mock.calls[0]!;
    const extraBody = call[1]?.extraBodyForModel?.('m');
    expect(extraBody).toMatchObject({ reasoning: { effort: 'low' } });
    expect(extraBody).toHaveProperty('usage', undefined);
  });
});
