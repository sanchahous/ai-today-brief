/** Hacker News via the Algolia search API — engagement signal (points + comments). */

import { logError } from '../log';
import { hnCreatedAtLowerBoundSec } from '../rolling-window';
import { HN_QUERIES } from './feeds';
import { fetchWithRetry, isSuccessfulResponse, type FetchedArticle } from './http';

const HN_SEARCH = 'https://hn.algolia.com/api/v1/search';

export async function fetchHackerNews(
  retry: typeof fetchWithRetry = fetchWithRetry,
): Promise<FetchedArticle[]> {
  const seen = new Set<string>();
  const results: FetchedArticle[] = [];

  for (const q of HN_QUERIES) {
    try {
      const url = `${HN_SEARCH}?query=${encodeURIComponent(q)}&tags=story&numericFilters=created_at_i>${hnCreatedAtLowerBoundSec()}&hitsPerPage=20`;
      const res = await retry(url, { signal: AbortSignal.timeout(10_000) });
      if (!isSuccessfulResponse(res)) continue;

      const json = (await res!.json()) as { hits?: unknown[] };
      for (const hit of (json.hits ?? []) as Record<string, unknown>[]) {
        const storyUrl = String(hit.url ?? '');
        if (!storyUrl || seen.has(storyUrl)) continue;
        seen.add(storyUrl);
        results.push({
          source_name: 'Hacker News',
          source_url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          title: String(hit.title ?? ''),
          url: storyUrl,
          published_at: new Date(Number(hit.created_at_i) * 1000).toISOString(),
          raw: hit,
          hn_score: Number(hit.points ?? 0),
          hn_comments: Number(hit.num_comments ?? 0),
          reddit_score: null,
          reddit_comments: null,
          inbrief_score: null,
        });
      }
    } catch (e) {
      logError('fetch', 'Hacker News query failed', e, { query: q });
    }
  }
  return results;
}
