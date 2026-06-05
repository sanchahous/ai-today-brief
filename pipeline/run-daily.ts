/**
 * Daily pipeline entry point: fetch → rank → summarize → publish.
 *
 *   npx tsx pipeline/run-daily.ts            # curate + write the day's DRAFT brief
 *   npx tsx pipeline/run-daily.ts --dry-run  # fetch + rank + summarize, print, no writes
 *
 * Each stage is logged to `pipeline_runs` (skipped in --dry-run). Partial source
 * failures are absorbed in fetch; the run hard-fails only when a stage's result
 * would be invalid. The brief lands as a draft for a human to publish.
 */

import { loadPipelineConfig } from './config';
import { collectArticles, toCandidate } from './fetch';
import { rankCandidates } from './rank';
import { selectPool } from './select';
import { summarize, resolveGeminiModel, type DraftBrief } from './summarize';
import { publish } from './publish';
import {
  createServiceClient,
  logPipelineRun,
  recentPublishedTitles,
  type PipelineDb,
  type PipelineRunLog,
} from './db';
import { logError, logEvent } from './log';

function todayUtc(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function printDryRun(brief: DraftBrief): void {
  const lines: string[] = [
    `\n──── DRY RUN · ${brief.items.length} item(s) ────`,
    `BRIEF  ${brief.title_en}  /  ${brief.title_uk}`,
    `slug   ${brief.slug}`,
    brief.intro_en ? `intro  ${brief.intro_en}` : '',
  ];
  brief.items.forEach((it, i) => {
    lines.push(
      `\n[${i + 1}] (${it.category_slug})  ${it.title_en}`,
      `    uk: ${it.title_uk}`,
      `    ${it.url}`,
      `    ${it.summary_en}`,
      it.why_matters_en ? `    why: ${it.why_matters_en}` : '',
      it.tools_mentioned.length ? `    tools: ${it.tools_mentioned.join(', ')}` : '',
    );
  });
  logEvent('info', 'summarize', 'Dry-run brief assembled', {
    items: brief.items.length,
    slug: brief.slug,
  });
  console.log(lines.filter(Boolean).join('\n'));
}

async function logStage(
  db: PipelineDb | null,
  dryRun: boolean,
  run: PipelineRunLog,
): Promise<void> {
  if (dryRun || !db) return;
  try {
    await logPipelineRun(db, run);
  } catch (e) {
    logError(run.stage, 'pipeline_runs log failed (non-fatal)', e);
  }
}

async function main(): Promise<void> {
  const config = loadPipelineConfig();
  const date = todayUtc();
  logEvent('info', 'fetch', 'Daily pipeline started', {
    date,
    dry_run: config.dryRun,
    model: resolveGeminiModel(),
  });

  const db = config.dryRun ? null : createServiceClient(config.supabaseUrl, config.supabaseServiceKey);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  let t = Date.now();
  const fetched = await collectArticles();
  await logStage(db, config.dryRun, {
    date,
    stage: 'fetch',
    status: fetched.length > 0 ? 'ok' : 'skipped',
    durationMs: Date.now() - t,
    meta: { count: fetched.length },
  });
  if (fetched.length === 0) {
    logEvent('warn', 'fetch', 'No fresh articles — nothing to do');
    return;
  }

  // ── Rank ───────────────────────────────────────────────────────────────────
  t = Date.now();
  const ranking = rankCandidates(fetched.map(toCandidate));
  const pool = selectPool(ranking.ranked, {
    minScore: config.minScore,
    perTopicCap: config.perTopicCap,
    poolSize: config.poolSize,
  });
  await logStage(db, config.dryRun, {
    date,
    stage: 'rank',
    status: pool.length > 0 ? 'ok' : 'skipped',
    durationMs: Date.now() - t,
    meta: { clusters: ranking.clusters, ranked: ranking.ranked.length, pool: pool.length },
  });
  logEvent('info', 'rank', 'Pool built', {
    fetched: fetched.length,
    clusters: ranking.clusters,
    ranked: ranking.ranked.length,
    pool: pool.length,
  });
  if (pool.length === 0) {
    logEvent('info', 'rank', 'Nothing strong enough this run — skipping');
    return;
  }

  // ── Summarize ────────────────────────────────────────────────────────────────
  t = Date.now();
  const recent = db ? await recentPublishedTitles(db, config.recentTitles).catch(() => []) : [];
  const brief = await summarize(pool, recent, config.maxItems, config.geminiApiKey);
  await logStage(db, config.dryRun, {
    date,
    stage: 'summarize',
    status: brief.items.length > 0 ? 'ok' : 'skipped',
    durationMs: Date.now() - t,
    meta: { selected: brief.items.length, pool: pool.length },
  });
  if (brief.items.length === 0) {
    logEvent('info', 'summarize', 'Editor kept nothing — skipping');
    return;
  }

  // ── Publish (or preview) ─────────────────────────────────────────────────────
  if (config.dryRun || !db) {
    printDryRun(brief);
    return;
  }

  t = Date.now();
  const result = await publish(db, date, fetched, brief, `pipeline:${resolveGeminiModel()}`);
  await logStage(db, config.dryRun, {
    date,
    stage: 'publish',
    status: result.skipped || result.itemCount === 0 ? 'skipped' : 'ok',
    durationMs: Date.now() - t,
    meta: { brief_id: result.briefId, items: result.itemCount, skipped: result.skipped ?? false },
  });
  logEvent('info', 'publish', 'Daily pipeline complete', {
    date,
    brief_id: result.briefId,
    items: result.itemCount,
    status: result.skipped ? 'left_published' : 'draft',
  });
}

main().catch((error) => {
  logError('publish', 'Daily pipeline failed', error);
  process.exit(1);
});
