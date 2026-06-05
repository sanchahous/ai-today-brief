/**
 * Shared HTTP for source fetchers: a bounded-retry `fetch` and the raw article
 * shape every source maps onto. Network IO — excluded from coverage; the pure
 * mappers/filters that consume `FetchedArticle` live in `../fetch.ts` and are
 * unit-tested.
 */

import { logError, logEvent } from '../log';

/** One raw candidate from any source, before clustering/ranking. */
export interface FetchedArticle {
  source_name: string;
  source_url: string;
  title: string;
  url: string;
  published_at: string;
  raw: Record<string, unknown>;
  hn_score: number | null;
  hn_comments: number | null;
  reddit_score: number | null;
  reddit_comments: number | null;
  inbrief_score: number | null;
}

export function isSuccessfulResponse(res: Response | null | undefined): boolean {
  return Boolean(res?.ok);
}

export function shouldRetryStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/* v8 ignore start -- network IO; covered by live runs, not unit tests */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3,
  fetchFn: typeof fetch = fetch,
  sleepFn: (ms: number) => Promise<void> = sleep,
): Promise<Response | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchFn(url, options);
      if (response.ok) return response;
      if (attempt < maxAttempts && shouldRetryStatus(response.status)) {
        const backoffMs = 500 * 2 ** (attempt - 1);
        logEvent('warn', 'fetch', 'Transient HTTP status, retrying', {
          url,
          status: response.status,
          attempt,
          backoff_ms: backoffMs,
        });
        await sleepFn(backoffMs);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      const backoffMs = 500 * 2 ** (attempt - 1);
      logError('fetch', 'Network error, retrying', error, { url, attempt, backoff_ms: backoffMs });
      await sleepFn(backoffMs);
    }
  }
  logError('fetch', 'Request failed after retries', lastError ?? new Error('unknown fetch error'), {
    url,
  });
  return null;
}
/* v8 ignore end */

/** Partial-failure default: a thrown source returns []. */
export type SourceFetch = () => Promise<FetchedArticle[]>;
