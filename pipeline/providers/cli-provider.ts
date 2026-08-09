/**
 * Generic CLI-subscription provider skeleton, generalized from
 * pipeline/claude-cli.ts's spawn/timeout/scratch-dir/ENOENT-mapping pattern
 * (which is genuinely tool-agnostic). Adding a NEW CLI tool (e.g. Codex CLI)
 * still needs real code per tool -- its own flags (buildArgs) and its own
 * stdout-envelope parser (parseEnvelope) -- this is honestly NOT achievable
 * as pure config, unlike the HTTP-provider case. See
 * wiki/pipeline/llm-providers.md.
 *
 * pipeline/claude-cli.ts is left untouched by this module for now: nothing
 * consumes this skeleton yet (a second CLI provider is an optional future
 * phase), and claude-cli.ts is the only $0-marginal-cost path for the weekly
 * master today, so there's no reason to add refactor risk to it ahead of an
 * actual second consumer.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProviderUnavailableError, type ProviderCallResult } from './types';

export type SpawnCliFn = (
  binary: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number },
) => Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  spawnError: NodeJS.ErrnoException | null;
}>;

export interface CliProviderConfig {
  /** Stable id: 'claude-cli' | 'codex-cli' | an owner-defined slug. */
  id: string;
  /** Binary name on PATH, e.g. 'claude' or 'codex'. */
  binary: string;
  /** Presence of this env var gates whether this provider is even attempted. */
  authEnvVar: string;
  /** Tool-specific argv builder — the "small amount of real code" every new CLI tool needs. */
  buildArgs: (prompt: string, opts: { jsonSchema?: Record<string, unknown> }) => string[];
  /** Tool-specific stdout-envelope parser. */
  parseEnvelope: (stdout: string) => { text: string; model: string; costUsd: number };
  spawnFn?: SpawnCliFn;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 4 * 60_000;

/* v8 ignore start -- live process spawn; envelope parsing is unit-tested via injected spawn */
const defaultSpawn: SpawnCliFn = (binary, args, { cwd, env, timeoutMs }) =>
  new Promise((resolve) => {
    // stdio[0] must be closed, not the Node default open-but-silent pipe --
    // see pipeline/claude-cli.ts's defaultSpawn for the live incident
    // (2026-08-09) this mirrors: a CLI tool that checks whether stdin carries
    // piped input hangs on an open-but-unwritten pipe until the spawn
    // `timeout` SIGTERMs it. 'ignore' is the equivalent of `< /dev/null`.
    const child = spawn(binary, args, {
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

/**
 * Spawns `cfg.binary` with `cfg.buildArgs(prompt, opts)`, isolated to a
 * throwaway cwd (so a CLI tool that reads project context, like Claude Code
 * reading CLAUDE.md, doesn't pick up this repo's own instructions). Throws
 * ProviderUnavailableError when the auth env var is unset or the binary
 * isn't installed — callers should treat that as an instant, expected
 * fallback signal, not a real failure.
 */
export async function generateWithCliProvider(
  prompt: string,
  cfg: CliProviderConfig,
  opts?: { jsonSchema?: Record<string, unknown> },
): Promise<ProviderCallResult> {
  const token = process.env[cfg.authEnvVar]?.trim();
  if (!token) throw new ProviderUnavailableError(cfg.id, `${cfg.authEnvVar} is not set`);

  const spawnFn = cfg.spawnFn ?? defaultSpawn;
  const args = cfg.buildArgs(prompt, { jsonSchema: opts?.jsonSchema });

  const scratchDir = mkdtempSync(join(tmpdir(), `${cfg.id}-`));
  try {
    const { stdout, stderr, exitCode, spawnError } = await spawnFn(cfg.binary, args, {
      cwd: scratchDir,
      env: { ...process.env, [cfg.authEnvVar]: token },
      timeoutMs: cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
    if (spawnError) {
      if (spawnError.code === 'ENOENT') {
        throw new ProviderUnavailableError(cfg.id, `the \`${cfg.binary}\` binary is not installed on this host`);
      }
      throw new Error(`[${cfg.id}] spawn failed: ${spawnError.message}`);
    }
    if (exitCode !== 0) {
      throw new Error(`[${cfg.id}] exited ${exitCode}: ${stderr.slice(0, 500) || stdout.slice(0, 500)}`);
    }
    const parsed = cfg.parseEnvelope(stdout);
    return {
      text: parsed.text,
      provider: cfg.id,
      model: parsed.model,
      usage: {
        promptTokens: null,
        outputTokens: null,
        costUsd: parsed.costUsd,
        costSource: 'subscription',
      },
    };
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}
