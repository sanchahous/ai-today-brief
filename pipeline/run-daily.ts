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
import { enrichPool, type EnrichedSource } from './enrich';
import { collectArticles, toCandidate } from './fetch';
import { rankCandidates } from './rank';
import { dropKnownUrls, isColdSingleton, selectPool } from './select';
import { summarize, type DraftBrief } from './summarize';
import { reviseFlaggedItems, verifyClaims } from './verify';
import { publish } from './publish';
import { notifyReview } from './notify';
import { createEmbedder, type EmbedFn } from './embeddings';
import {
  createServiceClient,
  logPipelineRun,
  matchRelevantItem,
  recentItemUrls,
  recentPublishedTitles,
  storeItemEmbeddings,
  todaysItemTitles,
  type PipelineDb,
  type PipelineRunLog,
} from './db';
import { sendMessage } from './telegram';
import { formatSourceHealthAlert } from './review-format';
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

  // Skip remaining 30-min slots in this progón after we already pushed new items to Telegram.
  if (db && !config.dryRun && (await isPipelineCycleComplete(db, date, cycleIndex).catch(() => false))) {
    logEvent('info', 'fetch', 'Progón already delivered — skipping remaining slots', {
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
  const { articles: fetched, health } = await collectArticles();
  await logStage(db, config.dryRun, {
    date,
    stage: 'fetch',
    status: fetched.length > 0 ? 'ok' : 'skipped',
    durationMs: Date.now() - t,
    meta: { ...runMeta, count: fetched.length, sources: health },
  });

  // Alert the review chat about dead sources/feeds — silent degradation is the
  // failure mode here (the pool keeps filling from whatever is left). Throttled
  // to once per progón: 6 half-hour retry slots would otherwise repeat the
  // identical alert into the same chat the reviewer works in.
  const unhealthy = health.filter(
    (h) => h.status !== 'ok' || (h.dead_feeds?.length ?? 0) > 0,
  );
  if (
    unhealthy.length > 0 &&
    !config.dryRun &&
    db &&
    config.telegramBotToken &&
    config.telegramReviewChatId
  ) {
    let alreadyAlerted = false;
    try {
      const { count } = await db
        .from('pipeline_runs')
        .select('id', { count: 'exact', head: true })
        .eq('date', date)
        .eq('stage', 'fetch')
        .contains('meta', { cycle: cycleIndex, source_alert_sent: true });
      alreadyAlerted = (count ?? 0) > 0;
    } catch (e) {
      logError('fetch', 'source alert throttle check failed (non-fatal)', e);
    }
    if (!alreadyAlerted) {
      await sendMessage(
        config.telegramBotToken,
        config.telegramReviewChatId,
        formatSourceHealthAlert(unhealthy),
      );
      await logStage(db, config.dryRun, {
        date,
        stage: 'fetch',
        status: 'ok',
        durationMs: 0,
        meta: {
          ...runMeta,
          source_alert_sent: true,
          unhealthy_sources: unhealthy.map((h) => h.source),
        },
      });
    }
  }

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
    maxColdSingletons: config.maxColdSingletons,
  });
  await logStage(db, config.dryRun, {
    date,
    stage: 'rank',
    status: pool.length > 0 ? 'ok' : 'skipped',
    durationMs: Date.now() - t,
    meta: {
      ...runMeta,
      clusters: ranking.clusters,
      ranked: ranking.ranked.length,
      pool: pool.length,
      cold_singletons_ranked: ranking.ranked.filter(isColdSingleton).length,
    },
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

  // ── Exact dedup ───────────────────────────────────────────────────────────────
  // Drop candidates whose URL already backs a brief item of the last 30 days —
  // a hot story can sit in the sources for a week and must never publish twice.
  // Deterministic and free; runs before the (paid) embedding pass. Non-fatal:
  // if the lookup fails, the semantic pass below still stands guard.
  let urlFiltered = pool;
  if (db) {
    t = Date.now();
    try {
      const knownUrls = await recentItemUrls(db, 30);
      urlFiltered = dropKnownUrls(pool, knownUrls);
      const dropped = pool.length - urlFiltered.length;
      for (const item of pool) {
        if (knownUrls.has(item.url)) {
          logEvent('info', 'dedup', 'Candidate dropped (URL already used)', {
            title: item.title,
            url: item.url,
          });
        }
      }
      await logStage(db, config.dryRun, {
        date,
        stage: 'dedup',
        status: 'ok',
        durationMs: Date.now() - t,
        meta: {
          ...runMeta,
          exact_pool_in: pool.length,
          exact_pool_out: urlFiltered.length,
          exact_dropped: dropped,
          known_urls: knownUrls.size,
        },
      });
    } catch (e) {
      logError('dedup', 'recentItemUrls failed (non-fatal — exact guard skipped)', e);
    }
    if (urlFiltered.length === 0) {
      logEvent('info', 'dedup', 'All candidates already used — skipping');
      return;
    }
  }

  // ── Semantic dedup ────────────────────────────────────────────────────────────
  // Embed each pool candidate's title and drop any that are within maxEmbedDistance
  // (cosine) of a previously published brief_item. This is the hard, deterministic
  // cross-day dedup that catches the same story re-worded differently.
  // Skipped in dry-run (no db) and when the embedding store is still empty.
  let embed: EmbedFn | null = null;
  let dedupedPool = urlFiltered;
  if (db) {
    t = Date.now();
    embed = createEmbedder(config.geminiApiKey);
    const embedBatch = urlFiltered.slice(0, config.embedLimit);
    const vectors = await embed(embedBatch.map((c) => c.title));
    const kept = [];
    let dropped = 0;
    for (let i = 0; i < embedBatch.length; i++) {
      const vec = vectors[i];
      if (!vec || vec.length === 0) {
        kept.push(embedBatch[i]!);
        continue;
      }
      const match = await matchRelevantItem(db, vec, config.maxEmbedDistance, date).catch(() => null);
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
    for (let i = embedBatch.length; i < urlFiltered.length; i++) kept.push(urlFiltered[i]!);
    // Re-number refs so the LLM sees contiguous 1..N.
    dedupedPool = kept.map((item, idx) => ({ ...item, ref: idx + 1 }));
    await logStage(db, config.dryRun, {
      date,
      stage: 'dedup',
      status: 'ok',
      durationMs: Date.now() - t,
      meta: {
        ...runMeta,
        pool_in: urlFiltered.length,
        pool_out: dedupedPool.length,
        dropped,
        embedded: embedBatch.length,
      },
    });
    logEvent('info', 'dedup', 'Semantic dedup complete', {
      pool_in: urlFiltered.length,
      pool_out: dedupedPool.length,
      dropped,
      max_distance: config.maxEmbedDistance,
    });
    if (dedupedPool.length === 0) {
      logEvent('info', 'dedup', 'All candidates are semantic duplicates — skipping');
      return;
    }
  }

  // ── Enrich ───────────────────────────────────────────────────────────────────
  // Fetch the actual source pages for the top candidates so the editor model
  // writes from full text (numbers, prices, commands) instead of headlines.
  let enrichment: EnrichedSource[] = [];
  if (config.enrichLimit > 0) {
    t = Date.now();
    const discussionUrlByUrl = new Map(
      fetched
        .filter((a) => a.source_url && a.source_url !== a.url)
        .map((a) => [a.url, a.source_url]),
    );
    enrichment = await enrichPool(dedupedPool, discussionUrlByUrl, config.enrichLimit);
    await logStage(db, config.dryRun, {
      date,
      stage: 'enrich',
      status: enrichment.some((e) => e.text) ? 'ok' : 'skipped',
      durationMs: Date.now() - t,
      meta: {
        ...runMeta,
        targets: Math.min(config.enrichLimit, dedupedPool.length),
        with_text: enrichment.filter((e) => e.text).length,
        with_image: enrichment.filter((e) => e.ogImage).length,
        with_comments: enrichment.filter((e) => e.comments.length > 0).length,
      },
    });
  }

  // ── Summarize ────────────────────────────────────────────────────────────────
  t = Date.now();
  // "Do not repeat" context: today's packs first (intra-day), then the recent
  // published archive (cross-day). Today's titles are schema-bounded (≤10 per
  // pack) and must not eat the cross-day budget — by the evening progóns they
  // would otherwise evict the published archive from the prompt entirely.
  const todays = db ? await todaysItemTitles(db, date).catch(() => []) : [];
  const published = db ? await recentPublishedTitles(db, config.recentTitles).catch(() => []) : [];
  const recent = [...todays, ...published.filter((p) => !todays.includes(p))].slice(
    0,
    todays.length + config.recentTitles,
  );
  const summarized = await summarize(
    dedupedPool,
    recent,
    config.maxItems,
    config.geminiApiKey,
    openRouterKey,
    geminiAttempts,
    enrichment,
  );
  const { brief, providerModel, usage } = summarized;
  await logStage(db, config.dryRun, {
    date,
    stage: 'summarize',
    status: brief.items.length > 0 ? 'ok' : 'skipped',
    durationMs: Date.now() - t,
    meta: {
      ...runMeta,
      selected: brief.items.length,
      pool: pool.length,
      model: providerModel,
      prompt_tokens: usage?.promptTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
      usage_estimated: usage?.estimated ?? null,
    },
  });
  if (brief.items.length === 0) {
    logEvent('info', 'summarize', 'Editor kept nothing — skipping');
    return;
  }

  // Hero images come from the source pages' og:image, never from the LLM.
  const imageByUrl = new Map(
    enrichment.filter((e) => e.ogImage).map((e) => [e.url, e.ogImage!]),
  );
  for (const item of brief.items) {
    item.image_url = imageByUrl.get(item.url) ?? null;
  }

  // ── Verify → revise → re-verify → auto-drop ─────────────────────────────────
  // Fully automatic fact-control: flagged items get ONE targeted rewrite
  // against their source; whatever still fails is dropped from the pack. The
  // human gate stays an editorial-taste check, never a fact-checking duty.
  // Non-fatal: a crashed checker publishes the items unchecked (flag visible).
  if (config.verifyClaims && enrichment.some((e) => e.text)) {
    t = Date.now();
    try {
      const outcome = await verifyClaims(
        brief.items,
        enrichment,
        config.geminiApiKey,
        geminiAttempts,
        openRouterKey,
      );

      let revisedCount = 0;
      const dropped: string[] = [];
      const flagged = brief.items.filter((i) => i.unsupported_claims.length > 0);
      if (flagged.length > 0) {
        const { revised } = await reviseFlaggedItems(
          flagged,
          enrichment,
          dedupedPool,
          config.geminiApiKey,
          geminiAttempts,
          openRouterKey,
        );
        if (revised.length > 0) {
          await verifyClaims(
            revised,
            enrichment,
            config.geminiApiKey,
            geminiAttempts,
            openRouterKey,
          );
        }
        const revisedByRef = new Map(revised.map((r) => [r.ref, r]));
        brief.items = brief.items.flatMap((item) => {
          if (item.unsupported_claims.length === 0) return [item];
          const rev = revisedByRef.get(item.ref);
          if (rev && rev.unsupported_claims.length === 0) {
            revisedCount++;
            // Keep the identity fields the revise pass must not change.
            return [{ ...rev, slug: item.slug, image_url: item.image_url }];
          }
          dropped.push(item.title_en);
          logEvent('warn', 'verify', 'Item dropped by auto fact-control', {
            ref: item.ref,
            title: item.title_en,
            claims: item.unsupported_claims,
          });
          return [];
        });
        if (
          dropped.length > 0 &&
          !config.dryRun &&
          config.telegramBotToken &&
          config.telegramReviewChatId
        ) {
          await sendMessage(
            config.telegramBotToken,
            config.telegramReviewChatId,
            ['⛔ <b>АВТО-ФАКТ-ЧЕК відкинув</b> (джерело не підтверджує):', ...dropped.map((d) => `• ${d}`)].join('\n'),
          );
        }
      }

      await logStage(db, config.dryRun, {
        date,
        stage: 'verify',
        status: outcome.checked > 0 ? 'ok' : 'skipped',
        durationMs: Date.now() - t,
        meta: {
          ...runMeta,
          checked: outcome.checked,
          flagged: outcome.flagged,
          revised: revisedCount,
          dropped: dropped.length,
          model: outcome.model,
          prompt_tokens: outcome.usage?.promptTokens ?? null,
          output_tokens: outcome.usage?.outputTokens ?? null,
        },
      });
      if (brief.items.length === 0) {
        logEvent('info', 'verify', 'Auto fact-control dropped everything — skipping');
        return;
      }
    } catch (e) {
      logError('verify', 'Claim verification failed (non-fatal)', e);
      await logStage(db, config.dryRun, {
        date,
        stage: 'verify',
        status: 'failed',
        durationMs: Date.now() - t,
        meta: runMeta,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ── Publish (or preview) ─────────────────────────────────────────────────────
  if (config.dryRun || !db) {
    printDryRun(brief);
    return;
  }

  t = Date.now();
  // Persist ranking telemetry per article — the dataset for tuning WEIGHTS
  // against the editor's approve/reject decisions later.
  const scoresByUrl = new Map(
    ranking.ranked.map((e) => [e.lead.url, { score: e.score, mentions: e.mentions }]),
  );
  const result = await publish(db, date, fetched, brief, `pipeline:${providerModel}`, scoresByUrl);
  await logStage(db, config.dryRun, {
    date,
    stage: 'publish',
    status: result.itemCount === 0 ? 'skipped' : 'ok',
    durationMs: Date.now() - t,
    meta: {
      ...runMeta,
      brief_id: result.briefId,
      edition: result.edition,
      items: result.itemCount,
      inserted: result.insertedCount,
      is_new_pack: result.isNewPack,
    },
  });
  logEvent('info', 'publish', 'Daily pipeline complete', {
    date,
    brief_id: result.briefId,
    edition: result.edition,
    items: result.itemCount,
    inserted: result.insertedCount,
    status: 'draft',
  });

  // ── Store embeddings for future dedup ────────────────────────────────────────
  // Embed the published items' English titles and upsert into brief_item_embeddings
  // so tomorrow's pipeline can do semantic cross-day dedup against them.
  // Best-effort: a failure here does not abort the run — the brief is already written.
  if (result.itemCount > 0 && embed) {
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
  if (result.insertedCount > 0 && config.telegramBotToken && config.telegramReviewChatId) {
    await notifyReview(db, config.telegramBotToken, config.telegramReviewChatId, result.briefId, {
      cycleLabel,
    });
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
