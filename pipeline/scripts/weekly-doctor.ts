/**
 * Provider preflight for the Weekly Digest master write.
 *
 * A dispatched editorial_master run costs ~5-40 minutes of Actions time
 * before it tells you anything. Most of the failures it reported were not
 * editorial at all — they were "the Claude CLI is not authenticated here",
 * "the OpenRouter key is out of credit", "the model reasons for longer than
 * the stall detector waits". Those are all answerable in under a minute
 * without touching the database, the job ledger or the digest.
 *
 * Every check is read-only and self-contained. Exit code is non-zero when a
 * check that the master write actually depends on failed, so this is safe to
 * run as a first step in the workflow itself.
 *
 * Usage: npm run weekly:doctor [-- --skip-live]
 *   --skip-live  configuration checks only; no billable provider call.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveOpenRouterAdaptiveTimeouts } from '../openrouter-adaptive';

type Status = 'ok' | 'warn' | 'fail' | 'skip';

interface Check {
  name: string;
  status: Status;
  detail: string;
}

const checks: Check[] = [];

function record(name: string, status: Status, detail: string): void {
  checks.push({ name, status, detail });
  const badge = { ok: ' OK ', warn: 'WARN', fail: 'FAIL', skip: 'SKIP' }[status];
  console.log(`[${badge}] ${name.padEnd(28)} ${detail}`);
}

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/** Runs a command with stdin closed and a hard timeout, resolving instead of
 * throwing — a missing binary is an expected answer here, not an error. */
function runCommand(
  binary: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number | null; signal: string | null; failed: boolean }> {
  return new Promise((resolve) => {
    const scratch = mkdtempSync(join(tmpdir(), 'weekly-doctor-'));
    const child = spawn(binary, args, {
      cwd: scratch,
      env: process.env,
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    const done = (result: { exitCode: number | null; signal: string | null; failed: boolean }) => {
      rmSync(scratch, { recursive: true, force: true });
      resolve({ stdout, stderr, ...result });
    };
    child.on('error', () => done({ exitCode: null, signal: null, failed: true }));
    child.on('close', (exitCode, signal) => done({ exitCode, signal, failed: false }));
  });
}

async function checkClaudeCli(live: boolean): Promise<void> {
  const localAuth = env('CLAUDE_CLI_USE_LOCAL_AUTH') === '1';
  if (env('CLAUDE_CODE_OAUTH_TOKEN')) {
    record('claude-cli token', 'ok', 'CLAUDE_CODE_OAUTH_TOKEN is set');
  } else if (localAuth) {
    // Sandbox posture: the binary is already signed in interactively. Valid
    // locally, never valid on a runner, so it stays a warning either way.
    record('claude-cli token', 'warn', "CLAUDE_CLI_USE_LOCAL_AUTH=1 — using the binary's own login (local only)");
  } else {
    record('claude-cli token', 'fail', 'CLAUDE_CODE_OAUTH_TOKEN is not set — the CLI ladder is unusable');
    return;
  }

  const version = await runCommand('claude', ['--version'], 30_000);
  if (version.failed) {
    record('claude-cli binary', 'fail', 'the `claude` binary is not on PATH');
    return;
  }
  record('claude-cli binary', 'ok', version.stdout.trim() || 'installed');

  if (!live) {
    record('claude-cli call', 'skip', '--skip-live');
    return;
  }

  // Same argv shape the real provider uses, on a prompt small enough that the
  // only thing it can measure is reachability, auth and cold-start latency.
  const started = Date.now();
  const probe = await runCommand(
    'claude',
    ['-p', 'Reply with exactly: pong', '--output-format', 'json', '--tools', ''],
    120_000,
  );
  const elapsed = Date.now() - started;
  if (probe.signal === 'SIGTERM') {
    record('claude-cli call', 'fail', `no answer in ${(elapsed / 1000).toFixed(0)}s (killed by timeout)`);
    return;
  }
  // The CLI reports its real reason inside the JSON envelope even when it
  // exits non-zero ("OAuth session expired", "credit balance too low"), so
  // parse first and only fall back to the raw stream. Printing the raw
  // envelope is exactly the unreadable failure this script exists to replace.
  type ClaudeEnvelope = { is_error?: boolean; result?: string; num_turns?: number };
  let envelope: ClaudeEnvelope | null;
  try {
    envelope = JSON.parse(probe.stdout) as ClaudeEnvelope;
  } catch {
    envelope = null;
  }
  if (envelope?.is_error || (probe.exitCode !== 0 && envelope?.result)) {
    record('claude-cli call', 'fail', envelope.result?.slice(0, 200) ?? 'provider reported an error');
    return;
  }
  if (probe.exitCode !== 0) {
    record('claude-cli call', 'fail', `exit ${probe.exitCode}: ${(probe.stderr || probe.stdout).slice(0, 200)}`);
    return;
  }
  if (!envelope) {
    record('claude-cli call', 'fail', `non-JSON output: ${probe.stdout.slice(0, 200)}`);
    return;
  }
  record(
    'claude-cli call',
    'ok',
    `answered in ${(elapsed / 1000).toFixed(1)}s, ${envelope.num_turns ?? '?'} turn(s)`,
  );
}

async function checkOpenRouter(live: boolean): Promise<void> {
  const key = env('OPEN_ROUTER_API_KEY');
  if (!key) {
    record('openrouter key', 'fail', 'OPEN_ROUTER_API_KEY is not set — no fallback and no critic');
    return;
  }

  const keyResponse = await fetch('https://openrouter.ai/api/v1/credits', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!keyResponse.ok) {
    record('openrouter key', 'fail', `GET /credits returned HTTP ${keyResponse.status}`);
    return;
  }
  const credits = (await keyResponse.json()) as {
    data?: { total_credits?: number; total_usage?: number };
  };
  const remaining = (credits.data?.total_credits ?? 0) - (credits.data?.total_usage ?? 0);
  record(
    'openrouter credit',
    remaining <= 1 ? 'fail' : remaining < 5 ? 'warn' : 'ok',
    `$${remaining.toFixed(2)} remaining of $${(credits.data?.total_credits ?? 0).toFixed(2)}`,
  );

  if (!live) {
    record('openrouter stream', 'skip', '--skip-live');
    return;
  }

  // The master critic runs on reasoning models. This measures the gap the
  // stall detector has to tolerate: how long the model streams `reasoning`
  // deltas before the first `content` delta appears. A first-token limit
  // below that gap kills a model that is working perfectly well.
  const timeouts = resolveOpenRouterAdaptiveTimeouts(process.env);
  const model = env('WEEKLY_DOCTOR_PROBE_MODEL') ?? 'deepseek/deepseek-v4-pro';
  const started = Date.now();
  let firstReasoningMs: number | null = null;
  let firstContentMs: number | null = null;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: 64,
        messages: [{ role: 'user', content: 'Reply with the single word: pong' }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok || !response.body) {
      record('openrouter stream', 'fail', `HTTP ${response.status} for ${model}`);
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (firstContentMs === null) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const delta = (JSON.parse(payload) as { choices?: Array<{ delta?: Record<string, unknown> }> })
            .choices?.[0]?.delta;
          if (!delta) continue;
          if (firstReasoningMs === null && typeof delta.reasoning === 'string' && delta.reasoning) {
            firstReasoningMs = Date.now() - started;
          }
          if (firstContentMs === null && typeof delta.content === 'string' && delta.content) {
            firstContentMs = Date.now() - started;
          }
        } catch {
          /* partial SSE frame — the next read completes it */
        }
      }
    }
    await reader.cancel().catch(() => undefined);
  } catch (error) {
    record('openrouter stream', 'fail', error instanceof Error ? error.message : String(error));
    return;
  }

  if (firstContentMs === null) {
    record('openrouter stream', 'fail', `${model} produced no content delta`);
    return;
  }
  record(
    'openrouter stream',
    'ok',
    `${model}: first reasoning ${firstReasoningMs ?? '-'}ms, first content ${firstContentMs}ms ` +
      `(first-token limit ${timeouts.firstTokenMs}ms)`,
  );
}

function checkConfig(): void {
  const order = env('WEEKLY_MASTER_PROVIDER_ORDER') ?? 'claude-cli,openrouter';
  record(
    'provider order',
    order.split(',').length > 1 ? 'ok' : 'warn',
    order.split(',').length > 1
      ? order
      : `${order} — single provider, a timeout there fails the whole job with no fallback`,
  );

  const studio = env('WEEKLY_CONTENT_STUDIO_V2') ?? 'off';
  record('content studio', studio === 'off' ? 'fail' : 'ok', studio);

  for (const [primary, fallback] of [
    ['SCRAPPER_BASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
    ['SCRAPPER_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  ] as const) {
    record(
      primary.toLowerCase().replace(/_/g, ' '),
      env(primary) || env(fallback) ? 'ok' : 'fail',
      env(primary) ? primary : env(fallback) ? `${fallback} (fallback)` : `neither ${primary} nor ${fallback}`,
    );
  }
}

async function main(): Promise<void> {
  const live = !process.argv.includes('--skip-live');
  console.log(`Weekly Digest provider preflight${live ? '' : ' (configuration only)'}\n`);

  checkConfig();
  await checkClaudeCli(live);
  await checkOpenRouter(live);

  const failed = checks.filter((check) => check.status === 'fail');
  const warned = checks.filter((check) => check.status === 'warn');
  console.log(
    `\n${checks.length} checks — ${checks.length - failed.length - warned.length} ok, ${warned.length} warn, ${failed.length} fail`,
  );
  if (failed.length > 0) {
    console.log('\nA master run dispatched now would fail on:');
    for (const check of failed) console.log(`  - ${check.name}: ${check.detail}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
