/**
 * GA4-ready analytics layer for the prototype.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * GOING LIVE: set ONE value and analytics starts flowing — nothing else.
 *
 *   1. Create a GA4 property → get a Measurement ID like `G-XXXXXXXXXX`.
 *   2. Set it via env:   VITE_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
 *      (or hardcode it in FALLBACK_MEASUREMENT_ID below).
 *
 * Until an ID is present, every event is logged to the console (dev) and
 * nothing is sent — so the instrumentation is verifiable without an account.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Design:
 *  • One `track(event, params)` entry point. Global params (lang, theme,
 *    page, experiment assignments) are merged into every event so the data is
 *    segmentable for A/B tests out of the box.
 *  • SPA-aware: page_view is sent manually on navigation (send_page_view off).
 *  • Consent Mode v2 defaults are set before config — wire a real CMP later.
 */

export type ParamValue = string | number | boolean | null | undefined | string[];
export type Params = Record<string, ParamValue>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Optional hardcoded fallback if you'd rather not use env vars. */
const FALLBACK_MEASUREMENT_ID = '';

export const GA_MEASUREMENT_ID = (
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) || FALLBACK_MEASUREMENT_ID
).trim();

export const analyticsEnabled = GA_MEASUREMENT_ID.length > 0;
const DEBUG = Boolean(import.meta.env.DEV);

let started = false;
const globalParams: Params = {};

/** Merge params attached to every subsequent event (e.g. experiment buckets). */
export function setGlobalParams(p: Params): void {
  Object.assign(globalParams, p);
}

export function initAnalytics(): void {
  if (started || typeof document === 'undefined') return;
  started = true;

  if (!analyticsEnabled) {
    if (DEBUG) {
      console.warn(
        '[analytics] No VITE_GA_MEASUREMENT_ID — events log to console only. ' +
          'Add your GA4 Measurement ID to go live.',
      );
    }
    return;
  }

  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]) => {
    window.dataLayer!.push(args);
  };
  window.gtag = gtag;

  // Consent Mode v2 defaults — analytics on, ads off. Replace with a CMP.
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });

  gtag('js', new Date());
  // SPA: page_view is dispatched manually on navigation.
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
}

/** GA4 user properties — used for stable dimensions (lang, theme, experiments). */
export function setUserProperties(props: Params): void {
  setGlobalParams(props);
  if (window.gtag && analyticsEnabled) {
    window.gtag('set', 'user_properties', props);
  }
}

/** The single event entry point. */
export function track(event: string, params: Params = {}): void {
  const payload: Params = { ...globalParams, ...params };
  // Dev-only event log so the instrumentation is verifiable before a GA4
  // Measurement ID is configured. `warn` is the allowed console method.
  if (DEBUG) console.warn('[analytics]', event, payload);
  if (window.gtag && analyticsEnabled) {
    window.gtag('event', event, payload);
  }
}

export function trackPageView(page: string, extra: Params = {}): void {
  setGlobalParams({ page });
  track('page_view', {
    page_title: `AI Brief — ${page}`,
    page_path: `/${page}`,
    ...extra,
  });
}

/** Update Consent Mode v2 at runtime once the CMP resolves (trust + GDPR). */
export function updateConsent(consent: { analytics: boolean; ads: boolean }): void {
  const payload = {
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_storage: consent.ads ? 'granted' : 'denied',
    ad_user_data: consent.ads ? 'granted' : 'denied',
    ad_personalization: consent.ads ? 'granted' : 'denied',
  };
  // Dev-visible so the CMP wiring is verifiable without a GA4 property.
  if (DEBUG) console.warn('[analytics] consent update', payload);
  if (window.gtag && analyticsEnabled) {
    window.gtag('consent', 'update', payload);
  }
}
