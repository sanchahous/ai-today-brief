/**
 * Capture the external rising-index for each tracked entity (migration 033).
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/backfill-trend-signals.ts [--dry-run]
 *
 * For every entity in TREND_ENTITIES: fetch its GDELT DOC 2.0 timelinevol series,
 * parse it, compute a [0,1] rising score, temper it with the lifecycle prior, and
 * append a row to entity_trend_signals. Free API, no key. Meant to run daily
 * (.github/workflows/trend-signals.yml).
 *
 * --dry-run prints what was parsed + scored without writing — use it on the first
 * live run to confirm GDELT's field names match the defensive parser.
 *
 * Requires migration 033 applied first (the table must exist). Pure scoring logic
 * lives in pipeline/trend-signals.ts (unit-tested); this runner only does IO.
 */

/* v8 ignore start -- network IO + DB writes */
import { loadPipelineConfig } from '../config';
import { createServiceClient, type PipelineDb } from '../db';
import { fetchWithRetry, retryAfterMs } from './../sources/http';
import { logError, logEvent } from '../log';
import {
  applyLifecycle,
  buildGdeltUrl,
  classifyTrendCaptureHealth,
  parseGdeltTimeline,
  risingScore,
  selectStalestTrendEntities,
  TREND_ENTITIES,
  type TrendEntity,
} from '../trend-signals';

const TIMESPAN = '3m';
// Keep the daily job well below its 10-minute Actions budget. Retrying the same
// GDELT 429 starved later entities, so each run now samples only the stalest six
// and lets tomorrow's run continue the queue.
const BATCH_SIZE = 6;
const SLEEP_BETWEEN_MS = 15_000;
const REQUEST_TIMEOUT_MS = 12_000;
const HISTORY_LIMIT = 500;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type CaptureStatus = 'ok' | 'empty' | 'failed' | 'rate_limited';

type CaptureResult = {
  status: CaptureStatus;
  retryAfterMs?: number;
};

type TrendSignalRow = { entity: string; captured_at: string };
type DbError = { message: string };
type LooseTrendTable = {
  select: (columns: string) => {
    order: (
      column: string,
      options: { ascending: boolean },
    ) => {
      limit: (count: number) => PromiseLike<{
        data: TrendSignalRow[] | null;
        error: DbError | null;
      }>;
    };
  };
  insert: (value: Record<string, unknown>) => PromiseLike<{ error: DbError | null }>;
};

function trendTable(db: PipelineDb): LooseTrendTable {
  return (db as unknown as { from: (table: string) => LooseTrendTable }).from(
    'entity_trend_signals',
  );
}

function kyivDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

async function loadLastCapturedAt(db: PipelineDb): Promise<Map<string, string>> {
  const { data, error } = await trendTable(db)
    .select('entity,captured_at')
    .order('captured_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) {
    logError('fetch', 'Trend signal history read failed — using date rotation', error);
    return new Map();
  }
  const latest = new Map<string, string>();
  for (const row of data ?? []) {
    if (!latest.has(row.entity)) latest.set(row.entity, row.captured_at);
  }
  return latest;
}

async function captureEntity(
  db: PipelineDb,
  entity: TrendEntity,
  dryRun: boolean,
): Promise<CaptureResult> {
  const url = buildGdeltUrl(entity.query, TIMESPAN);
  const res = await fetchWithRetry(
    url,
    { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    1,
  );
  if (!res) return { status: 'failed' };
  if (res.status === 429) {
    const waitMs = retryAfterMs(res) ?? SLEEP_BETWEEN_MS;
    logEvent('warn', 'fetch', 'GDELT rate limit — deferring entity', {
      entity: entity.key,
      retry_after_ms: waitMs,
    });
    return { status: 'rate_limited', retryAfterMs: waitMs };
  }
  if (!res.ok) {
    logEvent('warn', 'fetch', 'GDELT request rejected — deferring entity', {
      entity: entity.key,
      status: res.status,
    });
    return { status: 'failed' };
  }
  const points = parseGdeltTimeline(await res.text());
  if (points.length === 0) return { status: 'empty' };

  const raw = risingScore(points.map((p) => p.value));
  const score = applyLifecycle(raw, entity.lifecycle);

  if (dryRun) {
    logEvent('info', 'fetch', 'Trend signal (dry run)', {
      entity: entity.key,
      points: points.length,
      raw_rising: Number(raw.toFixed(4)),
      score: Number(score.toFixed(4)),
      lifecycle: entity.lifecycle,
    });
    return { status: 'ok' };
  }

  const { error } = await trendTable(db).insert({
    entity: entity.key,
    source: 'gdelt',
    window_span: TIMESPAN,
    rising_score: score,
    raw: { lifecycle: entity.lifecycle, raw_rising: raw, points: points.length },
  });
  if (error) {
    logError('fetch', 'Trend signal insert failed', error, { entity: entity.key });
    return { status: 'failed' };
  }
  return { status: 'ok' };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);
  const anchorDate = kyivDate();
  const lastCapturedAt = await loadLastCapturedAt(db);
  const selected = selectStalestTrendEntities(
    TREND_ENTITIES,
    lastCapturedAt,
    anchorDate,
    BATCH_SIZE,
  );

  let ok = 0;
  let empty = 0;
  let failed = 0;
  let rateLimited = 0;
  for (const [index, entity] of selected.entries()) {
    const result: CaptureResult = await captureEntity(db, entity, dryRun).catch((e) => {
      logError('fetch', 'Trend signal entity failed — continuing', e, { entity: entity.key });
      return { status: 'failed' as const };
    });
    if (result.status === 'ok') ok++;
    else if (result.status === 'empty') empty++;
    else if (result.status === 'rate_limited') rateLimited++;
    else failed++;
    if (index < selected.length - 1) {
      await sleep(Math.max(SLEEP_BETWEEN_MS, result.retryAfterMs ?? 0));
    }
  }

  const health = classifyTrendCaptureHealth(selected.length, ok);
  logEvent('info', 'fetch', 'Trend signal capture complete', {
    entities_total: TREND_ENTITIES.length,
    entities_attempted: selected.length,
    selected_entities: selected.map((entity) => entity.key),
    ok,
    empty,
    failed,
    rate_limited: rateLimited,
    health,
    dry_run: dryRun,
  });
  if (health === 'failed') process.exitCode = 1;
}

main().catch((e) => {
  logError('fetch', 'Trend signal capture failed', e);
  process.exit(1);
});
/* v8 ignore end */
