/**
 * OpenAI Codex CLI as a second CLI-subscription provider — Phase 7 of
 * wiki/pipeline/llm-providers.md. Proves cli-provider.ts's skeleton (built in
 * Phase 1, unused until now because there was no second consumer) is
 * genuinely tool-agnostic: the only Codex-specific code is buildArgs and
 * parseCodexExecEnvelope below.
 *
 * Runs under `CODEX_API_KEY` — the one env var Codex CLI documents as
 * "Provides an API key for a single non-interactive run. This is only
 * supported in `codex exec`" (learn.chatgpt.com/docs/config-file/environment-variables,
 * checked 2026-08-07), as distinct from the persistent `codex login` flow
 * that writes `~/.codex/auth.json` for interactive use. Only usable where
 * the `codex` binary is actually installed (a GitHub Actions runner, not
 * Vercel's serverless bundle) — same non-fatal-fallback contract as
 * claude-cli.ts and every other adapter in this registry.
 */

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CliProviderConfig } from '../cli-provider';

interface CodexExecEvent {
  type: string;
  item?: { type?: string; text?: string };
}

/**
 * `codex exec --json` prints one JSON object per line — thread.started,
 * turn.started, item.completed, turn.completed, ... The final assistant
 * reply lives in the last `item.completed` event whose `item.type` is
 * `agent_message` (verified against real command output samples,
 * 2026-08-07: a single-turn prompt emits exactly one, but taking the last
 * is robust if Codex ever emits an intermediate one too). No event carries
 * a `model` field — unlike claude-cli's `modelUsage` map, Codex's exec
 * JSONL simply doesn't expose which underlying model answered, so `model`
 * below is a fixed label, not a live read.
 */
export function parseCodexExecEnvelope(stdout: string): { text: string; model: string; costUsd: number } {
  let text: string | undefined;
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event: CodexExecEvent;
    try {
      event = JSON.parse(trimmed) as CodexExecEvent;
    } catch {
      continue; // a stray non-JSON diagnostic line -- --json's contract is NDJSON, but don't die on one bad line
    }
    if (event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item.text) {
      text = event.item.text;
    }
  }
  if (!text) {
    throw new Error(`[codex-cli] no agent_message in output: ${stdout.slice(0, 300)}`);
  }
  return { text, model: 'codex-cli', costUsd: 0 };
}

function buildCodexArgs(prompt: string, opts: { jsonSchema?: Record<string, unknown> }): string[] {
  const args = ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'read-only'];
  if (opts.jsonSchema) {
    // --output-schema takes a file path, not inline JSON like claude-cli's
    // --json-schema. buildArgs runs before generateWithCliProvider creates
    // its own scratchDir (cli-provider.ts), so there's no shared cleanup
    // hook to hang this off of -- a small, uncleaned temp file per call is
    // an accepted trade-off, same spirit as claude-cli.ts's own documented
    // trade-offs elsewhere in this registry.
    const schemaDir = mkdtempSync(join(tmpdir(), 'codex-schema-'));
    const schemaPath = join(schemaDir, 'schema.json');
    writeFileSync(schemaPath, JSON.stringify(opts.jsonSchema));
    args.push('--output-schema', schemaPath);
  }
  args.push(prompt);
  return args;
}

/** Registered under the id 'codex-cli' in registry.ts's KNOWN_CLI_PROVIDERS. */
export const CODEX_CLI_CONFIG: Omit<CliProviderConfig, 'id'> = {
  binary: 'codex',
  authEnvVar: 'CODEX_API_KEY',
  buildArgs: buildCodexArgs,
  parseEnvelope: parseCodexExecEnvelope,
};
