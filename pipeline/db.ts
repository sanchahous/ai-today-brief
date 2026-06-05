/**
 * Supabase data layer for the pipeline — holds the **service role** key and
 * bypasses RLS. All writes (articles, briefs, brief_items, pipeline_runs) go
 * through here. Re-runs for the same date are idempotent: the brief upserts on
 * its unique `date` and its items are replaced wholesale.
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

/**
 * Replace a brief's items wholesale (delete-then-insert) so re-runs never
 * duplicate. `rank` is the 1-based position; items whose lead article is missing
 * from `articleIdByUrl` are skipped (can't satisfy the FK).
 */
export async function replaceBriefItems(
  db: PipelineDb,
  briefId: string,
  items: DraftItem[],
  articleIdByUrl: Map<string, string>,
): Promise<number> {
  const { error: delErr } = await db.from('brief_items').delete().eq('brief_id', briefId);
  if (delErr) throw new Error(`[db] replaceBriefItems delete failed: ${delErr.message}`);

  const rows = items
    .map((item, i) => {
      const articleId = articleIdByUrl.get(item.url);
      if (!articleId) return null;
      return {
        brief_id: briefId,
        article_id: articleId,
        rank: i + 1,
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
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return 0;
  const { error: insErr } = await db.from('brief_items').insert(rows);
  if (insErr) throw new Error(`[db] replaceBriefItems insert failed: ${insErr.message}`);
  return rows.length;
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

/** Pending items of a brief that haven't been pushed to Telegram yet. */
export async function getPendingReviewItems(
  db: PipelineDb,
  briefId: string,
): Promise<ReviewItem[]> {
  const { data, error } = await db
    .from('brief_items')
    .select('id, rank, category_slug, title_en, title_uk, summary_en, why_matters_en, articles(url, source_name)')
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
      why_matters_en: r.why_matters_en,
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
