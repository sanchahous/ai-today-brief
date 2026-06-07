import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('analyticsConfigured', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is false when GA id is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', '');
    const mod = await import('@/lib/analytics-config');
    expect(mod.analyticsConfigured).toBe(false);
    expect(mod.GA_MEASUREMENT_ID).toBe('');
  });

  it('is true when GA id is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST123');
    const mod = await import('@/lib/analytics-config');
    expect(mod.analyticsConfigured).toBe(true);
    expect(mod.GA_MEASUREMENT_ID).toBe('G-TEST123');
  });

  it('gtmConfigured is false when GTM id is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_GTM_ID', '');
    const mod = await import('@/lib/analytics-config');
    expect(mod.gtmConfigured).toBe(false);
    expect(mod.tagsConfigured).toBe(mod.analyticsConfigured);
  });

  it('tagsConfigured is true when only GTM id is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', '');
    vi.stubEnv('NEXT_PUBLIC_GTM_ID', 'GTM-TEST');
    const mod = await import('@/lib/analytics-config');
    expect(mod.gtmConfigured).toBe(true);
    expect(mod.tagsConfigured).toBe(true);
  });
});
