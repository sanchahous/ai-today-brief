import { SchemaType } from '@google/generative-ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRegistryLoader, generateJsonWithFallback, withGeminiCallConfig } from './llm-json';
import type { GeminiResponseSchema } from './summarize';
import type { ResolvedProvider } from './providers/registry';

vi.mock('./providers/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./providers/registry')>();
  return { ...actual, loadProviderRegistry: vi.fn(), generateWithRegistry: vi.fn() };
});

import { loadProviderRegistry, generateWithRegistry } from './providers/registry';

const SAMPLE_SCHEMA: GeminiResponseSchema = {
  type: SchemaType.OBJECT,
  properties: { ok: { type: SchemaType.BOOLEAN } },
  required: ['ok'],
};

describe('withGeminiCallConfig (Phase 6a/6b: registry migration)', () => {
  const httpEntry: ResolvedProvider = {
    entry: { kind: 'http', id: 'openrouter' },
    http: { id: 'openrouter', apiKey: 'k', baseUrl: 'https://openrouter.ai/api/v1', modelQueue: ['m'] },
  };
  const geminiEntry: ResolvedProvider = {
    entry: { kind: 'gemini', id: 'gemini' },
    gemini: { apiKey: 'g-key' },
  };

  it('attaches the schema to a gemini entry only for the requested role', () => {
    const registry = { chainForRole: () => [geminiEntry, httpEntry] };
    const patched = withGeminiCallConfig('daily.verify', { schema: SAMPLE_SCHEMA }, registry);

    const chain = patched.chainForRole('daily.verify');
    expect(chain[0]?.gemini?.schema).toBe(SAMPLE_SCHEMA);
    expect(chain[0]?.gemini?.apiKey).toBe('g-key');
    expect(chain[1]).toBe(httpEntry);
  });

  it('leaves other roles untouched', () => {
    const registry = { chainForRole: () => [geminiEntry] };
    const patched = withGeminiCallConfig('daily.verify', { schema: SAMPLE_SCHEMA }, registry);

    const chain = patched.chainForRole('daily.summarize');
    expect(chain[0]).toBe(geminiEntry);
    expect(chain[0]?.gemini?.schema).toBeUndefined();
  });

  // run-daily.ts widens the Gemini attempt budget on the day's last slot
  // (geminiMaxAttemptsForSlot -> 3). Phase 6a silently dropped it on the way
  // through the registry, pinning every call to gemini-provider.ts's default.
  it('carries the per-call Gemini attempt budget onto the chain entry', () => {
    const registry = { chainForRole: () => [geminiEntry] };
    const patched = withGeminiCallConfig(
      'daily.verify',
      { schema: SAMPLE_SCHEMA, maxModelAttempts: 3 },
      registry,
    );

    expect(patched.chainForRole('daily.verify')[0]?.gemini?.maxModelAttempts).toBe(3);
  });
});

describe('generateJsonWithFallback (Phase 6a/6b: registry migration)', () => {
  afterEach(() => {
    vi.mocked(loadProviderRegistry).mockReset();
    vi.mocked(generateWithRegistry).mockReset();
  });

  const success = {
    text: '{"ok":true}',
    provider: 'gemini',
    model: 'gemini-3.5-pro',
    usage: { promptTokens: 10, outputTokens: 5, costUsd: null, costSource: 'estimated' as const },
  };

  it('routes through the registry, with the schema patched onto a gemini entry', async () => {
    vi.mocked(loadProviderRegistry).mockResolvedValueOnce({ chainForRole: () => [] });
    vi.mocked(generateWithRegistry).mockResolvedValueOnce(success);

    const result = await generateJsonWithFallback({
      role: 'daily.verify',
      prompt: 'prompt',
      schema: SAMPLE_SCHEMA,
      geminiApiKey: 'g-key',
      geminiMaxAttempts: 2,
      openRouterApiKey: 'or-key',
    });

    expect(loadProviderRegistry).toHaveBeenCalledWith(
      { GEMINI_API_KEY: 'g-key', OPEN_ROUTER_API_KEY: 'or-key' },
      {},
      undefined,
    );
    expect(generateWithRegistry).toHaveBeenCalledWith('daily.verify', 'prompt', expect.anything(), expect.anything());
    expect(result.text).toBe('{"ok":true}');
    expect(result.model).toBe('gemini:gemini-3.5-pro');
    expect(result.usage).toEqual({ promptTokens: 10, outputTokens: 5, estimated: true });
  });

  // auto-publish.ts (Phase 6b) sweeps a week of drafts in one run; rebuilding
  // the registry per draft would re-hit the live OpenRouter catalog each time.
  it('uses a pre-resolved registry instead of building a new one', async () => {
    vi.mocked(generateWithRegistry).mockResolvedValueOnce(success);

    await generateJsonWithFallback({
      role: 'daily.auto_publish_judge',
      prompt: 'prompt',
      schema: SAMPLE_SCHEMA,
      geminiApiKey: 'g-key',
      registry: { chainForRole: () => [] },
    });

    expect(loadProviderRegistry).not.toHaveBeenCalled();
    expect(generateWithRegistry).toHaveBeenCalledWith(
      'daily.auto_publish_judge',
      'prompt',
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('createRegistryLoader (Phase 6b)', () => {
  afterEach(() => {
    vi.mocked(loadProviderRegistry).mockReset();
  });

  it('builds the registry once and reuses it across calls', async () => {
    const registry = { chainForRole: () => [] };
    vi.mocked(loadProviderRegistry).mockResolvedValue(registry);

    const load = createRegistryLoader({ GEMINI_API_KEY: 'g' });
    const [first, second] = await Promise.all([load(), load()]);

    expect(first).toBe(registry);
    expect(second).toBe(registry);
    expect(loadProviderRegistry).toHaveBeenCalledTimes(1);
  });

  // A catalog/Supabase outage should be paid once per run, not once per draft.
  it('memoizes the failure too', async () => {
    vi.mocked(loadProviderRegistry).mockRejectedValue(new Error('catalog down'));

    const load = createRegistryLoader({ GEMINI_API_KEY: 'g' });
    await expect(load()).rejects.toThrow('catalog down');
    await expect(load()).rejects.toThrow('catalog down');

    expect(loadProviderRegistry).toHaveBeenCalledTimes(1);
  });
});
