/** Reddit public JSON — dev / vibe-coder communities. Skips self-posts. */

import { logError } from '../log';
import { isPublishedWithinRollingWindow } from '../rolling-window';
import { REDDIT_URLS, REDDIT_USER_AGENT } from './feeds';
import { fetchWithRetry, isSuccessfulResponse, type FetchedArticle } from './http';

export async function fetchReddit(
  retry: typeof fetchWithRetry = fetchWithRetry,
): Promise<FetchedArticle[]> {
  const results: FetchedArticle[] = [];

  for (const url of REDDIT_URLS) {
    try {
      const res = await retry(url, {
        headers: { 'User-Agent': REDDIT_USER_AGENT },
        signal: AbortSignal.timeout(10_000),
      });
      if (!isSuccessfulResponse(res)) continue;

      const json = (await res!.json()) as { data?: { children?: unknown[] } };
      for (const child of (json.data?.children ?? []) as { data: Record<string, unknown> }[]) {
        const post = child.data;
        const link = String(post.url ?? '');
        if (!link || link.includes('reddit.com')) continue; // skip self-posts
        const publishedAt = new Date(Number(post.created_utc) * 1000).toISOString();
        if (!isPublishedWithinRollingWindow(publishedAt)) continue;
        results.push({
          source_name: `Reddit · r/${post.subreddit}`,
          source_url: `https://reddit.com${post.permalink}`,
          title: String(post.title ?? ''),
          url: link,
          published_at: publishedAt,
          raw: post,
          hn_score: null,
          hn_comments: null,
          reddit_score: Number(post.score ?? 0),
          reddit_comments: Number(post.num_comments ?? 0),
          inbrief_score: null,
        });
      }
    } catch (e) {
      logError('fetch', 'Reddit fetch failed', e, { url });
    }
  }
  return results;
}
