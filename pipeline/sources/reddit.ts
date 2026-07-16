/**
 * Reddit — dev / vibe-coder communities. Skips self-posts; keeps link-out posts
 * only, and stores just metadata (title/score/comments/permalink), never the post
 * body. The summariser reads the EXTERNAL linked article, not Reddit content.
 *
 * EXPLICIT-APPROVAL GATE: this source runs only after Reddit grants written approval
 * for the business use and REDDIT_DATA_API_APPROVED=1 is set with valid OAuth
 * credentials and a contact username. OAuth credentials alone never enable it.
 * It never falls back to public *.json endpoints.
 */

import { logError, logEvent } from '../log';
import { isPublishedWithinRollingWindow } from '../rolling-window';
import { REDDIT_URLS, REDDIT_USER_AGENT } from './feeds';
import { fetchWithRetry, isSuccessfulResponse, type FetchedArticle } from './http';

/* v8 ignore start -- network IO; covered by live runs */
function isRedditApproved(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.REDDIT_DATA_API_APPROVED?.trim() === '1';
}

async function getOAuthToken(retry: typeof fetchWithRetry): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();
  const username = process.env.REDDIT_USERNAME?.trim();
  if (!isRedditApproved() || !clientId || !clientSecret || !username) {
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
  const token = await getOAuthToken(retry);
  if (!token) {
    logEvent('info', 'fetch', 'Reddit: disabled (approval or OAuth configuration missing)');
    return [];
  }
  logEvent('info', 'fetch', 'Reddit: using OAuth API');

  const results: FetchedArticle[] = [];
  for (const publicUrl of REDDIT_URLS) {
    const url = publicUrl
      .replace('https://www.reddit.com', 'https://oauth.reddit.com')
      .replace('/top.json', '/top');
    try {
      const res = await retry(url, {
        headers: {
          'User-Agent': REDDIT_USER_AGENT,
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!isSuccessfulResponse(res)) {
        logEvent('warn', 'fetch', 'Reddit endpoint failed', {
          url: publicUrl,
          status: res?.status ?? null,
          oauth: true,
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
          // Whitelisted metadata only — never persist author/selftext/awards/etc.
          // (over-collection + Reddit content-deletion liability). See compliance doc.
          raw: {
            subreddit: post.subreddit,
            permalink: post.permalink,
            score: post.score,
            num_comments: post.num_comments,
            created_utc: post.created_utc,
            title: post.title,
          },
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
