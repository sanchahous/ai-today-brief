/**
 * RSS/Atom primary source — fetch each feed, parse with the shared pure parser.
 * Reports dead feeds (HTTP failure or zero parsed entries) so a single broken
 * first-party feed surfaces in source health instead of hiding behind the
 * other ten: the whole point of this source is the lab blogs, and those are
 * exactly the feeds that die quietly when a vendor restructures their site.
 */

import { logError, logEvent } from '../log';
import { parseRssFeedXml } from '../rss-parse';
import { RSS_FEEDS } from './feeds';
import { fetchWithRetry, isSuccessfulResponse, type FetchedArticle } from './http';

export interface RssFetchResult {
  articles: FetchedArticle[];
  /** Feed names that failed or parsed to zero entries this run. */
  deadFeeds: string[];
}

export async function fetchRSS(
  retry: typeof fetchWithRetry = fetchWithRetry,
): Promise<RssFetchResult> {
  const articles: FetchedArticle[] = [];
  const deadFeeds: string[] = [];
  for (const feed of RSS_FEEDS) {
    try {
      const res = await retry(feed.url, { signal: AbortSignal.timeout(10_000) });
      if (!isSuccessfulResponse(res)) {
        logEvent('warn', 'fetch', 'RSS feed unavailable', {
          feed: feed.name,
          status: res?.status ?? null,
        });
        deadFeeds.push(feed.name);
        continue;
      }
      const xml = await res!.text();
      const parsed = parseRssFeedXml(xml, feed.name, feed.url);
      if (parsed.length === 0) {
        // These feeds always carry historical entries; an empty parse means
        // the feed moved or changed format, not a quiet news day.
        logEvent('warn', 'fetch', 'RSS feed parsed to zero entries', { feed: feed.name });
        deadFeeds.push(feed.name);
        continue;
      }
      articles.push(...parsed);
    } catch (e) {
      logError('fetch', 'RSS fetch failed', e, { feed: feed.name });
      deadFeeds.push(feed.name);
    }
  }
  return { articles, deadFeeds };
}
