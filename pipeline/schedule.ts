/**
 * Kyiv schedule: the day is divided into 2-hour cycle slots (00:00, 02:00, …
 * 22:00 → indices 0–11). The cron in .github/workflows/pipeline.yml fires 6 of
 * them, ALL DAYTIME — each lands in its own cycle, so each produces a distinct
 * edition (the cycle-guard skips a cycle that already published + notified).
 * Each cycle has up to 4 retry slots every 30 min (1.5 h window).
 *
 * Slot 1–3: lighter Gemini retries. Slot 4 (final): full Gemini retries + OpenRouter.
 *
 * NOTE: .github/scripts/cycle-guard.mjs duplicates KYIV_CYCLE_HOURS /
 * KYIV_CYCLES_PER_DAY (it runs pre-`npm ci` and can't import this module) — keep
 * the two in sync by hand.
 */

import type { PipelineDb } from './db';

export const KYIV_SCHEDULE_ATTEMPTS = 4 as const;
export const KYIV_CYCLES_PER_DAY = 12 as const;
export const KYIV_CYCLE_HOURS = 2;
export const KYIV_SLOT_INTERVAL_MINUTES = 30;
/** A daily editorial edition closes at 20:00 Europe/Kyiv. */
export const KYIV_EDITORIAL_CUTOFF_MINUTES = 20 * 60;

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

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
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

/**
 * Editorial date for daily intake. At 20:00 Kyiv sharp, incoming material
 * belongs to the next daily edition even though the civil calendar has not
 * changed yet. Keep `getPipelineDateKyiv` for calendar-based consumers such
 * as the midnight auto-publish window.
 */
export function getEditorialDateKyiv(now: Date = new Date()): string {
  const date = getPipelineDateKyiv(now);
  return getKyivMinutesOfDay(now) >= KYIV_EDITORIAL_CUTOFF_MINUTES
    ? addCalendarDays(date, 1)
    : date;
}

// ─── 4 h progón + 30 min slots ───────────────────────────────────────────────

/** Cycle index 0–11 (00:00, 02:00, 04:00, … 22:00 Kyiv). */
export function getKyivCycleIndex(now: Date = new Date()): number {
  const minutes = getKyivMinutesOfDay(now);
  const cycle = Math.floor(minutes / (KYIV_CYCLE_HOURS * 60));
  return Math.min(Math.max(cycle, 0), KYIV_CYCLES_PER_DAY - 1);
}

/** Kyiv start hour for a progón (0, 4, 8, …). */
export function kyivCycleStartHour(cycleIndex: number): number {
  return cycleIndex * KYIV_CYCLE_HOURS;
}

/** `cycle 2, slot 3` → `09:00` Kyiv. */
export function formatKyivSlotTime(cycleIndex: number, slot: number): string {
  const totalMinutes = cycleIndex * KYIV_CYCLE_HOURS * 60 + (slot - 1) * KYIV_SLOT_INTERVAL_MINUTES;
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Human label for logging / Telegram headers. */
export function formatKyivCycleLabel(cycleIndex: number): string {
  const start = kyivCycleStartHour(cycleIndex);
  const endMinutes = start * 60 + (KYIV_SCHEDULE_ATTEMPTS - 1) * KYIV_SLOT_INTERVAL_MINUTES;
  const endH = Math.floor(endMinutes / 60) % 24;
  const endM = endMinutes % 60;
  const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  return `${String(start).padStart(2, '0')}:00–${end}`;
}

/**
 * Slot 1–6 when run on a 30 min boundary inside the current 4 h progón window.
 * Returns null outside scheduled slot minutes (manual trigger, etc.).
 */
export function getKyivScheduleAttemptSlot(now: Date = new Date()): number | null {
  const minutes = getKyivMinutesOfDay(now);
  const cycleIndex = getKyivCycleIndex(now);
  const cycleStart = cycleIndex * KYIV_CYCLE_HOURS * 60;
  const offset = minutes - cycleStart;
  if (offset < 0 || offset > (KYIV_SCHEDULE_ATTEMPTS - 1) * KYIV_SLOT_INTERVAL_MINUTES) {
    return null;
  }
  if (offset % KYIV_SLOT_INTERVAL_MINUTES !== 0) return null;
  const slot = offset / KYIV_SLOT_INTERVAL_MINUTES + 1;
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
 * Resolve slot 1–6 within the current progón:
 *   1. `--attempt N` CLI flag
 *   2. `PIPELINE_SCHEDULE_ATTEMPT` env
 *   3. Kyiv-time slot (on-schedule run)
 *   4. Failure count + 1 in this progón (catch-up / manual)
 */
export function resolveScheduleAttempt(
  options: {
    argv?: string[];
    env?: Record<string, string | undefined>;
    now?: Date;
    summarizeFailuresInCycle?: number;
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

  const failures = options.summarizeFailuresInCycle ?? 0;
  return Math.min(Math.max(failures + 1, 1), KYIV_SCHEDULE_ATTEMPTS);
}

// ─── Per-slot policy ──────────────────────────────────────────────────────────

export function geminiMaxAttemptsForSlot(scheduleAttempt: number): number {
  return scheduleAttempt >= KYIV_SCHEDULE_ATTEMPTS ? 3 : 2;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * True when this date's progón already published + notified successfully.
 * Remaining slots in the same 4 h window should no-op.
 */
export async function isPipelineCycleComplete(
  db: PipelineDb,
  date: string,
  cycleIndex: number,
): Promise<boolean> {
  const { count, error } = await db
    .from('pipeline_runs')
    .select('id', { count: 'exact', head: true })
    .eq('date', date)
    .eq('stage', 'publish')
    .eq('status', 'ok')
    .contains('meta', { cycle: cycleIndex, cycle_notified: true });
  if (error) throw new Error(`[schedule] cycle complete check failed: ${error.message}`);
  return (count ?? 0) > 0;
}

/** Summarize failures in the current progón (for slot inference on manual runs). */
export async function countSummarizeFailuresForCycle(
  db: PipelineDb,
  date: string,
  cycleIndex: number,
): Promise<number> {
  const { count, error } = await db
    .from('pipeline_runs')
    .select('id', { count: 'exact', head: true })
    .eq('date', date)
    .eq('stage', 'summarize')
    .eq('status', 'failed')
    .contains('meta', { cycle: cycleIndex });
  if (error) throw new Error(`[schedule] cycle failure count failed: ${error.message}`);
  return count ?? 0;
}

/** @deprecated Use countSummarizeFailuresForCycle — kept for older log rows without cycle. */
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
