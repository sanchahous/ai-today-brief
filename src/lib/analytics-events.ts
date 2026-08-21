import type { Params } from '@/lib/analytics-client';

/**
 * Catalog of GA4 event names added in the 2026-08 coverage push. Legacy call
 * sites keep their string literals (30+ events predate this file); every NEW
 * event must be registered here so the taxonomy stays greppable and testable.
 * Weekly-digest mirrors intentionally reuse the Supabase engagement event
 * names (`digest_view`, `scroll_50`, …) so the two channels join 1:1.
 */
export const ANALYTICS_EVENTS = {
  hubView: 'hub_view',
  weeklyTopClick: 'weekly_top_click',
  digestCardClick: 'digest_card_click',
  categoryHubClick: 'category_hub_click',
  heroCtaClick: 'hero_cta_click',
  digestView: 'digest_view',
  digestScroll50: 'scroll_50',
  storyOpen: 'story_open',
  subscribeClick: 'subscribe_click',
  pdfDownload: 'pdf_download',
  videoPlay: 'video_play',
  newsletterFormStart: 'newsletter_form_start',
  newsletterSubmitError: 'newsletter_submit_error',
  newsletterImpression: 'newsletter_impression',
  socialProfileClick: 'social_profile_click',
  guideDwell: 'dwell',
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type HubType = 'concept' | 'category' | 'digests' | 'guides';

export function hubViewParams(hubType: HubType, slug: string): Params {
  return { hub_type: hubType, slug };
}

export function weeklyTopClickParams(slot: 'featured' | 'secondary', rank?: number): Params {
  return rank === undefined ? { slot } : { slot, rank };
}

export function digestCardClickParams(method: 'read' | 'pdf' | 'cover'): Params {
  return { method };
}

export function socialProfileClickParams(network: string, placement: string): Params {
  return { network, placement };
}

export function newsletterFunnelParams(placement: string, lang: string): Params {
  return { placement, lang };
}

const IMPRESSION_KEY = 'atb-nl-imp';

/**
 * True at most once per placement per session (sessionStorage-backed), so
 * `newsletter_impression` measures placements shown, not React remounts.
 * Counting on storage failure is deliberate — under-counting hides funnels.
 */
export function shouldCountNewsletterImpression(placement: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(IMPRESSION_KEY);
    const seen: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(seen) && seen.includes(placement)) return false;
    sessionStorage.setItem(IMPRESSION_KEY, JSON.stringify([...(Array.isArray(seen) ? seen : []), placement]));
    return true;
  } catch {
    return true;
  }
}
