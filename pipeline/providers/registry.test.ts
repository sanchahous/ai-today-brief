import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./http-provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http-provider')>();
  return { ...actual, generateWithHttpProviderChain: vi.fn() };
});
vi.mock('./cli-provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./cli-provider')>();
  return { ...actual, generateWithCliProvider: vi.fn() };
});
vi.mock('./gemini-provider', () => ({ generateWithGemini: vi.fn() }));
vi.mock('../openrouter-models', () => ({ resolveOpenRouterModelQueue: vi.fn() }));

import { generateWithHttpProviderChain } from './http-provider';
import { generateWithCliProvider } from './cli-provider';
import { generateWithGemini } from './gemini-provider';
import { resolveOpenRouterModelQueue } from '../openrouter-models';
import {
  generateWithRegistry,
  loadProviderRegistry,
  nimProvider,
  RegistryExhaustedError,
  type ProviderRegistry,
  type ResolvedProvider,
} from './registry';
import { ProviderUnavailableError, type ProviderCallResult } from './types';

afterEach(() => {
  vi.mocked(generateWithHttpProviderChain).mockReset();
  vi.mocked(generateWithCliProvider).mockReset();
  vi.mocked(generateWithGemini).mockReset();
  vi.mocked(resolveOpenRouterModelQueue).mockReset();
});

function result(overrides: Partial<ProviderCallResult> = {}): ProviderCallResult {
  return {
    text: 'ok',
    provider: 'x',
    model: 'x-model',
    usage: { promptTokens: null, outputTokens: null, costUsd: null, costSource: 'estimated' },
    ...overrides,
  };
}

function fixedRegistry(chain: ResolvedProvider[]): ProviderRegistry {
  return { chainForRole: () => chain };
}

const httpEntry: ResolvedProvider = {
  entry: { kind: 'http', id: 'openrouter' },
  http: { id: 'openrouter', apiKey: 'k', modelQueue: ['m'], baseUrl: 'https://openrouter.ai/api/v1' },
};
const cliEntry: ResolvedProvider = {
  entry: { kind: 'cli', id: 'claude-cli' },
  cli: {
    id: 'claude-cli',
    binary: 'claude',
    authEnvVar: 'CLAUDE_CODE_OAUTH_TOKEN',
    buildArgs: () => [],
    parseEnvelope: () => ({ text: '', model: '', costUsd: 0 }),
  },
};
const geminiEntry: ResolvedProvider = {
  entry: { kind: 'gemini', id: 'gemini' },
  gemini: { apiKey: 'k' },
};

describe('generateWithRegistry', () => {
  it('returns the first successful provider in the chain', async () => {
    vi.mocked(generateWithCliProvider).mockResolvedValue(result({ provider: 'claude-cli' }));
    vi.mocked(generateWithHttpProviderChain).mockResolvedValue(result({ provider: 'openrouter' }));

    const out = await generateWithRegistry('weekly.master_writer', 'prompt', fixedRegistry([cliEntry, httpEntry]));

    expect(out.provider).toBe('claude-cli');
    expect(generateWithHttpProviderChain).not.toHaveBeenCalled();
  });

  it('skips a ProviderUnavailableError entry and tries the next one (fast skip, not a retry-worthy failure)', async () => {
    vi.mocked(generateWithCliProvider).mockRejectedValue(
      new ProviderUnavailableError('claude-cli', 'CLAUDE_CODE_OAUTH_TOKEN is not set'),
    );
    vi.mocked(generateWithHttpProviderChain).mockResolvedValue(result({ provider: 'openrouter' }));

    const out = await generateWithRegistry('weekly.master_writer', 'prompt', fixedRegistry([cliEntry, httpEntry]));

    expect(out.provider).toBe('openrouter');
  });

  it('advances past a real (non-unavailable) failure too, recording it distinctly', async () => {
    vi.mocked(generateWithHttpProviderChain).mockRejectedValue(new Error('rate limited'));
    vi.mocked(generateWithGemini).mockResolvedValue(result({ provider: 'gemini' }));
    const onAttempt = vi.fn();

    const out = await generateWithRegistry('daily.summarize', 'prompt', fixedRegistry([httpEntry, geminiEntry]), {
      onAttempt,
    });

    expect(out.provider).toBe('gemini');
    expect(onAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'openrouter', status: 'failed', reason: expect.stringContaining('rate limited') }),
    );
    expect(onAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'gemini', status: 'success' }),
    );
  });

  it('throws RegistryExhaustedError with the full attempt log when every entry fails', async () => {
    vi.mocked(generateWithCliProvider).mockRejectedValue(
      new ProviderUnavailableError('claude-cli', 'no token'),
    );
    vi.mocked(generateWithHttpProviderChain).mockRejectedValue(new Error('everything is on fire'));

    await expect(
      generateWithRegistry('weekly.master_writer', 'prompt', fixedRegistry([cliEntry, httpEntry])),
    ).rejects.toBeInstanceOf(RegistryExhaustedError);
    try {
      await generateWithRegistry('weekly.master_writer', 'prompt', fixedRegistry([cliEntry, httpEntry]));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RegistryExhaustedError);
      const exhausted = error as RegistryExhaustedError;
      expect(exhausted.attempts).toHaveLength(2);
      expect(exhausted.attempts[0]).toMatchObject({ provider: 'claude-cli', status: 'unconfigured' });
      expect(exhausted.attempts[1]).toMatchObject({ provider: 'openrouter', status: 'failed' });
      expect(exhausted.message).toContain('everything is on fire');
    }
  });

  it('throws immediately (empty attempt log) when the resolved chain is empty', async () => {
    await expect(
      generateWithRegistry('social.critic', 'prompt', fixedRegistry([])),
    ).rejects.toBeInstanceOf(RegistryExhaustedError);
  });
});

describe('nimProvider', () => {
  it('returns null when NVIDIA_API_KEY is not set', () => {
    expect(nimProvider(['moonshotai/kimi-k3'], {})).toBeNull();
  });

  it('builds an http entry with the caller-supplied model queue when the key is present', () => {
    const resolved = nimProvider(['moonshotai/kimi-k3', 'deepseek-ai/deepseek-v4'], {
      NVIDIA_API_KEY: 'nvapi-test',
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.entry).toEqual({ kind: 'http', id: 'nim' });
    expect(resolved!.http?.modelQueue).toEqual(['moonshotai/kimi-k3', 'deepseek-ai/deepseek-v4']);
    expect(resolved!.http?.baseUrl).toBe('https://integrate.api.nvidia.com/v1');
    expect(resolved!.http?.reportsCost).toBe(false);
  });
});

describe('loadProviderRegistry', () => {
  it('builds an empty default chain when no provider keys are configured', async () => {
    const registry = await loadProviderRegistry({});
    expect(registry.chainForRole('daily.summarize')).toEqual([]);
  });

  it('includes gemini in the default chain when GEMINI_API_KEY is set', async () => {
    const registry = await loadProviderRegistry({ GEMINI_API_KEY: 'g-key' });
    const chain = registry.chainForRole('daily.summarize');
    expect(chain).toEqual([{ entry: { kind: 'gemini', id: 'gemini' }, gemini: { apiKey: 'g-key' } }]);
  });

  it('resolves a real, non-empty OpenRouter model queue for the default chain (never an empty-array footgun)', async () => {
    vi.mocked(resolveOpenRouterModelQueue).mockResolvedValue(['vendor/model-a', 'vendor/model-b']);

    const registry = await loadProviderRegistry({ OPEN_ROUTER_API_KEY: 'or-key' });
    const chain = registry.chainForRole('daily.summarize');

    expect(chain).toHaveLength(1);
    expect(chain[0]?.http?.modelQueue).toEqual(['vendor/model-a', 'vendor/model-b']);
  });

  it('omits the OpenRouter entry entirely when the live queue resolves empty, rather than passing an empty queue through', async () => {
    vi.mocked(resolveOpenRouterModelQueue).mockResolvedValue([]);

    const registry = await loadProviderRegistry({ OPEN_ROUTER_API_KEY: 'or-key' });

    expect(registry.chainForRole('daily.summarize')).toEqual([]);
  });

  it('lets a roleOverride replace the default chain for one specific role only', async () => {
    const override: ResolvedProvider[] = [cliEntry];
    const registry = await loadProviderRegistry({ GEMINI_API_KEY: 'g-key' }, { 'weekly.master_writer': override });

    expect(registry.chainForRole('weekly.master_writer')).toBe(override);
    expect(registry.chainForRole('daily.summarize')).not.toBe(override);
  });
});

describe('loadProviderRegistry with a db (Phase 1b)', () => {
  /** Minimal fake matching only the query chains registry.ts actually calls. */
  function fakeDb(tables: Record<string, unknown[]>, secrets: Record<string, string | null> = {}) {
    function makeBuilder(rows: unknown[]) {
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) =>
          makeBuilder(rows.filter((row) => (row as Record<string, unknown>)[column] === value)),
        order: () => Promise.resolve({ data: rows, error: null }),
        // select().eq() alone (no .order()) must also resolve -- llm_role_chains has no .eq()/.order() call.
        then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
          resolve({ data: rows, error: null }),
      };
      return builder;
    }
    return {
      from: (table: string) => makeBuilder(tables[table] ?? []),
      rpc: (fn: string, args: Record<string, unknown>) => {
        if (fn !== 'read_llm_provider_secret') throw new Error(`unexpected rpc ${fn}`);
        const id = args.p_provider_id as string;
        return Promise.resolve({ data: secrets[id] ?? null, error: null });
      },
    } as any;
  }

  it('resolves an HTTP provider from a saved role chain, reading its secret via the Vault RPC', async () => {
    const db = fakeDb(
      {
        llm_role_chains: [{ role: 'daily.card_image_scene', chain: [{ kind: 'http', id: 'nim' }] }],
        llm_providers: [
          { id: 'nim', kind: 'http', enabled: true, base_url: 'https://integrate.api.nvidia.com/v1', extra_headers: {}, reports_cost: false },
        ],
        llm_provider_models: [{ provider_id: 'nim', model_id: 'deepseek-ai/deepseek-v4-pro', rank: 0, enabled: true }],
      },
      { nim: 'nvapi-secret' },
    );

    const registry = await loadProviderRegistry({}, {}, db);
    const chain = registry.chainForRole('daily.card_image_scene');

    expect(chain).toHaveLength(1);
    expect(chain[0]).toMatchObject({
      entry: { kind: 'http', id: 'nim' },
      http: {
        id: 'nim',
        apiKey: 'nvapi-secret',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        modelQueue: ['deepseek-ai/deepseek-v4-pro'],
      },
    });
  });

  it('resolves a gemini chain entry using the env-supplied GEMINI_API_KEY (no Vault secret involved)', async () => {
    const db = fakeDb({
      llm_role_chains: [{ role: 'daily.card_image_scene', chain: [{ kind: 'gemini', id: 'gemini' }] }],
      llm_providers: [{ id: 'gemini', kind: 'gemini', enabled: true, base_url: null, extra_headers: {}, reports_cost: false }],
      llm_provider_models: [],
    });

    const registry = await loadProviderRegistry({ GEMINI_API_KEY: 'g-key' }, {}, db);
    expect(registry.chainForRole('daily.card_image_scene')).toEqual([
      { entry: { kind: 'gemini', id: 'gemini' }, gemini: { apiKey: 'g-key' } },
    ]);
  });

  it('drops a gemini chain entry when GEMINI_API_KEY is not set', async () => {
    const db = fakeDb({
      llm_role_chains: [{ role: 'daily.card_image_scene', chain: [{ kind: 'gemini', id: 'gemini' }] }],
      llm_providers: [{ id: 'gemini', kind: 'gemini', enabled: true, base_url: null, extra_headers: {}, reports_cost: false }],
      llm_provider_models: [],
    });

    const registry = await loadProviderRegistry({}, {}, db);
    expect(registry.chainForRole('daily.card_image_scene')).toEqual([]);
  });

  it('drops an HTTP provider entry when no secret has been stored yet', async () => {
    const db = fakeDb({
      llm_role_chains: [{ role: 'daily.card_image_scene', chain: [{ kind: 'http', id: 'nim' }] }],
      llm_providers: [
        { id: 'nim', kind: 'http', enabled: true, base_url: 'https://integrate.api.nvidia.com/v1', extra_headers: {}, reports_cost: false },
      ],
      llm_provider_models: [{ provider_id: 'nim', model_id: 'm', rank: 0, enabled: true }],
    });

    const registry = await loadProviderRegistry({}, {}, db);
    expect(registry.chainForRole('daily.card_image_scene')).toEqual([]);
  });

  it('skips a CLI entry in a saved chain (honest limitation: DB can\'t supply argv-builder/envelope-parser code)', async () => {
    const db = fakeDb({
      llm_role_chains: [{ role: 'weekly.master_writer', chain: [{ kind: 'cli', id: 'claude-cli' }] }],
      llm_providers: [
        { id: 'claude-cli', kind: 'cli', enabled: true, base_url: null, extra_headers: {}, reports_cost: false },
      ],
      llm_provider_models: [],
    });

    const registry = await loadProviderRegistry({}, {}, db);
    expect(registry.chainForRole('weekly.master_writer')).toEqual([]);
  });

  it('falls back to the env-only default chain for a role with no saved DB row', async () => {
    vi.mocked(resolveOpenRouterModelQueue).mockResolvedValue(['vendor/model']);
    const db = fakeDb({ llm_role_chains: [], llm_providers: [], llm_provider_models: [] });

    const registry = await loadProviderRegistry({ OPEN_ROUTER_API_KEY: 'or-key' }, {}, db);

    expect(registry.chainForRole('daily.summarize')).toHaveLength(1);
    expect(registry.chainForRole('daily.summarize')[0]?.entry.id).toBe('openrouter');
  });

  it('lets an explicit roleOverride win over a saved DB chain', async () => {
    const override: ResolvedProvider[] = [cliEntry];
    const db = fakeDb({
      llm_role_chains: [{ role: 'weekly.master_writer', chain: [{ kind: 'http', id: 'nim' }] }],
      llm_providers: [
        { id: 'nim', kind: 'http', enabled: true, base_url: 'https://x', extra_headers: {}, reports_cost: false },
      ],
      llm_provider_models: [],
    });

    const registry = await loadProviderRegistry({}, { 'weekly.master_writer': override }, db);
    expect(registry.chainForRole('weekly.master_writer')).toBe(override);
  });
});
