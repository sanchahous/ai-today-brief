/**
 * Backfill legacy items into the Phase-1 rich format — zero-cost lane.
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/backfill-rich.ts [--limit N] [--dry-run]
 *
 * For every published item that predates the rich pipeline (body_md_en IS
 * NULL): re-fetch its source page (enrich), generate ONLY the rich fields
 * (body_md, facts, code_snippet, when/when-not, community_reactions,
 * citations) with Gemini Flash, fact-check them with the VERIFY→revise loop,
 * and update the row. The human-approved title/summary/takeaways are NEVER
 * touched. Items whose rich fields fail verification stay legacy — the old
 * rendering is the safe fallback.
 *
 * Budget: batches of 5 items ≈ 3 Flash calls per batch (generate + verify +
 * occasional revise) → the whole archive fits comfortably inside the free
 * AI Studio tier (Flash 250 RPD). Idempotent: re-runs skip filled rows.
 */
import { loadPipelineConfig } from '../config';
import { createServiceClient, type PipelineDb } from '../db';
import { enrichPool, type EnrichedSource } from '../enrich';
import { logError, logEvent } from '../log';
import { resolveGeminiModelQueue } from '../gemini-models';
import type { PoolItem } from '../select';
import {
  GEMINI_SCHEMA,
  generateWithModelQueue,
  parseBrief,
  type DraftItem,
} from '../summarize';
import { reviseFlaggedItems, verifyClaims } from '../verify';

const BATCH_SIZE = 5;
const SLEEP_BETWEEN_BATCHES_MS = 25_000;

interface LegacyItem {
  id: string;
  slug: string | null;
  title_en: string | null;
  title_uk: string | null;
  summary_en: string;
  summary_uk: string;
  deep_dive_en: string | null;
  category_slug: string | null;
  url: string;
  source_name: string | null;
  discussion_url: string | null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function loadLegacyItems(db: PipelineDb, limit: number): Promise<LegacyItem[]> {
  const { data: briefs, error: bErr } = await db
    .from('briefs')
    .select('id')
    .eq('status', 'published');
  if (bErr) throw new Error(`backfill briefs: ${bErr.message}`);
  const briefIds = (briefs ?? []).map((b) => b.id);
  if (briefIds.length === 0) return [];

  const { data, error } = await db
    .from('brief_items')
    .select(
      'id, slug, title_en, title_uk, summary_en, summary_uk, deep_dive_en, category_slug, articles(url, source_url, source_name)',
    )
    .in('brief_id', briefIds)
    .eq('review_status', 'approved')
    .is('body_md_en', null)
    .limit(limit);
  if (error) throw new Error(`backfill items: ${error.message}`);

  return (data ?? []).flatMap((r) => {
    const article = r.articles as {
      url: string | null;
      source_url: string | null;
      source_name: string | null;
    } | null;
    if (!article?.url) return [];
    return [
      {
        id: r.id,
        slug: r.slug,
        title_en: r.title_en,
        title_uk: r.title_uk,
        summary_en: r.summary_en,
        summary_uk: r.summary_uk,
        deep_dive_en: r.deep_dive_en,
        category_slug: r.category_slug,
        url: article.url,
        source_name: article.source_name,
        discussion_url: article.source_url,
      },
    ];
  });
}

function buildBackfillPrompt(batch: LegacyItem[], enrichment: EnrichedSource[]): string {
  const textByRef = new Map(enrichment.filter((e) => e.text).map((e) => [e.ref, e.text!]));
  const commentsByRef = new Map(enrichment.map((e) => [e.ref, e.comments]));

  const itemsBlock = batch
    .map((item, i) => {
      const ref = i + 1;
      const comments = commentsByRef.get(ref) ?? [];
      return [
        `[${ref}] EXISTING TITLE: ${item.title_en}`,
        `EXISTING SUMMARY: ${item.summary_en}`,
        item.deep_dive_en ? `EXISTING ANALYSIS:\n${item.deep_dive_en}` : '',
        textByRef.has(ref)
          ? `SOURCE TEXT:\n${textByRef.get(ref)}`
          : 'SOURCE TEXT: (unavailable — write conservatively, no new specifics)',
        comments.length
          ? `HN COMMENTS:\n${comments.map((c) => `- ${c.author} (${c.url}): ${c.text}`).join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return `You are upgrading ALREADY PUBLISHED items of "AI Today Brief" to a richer format.
The title and summary are approved and FINAL — copy them into title_en/uk and
summary_en/uk unchanged. Your job is ONLY the new fields, in BOTH languages
(natural Ukrainian), grounded in the SOURCE TEXT for the same [ref]:

  body_md_en/uk    — 150–300 words of MARKDOWN: 2–4 "### " sections; concrete numbers,
                     prices, limits, commands from the source; inline \`code\`. HARD RULE:
                     every specific claim must come from the source text; with no source,
                     one short section restating the existing analysis, no new specifics.
  facts_en/uk      — 2–6 {label, value} rows; only values present in the source; [] if none.
  code_snippet     — {language, code} shortest way to try it, from the source; null if N/A.
  when_to_use_en/uk / when_not_to_use_en/uk — 2–3 honest bullets each; [] if not applicable.
  community_reactions — 1–3 of the provided HN COMMENTS: {author, quote ≤200 chars verbatim, url}; [] if none.
  citations        — 1–3 {title, url} chosen ONLY from URLs present in this prompt.
  takeaways/action_items/why_matters/deep_dive/social_hook/impact_level/tools_mentioned —
                     copy reasonable values or leave as instructed by the schema; they are ignored.

Return the full JSON brief object with one entry per [ref]. Never invent facts.

ITEMS:
${itemsBlock}`;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) || 20 : 20;

  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);

  const legacy = await loadLegacyItems(db, limit);
  logEvent('info', 'enrich', 'Backfill started', { items: legacy.length, dry_run: dryRun });
  if (legacy.length === 0) return;

  let updated = 0;
  let skipped = 0;

  for (let offset = 0; offset < legacy.length; offset += BATCH_SIZE) {
    const batch = legacy.slice(offset, offset + BATCH_SIZE);

    // Pseudo-pool so the regular enrich stage can be reused as-is.
    const pool: PoolItem[] = batch.map((item, i) => ({
      ref: i + 1,
      title: item.title_en ?? item.summary_en,
      url: item.url,
      source: item.source_name ?? 'unknown',
      topic: '',
      category: 'tools-and-releases',
    }));
    const discussionByUrl = new Map(
      batch
        .filter((b) => b.discussion_url && b.discussion_url !== b.url)
        .map((b) => [b.url, b.discussion_url!]),
    );
    const enrichment = await enrichPool(pool, discussionByUrl, pool.length);

    const prompt = buildBackfillPrompt(batch, enrichment);
    const modelQueue = await resolveGeminiModelQueue(config.geminiApiKey);
    const { text } = await generateWithModelQueue(
      prompt,
      config.geminiApiKey,
      modelQueue,
      2,
      undefined,
      undefined,
      GEMINI_SCHEMA,
    );
    const drafts: DraftItem[] = parseBrief(text, pool).items;

    // Fact-control identical to the live pipeline: verify → revise → re-verify.
    await verifyClaims(drafts, enrichment, config.geminiApiKey, 2);
    const flagged = drafts.filter((d) => d.unsupported_claims.length > 0);
    if (flagged.length > 0) {
      const { revised } = await reviseFlaggedItems(
        flagged,
        enrichment,
        pool,
        config.geminiApiKey,
        2,
      );
      if (revised.length > 0) {
        await verifyClaims(revised, enrichment, config.geminiApiKey, 2);
      }
      const byRef = new Map(revised.map((r) => [r.ref, r]));
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i]!;
        if (d.unsupported_claims.length === 0) continue;
        const rev = byRef.get(d.ref);
        if (rev && rev.unsupported_claims.length === 0) drafts[i] = rev;
      }
    }

    const imageByUrl = new Map(
      enrichment.filter((e) => e.ogImage).map((e) => [e.url, e.ogImage!]),
    );

    for (const draft of drafts) {
      const item = batch[draft.ref - 1];
      if (!item) continue;
      if (draft.unsupported_claims.length > 0) {
        skipped++;
        logEvent('warn', 'verify', 'Backfill: rich fields failed fact-control — left legacy', {
          item_id: item.id,
          title: item.title_en,
        });
        continue;
      }
      if (!draft.body_md_en) {
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`--- ${item.title_en}\n${draft.body_md_en.slice(0, 300)}…\n`);
        updated++;
        continue;
      }

      const { error } = await db
        .from('brief_items')
        .update({
          body_md_en: draft.body_md_en,
          body_md_uk: draft.body_md_uk || draft.body_md_en,
          facts_en: draft.facts_en,
          facts_uk: draft.facts_uk,
          code_snippet: draft.code_snippet,
          when_to_use_en: draft.when_to_use_en,
          when_to_use_uk: draft.when_to_use_uk,
          when_not_to_use_en: draft.when_not_to_use_en,
          when_not_to_use_uk: draft.when_not_to_use_uk,
          community_reactions: draft.community_reactions,
          citations: draft.citations,
          image_url: imageByUrl.get(item.url) ?? null,
        })
        .eq('id', item.id);
      if (error) {
        logError('publish', 'Backfill update failed', error, { item_id: item.id });
        skipped++;
        continue;
      }
      updated++;
    }

    logEvent('info', 'enrich', 'Backfill batch done', {
      batch: Math.floor(offset / BATCH_SIZE) + 1,
      updated,
      skipped,
    });
    if (offset + BATCH_SIZE < legacy.length) await sleep(SLEEP_BETWEEN_BATCHES_MS);
  }

  logEvent('info', 'enrich', 'Backfill complete', { updated, skipped, dry_run: dryRun });
}

main().catch((e) => {
  logError('enrich', 'Backfill failed', e);
  process.exit(1);
});
