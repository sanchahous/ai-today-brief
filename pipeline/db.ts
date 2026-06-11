/**
 * Supabase data layer for the pipeline — holds the **service role** key and
 * bypasses RLS. All writes (articles, briefs, brief_items, pipeline_runs) go
 * through here. Re-runs for the same date are idempotent: the brief upserts on
 * its unique `date`; draft items sync by `slug` so review state survives re-runs.
 *
 * Type-only import of the app's generated `Database` (erased at runtime, so tsx
 * needs no path-alias resolution; tsc resolves `@/` via tsconfig paths).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { FetchedArticle } from './sources/http';
import type { DraftBrief, DraftItem } from './summarize';
import { logEvent, type PipelineStage } from './log';
import type { ReviewItem } from './review-format';
import {
  buildConceptNameIndex,
  resolveConceptSlugs,
  toolNamesFromJsonb,
  type ConceptRow,
} from './concept-link';

export type PipelineDb = SupabaseClient<Database>;

export function createServiceClient(url: string, serviceKey: string): PipelineDb {
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Upsert the raw audit-trail rows; return a url→id map for FK wiring. */
export async function upsertArticles(
  db: PipelineDb,
  articles: FetchedArticle[],
): Promise<Map<string, string>> {
  if (articles.length === 0) return new Map();
  const rows = articles.map((a) => ({
    source_name: a.source_name,
    source_url: a.source_url,
    title: a.title,
    url: a.url,
    published_at: a.published_at,
    raw: a.raw as Database['public']['Tables']['articles']['Insert']['raw'],
    hn_score: a.hn_score,
    hn_comments: a.hn_comments,
    reddit_score: a.reddit_score,
    reddit_comments: a.reddit_comments,
    inbrief_score: a.inbrief_score,
  }));
  const { data, error } = await db
    .from('articles')
    .upsert(rows, { onConflict: 'url' })
    .select('id, url');
  if (error) throw new Error(`[db] upsertArticles failed: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.url, r.id]));
}

export interface ResolvedBrief {
  id: string;
  edition: number;
  isNewPack: boolean;
}

/** Pure helper — which edition row the pipeline should write to. */
export function computeNextBriefEdition(
  draft: { edition: number } | null,
  latest: { edition: number; status: string } | null,
): { mode: 'draft'; edition: number } | { mode: 'insert'; edition: number } {
  if (draft) return { mode: 'draft', edition: draft.edition };
  if (!latest) return { mode: 'insert', edition: 1 };
  if (latest.status === 'published') return { mode: 'insert', edition: latest.edition + 1 };
  throw new Error('[db] unexpected brief state: latest is draft but no draft row returned');
}

/**
 * Ensure a brief slug is globally unique (the `briefs_slug_uniq` partial index).
 * Reuses the slug when it already belongs to this date+edition; otherwise qualifies.
 */
async function resolveBriefSlug(
  db: PipelineDb,
  slug: string,
  date: string,
  edition: number,
): Promise<string> {
  const { data, error } = await db
    .from('briefs')
    .select('date, edition')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`[db] resolveBriefSlug failed: ${error.message}`);
  if (!data) return slug;
  if (data.date === date && data.edition === edition) return slug;
  if (data.date === date) return `${slug}-e${edition}`;
  return `${slug}-${date}`;
}

/**
 * Pick the draft to refresh, or open a new pack after the previous one was published.
 * New calendar day always starts at edition 1.
 */
export async function resolveBriefForPipeline(
  db: PipelineDb,
  date: string,
  brief: DraftBrief,
  generatedBy: string,
): Promise<ResolvedBrief> {
  const { data: draft, error: draftErr } = await db
    .from('briefs')
    .select('id, edition')
    .eq('date', date)
    .eq('status', 'draft')
    .order('edition', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (draftErr) throw new Error(`[db] resolveBriefForPipeline draft failed: ${draftErr.message}`);

  const { data: latest, error: latestErr } = await db
    .from('briefs')
    .select('edition, status')
    .eq('date', date)
    .order('edition', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw new Error(`[db] resolveBriefForPipeline latest failed: ${latestErr.message}`);

  const plan = computeNextBriefEdition(draft, latest);
  const slug = await resolveBriefSlug(db, brief.slug, date, plan.edition);

  if (plan.mode === 'draft' && draft) {
    const { error } = await db
      .from('briefs')
      .update({
        slug,
        title_en: brief.title_en,
        title_uk: brief.title_uk,
        intro_en: brief.intro_en,
        intro_uk: brief.intro_uk,
        generated_by: generatedBy,
      })
      .eq('id', draft.id);
    if (error) throw new Error(`[db] resolveBriefForPipeline update failed: ${error.message}`);
    return { id: draft.id, edition: draft.edition, isNewPack: false };
  }

  const { data: inserted, error: insErr } = await db
    .from('briefs')
    .insert({
      date,
      edition: plan.edition,
      slug,
      title_en: brief.title_en,
      title_uk: brief.title_uk,
      intro_en: brief.intro_en,
      intro_uk: brief.intro_uk,
      status: 'draft',
      generated_by: generatedBy,
    })
    .select('id, edition')
    .single();
  if (insErr || !inserted) {
    throw new Error(`[db] resolveBriefForPipeline insert failed: ${insErr?.message}`);
  }
  return { id: inserted.id, edition: inserted.edition, isNewPack: true };
}

/** Lead pack slug for a calendar day — canonical URL on the public site. */
export async function getLeadBriefSlug(db: PipelineDb, date: string): Promise<string | null> {
  const { data, error } = await db
    .from('briefs')
    .select('slug')
    .eq('date', date)
    .eq('edition', 1)
    .maybeSingle();
  if (error) throw new Error(`[db] getLeadBriefSlug failed: ${error.message}`);
  return data?.slug ?? null;
}

/** @deprecated Use resolveBriefForPipeline */
export async function upsertBriefForDate(
  db: PipelineDb,
  date: string,
  brief: DraftBrief,
  generatedBy: string,
): Promise<string> {
  const resolved = await resolveBriefForPipeline(db, date, brief, generatedBy);
  return resolved.id;
}

/** @deprecated Use resolveBriefForPipeline */
export const upsertBriefDraft = upsertBriefForDate;

type BriefItemContentRow = {
  article_id: string;
  rank: number;
  category_slug: string;
  slug: string;
  title_en: string;
  title_uk: string;
  summary_en: string;
  summary_uk: string;
  why_matters_en: string;
  why_matters_uk: string;
  deep_dive_en: string;
  deep_dive_uk: string;
  body_md_en: string | null;
  body_md_uk: string | null;
  facts_en: DraftItem['facts_en'];
  facts_uk: DraftItem['facts_uk'];
  code_snippet: DraftItem['code_snippet'];
  when_to_use_en: string[];
  when_to_use_uk: string[];
  when_not_to_use_en: string[];
  when_not_to_use_uk: string[];
  community_reactions: DraftItem['community_reactions'];
  citations: DraftItem['citations'];
  image_url: string | null;
  takeaways_en: string[];
  takeaways_uk: string[];
  tools_mentioned: string[];
  action_items_en: string[];
  action_items_uk: string[];
  impact_level: DraftItem['impact_level'];
  social_hook_en: string | null;
  social_hook_uk: string | null;
};

/** Map a draft item to a DB row (no brief_id — shared by sync + tests). */
export function draftItemToRow(
  item: DraftItem,
  rank: number,
  articleId: string,
): BriefItemContentRow {
  return {
    article_id: articleId,
    rank,
    category_slug: item.category_slug,
    slug: item.slug,
    title_en: item.title_en,
    title_uk: item.title_uk,
    summary_en: item.summary_en,
    summary_uk: item.summary_uk,
    why_matters_en: item.why_matters_en,
    why_matters_uk: item.why_matters_uk,
    deep_dive_en: item.deep_dive_en,
    deep_dive_uk: item.deep_dive_uk,
    body_md_en: item.body_md_en || null,
    body_md_uk: item.body_md_uk || null,
    facts_en: item.facts_en,
    facts_uk: item.facts_uk,
    code_snippet: item.code_snippet,
    when_to_use_en: item.when_to_use_en,
    when_to_use_uk: item.when_to_use_uk,
    when_not_to_use_en: item.when_not_to_use_en,
    when_not_to_use_uk: item.when_not_to_use_uk,
    community_reactions: item.community_reactions,
    citations: item.citations,
    image_url: item.image_url,
    takeaways_en: item.takeaways_en,
    takeaways_uk: item.takeaways_uk,
    tools_mentioned: item.tools_mentioned,
    action_items_en: item.action_items_en,
    action_items_uk: item.action_items_uk,
    impact_level: item.impact_level,
    social_hook_en: item.social_hook_en || null,
    social_hook_uk: item.social_hook_uk || null,
  };
}

export type SyncBriefItemsResult = { synced: number; inserted: number };

type ExistingItemRow = {
  id: string;
  slug: string | null;
  rank: number;
  review_status: string;
  article_id: string | null;
};

/** Hard cap from the schema: `brief_items.rank` is checked between 1 and 10. */
const MAX_ITEMS_PER_BRIEF = 10;

/**
 * Sync items into the day's pack — non-destructive. Existing rows (matched by
 * slug, or by article when the LLM re-titled the same story) are updated in
 * place so their rank and review state survive; genuinely new stories are
 * appended at the next free rank. Nothing is deleted: once a card reached the
 * Telegram reviewer, a later progón must not silently withdraw or reset it.
 * Items the editor rejected stay rejected; intra-day semantic dedup keeps the
 * same story from being re-proposed under a new wording.
 */
export async function syncBriefItems(
  db: PipelineDb,
  briefId: string,
  items: DraftItem[],
  articleIdByUrl: Map<string, string>,
): Promise<SyncBriefItemsResult> {
  const { data: existing, error: loadErr } = await db
    .from('brief_items')
    .select('id, slug, rank, review_status, article_id')
    .eq('brief_id', briefId);
  if (loadErr) throw new Error(`[db] syncBriefItems load failed: ${loadErr.message}`);

  return syncBriefItemsUpsert(db, briefId, items, articleIdByUrl, existing ?? []);
}

/**
 * Review-queue note combining the automated checks: Ukrainian language flags
 * and claims the VERIFY pass could not find in the source. Null when clean.
 */
export function autoReviewComment(item: {
  uk_quality_flags: string[];
  unsupported_claims: string[];
}): string | null {
  const notes: string[] = [];
  if (item.uk_quality_flags.length > 0) {
    notes.push(`мова: ${item.uk_quality_flags.join(', ')}`);
  }
  if (item.unsupported_claims.length > 0) {
    notes.push(`джерело не підтверджує: ${item.unsupported_claims.slice(0, 3).join('; ')}`);
  }
  return notes.length > 0 ? `⚠️ Авто-перевірка: ${notes.join(' | ')}` : null;
}

async function syncBriefItemsUpsert(
  db: PipelineDb,
  briefId: string,
  items: DraftItem[],
  articleIdByUrl: Map<string, string>,
  existing: ExistingItemRow[],
): Promise<SyncBriefItemsResult> {
  const bySlug = new Map<string, ExistingItemRow>();
  const byArticleId = new Map<string, ExistingItemRow>();
  const usedRanks = new Set<number>();
  for (const row of existing) {
    if (row.slug) bySlug.set(row.slug, row);
    if (row.article_id) byArticleId.set(row.article_id, row);
    usedRanks.add(row.rank);
  }

  let synced = 0;
  let inserted = 0;

  for (const item of items) {
    const articleId = articleIdByUrl.get(item.url);
    if (!articleId) continue;

    const prev = bySlug.get(item.slug) ?? byArticleId.get(articleId);
    if (prev) {
      const payload = draftItemToRow(item, prev.rank, articleId);
      // Same story re-titled: keep the established slug — it is unique per
      // brief and already on the reviewer's card.
      if (prev.slug && prev.slug !== item.slug) payload.slug = prev.slug;
      // Surface auto-check notes on still-pending items; never touch the
      // comment after a decision (reject reasons live there).
      const note = prev.review_status === 'pending' ? autoReviewComment(item) : null;
      const { error } = await db
        .from('brief_items')
        .update({ ...payload, ...(note ? { review_comment: note } : {}) })
        .eq('id', prev.id);
      if (error) throw new Error(`[db] syncBriefItems update failed: ${error.message}`);
      synced++;
      continue;
    }

    let rank = 1;
    while (usedRanks.has(rank) && rank <= MAX_ITEMS_PER_BRIEF) rank++;
    if (rank > MAX_ITEMS_PER_BRIEF) {
      logEvent('warn', 'publish', 'Brief pack is full — item skipped', {
        brief_id: briefId,
        slug: item.slug,
      });
      continue;
    }

    const payload = draftItemToRow(item, rank, articleId);
    const insertNote = autoReviewComment(item);
    const { error } = await db.from('brief_items').insert({
      brief_id: briefId,
      ...payload,
      review_status: 'pending',
      ...(insertNote ? { review_comment: insertNote } : {}),
    });
    if (error) throw new Error(`[db] syncBriefItems insert failed: ${error.message}`);
    usedRanks.add(rank);
    bySlug.set(item.slug, { id: '', slug: item.slug, rank, review_status: 'pending', article_id: articleId });
    byArticleId.set(articleId, { id: '', slug: item.slug, rank, review_status: 'pending', article_id: articleId });
    inserted++;
    synced++;
  }

  return { synced, inserted };
}

/** @deprecated Use syncBriefItems — kept as alias for callers outside publish. */
export const replaceBriefItems = syncBriefItems;

/** Wire brief_items.tools_mentioned → brief_item_concepts after each publish refresh. */
export async function syncBriefItemConcepts(db: PipelineDb, briefId: string): Promise<number> {
  const { data: concepts, error: cErr } = await db
    .from('concepts')
    .select('slug, name_en, name_uk, aliases');
  if (cErr) throw new Error(`[db] syncBriefItemConcepts concepts failed: ${cErr.message}`);

  const index = buildConceptNameIndex((concepts ?? []) as ConceptRow[]);

  const { data: items, error: iErr } = await db
    .from('brief_items')
    .select('id, tools_mentioned')
    .eq('brief_id', briefId);
  if (iErr) throw new Error(`[db] syncBriefItemConcepts items failed: ${iErr.message}`);

  const links: { item_id: string; concept_slug: string }[] = [];
  for (const item of items ?? []) {
    const tools = toolNamesFromJsonb(item.tools_mentioned);
    for (const slug of resolveConceptSlugs(tools, index)) {
      links.push({ item_id: item.id, concept_slug: slug });
    }
  }
  if (links.length === 0) return 0;

  // `brief_item_concepts` not yet in generated Database type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertErr } = await (db as any)
    .from('brief_item_concepts')
    .upsert(links, { onConflict: 'item_id,concept_slug' });
  if (upsertErr) {
    throw new Error(`[db] syncBriefItemConcepts upsert failed: ${upsertErr.message}`);
  }
  return links.length;
}

/**
 * English titles of everything already in today's packs (any status, any
 * edition) — the editor's intra-day "do not repeat" context. Rejected titles
 * included on purpose: re-proposing a story the editor killed wastes a slot.
 */
export async function todaysItemTitles(db: PipelineDb, date: string): Promise<string[]> {
  const { data: briefs, error: bErr } = await db
    .from('briefs')
    .select('id')
    .eq('date', date);
  if (bErr) throw new Error(`[db] todaysItemTitles briefs failed: ${bErr.message}`);
  const ids = (briefs ?? []).map((b) => b.id);
  if (ids.length === 0) return [];

  const { data: items, error: iErr } = await db
    .from('brief_items')
    .select('title_en')
    .in('brief_id', ids);
  if (iErr) throw new Error(`[db] todaysItemTitles items failed: ${iErr.message}`);
  return (items ?? [])
    .map((r) => r.title_en)
    .filter((t): t is string => typeof t === 'string' && t.length > 0);
}

/** Recent published item titles (English) — the editor's cross-day dedup context. */
export async function recentPublishedTitles(db: PipelineDb, limit: number): Promise<string[]> {
  if (limit <= 0) return [];
  const { data: briefs, error: bErr } = await db
    .from('briefs')
    .select('id')
    .eq('status', 'published')
    .order('date', { ascending: false })
    .limit(20);
  if (bErr) throw new Error(`[db] recentPublishedTitles briefs failed: ${bErr.message}`);
  const ids = (briefs ?? []).map((b) => b.id);
  if (ids.length === 0) return [];

  const { data: items, error: iErr } = await db
    .from('brief_items')
    .select('title_en')
    .in('brief_id', ids)
    .order('rank', { ascending: true })
    .limit(limit);
  if (iErr) throw new Error(`[db] recentPublishedTitles items failed: ${iErr.message}`);
  return (items ?? [])
    .map((r) => r.title_en)
    .filter((t): t is string => typeof t === 'string' && t.length > 0);
}

/** Brief date, title, edition, lead slug — Telegram review batch header. */
export async function getBriefMeta(
  db: PipelineDb,
  briefId: string,
): Promise<{ date: string; title: string | null; edition: number; leadSlug: string | null } | null> {
  const { data, error } = await db
    .from('briefs')
    .select('date, title_uk, title_en, edition')
    .eq('id', briefId)
    .maybeSingle();
  if (error) throw new Error(`[db] getBriefMeta failed: ${error.message}`);
  if (!data) return null;
  const leadSlug = await getLeadBriefSlug(db, data.date);
  return {
    date: data.date,
    title: data.title_uk ?? data.title_en ?? null,
    edition: data.edition,
    leadSlug,
  };
}

/** Pending items of a brief for Telegram review cards. */
export async function getPendingReviewItems(
  db: PipelineDb,
  briefId: string,
  options: { resend?: boolean } = {},
): Promise<ReviewItem[]> {
  let query = db
    .from('brief_items')
    .select('id, rank, category_slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, review_comment, articles(url, source_name)')
    .eq('brief_id', briefId)
    .eq('review_status', 'pending');
  if (!options.resend) {
    query = query.is('review_msg_id', null);
  }
  const { data, error } = await query.order('rank', { ascending: true });
  if (error) throw new Error(`[db] getPendingReviewItems failed: ${error.message}`);
  return (data ?? []).map((r) => {
    const article = r.articles as { url: string | null; source_name: string | null } | null;
    return {
      id: r.id,
      rank: r.rank,
      category_slug: r.category_slug,
      title_en: r.title_en,
      title_uk: r.title_uk,
      summary_en: r.summary_en,
      summary_uk: r.summary_uk,
      why_matters_en: r.why_matters_en,
      why_matters_uk: r.why_matters_uk,
      review_comment: r.review_comment,
      url: article?.url ?? null,
      source_name: article?.source_name ?? null,
    };
  });
}

/** Pending cards already sent in earlier cycles — still undecided above in chat. */
export async function countPendingWithCards(db: PipelineDb, briefId: string): Promise<number> {
  const { count, error } = await db
    .from('brief_items')
    .select('id', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .eq('review_status', 'pending')
    .not('review_msg_id', 'is', null);
  if (error) throw new Error(`[db] countPendingWithCards failed: ${error.message}`);
  return count ?? 0;
}

/** Record the Telegram message id so a re-run won't re-send, and the webhook can edit it. */
export async function setReviewMsgId(
  db: PipelineDb,
  itemId: string,
  msgId: number,
): Promise<void> {
  const { error } = await db
    .from('brief_items')
    .update({ review_msg_id: msgId })
    .eq('id', itemId);
  if (error) throw new Error(`[db] setReviewMsgId failed: ${error.message}`);
}

export interface PipelineRunLog {
  date: string;
  stage: PipelineStage;
  status: 'ok' | 'failed' | 'skipped';
  error?: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
}

export async function logPipelineRun(db: PipelineDb, run: PipelineRunLog): Promise<void> {
  const { error } = await db.from('pipeline_runs').insert({
    date: run.date,
    stage: run.stage,
    status: run.status,
    error: run.error ?? null,
    duration_ms: run.durationMs ?? null,
    meta: (run.meta ?? null) as Database['public']['Tables']['pipeline_runs']['Insert']['meta'],
  });
  if (error) throw new Error(`[db] logPipelineRun failed: ${error.message}`);
}

// ─── Semantic dedup (pgvector) ────────────────────────────────────────────────

/** pgvector expects its input as a `[a,b,c]` string literal. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

/**
 * Nearest known brief_item to an embedding within `maxDistance` cosine
 * distance, looking at published items (any day) AND everything already in
 * today's packs — draft, pending, even rejected. A story the editor rejected
 * this morning must not be re-proposed by the afternoon progón. Returns null
 * when nothing is close enough — the candidate is novel.
 */
export async function matchRelevantItem(
  db: PipelineDb,
  embedding: number[],
  maxDistance: number,
  sameDay: string,
): Promise<{ brief_item_id: string; distance: number } | null> {
  // Cast needed: match_relevant_item is a new RPC not yet in the generated Database type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc('match_relevant_item', {
    query_embedding: toVectorLiteral(embedding),
    max_distance: maxDistance,
    same_day: sameDay,
  });
  if (error) throw new Error(`[db] match_relevant_item failed: ${(error as { message: string }).message}`);
  const row = ((data ?? [])[0]) as unknown as { brief_item_id: string; distance: number } | undefined;
  return row ?? null;
}

/**
 * Embed the English titles of a brief's items and upsert them into
 * `brief_item_embeddings` so future runs can do cross-day semantic dedup.
 * Idempotent: upserts on `brief_item_id` (re-run after partial failure is safe).
 */
export async function storeItemEmbeddings(
  db: PipelineDb,
  briefId: string,
  embed: (texts: string[]) => Promise<number[][]>,
): Promise<number> {
  const { data, error } = await db
    .from('brief_items')
    .select('id, title_en')
    .eq('brief_id', briefId);
  if (error) throw new Error(`[db] storeItemEmbeddings fetch failed: ${error.message}`);

  const items = (data ?? []) as { id: string; title_en: string | null }[];
  const eligible = items.filter((it) => it.title_en && it.title_en.trim().length > 0);
  if (eligible.length === 0) return 0;

  const vectors = await embed(eligible.map((it) => it.title_en!.trim()));
  const rows = eligible
    .map((item, i) => {
      const vec = vectors[i];
      if (!vec || vec.length === 0) return null;
      return { brief_item_id: item.id, embedding: toVectorLiteral(vec) };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return 0;

  // `brief_item_embeddings` is not in the generated Database type yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertErr } = await (db as any)
    .from('brief_item_embeddings')
    .upsert(rows, { onConflict: 'brief_item_id' });
  if (upsertErr) throw new Error(`[db] storeItemEmbeddings upsert failed: ${upsertErr.message}`);
  return rows.length;
}
