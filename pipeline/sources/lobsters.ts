/**
 * Lobsters — open, BSD-licensed HN-cousin. The per-tag JSON endpoint
 * (`/t/<tag>.json`) carries the Reddit-shaped engagement signal we lost: each
 * story has a `score` (upvotes) and `comment_count`, which feed the same
 * velocity lane Reddit/Bluesky use in `rank.ts`. Only stories that link OUT are
 * kept (text-only "Ask"-style posts are skipped, like Reddit self-posts). The
 * feed is a discovery/ranking signal — we link to the original article, never
 * republish Lobsters content (robots.txt sets ai-input=no).
 */

import { logError, logEvent } from '../log';
import { isPublishedWithinRollingWindow } from '../rolling-window';
import { BUILDER_USER_AGENT, LOBSTERS_TAGS, lobstersTagUrl } from './feeds';
import { fetchWithRetry, isSuccessfulResponse, type FetchedArticle } from './http';

/**
 * Map one Lobsters story onto FetchedArticle. Returns null for text-only posts
 * (no external `url`) or malformed rows. `score`/`comment_count` map onto the
 * engagement lane so upvoted Lobsters links compete in `rank.ts` velocity.
 */
export function lobstersStoryToArticle(story: unknown): FetchedArticle | null {
  if (typeof story !== 'object' || story === null) return null;
  const s = story as Record<string, unknown>;

  const url = typeof s.url === 'string' ? s.url.trim() : '';
  if (!url.startsWith('http')) return null; // text-only / self post → skip

  const title = typeof s.title === 'string' ? s.title.trim() : '';
  if (!title) return null;

  const createdAt = typeof s.created_at === 'string' ? s.created_at : '';
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return null;

  const commentsUrl = typeof s.comments_url === 'string' ? s.comments_url : url;

  return {
    source_name: 'Lobsters',
    source_url: commentsUrl,
    title,
    url,
    published_at: new Date(ts).toISOString(),
    raw: s,
    hn_score: null,
    hn_comments: null,
    // Engagement lane shared with Reddit/Bluesky — rank.ts sums it into velocity.
    reddit_score: Number(s.score ?? 0),
    reddit_comments: Number(s.comment_count ?? 0),
    inbrief_score: null,
  };
}

/* v8 ignore start -- live network; the mapper above is unit-tested */
export async function fetchLobsters(
  retry: typeof fetchWithRetry = fetchWithRetry,
): Promise<FetchedArticle[]> {
  const seen = new Set<string>();
  const results: FetchedArticle[] = [];

  for (const tag of LOBSTERS_TAGS) {
    try {
      const res = await retry(lobstersTagUrl(tag), {
        headers: { 'User-Agent': BUILDER_USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!isSuccessfulResponse(res)) {
        logEvent('warn', 'fetch', 'Lobsters tag failed', { tag, status: res?.status ?? null });
        continue;
      }

      const json = (await res!.json()) as unknown;
      for (const story of Array.isArray(json) ? json : []) {
        const article = lobstersStoryToArticle(story);
        if (!article || seen.has(article.url)) continue;
        if (!isPublishedWithinRollingWindow(article.published_at)) continue;
        seen.add(article.url);
        results.push(article);
      }
    } catch (e) {
      logError('fetch', 'Lobsters fetch failed', e, { tag });
    }
  }
  return results;
}
/* v8 ignore end */
