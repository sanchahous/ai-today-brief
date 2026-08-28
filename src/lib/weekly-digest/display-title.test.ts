import { describe, expect, it } from 'vitest';
import { localizedWeeklyDisplayTitle, weeklyRevisionTitlePresentation } from './display-title';

const canonical = {
  title_en: 'Qwen3.8, IBM memory, and open licensing this week',
  title_uk: 'Qwen3.8, пам’ять IBM і відкриті ліцензії цього тижня',
};

describe('localizedWeeklyDisplayTitle', () => {
  it('uses the localized editorial display title when it is nonblank', () => {
    expect(
      localizedWeeklyDisplayTitle('en', {
        ...canonical,
        display_title_en: 'Efficiency, not scale',
        display_title_uk: 'Не масштаб, а ефективність',
      }),
    ).toBe('Efficiency, not scale');
    expect(
      localizedWeeklyDisplayTitle('uk', {
        ...canonical,
        display_title_en: 'Efficiency, not scale',
        display_title_uk: 'Не масштаб, а ефективність',
      }),
    ).toBe('Не масштаб, а ефективність');
  });

  it('keeps the canonical title separate for SEO, OG, and listing surfaces', () => {
    expect(
      weeklyRevisionTitlePresentation('en', {
        ...canonical,
        display_title_en: 'Efficiency, not scale',
      }),
    ).toEqual({
      canonicalTitle: canonical.title_en,
      displayTitle: 'Efficiency, not scale',
    });
  });

  it('falls back to the same locale canonical title instead of borrowing another locale display title', () => {
    expect(
      localizedWeeklyDisplayTitle('uk', {
        ...canonical,
        display_title_en: 'Efficiency, not scale',
        display_title_uk: '  ',
      }),
    ).toBe(canonical.title_uk);
  });

  it('uses a canonical title for historical revisions with no display-title fields', () => {
    expect(localizedWeeklyDisplayTitle('en', canonical)).toBe(canonical.title_en);
    expect(localizedWeeklyDisplayTitle('uk', canonical)).toBe(canonical.title_uk);
  });
});
