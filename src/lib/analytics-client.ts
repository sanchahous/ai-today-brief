'use client';

import { analyticsConfigured } from '@/lib/analytics-config';
import type { ConsentState } from '@/lib/consent';

type ParamValue = string | number | boolean | null | undefined;
type Params = Record<string, ParamValue>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function gtagReady(): boolean {
  return analyticsConfigured && typeof window.gtag === 'function';
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

export function trackEvent(event: string, params: Params = {}): void {
  if (!gtagReady()) return;
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
