'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { analyticsConfigured } from '@/lib/analytics-config';
import { applyConsentToGtag, trackPageView } from '@/lib/analytics-client';
import { parseConsentJson, CONSENT_STORAGE_KEY } from '@/lib/consent';
import type { Lang } from '@/lib/site';

/** SPA page_view + restore stored consent when GA4 is configured. */
export function AnalyticsProvider({ lang }: { lang: Lang }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!analyticsConfigured) return;
    try {
      const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
      const stored = raw ? parseConsentJson(raw) : null;
      if (stored) applyConsentToGtag(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!pathname || !analyticsConfigured) return;
    try {
      const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
      const stored = raw ? parseConsentJson(raw) : null;
      if (!stored?.analytics) return;
      trackPageView(pathname, lang);
    } catch {
      /* ignore */
    }
  }, [pathname, lang]);

  return null;
}
