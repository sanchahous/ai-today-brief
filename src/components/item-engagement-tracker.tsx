'use client';

import { useEffect } from 'react';
import { trackItemEvent, type ItemTarget } from '@/lib/analytics-client';

/** True only for an http(s) link whose host differs from the current page's. */
export function isExternalLink(href: string, base: string): boolean {
  try {
    const url = new URL(href, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.host !== new URL(base).host;
  } catch {
    return false;
  }
}

/**
 * Per-item engagement tracker for the article page — fires the reward-signal
 * beacons that can't ride on a server-rendered element: a `view` on mount,
 * `scroll_50`/`scroll_90` depth milestones (once each), and `outbound_click` for
 * any external link in the article (delegated on capture, so it covers the
 * citations + the source button without touching the server markup). Renders
 * nothing; every beacon is consent-gated inside trackItemEvent.
 */
export function ItemEngagementTracker({
  id,
  slug,
  lang,
}: {
  id: string;
  slug: string;
  lang: string;
}) {
  useEffect(() => {
    const target: ItemTarget = { id, slug, lang };
    const seen = new Set<string>();
    const once = (key: string, fn: () => void) => {
      if (seen.has(key)) return;
      seen.add(key);
      fn();
    };

    once('view', () => trackItemEvent('view', target));

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 0) return;
      const pct = (doc.scrollTop / scrollable) * 100;
      if (pct >= 50) once('scroll_50', () => trackItemEvent('scroll_50', target, { percent: 50 }));
      if (pct >= 90) once('scroll_90', () => trackItemEvent('scroll_90', target, { percent: 90 }));
    };

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as
        | HTMLAnchorElement
        | null;
      if (anchor && isExternalLink(anchor.href, window.location.href)) {
        trackItemEvent('outbound_click', target);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick, true);

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, true);
    };
  }, [id, slug, lang]);

  return null;
}
