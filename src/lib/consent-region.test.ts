import { describe, expect, it } from 'vitest';
import {
  analyticsDefaultFor,
  consentRegionForCountry,
  readConsentRegion,
} from '@/lib/consent-region';

describe('consentRegionForCountry', () => {
  it('keeps the EEA, the UK and Switzerland opt-in', () => {
    for (const country of ['DE', 'FR', 'PL', 'NO', 'IS', 'GB', 'CH']) {
      expect(consentRegionForCountry(country)).toBe('strict');
    }
  });

  it('uses opt-out elsewhere', () => {
    for (const country of ['UA', 'US', 'CA', 'IN', 'SG']) {
      expect(consentRegionForCountry(country)).toBe('standard');
    }
  });

  it('normalises case and whitespace', () => {
    expect(consentRegionForCountry(' ua ')).toBe('standard');
    expect(consentRegionForCountry('de')).toBe('strict');
  });

  it('treats a missing or malformed country as strict', () => {
    expect(consentRegionForCountry(null)).toBe('strict');
    expect(consentRegionForCountry(undefined)).toBe('strict');
    expect(consentRegionForCountry('')).toBe('strict');
    expect(consentRegionForCountry('XX1')).toBe('strict');
  });
});

describe('readConsentRegion', () => {
  it('reads the region among other cookies', () => {
    expect(readConsentRegion('atb-lang=uk; atb-consent-region=standard')).toBe('standard');
    expect(readConsentRegion('atb-consent-region=standard; atb-lang=en')).toBe('standard');
    expect(readConsentRegion('atb-consent-region=strict')).toBe('strict');
  });

  it('falls back to strict', () => {
    expect(readConsentRegion('')).toBe('strict');
    expect(readConsentRegion(null)).toBe('strict');
    expect(readConsentRegion('atb-consent-region=granted')).toBe('strict');
    expect(readConsentRegion('x-atb-consent-region=standard')).toBe('strict');
  });
});

describe('analyticsDefaultFor', () => {
  it('grants analytics by default only outside the strict region', () => {
    expect(analyticsDefaultFor('standard')).toBe(true);
    expect(analyticsDefaultFor('strict')).toBe(false);
  });
});
