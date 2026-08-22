import { revalidatePath } from 'next/cache';
import { LANGS } from '@/lib/site';
import { TOP_CATEGORY_SLUGS } from '@/lib/category-meta';

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
 * Revalidate shared site surfaces for both languages plus the given content
 * paths. Used by the publish flows (Telegram webhook, weekly release worker)
 * so hubs never serve a day-old list after new items ship.
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
