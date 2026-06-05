/** Rolling freshness window — fetch filters and rank share one cutoff. */

export const ROLLING_NEWS_WINDOW_MS = 24 * 60 * 60 * 1000;

export function rollingWindowCutoffMs(nowMs = Date.now()): number {
  return nowMs - ROLLING_NEWS_WINDOW_MS;
}

export function rollingWindowCutoffIso(nowMs = Date.now()): string {
  return new Date(rollingWindowCutoffMs(nowMs)).toISOString();
}

export function isPublishedWithinRollingWindow(publishedAt: string, nowMs = Date.now()): boolean {
  const ts = new Date(publishedAt).getTime();
  if (Number.isNaN(ts)) return false;
  return ts >= rollingWindowCutoffMs(nowMs);
}

/** Lower bound for the HN Algolia `created_at_i` numeric filter (unix seconds). */
export function hnCreatedAtLowerBoundSec(nowSec = Math.floor(Date.now() / 1000)): number {
  return nowSec - Math.floor(ROLLING_NEWS_WINDOW_MS / 1000);
}
