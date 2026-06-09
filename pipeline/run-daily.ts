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
import { summarize, type DraftBrief } from './summarize';
import { publish } from './publish';
import { notifyReview } from './notify';
import { createEmbedder, type EmbedFn } from './embeddings';
import {
  createServiceClient,
  logPipelineRun,
  matchPublishedItem,
  recentPublishedTitles,
  storeItemEmbeddings,
  type PipelineDb,
  type PipelineRunLog,
} from './db';
import {
  countSummarizeFailuresForCycle,
  formatKyivCycleLabel,
  geminiMaxAttemptsForSlot,
  getKyivCycleIndex,
  getPipelineDateKyiv,
  isPipelineCycleComplete,
  resolveScheduleAttempt,
} from './schedule';
import { logError, logEvent } from './log';

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
  const date = getPipelineDateKyiv();

  const db = config.dryRun ? null : createServiceClient(config.supabaseUrl, config.supabaseServiceKey);
  const cycleIndex = getKyivCycleIndex();
  const cycleLabel = formatKyivCycleLabel(cycleIndex);

  if (db && !config.dryRun && (await isPipelineCycleComplete(db, date, cycleIndex).catch(() => false))) {
    logEvent('info', 'fetch', 'Progón already completed — skipping remaining slots', {
      date,
      cycle: cycleIndex,
      cycle_label: cycleLabel,
    });
    return;
  }

  // ── Schedule awareness ────────────────────────────────────────────────────────
  const failuresInCycle = db
    ? await countSummarizeFailuresForCycle(db, date, cycleIndex).catch(() => 0)
    : 0;
  const scheduleAttempt = resolveScheduleAttempt({
    argv: process.argv,
    env: process.env as Record<string, string | undefined>,
    now: new Date(),
    summarizeFailuresInCycle: failuresInCycle,
  });
  const runMeta = { cycle: cycleIndex, schedule_attempt: scheduleAttempt };
  // OpenRouter is only called after Gemini exhausts retries; enable whenever the key
  // is set so early cron slots don't hard-fail on transient 503s from gemini-3.5-flash.
  const openRouterKey = config.openRouterApiKey;
  const geminiAttempts = geminiMaxAttemptsForSlot(scheduleAttempt);

  logEvent('info', 'fetch', 'Daily pipeline started', {
    date,
    dry_run: config.dryRun,
    gemini_models: 'catalog',
    cycle: cycleIndex,
    cycle_label: cycleLabel,
    schedule_attempt: scheduleAttempt,
    gemini_attempts: geminiAttempts,
    openrouter_enabled: Boolean(openRouterKey),
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  let t = Date.now();
  const fetched = await collectArticles();
  await logStage(db, config.dryRun, {
    date,
    stage: 'fetch',
    status: fetched.length > 0 ? 'ok' : 'skipped',
    durationMs: Date.now() - t,
    meta: { ...runMeta, count: fetched.length },
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
    meta: { ...runMeta, clusters: ranking.clusters, ranked: ranking.ranked.length, pool: pool.length },
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

  // ── Semantic dedup ────────────────────────────────────────────────────────────
  // Embed each pool candidate's title and drop any that are within maxEmbedDistance
  // (cosine) of a previously published brief_item. This is the hard, deterministic
  // cross-day dedup that catches the same story re-worded differently.
  // Skipped in dry-run (no db) and when the embedding store is still empty.
  let embed: EmbedFn | null = null;
  let dedupedPool = pool;
  if (db) {
    t = Date.now();
    embed = createEmbedder(config.geminiApiKey);
    const embedBatch = pool.slice(0, config.embedLimit);
    const vectors = await embed(embedBatch.map((c) => c.title));
    const kept = [];
    let dropped = 0;
    for (let i = 0; i < embedBatch.length; i++) {
      const vec = vectors[i];
      if (!vec || vec.length === 0) {
        kept.push(embedBatch[i]!);
        continue;
      }
      const match = await matchPublishedItem(db, vec, config.maxEmbedDistance).catch(() => null);
      if (match) {
        dropped++;
        logEvent('info', 'dedup', 'Candidate dropped (semantic duplicate)', {
          title: embedBatch[i]!.title,
          distance: match.distance,
        });
        continue;
      }
      kept.push(embedBatch[i]!);
    }
    // Items beyond embedLimit (below the score cap) pass through unchanged.
    for (let i = embedBatch.length; i < pool.length; i++) kept.push(pool[i]!);
    // Re-number refs so the LLM sees contiguous 1..N.
    dedupedPool = kept.map((item, idx) => ({ ...item, ref: idx + 1 }));
    await logStage(db, config.dryRun, {
      date,
      stage: 'dedup',
      status: 'ok',
      durationMs: Date.now() - t,
      meta: { ...runMeta, pool_in: pool.length, pool_out: dedupedPool.length, dropped },
    });
    logEvent('info', 'dedup', 'Semantic dedup complete', {
      pool_in: pool.length,
      pool_out: dedupedPool.length,
      dropped,
      max_distance: config.maxEmbedDistance,
    });
    if (dedupedPool.length === 0) {
      logEvent('info', 'dedup', 'All candidates are semantic duplicates — skipping');
      return;
    }
  }

  // ── Summarize ────────────────────────────────────────────────────────────────
  t = Date.now();
  const recent = db ? await recentPublishedTitles(db, config.recentTitles).catch(() => []) : [];
  const summarized = await summarize(
    dedupedPool,
    recent,
    config.maxItems,
    config.geminiApiKey,
    openRouterKey,
    geminiAttempts,
  );
  const { brief, providerModel } = summarized;
  await logStage(db, config.dryRun, {
    date,
    stage: 'summarize',
    status: brief.items.length > 0 ? 'ok' : 'skipped',
    durationMs: Date.now() - t,
    meta: { ...runMeta, selected: brief.items.length, pool: pool.length, model: providerModel },
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
  const result = await publish(db, date, fetched, brief, `pipeline:${providerModel}`);
  await logStage(db, config.dryRun, {
    date,
    stage: 'publish',
    status: result.skipped || result.itemCount === 0 ? 'skipped' : 'ok',
    durationMs: Date.now() - t,
    meta: {
      ...runMeta,
      brief_id: result.briefId,
      items: result.itemCount,
      skipped: result.skipped ?? false,
    },
  });
  logEvent('info', 'publish', 'Daily pipeline complete', {
    date,
    brief_id: result.briefId,
    items: result.itemCount,
    status: result.skipped ? 'left_published' : 'draft',
  });

  // ── Store embeddings for future dedup ────────────────────────────────────────
  // Embed the published items' English titles and upsert into brief_item_embeddings
  // so tomorrow's pipeline can do semantic cross-day dedup against them.
  // Best-effort: a failure here does not abort the run — the brief is already written.
  if (!result.skipped && embed) {
    try {
      const stored = await storeItemEmbeddings(db, result.briefId, embed);
      logEvent('info', 'publish', 'Brief item embeddings stored', {
        brief_id: result.briefId,
        stored,
      });
    } catch (e) {
      logError('publish', 'storeItemEmbeddings failed (non-fatal)', e);
    }
  }

  // ── Notify for review (optional) ─────────────────────────────────────────────
  // Push each pending item to the private Telegram chat with ✅/❌ buttons.
  if (!result.skipped) {
    if (config.telegramBotToken && config.telegramReviewChatId) {
      await notifyReview(db, config.telegramBotToken, config.telegramReviewChatId, result.briefId, {
        cycleLabel,
      });
    }
    await logStage(db, config.dryRun, {
      date,
      stage: 'publish',
      status: 'ok',
      durationMs: 0,
      meta: { ...runMeta, cycle_notified: true, brief_id: result.briefId },
    });
  }
}

main().catch((error) => {
  logError('publish', 'Daily pipeline failed', error);
  process.exit(1);
});
