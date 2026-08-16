/**
 * Stage 1 — Fetch. Collects raw candidates from InBrief, Hacker News (story +
 * Show HN), Reddit, the first-party RSS feeds, Bluesky, Lobsters and Mastodon
 * in parallel, reporting per-source health so a silently dead source surfaces
 * in `pipeline_runs` and Telegram instead of the pool quietly degrading.
 * Returns an in-memory, de-duplicated, rolling-window-filtered list — no
 * database here.
 *
 * RSS used to be a thin-primary fallback only; it is a primary source now
 * because the feeds are the first-party lab blogs (Anthropic, OpenAI, …) whose
 * announcements the ranker was structurally missing — published items were
 * almost entirely HN/Reddit-amplified coverage.
 *
 * The pure helpers (`prepareArticles`, `filterToRollingWindow`, `toCandidate`,
 * `sourceHealthOf`) are unit-tested; `collectArticles` (live network) is
 * covered by real runs.
 */

import type { Candidate } from './rank';
import { isPublishedWithinRollingWindow } from './rolling-window';
import { canonicalPageUrl, pageIdentityKey } from './page-url';
import { canonicalSourceName } from './source-names';
import { logEvent } from './log';
import type { FetchedArticle } from './sources/http';

export type { FetchedArticle } from './sources/http';

/**
 * Keep valid http(s) URLs + non-empty titles; de-duplicate within the batch by
 * URL; normalize source names so trust scoring and site facets see one label
 * per outlet.
 */
export function prepareArticles(input: FetchedArticle[]): FetchedArticle[] {
  const seen = new Set<string>();
  const out: FetchedArticle[] = [];
  for (const a of input) {
    if (!a.url || !a.title || !a.url.startsWith('http')) continue;
    const canonical = canonicalPageUrl(a.url);
    const identity = canonical ? pageIdentityKey(canonical) : null;
    if (!canonical || !identity || seen.has(identity)) continue;
    seen.add(identity);
    out.push({ ...a, url: canonical, source_name: canonicalSourceName(a.source_name) });
  }
  return out;
}

export function filterToRollingWindow(
  articles: FetchedArticle[],
  nowMs = Date.now(),
): FetchedArticle[] {
  return articles.filter((a) => isPublishedWithinRollingWindow(a.published_at, nowMs));
}

/** Project a fetched article onto the ranking model (one row = one mention). */
export function toCandidate(a: FetchedArticle): Candidate {
  return {
    id: a.url,
    title: a.title,
    url: a.url,
    source_name: a.source_name,
    published_at: a.published_at,
    hn_score: a.hn_score,
    hn_comments: a.hn_comments,
    reddit_score: a.reddit_score,
    reddit_comments: a.reddit_comments,
    inbrief_score: a.inbrief_score,
    mentions_count: 1,
  };
}

// ─── Source health ───────────────────────────────────────────────────────────

export type SourceBranch =
  | 'inbrief'
  | 'hacker_news'
  | 'reddit'
  | 'rss'
  | 'bluesky'
  | 'lobsters'
  | 'mastodon';

export interface SourceHealth {
  source: SourceBranch;
  status: 'ok' | 'empty' | 'failed';
  count: number;
  /** RSS only: individual feeds that failed even when the branch is 'ok'. */
  dead_feeds?: string[];
}

/**
 * Health verdict for one settled source branch. Sources absorb their own
 * per-URL errors and resolve to [], so `empty` usually means "every request
 * inside failed or nothing passed the window" — worth surfacing either way.
 */
export function sourceHealthOf(
  source: SourceBranch,
  settled: PromiseSettledResult<FetchedArticle[]>,
): SourceHealth {
  if (settled.status === 'rejected') return { source, status: 'failed', count: 0 };
  const count = settled.value.length;
  return { source, status: count === 0 ? 'empty' : 'ok', count };
}

export interface CollectResult {
  articles: FetchedArticle[];
  health: SourceHealth[];
}

/* v8 ignore start -- live network orchestration; helpers above are unit-tested */
export async function collectArticles(): Promise<CollectResult> {
  const { fetchInBrief } = await import('./sources/inbrief');
  const { fetchHackerNews } = await import('./sources/hacker-news');
  const { fetchReddit } = await import('./sources/reddit');
  const { fetchRSS } = await import('./sources/rss');
  const { fetchBluesky } = await import('./sources/bluesky');
  const { fetchLobsters } = await import('./sources/lobsters');
  const { fetchMastodon } = await import('./sources/mastodon');

  logEvent('info', 'fetch', 'Fetch stage started');
  const start = Date.now();

  const [inbrief, hn, reddit, rss, bluesky, lobsters, mastodon] = await Promise.allSettled([
    fetchInBrief(),
    fetchHackerNews(),
    fetchReddit(),
    fetchRSS(),
    fetchBluesky(),
    fetchLobsters(),
    fetchMastodon(),
  ]);

  const rssArticles: PromiseSettledResult<FetchedArticle[]> =
    rss.status === 'fulfilled'
      ? { status: 'fulfilled', value: rss.value.articles }
      : rss;
  const rssHealth = sourceHealthOf('rss', rssArticles);
  if (rss.status === 'fulfilled' && rss.value.deadFeeds.length > 0) {
    rssHealth.dead_feeds = rss.value.deadFeeds;
  }

  const health: SourceHealth[] = [
    sourceHealthOf('inbrief', inbrief),
    sourceHealthOf('hacker_news', hn),
    sourceHealthOf('reddit', reddit),
    rssHealth,
    sourceHealthOf('bluesky', bluesky),
    sourceHealthOf('lobsters', lobsters),
    sourceHealthOf('mastodon', mastodon),
  ];

  const merged: FetchedArticle[] = [
    ...(inbrief.status === 'fulfilled' ? inbrief.value : []),
    ...(hn.status === 'fulfilled' ? hn.value : []),
    ...(reddit.status === 'fulfilled' ? reddit.value : []),
    ...(rss.status === 'fulfilled' ? rss.value.articles : []),
    ...(bluesky.status === 'fulfilled' ? bluesky.value : []),
    ...(lobsters.status === 'fulfilled' ? lobsters.value : []),
    ...(mastodon.status === 'fulfilled' ? mastodon.value : []),
  ];

  const articles = filterToRollingWindow(prepareArticles(merged));
  logEvent('info', 'fetch', 'Fetch stage complete', {
    count: articles.length,
    sources: health,
    duration_ms: Date.now() - start,
  });
  return { articles, health };
}
/* v8 ignore end */
