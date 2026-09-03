/** Placeholder assigned at digest creation, before a title exists. */

const LIVE_PREFIX = 'ai-weekly-';
const TEST_PREFIX = 'ai-weekly-test-';
const DATE_LEN = 10; // YYYY-MM-DD

export type WeeklyPlaceholderSlug = {
  weekStart: string;
  isTest: boolean;
};

export function parseWeeklyPlaceholderSlug(slug: string): WeeklyPlaceholderSlug | null {
  let isTest = false;
  let rest: string;
  if (slug.startsWith(TEST_PREFIX)) {
    isTest = true;
    rest = slug.slice(TEST_PREFIX.length);
  } else if (slug.startsWith(LIVE_PREFIX)) {
    rest = slug.slice(LIVE_PREFIX.length);
  } else {
    return null;
  }
  if (rest.length !== DATE_LEN) return null;
  if (rest[4] !== '-' || rest[7] !== '-') return null;
  for (let i = 0; i < DATE_LEN; i++) {
    if (i === 4 || i === 7) continue;
    const code = rest.charCodeAt(i);
    if (code < 48 || code > 57) return null;
  }
  return { weekStart: rest, isTest };
}

export type WeeklySlugLookup = {
  isPublished(slug: string): Promise<boolean | null>;
  publishedSlugForWeek(weekStart: string, isTest: boolean): Promise<string | null>;
};

export type WeeklySlugResolution =
  | { kind: 'pass' }
  | { kind: 'missing' }
  | { kind: 'redirect'; slug: string };

/**
 * Exact published slug passes. A leftover `ai-weekly-YYYY-MM-DD` after
 * `finish_weekly_digest_release` rewrote it to a topic slug must 308, not 404.
 * `isPublished` returning `null` is a lookup failure — caller falls through.
 */
export async function resolveWeeklyPublicSlug(
  requestedSlug: string,
  lookup: WeeklySlugLookup,
): Promise<WeeklySlugResolution> {
  const exact = await lookup.isPublished(requestedSlug);
  if (exact === null) return { kind: 'pass' };
  if (exact) return { kind: 'pass' };
  const placeholder = parseWeeklyPlaceholderSlug(requestedSlug);
  if (!placeholder) return { kind: 'missing' };
  const canonical = await lookup.publishedSlugForWeek(placeholder.weekStart, placeholder.isTest);
  if (!canonical || canonical === requestedSlug) return { kind: 'missing' };
  return { kind: 'redirect', slug: canonical };
}
