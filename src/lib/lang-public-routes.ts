import type { Lang } from '@/lib/site';

/** First path segment under `/[lang]/…` that is a real route, not a daily brief slug. */
export const LANG_PUBLIC_ROUTE_SEGMENTS = new Set([
  'about',
  'advertise',
  'ai-disclosure',
  'author',
  'category',
  'concepts',
  'digests',
  'editorial-policy',
  'guides',
  'news',
  'opengraph-image',
  'privacy',
  'subscribe',
  'terms',
  'tools',
  'weekly',
  /** Internal rewrite target for true HTTP 404 (proxy only). */
  '__site-404__', // must match src/app/[lang]/__site-404__/page.tsx
]);

export function isLangPublicRouteSegment(segment: string): boolean {
  return LANG_PUBLIC_ROUTE_SEGMENTS.has(segment);
}

export function parseLangSingleSegmentPath(pathname: string): { lang: Lang; segment: string } | null {
  const match = pathname.match(/^\/(en|uk)\/([^/]+)\/?$/);
  if (!match) return null;
  return { lang: match[1] as Lang, segment: decodeURIComponent(match[2]) };
}
