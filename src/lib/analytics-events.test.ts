import { describe, expect, it, vi } from 'vitest';

import {
  ANALYTICS_EVENTS,
  digestCardClickParams,
  hubViewParams,
  newsletterFunnelParams,
  shouldCountNewsletterImpression,
  socialProfileClickParams,
  weeklyTopClickParams,
} from './analytics-events';

describe('analytics event catalog', () => {
  it('keeps new event names snake_case and unique', () => {
    const names = Object.values(ANALYTICS_EVENTS);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('mirrors the Supabase weekly engagement names for the GA4 channel', () => {
    expect(ANALYTICS_EVENTS.digestView).toBe('digest_view');
    expect(ANALYTICS_EVENTS.digestScroll50).toBe('scroll_50');
    expect(ANALYTICS_EVENTS.storyOpen).toBe('story_open');
    expect(ANALYTICS_EVENTS.subscribeClick).toBe('subscribe_click');
    expect(ANALYTICS_EVENTS.pdfDownload).toBe('pdf_download');
    expect(ANALYTICS_EVENTS.videoPlay).toBe('video_play');
  });
});

describe('param builders', () => {
  it('builds hub view params', () => {
    expect(hubViewParams('concept', 'context-engineering')).toEqual({
      hub_type: 'concept',
      slug: 'context-engineering',
    });
  });

  it('omits rank when absent for weekly top clicks', () => {
    expect(weeklyTopClickParams('featured')).toEqual({ slot: 'featured' });
    expect(weeklyTopClickParams('secondary', 3)).toEqual({ slot: 'secondary', rank: 3 });
  });

  it('builds digest card click params', () => {
    expect(digestCardClickParams('pdf')).toEqual({ method: 'pdf' });
  });

  it('builds social profile params', () => {
    expect(socialProfileClickParams('linkedin', 'footer')).toEqual({
      network: 'linkedin',
      placement: 'footer',
    });
  });

  it('builds newsletter funnel params', () => {
    expect(newsletterFunnelParams('home-band', 'uk')).toEqual({
      placement: 'home-band',
      lang: 'uk',
    });
  });
});

describe('shouldCountNewsletterImpression', () => {
  it('counts once per placement in a session', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
    });

    expect(shouldCountNewsletterImpression('home-band')).toBe(true);
    expect(shouldCountNewsletterImpression('home-band')).toBe(false);
    expect(shouldCountNewsletterImpression('item-page')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('counts when storage is unavailable instead of hiding placements', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('sessionStorage', undefined);
    expect(shouldCountNewsletterImpression('brief-page')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('never counts on the server', () => {
    expect(shouldCountNewsletterImpression('home-band')).toBe(false);
  });
});
