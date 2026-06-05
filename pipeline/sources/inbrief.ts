/**
 * InBrief.info — a curated AI/ML feed with an editorial importance score, served
 * from its public Supabase via the `get_archive_articles` RPC. We pull today and
 * yesterday and keep what falls in the rolling window.
 */

import { logError, logEvent } from '../log';
import { isPublishedWithinRollingWindow } from '../rolling-window';
import { INBRIEF_ANON_KEY, INBRIEF_SUPABASE_URL } from './feeds';
import { fetchWithRetry, type FetchedArticle } from './http';

interface InBriefArticle {
  id: string;
  url: string;
  title?: string;
  title_en?: string;
  source?: string;
  published_at?: string;
  importance_score?: number;
  rss_sources?: { name: string };
}

async function fetchForDate(
  dateStr: string,
  retry: typeof fetchWithRetry,
): Promise<FetchedArticle[]> {
  const res = await retry(`${INBRIEF_SUPABASE_URL}/rest/v1/rpc/get_archive_articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: INBRIEF_ANON_KEY,
      Authorization: `Bearer ${INBRIEF_ANON_KEY}`,
      'User-Agent': 'ai-today-brief/1.0',
    },
    body: JSON.stringify({ p_date: dateStr, p_display_count: 25, p_language: 'en' }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res || !res.ok) {
    logEvent('warn', 'fetch', 'InBrief RPC failed', { date: dateStr, status: res?.status ?? null });
    return [];
  }

  const json = (await res.json()) as { articles?: unknown[] };
  const articles = (json.articles ?? []) as InBriefArticle[];
  return articles
    .filter((a) => a.url && (a.title_en ?? a.title))
    .map((a) => ({
      source_name: a.rss_sources?.name ?? a.source ?? 'InBrief',
      source_url: 'https://inbrief.info',
      title: String(a.title_en ?? a.title ?? ''),
      url: String(a.url),
      published_at: a.published_at ? new Date(a.published_at).toISOString() : new Date().toISOString(),
      raw: a as unknown as Record<string, unknown>,
      hn_score: null,
      hn_comments: null,
      reddit_score: null,
      reddit_comments: null,
      inbrief_score: a.importance_score ?? null,
    }));
}

export async function fetchInBrief(
  retry: typeof fetchWithRetry = fetchWithRetry,
): Promise<FetchedArticle[]> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const fmt = (d: Date): string => d.toISOString().slice(0, 10);

  try {
    const [a, b] = await Promise.allSettled([
      fetchForDate(fmt(today), retry),
      fetchForDate(fmt(yesterday), retry),
    ]);
    const combined = [
      ...(a.status === 'fulfilled' ? a.value : []),
      ...(b.status === 'fulfilled' ? b.value : []),
    ];
    return combined.filter((x) => isPublishedWithinRollingWindow(x.published_at));
  } catch (e) {
    logError('fetch', 'InBrief fetch failed', e);
    return [];
  }
}
