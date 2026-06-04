import { describe, expect, it } from 'vitest';
import { isLang, LANGS } from '@/lib/site';

describe('isLang', () => {
  it('accepts supported locales', () => {
    for (const lang of LANGS) {
      expect(isLang(lang)).toBe(true);
    }
  });

  it('rejects unknown values', () => {
    expect(isLang('de')).toBe(false);
    expect(isLang(null)).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});
