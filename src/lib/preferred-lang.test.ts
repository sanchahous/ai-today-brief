import { describe, expect, it } from 'vitest';
import {
  alternateLangHref,
  countrySuggestsUk,
  parseAcceptLanguage,
  resolvePreferredLang,
} from '@/lib/preferred-lang';

describe('parseAcceptLanguage', () => {
  it('prefers uk when listed first', () => {
    expect(parseAcceptLanguage('uk-UA,uk;q=0.9,en;q=0.8')).toBe('uk');
  });

  it('respects q values', () => {
    expect(parseAcceptLanguage('en;q=0.9,uk;q=0.95')).toBe('uk');
  });

  it('returns null when no supported tag', () => {
    expect(parseAcceptLanguage('de,fr')).toBeNull();
  });
});

describe('resolvePreferredLang', () => {
  it('uses cookie over geo and accept-language', () => {
    expect(
      resolvePreferredLang({
        cookieLang: 'en',
        country: 'UA',
        acceptLanguage: 'uk',
      }),
    ).toBe('en');
  });

  it('uses Ukraine geo when browser is English', () => {
    expect(
      resolvePreferredLang({
        acceptLanguage: 'en-US,en;q=0.9',
        country: 'UA',
      }),
    ).toBe('uk');
  });

  it('falls back to accept-language then default', () => {
    expect(resolvePreferredLang({ acceptLanguage: 'uk' })).toBe('uk');
    expect(resolvePreferredLang({})).toBe('en');
  });
});

describe('countrySuggestsUk', () => {
  it('matches UA case-insensitively', () => {
    expect(countrySuggestsUk('ua')).toBe(true);
    expect(countrySuggestsUk('US')).toBe(false);
  });
});

describe('alternateLangHref', () => {
  it('swaps lang prefix on nested paths', () => {
    expect(alternateLangHref('/uk/news', 'uk')).toBe('/en/news');
  });

  it('returns bare alt lang when path missing', () => {
    expect(alternateLangHref(null, 'en')).toBe('/uk');
  });
});
