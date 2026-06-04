import { describe, expect, it } from 'vitest';
import { isConsentState, parseConsentJson } from '@/lib/consent';

describe('parseConsentJson', () => {
  it('parses valid consent', () => {
    const raw = JSON.stringify({
      analytics: true,
      ads: false,
      updatedAt: '2026-06-04T10:00:00.000Z',
    });
    expect(parseConsentJson(raw)).toEqual({
      analytics: true,
      ads: false,
      updatedAt: '2026-06-04T10:00:00.000Z',
    });
  });

  it('rejects invalid JSON and shape', () => {
    expect(parseConsentJson('not-json')).toBeNull();
    expect(parseConsentJson('{}')).toBeNull();
    expect(parseConsentJson(JSON.stringify({ analytics: 'yes', ads: false, updatedAt: 'x' }))).toBeNull();
  });
});

describe('isConsentState', () => {
  it('narrows valid objects', () => {
    expect(
      isConsentState({ analytics: false, ads: true, updatedAt: '2026-01-01T00:00:00.000Z' }),
    ).toBe(true);
    expect(isConsentState(null)).toBe(false);
  });
});
