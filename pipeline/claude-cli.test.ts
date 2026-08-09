import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ClaudeCliUnavailableError,
  generateWithClaudeCli,
  parseClaudeCliEnvelope,
  type SpawnClaudeCliFn,
} from './claude-cli';

type SpawnArgs = Parameters<SpawnClaudeCliFn>[0];
type SpawnOptions = Parameters<SpawnClaudeCliFn>[1];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('parseClaudeCliEnvelope', () => {
  it('prefers the schema-validated structured_output over the raw result text', () => {
    const raw = JSON.stringify({
      is_error: false,
      result: '{"greeting":"raw text version"}',
      structured_output: { greeting: 'schema-validated version' },
      modelUsage: {
        'claude-haiku-4-5': { outputTokens: 12, canonicalModel: 'claude-haiku-4-5' },
        'claude-sonnet-5': { outputTokens: 500, canonicalModel: 'claude-sonnet-5' },
      },
      total_cost_usd: 0.254072,
    });
    const result = parseClaudeCliEnvelope(raw);
    expect(result.text).toBe(JSON.stringify({ greeting: 'schema-validated version' }));
    expect(result.model).toBe('claude-sonnet-5');
    expect(result.totalCostUsd).toBe(0.254072);
  });

  it('falls back to the result field when structured_output is absent', () => {
    const raw = JSON.stringify({ is_error: false, result: 'plain text answer' });
    expect(parseClaudeCliEnvelope(raw).text).toBe('plain text answer');
  });

  it('throws using the result text when is_error is true', () => {
    const raw = JSON.stringify({ is_error: true, result: 'rate limited' });
    expect(() => parseClaudeCliEnvelope(raw)).toThrow('rate limited');
  });

  it('throws a clear error on non-JSON output', () => {
    expect(() => parseClaudeCliEnvelope('not json')).toThrow(/non-JSON/);
  });

  it('throws when neither structured_output nor result carries content', () => {
    const raw = JSON.stringify({ is_error: false });
    expect(() => parseClaudeCliEnvelope(raw)).toThrow(/empty result/);
  });

  it('falls back to a generic model label when modelUsage is absent', () => {
    const raw = JSON.stringify({ is_error: false, result: 'ok' });
    expect(parseClaudeCliEnvelope(raw).model).toBe('claude-code-cli');
  });

  it('defaults total cost to 0 when the field is missing', () => {
    const raw = JSON.stringify({ is_error: false, result: 'ok' });
    expect(parseClaudeCliEnvelope(raw).totalCostUsd).toBe(0);
  });
});

describe('generateWithClaudeCli', () => {
  it('throws ClaudeCliUnavailableError when CLAUDE_CODE_OAUTH_TOKEN is not set', async () => {
    await expect(generateWithClaudeCli('prompt')).rejects.toBeInstanceOf(ClaudeCliUnavailableError);
  });

  it('resolves with the parsed envelope on a clean run', async () => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'test-token');
    const spawnFn = vi.fn(async (_args: SpawnArgs, _options: SpawnOptions) => ({
      stdout: JSON.stringify({
        is_error: false,
        result: 'hello',
        modelUsage: { 'claude-sonnet-5': { outputTokens: 10, canonicalModel: 'claude-sonnet-5' } },
        total_cost_usd: 0.01,
      }),
      stderr: '',
      exitCode: 0,
      spawnError: null,
    }));
    const result = await generateWithClaudeCli('prompt', { spawnFn });
    expect(result).toEqual({ text: 'hello', model: 'claude-sonnet-5', totalCostUsd: 0.01 });
    expect(spawnFn).toHaveBeenCalledTimes(1);
    const [args, options] = spawnFn.mock.calls[0]!;
    expect(args).toEqual(['-p', 'prompt', '--output-format', 'json', '--tools', '']);
    expect(options.env.CLAUDE_CODE_OAUTH_TOKEN).toBe('test-token');
  });

  it('disables every built-in tool so a one-shot write cannot turn agentic', async () => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'test-token');
    const spawnFn = vi.fn(async (_args: SpawnArgs, _options: SpawnOptions) => ({
      stdout: JSON.stringify({ is_error: false, result: 'hello' }),
      stderr: '',
      exitCode: 0,
      spawnError: null,
    }));
    await generateWithClaudeCli('prompt', { spawnFn });
    const [args] = spawnFn.mock.calls[0]!;
    expect(args[args.indexOf('--tools') + 1]).toBe('');
  });

  it('defaults to a timeout long enough for a full master write', async () => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'test-token');
    const spawnFn = vi.fn(async (_args: SpawnArgs, _options: SpawnOptions) => ({
      stdout: JSON.stringify({ is_error: false, result: 'hello' }),
      stderr: '',
      exitCode: 0,
      spawnError: null,
    }));
    await generateWithClaudeCli('prompt', { spawnFn });
    expect(spawnFn.mock.calls[0]![1].timeoutMs).toBe(20 * 60_000);
  });

  it('honours CLAUDE_CLI_TIMEOUT_MS', async () => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'test-token');
    vi.stubEnv('CLAUDE_CLI_TIMEOUT_MS', '90000');
    const spawnFn = vi.fn(async (_args: SpawnArgs, _options: SpawnOptions) => ({
      stdout: JSON.stringify({ is_error: false, result: 'hello' }),
      stderr: '',
      exitCode: 0,
      spawnError: null,
    }));
    await generateWithClaudeCli('prompt', { spawnFn });
    expect(spawnFn.mock.calls[0]![1].timeoutMs).toBe(90_000);
  });

  it.each([
    ['SIGTERM signal', { exitCode: null, signal: 'SIGTERM' as const }],
    ['shell exit 143', { exitCode: 143, signal: null }],
  ])('reports a timeout kill as a timeout, not a model error (%s)', async (_label, outcome) => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'test-token');
    const spawnFn = vi.fn(async (_args: SpawnArgs, _options: SpawnOptions) => ({
      stdout: '{"is_error":true,"duration_api_ms":178618}',
      stderr: '',
      spawnError: null,
      ...outcome,
    }));
    await expect(generateWithClaudeCli('prompt', { spawnFn, timeoutMs: 240_000 })).rejects.toThrow(
      /timed out after 240s and was killed/,
    );
  });

  it('allows the local sandbox to lean on the binary’s own login', async () => {
    vi.stubEnv('CLAUDE_CLI_USE_LOCAL_AUTH', '1');
    const spawnFn = vi.fn(async (_args: SpawnArgs, _options: SpawnOptions) => ({
      stdout: JSON.stringify({ is_error: false, result: 'hello' }),
      stderr: '',
      exitCode: 0,
      spawnError: null,
    }));
    await expect(generateWithClaudeCli('prompt', { spawnFn })).resolves.toMatchObject({
      text: 'hello',
    });
  });

  it('adds --json-schema only when a schema is given', async () => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'test-token');
    const schema = { type: 'object', properties: { greeting: { type: 'string' } } };
    const spawnFn = vi.fn(async (_args: SpawnArgs, _options: SpawnOptions) => ({
      stdout: JSON.stringify({ is_error: false, structured_output: { greeting: 'hi' } }),
      stderr: '',
      exitCode: 0,
      spawnError: null,
    }));
    await generateWithClaudeCli('prompt', { spawnFn, jsonSchema: schema });
    const [args] = spawnFn.mock.calls[0]!;
    expect(args).toEqual([
      '-p',
      'prompt',
      '--output-format',
      'json',
      '--tools',
      '',
      '--json-schema',
      JSON.stringify(schema),
    ]);
  });

  it('maps an ENOENT spawn error (binary not installed) to ClaudeCliUnavailableError', async () => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'test-token');
    const spawnFn = vi.fn(async () => ({
      stdout: '',
      stderr: '',
      exitCode: null,
      spawnError: Object.assign(new Error('not found'), { code: 'ENOENT' }),
    }));
    await expect(generateWithClaudeCli('prompt', { spawnFn })).rejects.toBeInstanceOf(
      ClaudeCliUnavailableError,
    );
  });

  it('rethrows non-ENOENT spawn errors as plain failures', async () => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'test-token');
    const spawnFn = vi.fn(async () => ({
      stdout: '',
      stderr: '',
      exitCode: null,
      spawnError: Object.assign(new Error('permission denied'), { code: 'EACCES' }),
    }));
    await expect(generateWithClaudeCli('prompt', { spawnFn })).rejects.toThrow(/permission denied/);
  });

  it('throws on a non-zero exit code, surfacing stderr', async () => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'test-token');
    const spawnFn = vi.fn(async () => ({
      stdout: '',
      stderr: 'auth expired',
      exitCode: 1,
      spawnError: null,
    }));
    await expect(generateWithClaudeCli('prompt', { spawnFn })).rejects.toThrow(/auth expired/);
  });
});
