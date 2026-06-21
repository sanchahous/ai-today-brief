/** Hacker News via the Algolia search API — engagement signal (points + comments). */

import { logError } from '../log';
import { hnCreatedAtLowerBoundSec } from '../rolling-window';
import { HN_QUERIES, HN_SHOW_HN_QUERIES } from './feeds';
import { fetchWithRetry, isSuccessfulResponse, type FetchedArticle } from './http';

const HN_SEARCH = 'https://hn.algolia.com/api/v1/search';
const HN_SEARCH_BY_DATE = 'https://hn.algolia.com/api/v1/search_by_date';
/** Floor on Show HN points — drops the 1-point unranked "weekend project" noise. */
const SHOW_HN_MIN_POINTS = 5;

/** Map one Algolia hit onto FetchedArticle; null when it carries no external url. */
export function hnHitToArticle(hit: Record<string, unknown>): FetchedArticle | null {
  const storyUrl = String(hit.url ?? '');
  const title = String(hit.title ?? '');
  if (!storyUrl || !title) return null;
  return {
    source_name: 'Hacker News',
    source_url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    title,
    url: storyUrl,
    published_at: new Date(Number(hit.created_at_i) * 1000).toISOString(),
    raw: hit,
    hn_score: Number(hit.points ?? 0),
    hn_comments: Number(hit.num_comments ?? 0),
    reddit_score: null,
    reddit_comments: null,
    inbrief_score: null,
  };
}

export async function fetchHackerNews(
  retry: typeof fetchWithRetry = fetchWithRetry,
): Promise<FetchedArticle[]> {
  const seen = new Set<string>();
  const results: FetchedArticle[] = [];
  const since = hnCreatedAtLowerBoundSec();

  const collect = async (url: string): Promise<void> => {
    const res = await retry(url, { signal: AbortSignal.timeout(10_000) });
    if (!isSuccessfulResponse(res)) return;
    const json = (await res!.json()) as { hits?: unknown[] };
    for (const hit of (json.hits ?? []) as Record<string, unknown>[]) {
      const article = hnHitToArticle(hit);
      if (!article || seen.has(article.url)) continue;
      seen.add(article.url);
      results.push(article);
    }
  };

  // Story lane: AI/dev discussion + news, relevance-ranked within the window.
  for (const q of HN_QUERIES) {
    try {
      await collect(
        `${HN_SEARCH}?query=${encodeURIComponent(q)}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=20`,
      );
    } catch (e) {
      logError('fetch', 'Hacker News query failed', e, { query: q });
    }
  }

  // Show HN lane: "someone shipped a thing you can try today" — the highest-
  // actionability slice, which tags=story alone misses. Date-sorted for
  // freshness; a points floor in numericFilters drops the 1-point launches.
  for (const q of HN_SHOW_HN_QUERIES) {
    try {
      await collect(
        `${HN_SEARCH_BY_DATE}?query=${encodeURIComponent(q)}&tags=show_hn&numericFilters=created_at_i>${since},points>=${SHOW_HN_MIN_POINTS}&hitsPerPage=20`,
      );
    } catch (e) {
      logError('fetch', 'Hacker News Show HN query failed', e, { query: q });
    }
  }

  return results;
}
