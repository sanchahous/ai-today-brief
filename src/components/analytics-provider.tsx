'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { analyticsConfigured } from '@/lib/analytics-config';
import {
  applyConsentToGtag,
  setGlobalParams,
  setUserProperties,
  trackPageView,
} from '@/lib/analytics-client';
import { parseConsentJson, CONSENT_STORAGE_KEY } from '@/lib/consent';
import { collectWebVitals } from '@/lib/web-vitals';
import { useScrollDepth } from '@/hooks/use-scroll-depth';
import type { Lang } from '@/lib/site';

function readTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
}

/** SPA page_view + global GA4 hooks when configured. */
export function AnalyticsProvider({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  useScrollDepth(pathname);

  useEffect(() => {
    if (!analyticsConfigured) return;
    try {
      const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
      const stored = raw ? parseConsentJson(raw) : null;
      if (stored) applyConsentToGtag(stored);
    } catch {
      /* ignore */
    }
    collectWebVitals();
  }, []);

  useEffect(() => {
    setGlobalParams({ lang, page_path: pathname ?? '' });
    setUserProperties({ lang, theme: readTheme() });
  }, [lang, pathname]);

  useEffect(() => {
    if (!analyticsConfigured) return;

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setUserProperties({ theme: readTheme() });
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pathname || !analyticsConfigured) return;
    trackPageView(pathname, lang);
  }, [pathname, lang]);

  return null;
}
