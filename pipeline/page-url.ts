/**
 * Page-level URL identity. Tracking params, `www.`, and a trailing slash
 * are not a different document — Hacker News and a first-party RSS feed
 * routinely disagree on exactly those bits, and exact-string dedup then
 * stores two `articles` rows for one page.
 */

const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'eicker.news']);

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

/**
 * HTTPS-or-HTTP URL with a lowercase host, no `www.`, no tracking query
 * params, no hash, and no trailing slash on the path. Returns `null` when
 * the value is not a credential-free http(s) URL.
 */
export function canonicalPageUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (isTrackingParam(key)) url.searchParams.delete(key);
  }
  let path = url.pathname;
  while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  url.pathname = path;
  return url.toString();
}

/**
 * Comparison key for "is this the same page?": canonical form with the
 * protocol forced to https so `http://` and `https://` of the same host/path
 * collapse. Used for dedup, not as the URL we fetch.
 */
export function pageIdentityKey(raw: string): string | null {
  const canonical = canonicalPageUrl(raw);
  if (!canonical) return null;
  const url = new URL(canonical);
  url.protocol = 'https:';
  return url.toString();
}
