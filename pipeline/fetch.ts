/**
 * Stage 1 — Fetch. Collects raw candidates from InBrief, Hacker News, Reddit,
 * with an RSS fallback when the primary sources come back thin. Returns an
 * in-memory, de-duplicated, rolling-window-filtered list — no database here.
 *
 * The pure helpers (`prepareArticles`, `filterToRollingWindow`, `toCandidate`)
 * are unit-tested; `collectArticles` (live network) is covered by real runs.
 */

import type { Candidate } from './rank';
import { isPublishedWithinRollingWindow } from './rolling-window';
import { logEvent } from './log';
import type { FetchedArticle } from './sources/http';

export type { FetchedArticle } from './sources/http';

/** Keep valid http(s) URLs + non-empty titles; de-duplicate within the batch by URL. */
export function prepareArticles(input: FetchedArticle[]): FetchedArticle[] {
  const seen = new Set<string>();
  const out: FetchedArticle[] = [];
  for (const a of input) {
    if (!a.url || !a.title || !a.url.startsWith('http')) continue;
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    out.push(a);
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

/** Below this many primary-source articles, pull the RSS fallback too. */
export const THIN_PRIMARY_THRESHOLD = 10;

/* v8 ignore start -- live network orchestration; helpers above are unit-tested */
export async function collectArticles(): Promise<FetchedArticle[]> {
  const { fetchInBrief } = await import('./sources/inbrief');
  const { fetchHackerNews } = await import('./sources/hacker-news');
  const { fetchReddit } = await import('./sources/reddit');

  logEvent('info', 'fetch', 'Fetch stage started');
  const start = Date.now();

  const [inbrief, hn, reddit] = await Promise.allSettled([
    fetchInBrief(),
    fetchHackerNews(),
    fetchReddit(),
  ]);

  let articles: FetchedArticle[] = [
    ...(inbrief.status === 'fulfilled' ? inbrief.value : []),
    ...(hn.status === 'fulfilled' ? hn.value : []),
    ...(reddit.status === 'fulfilled' ? reddit.value : []),
  ];

  if (articles.length < THIN_PRIMARY_THRESHOLD) {
    logEvent('warn', 'fetch', 'Primary sources thin, using RSS fallback', {
      primary_count: articles.length,
    });
    const { fetchRSS } = await import('./sources/rss');
    const rss = await fetchRSS();
    articles.push(...rss);
  }

  articles = filterToRollingWindow(prepareArticles(articles));
  logEvent('info', 'fetch', 'Fetch stage complete', {
    count: articles.length,
    duration_ms: Date.now() - start,
  });
  return articles;
}
/* v8 ignore end */
