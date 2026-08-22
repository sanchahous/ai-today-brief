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
  if (!analyticsConfigured || !gtagReady()) return;
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

/** Path of the first-party per-item beacon endpoint (see src/app/api/ev/route.ts). */
const EVENT_BEACON_PATH = '/api/ev';

export type ItemTarget = { id?: string; slug?: string; lang?: string };

/**
 * Per-item interaction — fires the GA4 event (unchanged taxonomy) AND a first-party
 * beacon to /api/ev, so we own a joinable, PII-free reward signal independent of GA4
 * (own rows, no sampling, no 24–48h latency). Consent-gated exactly like trackEvent;
 * never throws — telemetry must not break the page.
 */
export function trackItemEvent(type: string, target: ItemTarget, params: Params = {}): void {
  const gaParams: Params = { ...params };
  if (target.id) gaParams.post_id = target.id;
  if (target.slug) gaParams.slug = target.slug;
  trackEvent(type, gaParams);
  sendItemBeacon(type, target, params);
}

function sendItemBeacon(type: string, target: ItemTarget, params: Params): void {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
  if (!hasAnalyticsConsent()) return;
  if (!target.id && !target.slug) return;
  const raw = params.value ?? params.percent;
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
  try {
    const payload = JSON.stringify({ id: target.id, slug: target.slug, type, lang: target.lang, value });
    navigator.sendBeacon(EVENT_BEACON_PATH, payload);
  } catch {
    /* telemetry must never break the page */
  }
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
