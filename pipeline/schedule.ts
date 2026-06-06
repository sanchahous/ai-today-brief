/**
 * Kyiv daily schedule: 6 cron slots at 06:00–08:30 (every 30 min).
 *
 * Slot 1–5: Gemini only (2 retries).
 * Slot 6  : Gemini (3 retries) then OpenRouter fallback chain.
 *
 * When running outside the Kyiv window (manual trigger, CI) the pipeline
 * resolves its own "attempt" from --attempt flag → env → failure count.
 */

import type { PipelineDb } from './db';

export const KYIV_SCHEDULE_ATTEMPTS = 6 as const;
const KYIV_FIRST_HOUR = 6;
const KYIV_LAST_SLOT_MINUTES = 8 * 60 + 30; // 08:30

// ─── Time helpers ─────────────────────────────────────────────────────────────

/** Calendar date for the brief in Europe/Kyiv (YYYY-MM-DD). */
export function getPipelineDateKyiv(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Minutes since midnight in Europe/Kyiv. */
export function getKyivMinutesOfDay(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

// ─── Slot resolution ──────────────────────────────────────────────────────────

/**
 * Scheduled slot 1–6 when run at 06:00, 06:30, … 08:30 Kyiv.
 * Returns null outside that window (manual trigger, late retry, etc.).
 */
export function getKyivScheduleAttemptSlot(now: Date = new Date()): number | null {
  const total = getKyivMinutesOfDay(now);
  const start = KYIV_FIRST_HOUR * 60;
  if (total < start || total > KYIV_LAST_SLOT_MINUTES) return null;
  const offset = total - start;
  if (offset % 30 !== 0) return null;
  const slot = offset / 30 + 1;
  return slot >= 1 && slot <= KYIV_SCHEDULE_ATTEMPTS ? slot : null;
}

export function parseScheduleAttemptFlag(argv: string[]): number | undefined {
  const flag = argv.indexOf('--attempt');
  if (flag === -1 || !argv[flag + 1]) return undefined;
  const n = Number.parseInt(argv[flag + 1]!, 10);
  if (!Number.isFinite(n) || n < 1 || n > KYIV_SCHEDULE_ATTEMPTS) {
    throw new Error(`[pipeline] --attempt must be 1–${KYIV_SCHEDULE_ATTEMPTS}, got: ${n}`);
  }
  return n;
}

/**
 * Resolve which attempt number we're on:
 *   1. `--attempt N` CLI flag
 *   2. `PIPELINE_SCHEDULE_ATTEMPT` env
 *   3. Kyiv-time slot (on-schedule run)
 *   4. Failure count + 1 (catch-up / manual)
 */
export function resolveScheduleAttempt(
  options: {
    argv?: string[];
    env?: Record<string, string | undefined>;
    now?: Date;
    summarizeFailuresToday?: number;
  } = {},
): number {
  const argv = options.argv ?? process.argv;
  const env = options.env ?? (process.env as Record<string, string | undefined>);

  const fromFlag = parseScheduleAttemptFlag(argv);
  if (fromFlag !== undefined) return fromFlag;

  const fromEnv = env.PIPELINE_SCHEDULE_ATTEMPT?.trim();
  if (fromEnv) {
    const n = Number.parseInt(fromEnv, 10);
    if (Number.isFinite(n) && n >= 1 && n <= KYIV_SCHEDULE_ATTEMPTS) return n;
  }

  const now = options.now ?? new Date();
  const kyivSlot = getKyivScheduleAttemptSlot(now);
  if (kyivSlot !== null) return kyivSlot;

  const failures = options.summarizeFailuresToday ?? 0;
  return Math.min(Math.max(failures + 1, 1), KYIV_SCHEDULE_ATTEMPTS);
}

// ─── Per-slot policy ──────────────────────────────────────────────────────────

/**
 * OpenRouter is only engaged on the final slot (6) — the "last chance" run.
 * Earlier slots avoid the extra latency and cost.
 */
export function shouldUseOpenRouter(scheduleAttempt: number): boolean {
  return scheduleAttempt >= KYIV_SCHEDULE_ATTEMPTS;
}

/**
 * Lighter Gemini retry budget on early slots (less waiting before the next cron fires),
 * full budget on the final slot where we want to exhaust every avenue.
 */
export function geminiMaxAttemptsForSlot(scheduleAttempt: number): number {
  return scheduleAttempt >= KYIV_SCHEDULE_ATTEMPTS ? 3 : 2;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Count how many times today's summarize stage has already failed.
 * Used to infer the schedule attempt when running outside the Kyiv cron window.
 * Returns 0 on error (non-fatal — the attempt can still be resolved from other sources).
 */
export async function countSummarizeFailuresForDate(
  db: PipelineDb,
  date: string,
): Promise<number> {
  const { count, error } = await db
    .from('pipeline_runs')
    .select('id', { count: 'exact', head: true })
    .eq('date', date)
    .eq('stage', 'summarize')
    .eq('status', 'failed');
  if (error) throw new Error(`[schedule] failure count failed: ${error.message}`);
  return count ?? 0;
}
