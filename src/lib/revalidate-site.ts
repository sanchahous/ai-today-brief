import { revalidatePath, revalidateTag } from 'next/cache';
import { TOP_CATEGORY_SLUGS } from '@/lib/category-meta';
import { PUBLIC_CONTENT_TAG } from '@/lib/public-content-tag';

/**
 * Public surfaces whose content changes whenever new content publishes: the
 * home page, the news index, every category hub, the concepts index, the
 * digests archive and the sitemaps/feeds. Per-item pages are revalidated
 * separately (the caller knows their paths); hubs reshuffle because a new item
 * joins their feed, so they must not go stale until the 24 h ISR fallback.
 */
const SITE_SURFACES = (lang: string): string[] => [
  '/',
  `/${lang}`,
  `/${lang}/news`,
  `/${lang}/digests`,
  `/${lang}/concepts`,
  ...TOP_CATEGORY_SLUGS.map((slug) => `/${lang}/category/${slug}`),
  '/sitemap.xml',
  '/news-sitemap.xml',
  lang === 'uk' ? '/rss-uk.xml' : '/rss.xml',
];

/** Deduplicated publish-invalidation list: shared surfaces + caller's paths. */
export function revalidatePathsForPublish(extraPaths: string[] = []): string[] {
  return [...new Set([...SITE_SURFACES('en'), ...SITE_SURFACES('uk'), ...extraPaths])];
}

/**
 * Site-wide purge: marks every page that read anon PostgREST data as stale, so
 * each one re-renders on its next hit (crawlers reach thousands of item pages a
 * day). Reserve it for changes that touch every page (weekly release, manual
 * `purgeAll`). Routine publishes must not call it: `revalidatePath` already
 * makes the listed paths read fresh data, because Data Cache and
 * `unstable_cache` entries are checked against the route's soft tags. Calling
 * it on every publish burned the Hobby Fluid CPU quota (2026-10).
 */
export function revalidatePublicContentTag(): void {
  try {
    revalidateTag(PUBLIC_CONTENT_TAG, 'max');
  } catch {
    // Publication is already committed; a failed invalidation must not fail
    // the flow — the ISR timers backstop stale entries.
  }
}

/**
 * Revalidate shared site surfaces for both languages plus the given content
 * paths. Used by the publish flows (Telegram webhook, `/api/revalidate`) so
 * hubs never serve a day-old list after new items ship. Existing item pages
 * keep their cached "related stories" until their own 24 h ISR window.
 */
export function revalidateSiteSurfaces(extraPaths: string[] = []): void {
  for (const path of revalidatePathsForPublish(extraPaths)) {
    try {
      revalidatePath(path);
    } catch {
      // Publication is already committed; a failed invalidation must not fail
      // the flow — the ISR timers backstop stale entries.
    }
  }
}
