/**
 * Reddit — dev / vibe-coder communities. Skips self-posts.
 *
 * Prefers the official OAuth API (client_credentials of a "script" app) when
 * REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET are set: the public *.json endpoints
 * rate-limit/block datacenter IPs (GitHub Actions runners read as bots), which
 * shows up as a silent "reddit — 0 статей" in source health. Falls back to the
 * public JSON when no credentials are configured (local runs).
 */

import { logError, logEvent } from '../log';
import { isPublishedWithinRollingWindow } from '../rolling-window';
import { REDDIT_URLS, REDDIT_USER_AGENT } from './feeds';
import { fetchWithRetry, isSuccessfulResponse, type FetchedArticle } from './http';

/* v8 ignore start -- network IO; covered by live runs */
async function getOAuthToken(retry: typeof fetchWithRetry): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    // Surface the root cause: without creds the public *.json endpoints 403 from
    // CI (datacenter IP), so reddit silently returns 0. Set REDDIT_CLIENT_ID /
    // REDDIT_CLIENT_SECRET (a Reddit "script" app) as Actions secrets to fix it.
    logEvent('warn', 'fetch', 'Reddit: no OAuth credentials — public API will 403 from CI');
    return null;
  }

  try {
    const res = await retry('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': REDDIT_USER_AGENT,
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10_000),
    });
    if (!isSuccessfulResponse(res)) {
      logEvent('warn', 'fetch', 'Reddit OAuth token request failed', {
        status: res?.status ?? null,
      });
      return null;
    }
    const json = (await res!.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (e) {
    logError('fetch', 'Reddit OAuth token request failed', e);
    return null;
  }
}

export async function fetchReddit(
  retry: typeof fetchWithRetry = fetchWithRetry,
): Promise<FetchedArticle[]> {
  const results: FetchedArticle[] = [];
  const token = await getOAuthToken(retry);
  if (token) logEvent('info', 'fetch', 'Reddit: using OAuth API');

  for (const publicUrl of REDDIT_URLS) {
    const url = token
      ? publicUrl
          .replace('https://www.reddit.com', 'https://oauth.reddit.com')
          .replace('/top.json', '/top')
      : publicUrl;
    try {
      const res = await retry(url, {
        headers: {
          'User-Agent': REDDIT_USER_AGENT,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!isSuccessfulResponse(res)) {
        logEvent('warn', 'fetch', 'Reddit endpoint failed', {
          url: publicUrl,
          status: res?.status ?? null,
          oauth: Boolean(token),
        });
        continue;
      }

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
      logError('fetch', 'Reddit fetch failed', e, { url: publicUrl });
    }
  }
  return results;
}
/* v8 ignore end */
