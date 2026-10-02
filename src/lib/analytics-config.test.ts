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
});

describe('gtagInitScript', () => {
  /** Runs the inline snippet against fake browser globals, exactly as the page would. */
  async function runInit(navigatorStub: { webdriver?: boolean }) {
    const { gtagInitScript } = await import('@/lib/analytics-config');
    const win: Record<string, unknown> = {};
    const gtag = vi.fn();
    new Function('navigator', 'window', 'gtag', gtagInitScript('G-TEST123'))(
      navigatorStub,
      win,
      gtag,
    );
    return { win, gtag };
  }

  it('configures GA4 without an automatic page_view', async () => {
    const { gtag } = await runInit({});
    expect(gtag).toHaveBeenCalledWith('js', expect.any(Date));
    expect(gtag).toHaveBeenCalledWith('config', 'G-TEST123', { send_page_view: false });
  });

  it('leaves GA4 enabled for a normal browser', async () => {
    const { win } = await runInit({ webdriver: false });
    expect(win['ga-disable-G-TEST123']).toBeUndefined();
  });

  it('disables every hit to the property in an automated browser', async () => {
    const { win, gtag } = await runInit({ webdriver: true });
    expect(win['ga-disable-G-TEST123']).toBe(true);
    // The flag must be set before config so gtag.js never sends the first hit.
    expect(gtag).toHaveBeenCalledWith('config', 'G-TEST123', { send_page_view: false });
  });
});
