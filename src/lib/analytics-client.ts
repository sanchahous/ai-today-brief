'use client';

import { GA_MEASUREMENT_ID, analyticsConfigured } from '@/lib/analytics-config';
import type { ConsentState } from '@/lib/consent';

type ParamValue = string | number | boolean | null | undefined;
type Params = Record<string, ParamValue>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let scriptInjected = false;

function gtag(...args: unknown[]): void {
  window.dataLayer?.push(args);
}

/** Inject gtag.js once; Consent Mode defaults stay denied until CMP resolves. */
export function ensureGtagScript(): void {
  if (!analyticsConfigured || scriptInjected || typeof document === 'undefined') return;
  scriptInjected = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = gtag;

  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });

  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
}

export function applyConsentToGtag(consent: Pick<ConsentState, 'analytics' | 'ads'>): void {
  if (!analyticsConfigured) return;
  ensureGtagScript();
  const payload = {
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_storage: consent.ads ? 'granted' : 'denied',
    ad_user_data: consent.ads ? 'granted' : 'denied',
    ad_personalization: consent.ads ? 'granted' : 'denied',
  };
  window.gtag?.('consent', 'update', payload);
}

export function trackEvent(event: string, params: Params = {}): void {
  if (!analyticsConfigured) return;
  ensureGtagScript();
  window.gtag?.('event', event, params);
}

export function trackPageView(path: string, lang: string): void {
  trackEvent('page_view', {
    page_path: path,
    page_location: typeof window !== 'undefined' ? window.location.href : path,
    language: lang,
  });
}

export const OPEN_CONSENT_EVENT = 'atb-open-consent';

export function dispatchOpenConsent(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
  }
}
