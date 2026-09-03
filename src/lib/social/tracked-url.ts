import { SITE_URL } from '@/lib/site';

/** First-party click token on the canonical page. Replaces `/r/s/{uuid}`. */
export const SOCIAL_CLICK_PARAM = 's';

export function isSocialTrackingToken(value: string): boolean {
  if (value.length !== 36) return false;
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      if (value[i] !== '-') return false;
      continue;
    }
    const code = value.charCodeAt(i);
    const isHex =
      (code >= 48 && code <= 57) || (code >= 97 && code <= 102) || (code >= 65 && code <= 70);
    if (!isHex) return false;
  }
  return true;
}

export function withSocialClickToken(destination: string, token: string): string {
  const url = new URL(destination, SITE_URL);
  url.searchParams.set(SOCIAL_CLICK_PARAM, token);
  return url.toString();
}

export function socialClickTokenFromSearch(search: string): string | null {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const token = new URLSearchParams(query).get(SOCIAL_CLICK_PARAM);
  return token && isSocialTrackingToken(token) ? token : null;
}

export function trackingTokenFromUrl(url: string): string {
  try {
    const parsed = new URL(url, SITE_URL);
    const fromQuery = parsed.searchParams.get(SOCIAL_CLICK_PARAM);
    if (fromQuery) return fromQuery;
    const segments = parsed.pathname.split('/');
    return segments[segments.length - 1] ?? url;
  } catch {
    const segments = url.split('/');
    return segments[segments.length - 1] ?? url;
  }
}

/** Point a stored weekly URL at the slug that is actually published. */
export function withWeeklySlug(url: string, slug: string): string {
  const parsed = new URL(url, SITE_URL);
  const parts = parsed.pathname.split('/');
  if (parts.length >= 4 && parts[2] === 'weekly' && parts[3] !== slug) {
    parts[3] = slug;
    parsed.pathname = parts.join('/');
  }
  return parsed.toString();
}

export function weeklyPageUrl(locale: string, slug: string): string {
  return new URL(`/${locale}/weekly/${slug}`, SITE_URL).toString();
}

export function weeklyTrackedUrl(
  locale: string,
  slug: string,
  token: string,
  utm: { source: string; campaign?: string; content?: string | null },
): string {
  const url = new URL(weeklyPageUrl(locale, slug));
  url.searchParams.set('utm_source', utm.source);
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', utm.campaign ?? 'weekly_digest');
  if (utm.content) url.searchParams.set('utm_content', utm.content.slice(0, 80));
  return withSocialClickToken(url.toString(), token);
}
