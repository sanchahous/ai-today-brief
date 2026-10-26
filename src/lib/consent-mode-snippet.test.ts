import { describe, expect, it } from 'vitest';
import { CONSENT_STORAGE_KEY } from '@/lib/consent';
import { CONSENT_MODE_DEFAULTS_SCRIPT } from '@/lib/consent-mode-snippet';

/** Runs the inline snippet against fake browser globals and returns the consent default. */
function consentDefault(cookie: string, stored: string | null): Record<string, unknown> {
  const dataLayer: unknown[][] = [];
  const window: Record<string, unknown> = { dataLayer };
  const document = { cookie };
  const localStorage = { getItem: (key: string) => (key === CONSENT_STORAGE_KEY ? stored : null) };
  // Executes the exact inline string the layout ships.
  new Function('window', 'document', 'localStorage', 'dataLayer', CONSENT_MODE_DEFAULTS_SCRIPT)(
    window,
    document,
    localStorage,
    dataLayer,
  );
  const call = dataLayer.find((args) => args[0] === 'consent' && args[1] === 'default');
  return call?.[2] as Record<string, unknown>;
}

describe('CONSENT_MODE_DEFAULTS_SCRIPT', () => {
  it('denies analytics without a region cookie', () => {
    expect(consentDefault('', null).analytics_storage).toBe('denied');
  });

  it('grants analytics by default in the standard region', () => {
    expect(consentDefault('atb-lang=uk; atb-consent-region=standard', null).analytics_storage).toBe(
      'granted',
    );
  });

  it('keeps the strict region opt-in', () => {
    expect(consentDefault('atb-consent-region=strict', null).analytics_storage).toBe('denied');
  });

  it('lets a stored choice win over the region', () => {
    const optOut = JSON.stringify({ analytics: false, ads: false, updatedAt: '2026-01-01' });
    const optIn = JSON.stringify({ analytics: true, ads: false, updatedAt: '2026-01-01' });
    expect(consentDefault('atb-consent-region=standard', optOut).analytics_storage).toBe('denied');
    expect(consentDefault('atb-consent-region=strict', optIn).analytics_storage).toBe('granted');
  });

  it('never grants ad storage by default', () => {
    const consent = consentDefault('atb-consent-region=standard', null);
    expect(consent.ad_storage).toBe('denied');
    expect(consent.ad_user_data).toBe('denied');
    expect(consent.ad_personalization).toBe('denied');
  });

  it('survives unreadable storage', () => {
    expect(consentDefault('atb-consent-region=standard', '{not json').analytics_storage).toBe(
      'denied',
    );
  });
});
