import { SchemaType } from '@google/generative-ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateJsonWithFallback, withJsonSchema } from './llm-json';
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

describe('withJsonSchema (Phase 6a: registry migration)', () => {
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
    const patched = withJsonSchema('daily.verify', SAMPLE_SCHEMA, registry);

    const chain = patched.chainForRole('daily.verify');
    expect(chain[0]?.gemini?.schema).toBe(SAMPLE_SCHEMA);
    expect(chain[0]?.gemini?.apiKey).toBe('g-key');
    expect(chain[1]).toBe(httpEntry);
  });

  it('leaves other roles untouched', () => {
    const registry = { chainForRole: () => [geminiEntry] };
    const patched = withJsonSchema('daily.verify', SAMPLE_SCHEMA, registry);

    const chain = patched.chainForRole('daily.summarize');
    expect(chain[0]).toBe(geminiEntry);
    expect(chain[0]?.gemini?.schema).toBeUndefined();
  });
});

describe('generateJsonWithFallback (Phase 6a: registry migration)', () => {
  afterEach(() => {
    vi.mocked(loadProviderRegistry).mockReset();
    vi.mocked(generateWithRegistry).mockReset();
  });

  it('uses the old primaryProvider-driven path unchanged when no role is passed (auto-publish.ts, not yet migrated)', async () => {
    // No role -> generateJsonWithFallback must never touch the registry at all.
    const result = await generateJsonWithFallback(
      'judge',
      'prompt',
      '', // empty Gemini key
      2,
      SAMPLE_SCHEMA,
      undefined, // no OpenRouter key either
    ).catch((error: unknown) => error);

    expect(result).toBeInstanceOf(Error);
    expect(loadProviderRegistry).not.toHaveBeenCalled();
    expect(generateWithRegistry).not.toHaveBeenCalled();
  });

  it('routes through the registry, with the schema patched onto a gemini entry, when role is passed', async () => {
    const registry = { chainForRole: () => [] };
    vi.mocked(loadProviderRegistry).mockResolvedValueOnce(registry);
    vi.mocked(generateWithRegistry).mockResolvedValueOnce({
      text: '{"ok":true}',
      provider: 'gemini',
      model: 'gemini-3.5-pro',
      usage: { promptTokens: 10, outputTokens: 5, costUsd: null, costSource: 'estimated' },
    });

    const result = await generateJsonWithFallback(
      'verify',
      'prompt',
      'g-key',
      2,
      SAMPLE_SCHEMA,
      'or-key',
      'gemini',
      'daily.verify',
      undefined,
    );

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
});
