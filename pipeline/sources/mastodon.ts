/**
 * Mastodon (fediverse) — public hashtag timelines via the open REST API
 * (`/api/v1/timelines/tag/<tag>`), no auth. The strongest OPEN social signal
 * after Reddit/X closed: instance choice is the curation, and each status'
 * `card` is the outbound link (article/repo) while `favourites`+`reblogs` feed
 * the same engagement lane Bluesky uses in `rank.ts`. Only statuses that link
 * out are kept; boosts (reblogs) are dropped to avoid amplification dupes.
 */

import { logError, logEvent } from '../log';
import { isPublishedWithinRollingWindow } from '../rolling-window';
import { BUILDER_USER_AGENT, MASTODON_INSTANCES, MASTODON_TAGS, mastodonTagUrl } from './feeds';
import { fetchWithRetry, isSuccessfulResponse, type FetchedArticle } from './http';

/** Strip HTML tags, decode common entities, collapse whitespace. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;|&#x27;/gi, "'")
    .replace(/&[a-z]+;|&#\d+;/gi, ' ') // any remaining entity → space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Map one Mastodon status onto FetchedArticle. Returns null for boosts, posts
 * without an external link card (pure chatter), or malformed rows.
 */
export function mastodonStatusToArticle(status: unknown): FetchedArticle | null {
  if (typeof status !== 'object' || status === null) return null;
  const s = status as Record<string, unknown>;

  if (s.reblog) return null; // a boost — skip to avoid amplification noise + dupes

  const card = (typeof s.card === 'object' && s.card !== null ? s.card : null) as Record<
    string,
    unknown
  > | null;
  const link = card && typeof card.url === 'string' ? card.url : '';
  if (!link.startsWith('http')) return null; // no outbound link → chatter, skip

  const createdAt = typeof s.created_at === 'string' ? s.created_at : '';
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return null;

  const cardTitle = card && typeof card.title === 'string' ? card.title.trim() : '';
  const text = typeof s.content === 'string' ? stripHtml(s.content) : '';
  const title = cardTitle || text.slice(0, 140);
  if (!title) return null;

  const statusUrl = typeof s.url === 'string' ? s.url : '';

  return {
    source_name: 'Mastodon',
    source_url: statusUrl || link,
    title,
    url: link,
    published_at: new Date(ts).toISOString(),
    raw: s,
    hn_score: null,
    hn_comments: null,
    // Engagement lane shared with Reddit/Bluesky — rank.ts sums it into velocity.
    reddit_score: Number(s.favourites_count ?? 0) + Number(s.reblogs_count ?? 0),
    reddit_comments: Number(s.replies_count ?? 0),
    inbrief_score: null,
  };
}

/* v8 ignore start -- live network; the mapper above is unit-tested */
export async function fetchMastodon(
  retry: typeof fetchWithRetry = fetchWithRetry,
): Promise<FetchedArticle[]> {
  const seen = new Set<string>();
  const results: FetchedArticle[] = [];

  for (const instance of MASTODON_INSTANCES) {
    for (const tag of MASTODON_TAGS) {
      try {
        const res = await retry(mastodonTagUrl(instance, tag), {
          headers: { 'User-Agent': BUILDER_USER_AGENT, Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        });
        if (!isSuccessfulResponse(res)) {
          // 401 = this instance disabled unauthenticated API access; just skip it.
          logEvent('warn', 'fetch', 'Mastodon timeline failed', {
            instance,
            tag,
            status: res?.status ?? null,
          });
          continue;
        }

        const json = (await res!.json()) as unknown;
        for (const status of Array.isArray(json) ? json : []) {
          const article = mastodonStatusToArticle(status);
          if (!article || seen.has(article.url)) continue; // dedupe across federated instances
          if (!isPublishedWithinRollingWindow(article.published_at)) continue;
          seen.add(article.url);
          results.push(article);
        }
      } catch (e) {
        logError('fetch', 'Mastodon fetch failed', e, { instance, tag });
      }
    }
  }
  return results;
}
/* v8 ignore end */
