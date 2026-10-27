import { describe, expect, it } from 'vitest';
import { CONSENT_STORAGE_KEY } from '@/lib/consent';
import { CONSENT_MODE_DEFAULTS_SCRIPT } from '@/lib/consent-mode-snippet';

/** Runs the inline snippet against fake browser globals and returns the consent default. */
function consentDefault(stored: string | null): Record<string, unknown> {
  const dataLayer: unknown[][] = [];
  const window: Record<string, unknown> = { dataLayer };
  const localStorage = { getItem: (key: string) => (key === CONSENT_STORAGE_KEY ? stored : null) };
  // Executes the exact inline string the layout ships.
  new Function('window', 'localStorage', 'dataLayer', CONSENT_MODE_DEFAULTS_SCRIPT)(
    window,
    localStorage,
    dataLayer,
  );
  const call = dataLayer.find((args) => args[0] === 'consent' && args[1] === 'default');
  return call?.[2] as Record<string, unknown>;
}

describe('CONSENT_MODE_DEFAULTS_SCRIPT', () => {
  it('grants analytics without a stored choice', () => {
    expect(consentDefault(null).analytics_storage).toBe('granted');
  });

  it('honours a stored analytics opt-out', () => {
    const optOut = JSON.stringify({ analytics: false, ads: false, updatedAt: '2026-01-01' });
    expect(consentDefault(optOut).analytics_storage).toBe('denied');
  });

  it('keeps analytics on for a stored opt-in', () => {
    const optIn = JSON.stringify({ analytics: true, ads: false, updatedAt: '2026-01-01' });
    expect(consentDefault(optIn).analytics_storage).toBe('granted');
  });

  it('never grants ad storage by default', () => {
    const consent = consentDefault(null);
    expect(consent.ad_storage).toBe('denied');
    expect(consent.ad_user_data).toBe('denied');
    expect(consent.ad_personalization).toBe('denied');
  });

  it('survives unreadable storage', () => {
    expect(consentDefault('{not json').analytics_storage).toBe('granted');
  });
});
