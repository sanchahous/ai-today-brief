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
