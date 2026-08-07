import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateWithCliProvider, type CliProviderConfig, type SpawnCliFn } from './cli-provider';
import { ProviderUnavailableError } from './types';

type SpawnArgs = Parameters<SpawnCliFn>;

afterEach(() => {
  vi.unstubAllEnvs();
});

function fakeCliConfig(overrides: Partial<CliProviderConfig> = {}): CliProviderConfig {
  return {
    id: 'fake-cli',
    binary: 'fake',
    authEnvVar: 'FAKE_CLI_TOKEN',
    buildArgs: (prompt, opts) => [
      '--prompt',
      prompt,
      ...(opts.jsonSchema ? ['--schema', JSON.stringify(opts.jsonSchema)] : []),
    ],
    parseEnvelope: (stdout) => JSON.parse(stdout) as { text: string; model: string; costUsd: number },
    ...overrides,
  };
}

describe('generateWithCliProvider', () => {
  it('throws ProviderUnavailableError when the auth env var is not set', async () => {
    await expect(generateWithCliProvider('prompt', fakeCliConfig())).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('resolves with a normalized ProviderCallResult on a clean run, tagged costSource=subscription', async () => {
    vi.stubEnv('FAKE_CLI_TOKEN', 'test-token');
    const spawnFn = vi.fn(async (..._args: SpawnArgs) => ({
      stdout: JSON.stringify({ text: 'hello', model: 'fake-model-1', costUsd: 0 }),
      stderr: '',
      exitCode: 0,
      spawnError: null,
    }));
    const result = await generateWithCliProvider('prompt', fakeCliConfig({ spawnFn }));

    expect(result).toEqual({
      text: 'hello',
      provider: 'fake-cli',
      model: 'fake-model-1',
      usage: { promptTokens: null, outputTokens: null, costUsd: 0, costSource: 'subscription' },
    });
    expect(spawnFn).toHaveBeenCalledTimes(1);
    const [binary, args, options] = spawnFn.mock.calls[0]!;
    expect(binary).toBe('fake');
    expect(args).toEqual(['--prompt', 'prompt']);
    expect(options.env.FAKE_CLI_TOKEN).toBe('test-token');
  });

  it('passes jsonSchema through to buildArgs only when supplied', async () => {
    vi.stubEnv('FAKE_CLI_TOKEN', 'test-token');
    const schema = { type: 'object' };
    const spawnFn = vi.fn(async (..._args: SpawnArgs) => ({
      stdout: JSON.stringify({ text: 'hi', model: 'm', costUsd: 0 }),
      stderr: '',
      exitCode: 0,
      spawnError: null,
    }));
    await generateWithCliProvider('prompt', fakeCliConfig({ spawnFn }), { jsonSchema: schema });
    const [, args] = spawnFn.mock.calls[0]!;
    expect(args).toEqual(['--prompt', 'prompt', '--schema', JSON.stringify(schema)]);
  });

  it('maps an ENOENT spawn error (binary not installed) to ProviderUnavailableError', async () => {
    vi.stubEnv('FAKE_CLI_TOKEN', 'test-token');
    const spawnFn = vi.fn(async (..._args: SpawnArgs) => ({
      stdout: '',
      stderr: '',
      exitCode: null,
      spawnError: Object.assign(new Error('not found'), { code: 'ENOENT' }),
    }));
    await expect(
      generateWithCliProvider('prompt', fakeCliConfig({ spawnFn })),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it('rethrows non-ENOENT spawn errors as plain failures', async () => {
    vi.stubEnv('FAKE_CLI_TOKEN', 'test-token');
    const spawnFn = vi.fn(async (..._args: SpawnArgs) => ({
      stdout: '',
      stderr: '',
      exitCode: null,
      spawnError: Object.assign(new Error('permission denied'), { code: 'EACCES' }),
    }));
    await expect(generateWithCliProvider('prompt', fakeCliConfig({ spawnFn }))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('throws on a non-zero exit code, surfacing stderr', async () => {
    vi.stubEnv('FAKE_CLI_TOKEN', 'test-token');
    const spawnFn = vi.fn(async (..._args: SpawnArgs) => ({
      stdout: '',
      stderr: 'auth expired',
      exitCode: 1,
      spawnError: null,
    }));
    await expect(generateWithCliProvider('prompt', fakeCliConfig({ spawnFn }))).rejects.toThrow(
      /auth expired/,
    );
  });

  it('works for a second, differently-configured CLI tool without touching the first (proves the skeleton is genuinely generic)', async () => {
    vi.stubEnv('CODEX_CLI_TOKEN', 'codex-token');
    const spawnFn = vi.fn(async (..._args: SpawnArgs) => ({
      stdout: JSON.stringify({ text: 'codex says hi', model: 'gpt-5-codex', costUsd: 0 }),
      stderr: '',
      exitCode: 0,
      spawnError: null,
    }));
    const codexConfig = fakeCliConfig({
      id: 'codex-cli',
      binary: 'codex',
      authEnvVar: 'CODEX_CLI_TOKEN',
      spawnFn,
    });
    const result = await generateWithCliProvider('prompt', codexConfig);
    expect(result.provider).toBe('codex-cli');
    expect(result.model).toBe('gpt-5-codex');
    const [binary] = spawnFn.mock.calls[0]!;
    expect(binary).toBe('codex');
  });
});
