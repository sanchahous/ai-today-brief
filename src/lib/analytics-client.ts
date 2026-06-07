'use client';

import { analyticsConfigured, tagsConfigured } from '@/lib/analytics-config';
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
  return typeof window.gtag === 'function';
}

function analyticsReady(): boolean {
  return analyticsConfigured && gtagReady();
}

/**
 * Opt-out model: analytics on until the user explicitly disables it in the CMP.
 * No stored choice → full analytics; stored with analytics: false → blocked.
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    const stored = raw ? parseConsentJson(raw) : null;
    if (!stored) return true;
    return stored.analytics;
  } catch {
    return true;
  }
}

/** Merge params attached to every subsequent event (e.g. lang, page_path). */
export function setGlobalParams(p: Params): void {
  Object.assign(globalParams, p);
}

/** GA4 user properties — stable dimensions (lang, theme). */
export function setUserProperties(props: Record<string, ParamValue>): void {
  if (!analyticsReady() || !hasAnalyticsConsent()) return;
  window.gtag?.('set', 'user_properties', props);
}

export function applyConsentToGtag(consent: Pick<ConsentState, 'analytics' | 'ads'>): void {
  if (!tagsConfigured || !gtagReady()) return;
  window.gtag?.('consent', 'update', {
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_storage: consent.ads ? 'granted' : 'denied',
    ad_user_data: consent.ads ? 'granted' : 'denied',
    ad_personalization: consent.ads ? 'granted' : 'denied',
  });
}

/** Send a GA4 event. Blocked only after explicit analytics opt-out in the CMP. */
export function trackEvent(event: string, params: Params = {}): void {
  const merged = { ...globalParams, ...params };

  if (!analyticsConfigured) {
    if (DEBUG) console.warn('[analytics]', event, merged);
    return;
  }

  if (!hasAnalyticsConsent()) return;
  if (!analyticsReady()) return;

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
