'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics-client';

const THRESHOLDS = [25, 50, 75, 100] as const;

/** Fire `scroll_depth` at 25/50/75/100% once per page navigation. */
export function useScrollDepth(pagePath: string | null): void {
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    firedRef.current = new Set();
  }, [pagePath]);

  useEffect(() => {
    if (!pagePath) return;

    function onScroll() {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      if (scrollHeight <= 0) return;

      const percent = Math.min(100, Math.round((scrollTop / scrollHeight) * 100));
      for (const threshold of THRESHOLDS) {
        if (percent >= threshold && !firedRef.current.has(threshold)) {
          firedRef.current.add(threshold);
          trackEvent('scroll_depth', { page_path: pagePath, percent: threshold });
        }
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [pagePath]);
}
