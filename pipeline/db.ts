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
import type { PipelineStage } from './log';
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

/** The brief on a given date, if any — used to guard against clobbering it. */
export async function getBriefByDate(
  db: PipelineDb,
  date: string,
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await db
    .from('briefs')
    .select('id, status')
    .eq('date', date)
    .maybeSingle();
  if (error) throw new Error(`[db] getBriefByDate failed: ${error.message}`);
  return data ?? null;
}

/**
 * Ensure a brief slug is globally unique (the `briefs_slug_uniq` partial index).
 * Reuses the slug if it's free or already belongs to this date; otherwise
 * qualifies it with the date so re-runs stay deterministic.
 */
async function resolveBriefSlug(db: PipelineDb, slug: string, date: string): Promise<string> {
  const { data, error } = await db.from('briefs').select('date').eq('slug', slug).maybeSingle();
  if (error) throw new Error(`[db] resolveBriefSlug failed: ${error.message}`);
  if (!data || data.date === date) return slug;
  return `${slug}-${date}`;
}

/** Upsert the day's brief as a draft (human publishes later). Returns its id. */
export async function upsertBriefDraft(
  db: PipelineDb,
  date: string,
  brief: DraftBrief,
  generatedBy: string,
): Promise<string> {
  const slug = await resolveBriefSlug(db, brief.slug, date);
  const { data, error } = await db
    .from('briefs')
    .upsert(
      {
        date,
        slug,
        title_en: brief.title_en,
        title_uk: brief.title_uk,
        intro_en: brief.intro_en,
        intro_uk: brief.intro_uk,
        status: 'draft',
        generated_by: generatedBy,
      },
      { onConflict: 'date' },
    )
    .select('id')
    .single();
  if (error || !data) throw new Error(`[db] upsertBriefDraft failed: ${error?.message}`);
  return data.id;
}

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

/**
 * Sync draft items by `slug` so re-runs refresh content without wiping review
 * state or Telegram message ids. Ranks are bumped temporarily to satisfy the
 * unique (brief_id, rank) constraint during reorder.
 */
export async function syncBriefItems(
  db: PipelineDb,
  briefId: string,
  items: DraftItem[],
  articleIdByUrl: Map<string, string>,
): Promise<number> {
  const { data: existing, error: loadErr } = await db
    .from('brief_items')
    .select('id, slug, rank')
    .eq('brief_id', briefId);
  if (loadErr) throw new Error(`[db] syncBriefItems load failed: ${loadErr.message}`);

  const existingBySlug = new Map<string, { id: string; slug: string; rank: number }>();
  for (const row of existing ?? []) {
    if (!row.slug) continue;
    existingBySlug.set(row.slug, { id: row.id, slug: row.slug, rank: row.rank });
  }
  const targetSlugs = new Set<string>();
  let count = 0;

  for (const row of existing ?? []) {
    const { error } = await db
      .from('brief_items')
      .update({ rank: row.rank + 100 })
      .eq('id', row.id);
    if (error) throw new Error(`[db] syncBriefItems rank bump failed: ${error.message}`);
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const articleId = articleIdByUrl.get(item.url);
    if (!articleId) continue;

    targetSlugs.add(item.slug);
    const payload = draftItemToRow(item, i + 1, articleId);
    const prev = existingBySlug.get(item.slug);

    if (prev) {
      const { error } = await db.from('brief_items').update(payload).eq('id', prev.id);
      if (error) throw new Error(`[db] syncBriefItems update failed: ${error.message}`);
    } else {
      const { error } = await db.from('brief_items').insert({
        brief_id: briefId,
        ...payload,
        review_status: 'pending',
      });
      if (error) throw new Error(`[db] syncBriefItems insert failed: ${error.message}`);
    }
    count++;
  }

  for (const [slug, prev] of existingBySlug) {
    if (targetSlugs.has(slug)) continue;
    const { error } = await db.from('brief_items').delete().eq('id', prev.id);
    if (error) throw new Error(`[db] syncBriefItems delete failed: ${error.message}`);
  }

  return count;
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

/** Brief date + title — used for the Telegram review batch header. */
export async function getBriefMeta(
  db: PipelineDb,
  briefId: string,
): Promise<{ date: string; title: string | null } | null> {
  const { data, error } = await db
    .from('briefs')
    .select('date, title_uk, title_en')
    .eq('id', briefId)
    .maybeSingle();
  if (error) throw new Error(`[db] getBriefMeta failed: ${error.message}`);
  if (!data) return null;
  return { date: data.date, title: data.title_uk ?? data.title_en ?? null };
}

/** Pending items of a brief that haven't been pushed to Telegram yet. */
export async function getPendingReviewItems(
  db: PipelineDb,
  briefId: string,
): Promise<ReviewItem[]> {
  const { data, error } = await db
    .from('brief_items')
    .select('id, rank, category_slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, articles(url, source_name)')
    .eq('brief_id', briefId)
    .eq('review_status', 'pending')
    .is('review_msg_id', null)
    .order('rank', { ascending: true });
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
      url: article?.url ?? null,
      source_name: article?.source_name ?? null,
    };
  });
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
 * Nearest published brief_item to an embedding within `maxDistance` cosine
 * distance. Returns null when nothing is close enough — the candidate is novel.
 */
export async function matchPublishedItem(
  db: PipelineDb,
  embedding: number[],
  maxDistance: number,
): Promise<{ brief_item_id: string; distance: number } | null> {
  // Cast needed: match_published_item is a new RPC not yet in the generated Database type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc('match_published_item', {
    query_embedding: toVectorLiteral(embedding),
    max_distance: maxDistance,
  });
  if (error) throw new Error(`[db] match_published_item failed: ${(error as { message: string }).message}`);
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
