/**
 * RSS/Atom primary source — fetch each feed, parse with the shared pure parser.
 * Reports dead feeds (HTTP failure, or a document with no entries at all) so a
 * single broken first-party feed surfaces in source health instead of hiding
 * behind the other ten. A feed whose entries are merely older than the rolling
 * window is QUIET, not dead — weekly lab blogs spend most days that way.
 */

import { logError, logEvent } from '../log';
import { feedHasEntries, parseRssFeedXml } from '../rss-parse';
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
        // The parser window-filters internally — zero parsed entries usually
        // means a quiet 24h, not a broken feed. Dead = no entries at all.
        if (!feedHasEntries(xml)) {
          logEvent('warn', 'fetch', 'RSS feed has no entries — looks dead', { feed: feed.name });
          deadFeeds.push(feed.name);
        }
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
