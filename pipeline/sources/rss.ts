/** RSS/Atom fallback — fetch each feed, parse with the shared pure parser. */

import { logError } from '../log';
import { parseRssFeedXml } from '../rss-parse';
import { RSS_FEEDS } from './feeds';
import { fetchWithRetry, isSuccessfulResponse, type FetchedArticle } from './http';

export async function fetchRSS(
  retry: typeof fetchWithRetry = fetchWithRetry,
): Promise<FetchedArticle[]> {
  const results: FetchedArticle[] = [];
  for (const feed of RSS_FEEDS) {
    try {
      const res = await retry(feed.url, { signal: AbortSignal.timeout(10_000) });
      if (!isSuccessfulResponse(res)) continue;
      const xml = await res!.text();
      results.push(...parseRssFeedXml(xml, feed.name, feed.url));
    } catch (e) {
      logError('fetch', 'RSS fetch failed', e, { feed: feed.name });
    }
  }
  return results;
}
