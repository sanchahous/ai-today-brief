/**
 * Bluesky — live dev-community discussion via the PUBLIC AppView search API
 * (no auth required). Only posts that link out to an article/repo are kept;
 * likes+reposts feed the engagement lane (same slot Reddit uses), so hot
 * Bluesky links compete in `rank.ts` velocity like any social signal.
 */

import { logError, logEvent } from '../log';
import { isPublishedWithinRollingWindow } from '../rolling-window';
import { BLUESKY_QUERIES } from './feeds';
import { fetchWithRetry, isSuccessfulResponse, type FetchedArticle } from './http';

const SEARCH_URL = 'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts';

/** Permalink for a post `at://did/app.bsky.feed.post/rkey`. */
export function blueskyPostUrl(uri: string, handle: string): string | null {
  const m = uri.match(/^at:\/\/[^/]+\/app\.bsky\.feed\.post\/([\w.~-]+)$/);
  return m ? `https://bsky.app/profile/${handle}/post/${m[1]}` : null;
}

/**
 * Map one search hit onto FetchedArticle. Returns null for posts without an
 * external link (pure chatter) or with malformed fields.
 */
export function blueskyPostToArticle(post: unknown): FetchedArticle | null {
  if (typeof post !== 'object' || post === null) return null;
  const p = post as Record<string, unknown>;
  const author = (p.author ?? {}) as Record<string, unknown>;
  const record = (p.record ?? {}) as Record<string, unknown>;
  const embed = (p.embed ?? {}) as Record<string, unknown>;
  const external = (embed.external ?? {}) as Record<string, unknown>;

  const link = typeof external.uri === 'string' ? external.uri : '';
  if (!link.startsWith('http') || link.includes('bsky.app')) return null;

  const uri = typeof p.uri === 'string' ? p.uri : '';
  const handle = typeof author.handle === 'string' ? author.handle : '';
  const sourceUrl = blueskyPostUrl(uri, handle);
  if (!sourceUrl) return null;

  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : '';
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return null;

  const title =
    (typeof external.title === 'string' && external.title.trim()) ||
    (typeof record.text === 'string' && record.text.trim().slice(0, 140)) ||
    '';
  if (!title) return null;

  const likes = Number(p.likeCount ?? 0);
  const reposts = Number(p.repostCount ?? 0);
  const replies = Number(p.replyCount ?? 0);

  return {
    source_name: 'Bluesky',
    source_url: sourceUrl,
    title,
    url: link,
    published_at: new Date(ts).toISOString(),
    raw: p,
    hn_score: null,
    hn_comments: null,
    // Engagement lane shared with Reddit — rank.ts sums both into velocity.
    reddit_score: likes + reposts,
    reddit_comments: replies,
    inbrief_score: null,
  };
}

/* v8 ignore start -- live network; the mapper above is unit-tested */
export async function fetchBluesky(
  retry: typeof fetchWithRetry = fetchWithRetry,
): Promise<FetchedArticle[]> {
  const seen = new Set<string>();
  const results: FetchedArticle[] = [];

  for (const q of BLUESKY_QUERIES) {
    try {
      const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&sort=top&limit=25`;
      const res = await retry(url, { signal: AbortSignal.timeout(10_000) });
      if (!isSuccessfulResponse(res)) {
        // Was silent — log the status so a persistent 0 (e.g. the public AppView
        // moving search behind auth) is diagnosable instead of invisible.
        logEvent('warn', 'fetch', 'Bluesky search failed', { query: q, status: res?.status ?? null });
        continue;
      }

      const json = (await res!.json()) as { posts?: unknown[] };
      for (const post of json.posts ?? []) {
        const article = blueskyPostToArticle(post);
        if (!article) continue;
        if (seen.has(article.url)) continue;
        if (!isPublishedWithinRollingWindow(article.published_at)) continue;
        seen.add(article.url);
        results.push(article);
      }
    } catch (e) {
      logError('fetch', 'Bluesky query failed', e, { query: q });
    }
  }
  return results;
}
/* v8 ignore end */
