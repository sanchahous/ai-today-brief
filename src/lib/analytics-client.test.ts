import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_STORAGE_KEY } from '@/lib/consent';

function grantAnalytics(storage: Map<string, string>): void {
  storage.set(
    CONSENT_STORAGE_KEY,
    JSON.stringify({ analytics: true, ads: false, updatedAt: '2026-01-01T00:00:00.000Z' }),
  );
}

describe('analytics-client', () => {
  const gtag = vi.fn();
  const storage = new Map<string, string>();

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST123');
    storage.clear();
    gtag.mockClear();

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
    vi.stubGlobal('window', {
      gtag,
      location: { href: 'https://example.com/en/news' },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('hasAnalyticsConsent is true when analytics cookies granted', async () => {
    grantAnalytics(storage);
    const mod = await import('@/lib/analytics-client');
    expect(mod.hasAnalyticsConsent()).toBe(true);
  });

  it('hasAnalyticsConsent is true without stored consent (opt-out default)', async () => {
    const mod = await import('@/lib/analytics-client');
    expect(mod.hasAnalyticsConsent()).toBe(true);
  });

  it('hasAnalyticsConsent is false after explicit analytics opt-out', async () => {
    storage.set(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ analytics: false, ads: false, updatedAt: '2026-01-01T00:00:00.000Z' }),
    );
    const mod = await import('@/lib/analytics-client');
    expect(mod.hasAnalyticsConsent()).toBe(false);
  });

  it('does not call gtag after explicit analytics opt-out', async () => {
    storage.set(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ analytics: false, ads: false, updatedAt: '2026-01-01T00:00:00.000Z' }),
    );
    const mod = await import('@/lib/analytics-client');
    mod.trackEvent('test_event', { foo: 'bar' });
    expect(gtag).not.toHaveBeenCalled();
  });

  it('merges global params into trackEvent without stored consent', async () => {
    const mod = await import('@/lib/analytics-client');
    mod.setGlobalParams({ lang: 'en', page_path: '/en/news' });
    mod.trackEvent('test_event', { foo: 'bar' });
    expect(gtag).toHaveBeenCalledWith('event', 'test_event', {
      lang: 'en',
      page_path: '/en/news',
      foo: 'bar',
    });
  });

  it('setUserProperties calls gtag set without stored consent', async () => {
    const mod = await import('@/lib/analytics-client');
    mod.setUserProperties({ lang: 'uk', theme: 'dark' });
    expect(gtag).toHaveBeenCalledWith('set', 'user_properties', { lang: 'uk', theme: 'dark' });
  });

  it('logs to console in dev when GA is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', '');
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await import('@/lib/analytics-client');
    mod.trackEvent('dev_event', { x: 1 });
    expect(warn).toHaveBeenCalledWith('[analytics]', 'dev_event', { x: 1 });
    warn.mockRestore();
  });
});

describe('trackItemEvent', () => {
  const gtag = vi.fn();
  const sendBeacon = vi.fn((_url: string, _body?: string): boolean => true);
  const storage = new Map<string, string>();

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST123');
    storage.clear();
    gtag.mockClear();
    sendBeacon.mockClear();

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
    vi.stubGlobal('window', { gtag, location: { href: 'https://aitodaybrief.com/en/news' } });
    vi.stubGlobal('navigator', { sendBeacon });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('fires GA4 (with id as post_id) and a beacon to /api/ev', async () => {
    const mod = await import('@/lib/analytics-client');
    mod.trackItemEvent('post_expand', { id: 'abc', lang: 'en' }, { category: 'agents' });
    expect(gtag).toHaveBeenCalledWith('event', 'post_expand', { category: 'agents', post_id: 'abc' });
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [path, payload] = sendBeacon.mock.calls[0]!;
    expect(path).toBe('/api/ev');
    expect(JSON.parse(payload as string)).toMatchObject({ id: 'abc', type: 'post_expand', lang: 'en' });
  });

  it('does not beacon (or GA4) after analytics opt-out', async () => {
    storage.set(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ analytics: false, ads: false, updatedAt: '2026-01-01T00:00:00.000Z' }),
    );
    const mod = await import('@/lib/analytics-client');
    mod.trackItemEvent('share', { id: 'abc' }, { method: 'x' });
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(gtag).not.toHaveBeenCalled();
  });

  it('skips the beacon when neither id nor slug is given', async () => {
    const mod = await import('@/lib/analytics-client');
    mod.trackItemEvent('view', {}, {});
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('forwards a numeric percent as the beacon value', async () => {
    const mod = await import('@/lib/analytics-client');
    mod.trackItemEvent('scroll_90', { slug: 's' }, { percent: 90 });
    const payload = JSON.parse(sendBeacon.mock.calls[0]![1] as string);
    expect(payload).toMatchObject({ slug: 's', type: 'scroll_90', value: 90 });
  });
});
