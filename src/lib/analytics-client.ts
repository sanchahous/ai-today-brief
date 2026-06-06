'use client';

import { analyticsConfigured } from '@/lib/analytics-config';
import { CONSENT_STORAGE_KEY, parseConsentJson, type ConsentState } from '@/lib/consent';

export type ParamValue = string | number | boolean | null | undefined;
export type Params = Record<string, ParamValue>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const globalParams: Params = {};
const DEBUG = process.env.NODE_ENV === 'development';

function gtagReady(): boolean {
  return analyticsConfigured && typeof window.gtag === 'function';
}

/** Whether the user granted analytics cookies (localStorage CMP state). */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    const stored = raw ? parseConsentJson(raw) : null;
    return stored?.analytics === true;
  } catch {
    return false;
  }
}

/** Merge params attached to every subsequent event (e.g. lang, page_path). */
export function setGlobalParams(p: Params): void {
  Object.assign(globalParams, p);
}

/** GA4 user properties — stable dimensions (lang, theme). Consent Mode limits persistence when denied. */
export function setUserProperties(props: Record<string, ParamValue>): void {
  if (!gtagReady()) return;
  window.gtag?.('set', 'user_properties', props);
}

export function applyConsentToGtag(consent: Pick<ConsentState, 'analytics' | 'ads'>): void {
  if (!gtagReady()) return;
  window.gtag?.('consent', 'update', {
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_storage: consent.ads ? 'granted' : 'denied',
    ad_user_data: consent.ads ? 'granted' : 'denied',
    ad_personalization: consent.ads ? 'granted' : 'denied',
  });
}

/**
 * Send a GA4 event. With Consent Mode v2 defaults (denied), gtag emits cookieless
 * pings until the CMP grants analytics_storage — no app-level consent gate needed.
 */
export function trackEvent(event: string, params: Params = {}): void {
  const merged = { ...globalParams, ...params };

  if (!analyticsConfigured) {
    if (DEBUG) console.warn('[analytics]', event, merged);
    return;
  }

  if (!gtagReady()) return;

  window.gtag?.('event', event, merged);
}

export function trackPageView(path: string, lang: string): void {
  trackEvent('page_view', {
    page_path: path,
    page_location: typeof window !== 'undefined' ? window.location.href : path,
    language: lang,
  });
}

/** Fire `search` with optional precomputed results; otherwise fetches total from /api/search. */
export function trackSearch(
  query: string,
  source: string,
  lang: string,
  results?: number,
): void {
  const q = query.trim();
  if (!q) return;

  if (results !== undefined) {
    trackEvent('search', { query: q, results, source });
    return;
  }

  const params = new URLSearchParams({ q, lang, limit: '1' });
  void fetch(`/api/search?${params}`)
    .then((res) => (res.ok ? res.json() : { total: 0 }))
    .then((body: { total?: number }) => {
      trackEvent('search', { query: q, results: body.total ?? 0, source });
    })
    .catch(() => {
      trackEvent('search', { query: q, results: 0, source });
    });
}

export const OPEN_CONSENT_EVENT = 'atb-open-consent';

export function dispatchOpenConsent(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
  }
}
