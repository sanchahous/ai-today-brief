'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics-client';
import { isExternalLink } from '@/components/item-engagement-tracker';
import { ANALYTICS_EVENTS } from '@/lib/analytics-events';
import { simulateDwellTimer } from '@/hooks/use-engaged-dwell.testable';

/**
 * Engagement tracker for non-item article pages (guides). Same milestones as
 * the item tracker — view on mount, 50/90% depth once each, delegated outbound
 * clicks, 30 s engaged dwell — but GA4-only: the /api/ev beacon channel stays
 * reserved for the news-item reward signal, so guide slugs never enter
 * item_metrics.
 */
export function PageEngagementTracker({
  pageType,
  slug,
  lang,
}: {
  pageType: string;
  slug: string;
  lang: string;
}) {
  useEffect(() => {
    const base = { page_type: pageType, slug, lang };
    const seen = new Set<string>();
    const once = (key: string, fn: () => void) => {
      if (seen.has(key)) return;
      seen.add(key);
      fn();
    };

    once('view', () => trackEvent('view', base));

    const stopDwell = simulateDwellTimer(() => trackEvent(ANALYTICS_EVENTS.guideDwell, base));

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 0) return;
      const pct = (doc.scrollTop / scrollable) * 100;
      if (pct >= 50) once('scroll_50', () => trackEvent('scroll_50', { ...base, percent: 50 }));
      if (pct >= 90) once('scroll_90', () => trackEvent('scroll_90', { ...base, percent: 90 }));
    };

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as
        | HTMLAnchorElement
        | null;
      if (anchor && isExternalLink(anchor.href, window.location.href)) {
        trackEvent('outbound_click', base);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick, true);

    return () => {
      stopDwell();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, true);
    };
  }, [pageType, slug, lang]);

  return null;
}
