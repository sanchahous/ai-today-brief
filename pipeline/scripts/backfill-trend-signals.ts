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
import { fetchWithRetry } from './../sources/http';
import { logError, logEvent } from '../log';
import {
  applyLifecycle,
  buildGdeltUrl,
  parseGdeltTimeline,
  risingScore,
  TREND_ENTITIES,
  type TrendEntity,
} from '../trend-signals';

const TIMESPAN = '3m';
const SLEEP_BETWEEN_MS = 1500; // be polite to the free API

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function captureEntity(
  db: PipelineDb | null,
  entity: TrendEntity,
  dryRun: boolean,
): Promise<'ok' | 'empty' | 'failed'> {
  const url = buildGdeltUrl(entity.query, TIMESPAN);
  const res = await fetchWithRetry(url, { headers: { accept: 'application/json' } });
  if (!res) return 'failed';
  const points = parseGdeltTimeline(await res.text());
  if (points.length === 0) return 'empty';

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
    return 'ok';
  }

  // Cast through unknown: entity_trend_signals is not in the generated Database
  // type until it is regenerated post-migration-033.
  const loose = db as unknown as {
    from: (table: string) => {
      insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await loose.from('entity_trend_signals').insert({
    entity: entity.key,
    source: 'gdelt',
    window: TIMESPAN,
    rising_score: score,
    raw: { lifecycle: entity.lifecycle, raw_rising: raw, points: points.length },
  });
  if (error) {
    logError('fetch', 'Trend signal insert failed', error, { entity: entity.key });
    return 'failed';
  }
  return 'ok';
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const config = loadPipelineConfig();
  const db = dryRun ? null : createServiceClient(config.supabaseUrl, config.supabaseServiceKey);

  let ok = 0;
  let empty = 0;
  let failed = 0;
  for (const entity of TREND_ENTITIES) {
    const status = await captureEntity(db, entity, dryRun).catch((e) => {
      logError('fetch', 'Trend signal entity failed — continuing', e, { entity: entity.key });
      return 'failed' as const;
    });
    if (status === 'ok') ok++;
    else if (status === 'empty') empty++;
    else failed++;
    await sleep(SLEEP_BETWEEN_MS);
  }

  logEvent('info', 'fetch', 'Trend signal capture complete', {
    entities: TREND_ENTITIES.length,
    ok,
    empty,
    failed,
    dry_run: dryRun,
  });
}

main().catch((e) => {
  logError('fetch', 'Trend signal capture failed', e);
  process.exit(1);
});
/* v8 ignore end */
