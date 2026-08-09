/**
 * Claude Code CLI as a subscription-covered editorial provider.
 * @see https://docs.claude.com/en/docs/claude-code — `claude -p` headless mode.
 *
 * Runs under `CLAUDE_CODE_OAUTH_TOKEN` (a long-lived token from `claude
 * setup-token`, requires a Claude subscription) rather than a metered API
 * key — usage draws on the account's Pro/Max plan limits, not the OpenRouter
 * dollar budget. Only usable where the `claude` binary is actually installed
 * (a real Linux/macOS/Windows host — a GitHub Actions runner, not Vercel's
 * serverless bundle); callers must treat "binary missing" as an ordinary,
 * fast, non-fatal fallback signal, exactly like a missing API key.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export class ClaudeCliUnavailableError extends Error {
  constructor(reason: string) {
    super(`UNCONFIGURED:CLAUDE_CODE_CLI: ${reason}`);
    this.name = 'ClaudeCliUnavailableError';
  }
}

export type ClaudeCliResult = {
  text: string;
  model: string;
  totalCostUsd: number;
};

type ClaudeCliEnvelope = {
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  modelUsage?: Record<string, { outputTokens?: number; canonicalModel?: string }>;
  total_cost_usd?: number;
};

/** The model with the most output tokens is the actual generation model — the
 * haiku routing/classification pass that precedes it contributes only a few
 * tokens and isn't what we want to report as "the model that wrote this". */
function primaryModel(usage: ClaudeCliEnvelope['modelUsage']): string {
  const entries = Object.entries(usage ?? {});
  if (entries.length === 0) return 'claude-code-cli';
  const [, top] = entries.reduce((best, entry) =>
    (entry[1].outputTokens ?? 0) > (best[1].outputTokens ?? 0) ? entry : best,
  );
  return top.canonicalModel ?? 'claude-code-cli';
}

export type SpawnClaudeCliFn = (
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number },
) => Promise<{ stdout: string; stderr: string; exitCode: number | null; spawnError: NodeJS.ErrnoException | null }>;

/* v8 ignore start -- live process spawn; envelope parsing is unit-tested via injected spawn */
const defaultSpawn: SpawnClaudeCliFn = (args, { cwd, env, timeoutMs }) =>
  new Promise((resolve) => {
    // stdio[0] must be closed, not the Node default open-but-silent pipe: the
    // `claude` binary itself waits to see whether stdin carries piped input,
    // and an open pipe nobody writes to or ends never resolves that wait --
    // observed live (2026-08-09, job 33ebdf9e) as a ~4-minute hang ending in
    // SIGTERM (exit 143) at exactly the spawn `timeout`, with the CLI's own
    // "no stdin data received in 3s ... redirect stdin explicitly: < /dev/null"
    // warning on stderr. 'ignore' is the child_process equivalent of that
    // redirect.
    const child = spawn('claude', args, {
      cwd,
      env,
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (spawnError: NodeJS.ErrnoException) => {
      resolve({ stdout, stderr, exitCode: null, spawnError });
    });
    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode, spawnError: null });
    });
  });
/* v8 ignore end */

export function parseClaudeCliEnvelope(raw: string): ClaudeCliResult {
  let envelope: ClaudeCliEnvelope;
  try {
    envelope = JSON.parse(raw) as ClaudeCliEnvelope;
  } catch {
    throw new Error(`[claude-cli] non-JSON output: ${raw.slice(0, 300)}`);
  }
  if (envelope.is_error) {
    throw new Error(`[claude-cli] ${envelope.result ?? 'generation failed'}`);
  }
  const text =
    envelope.structured_output !== undefined
      ? JSON.stringify(envelope.structured_output)
      : envelope.result;
  if (!text) {
    throw new Error('[claude-cli] empty result');
  }
  return {
    text,
    model: primaryModel(envelope.modelUsage),
    totalCostUsd: typeof envelope.total_cost_usd === 'number' ? envelope.total_cost_usd : 0,
  };
}

export type GenerateWithClaudeCliOptions = {
  jsonSchema?: Record<string, unknown>;
  timeoutMs?: number;
  spawnFn?: SpawnClaudeCliFn;
};

const DEFAULT_TIMEOUT_MS = 4 * 60_000;

/**
 * Runs `claude -p <prompt> --output-format json`, isolated to a throwaway
 * cwd so it never picks up this repo's own CLAUDE.md as unrelated context.
 * Throws ClaudeCliUnavailableError when the token is unset or the binary
 * isn't installed — callers should treat that as an instant, expected
 * fallback signal, not a real failure.
 */
export async function generateWithClaudeCli(
  prompt: string,
  options: GenerateWithClaudeCliOptions = {},
): Promise<ClaudeCliResult> {
  const token = process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim();
  if (!token) throw new ClaudeCliUnavailableError('CLAUDE_CODE_OAUTH_TOKEN is not set');

  const spawnFn = options.spawnFn ?? defaultSpawn;
  const args = ['-p', prompt, '--output-format', 'json'];
  if (options.jsonSchema) args.push('--json-schema', JSON.stringify(options.jsonSchema));

  const scratchDir = mkdtempSync(join(tmpdir(), 'claude-cli-'));
  try {
    const { stdout, stderr, exitCode, spawnError } = await spawnFn(args, {
      cwd: scratchDir,
      env: { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: token },
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
    if (spawnError) {
      if (spawnError.code === 'ENOENT') {
        throw new ClaudeCliUnavailableError('the `claude` binary is not installed on this host');
      }
      throw new Error(`[claude-cli] spawn failed: ${spawnError.message}`);
    }
    if (exitCode !== 0) {
      throw new Error(`[claude-cli] exited ${exitCode}: ${stderr.slice(0, 500) || stdout.slice(0, 500)}`);
    }
    return parseClaudeCliEnvelope(stdout);
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}
