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
) => Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  spawnError: NodeJS.ErrnoException | null;
  /** Set when the OS killed the child — `timeout` expiring reports SIGTERM. */
  signal?: NodeJS.Signals | null;
}>;

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
      resolve({ stdout, stderr, exitCode: null, spawnError, signal: null });
    });
    child.on('close', (exitCode, signal) => {
      resolve({ stdout, stderr, exitCode, spawnError: null, signal });
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

/**
 * A weekly master EN write is a single ~20k-output-token generation over a
 * ~50k-token prompt. The old 4-minute ceiling was set before the v7 prompt
 * and the research-pack copy grew it, and it silently became the actual
 * cause of every editorial_master failure on 2026-08-09: the CLI was working
 * (178s and 233s of real API time on the two observed runs, still mid-answer)
 * and got SIGTERMed at exactly 240s. Sized from the sandbox measurement in
 * wiki/ops/weekly-sandbox.md with headroom for a slow day, and well inside
 * the workflow's own 120-minute job timeout.
 */
const DEFAULT_TIMEOUT_MS = 20 * 60_000;

function resolveTimeoutMs(explicit?: number): number {
  if (explicit && explicit > 0) return explicit;
  const configured = Number(process.env.CLAUDE_CLI_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

/**
 * Every call here is a one-shot text generation, so the agentic toolbelt is
 * pure downside: the two failed 2026-08-09 runs both died with
 * `stop_reason: "tool_use"` after 3 and 7 turns, re-sending the prompt each
 * turn (296k cached input tokens on the second) for an answer that needs no
 * file access at all. `--tools ""` is the CLI's documented way to disable
 * every built-in tool, which collapses this back to a single turn.
 */
function buildArgs(prompt: string, jsonSchema?: Record<string, unknown>): string[] {
  const args = ['-p', prompt, '--output-format', 'json', '--tools', ''];
  if (jsonSchema) args.push('--json-schema', JSON.stringify(jsonSchema));
  return args;
}

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
  // Opt-in escape hatch for the local sandbox, where the binary is already
  // signed in interactively and minting a second long-lived token into a
  // dotfile buys nothing. Unset (the CI default) the token stays required,
  // so a misconfigured runner still fails fast and visibly.
  const useLocalAuth = process.env.CLAUDE_CLI_USE_LOCAL_AUTH === '1';
  if (!token && !useLocalAuth) {
    throw new ClaudeCliUnavailableError('CLAUDE_CODE_OAUTH_TOKEN is not set');
  }

  const spawnFn = options.spawnFn ?? defaultSpawn;
  const args = buildArgs(prompt, options.jsonSchema);
  const timeoutMs = resolveTimeoutMs(options.timeoutMs);

  const scratchDir = mkdtempSync(join(tmpdir(), 'claude-cli-'));
  try {
    const { stdout, stderr, exitCode, spawnError, signal } = await spawnFn(args, {
      cwd: scratchDir,
      env: token ? { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: token } : { ...process.env },
      timeoutMs,
    });
    if (spawnError) {
      if (spawnError.code === 'ENOENT') {
        throw new ClaudeCliUnavailableError('the `claude` binary is not installed on this host');
      }
      throw new Error(`[claude-cli] spawn failed: ${spawnError.message}`);
    }
    // 143 is the shell's encoding of the same SIGTERM the spawn `timeout`
    // sends; report it as the timeout it is instead of dumping a truncated
    // JSON envelope that reads like a model error.
    if (signal === 'SIGTERM' || exitCode === 143) {
      throw new Error(
        `[claude-cli] timed out after ${Math.round(timeoutMs / 1000)}s and was killed. ` +
          'Raise CLAUDE_CLI_TIMEOUT_MS if the prompt legitimately needs longer.',
      );
    }
    if (exitCode !== 0) {
      throw new Error(`[claude-cli] exited ${exitCode}: ${stderr.slice(0, 500) || stdout.slice(0, 500)}`);
    }
    return parseClaudeCliEnvelope(stdout);
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}
