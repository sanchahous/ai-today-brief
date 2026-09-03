import { describe, expect, it } from 'vitest';
import { dailyHeroDescriptions } from './daily-hero';

describe('dailyHeroDescriptions', () => {
  it('keeps a short intro fully visible, with no Show more', () => {
    expect(dailyHeroDescriptions('One concise published introduction.')).toEqual({
      excerpt: 'One concise published introduction.',
      more: null,
    });
  });

  it('shows the opening sentence and puts the rest behind Show more', () => {
    const first = 'The meaningful shift is lower inference cost.';
    const rest =
      'This much longer supporting sentence keeps going to make sure the whole intro comfortably exceeds the excerpt budget so the sentence-boundary split actually triggers here as intended.';
    const intro = `${first} ${rest}`;
    expect(intro.length).toBeGreaterThan(220);
    expect(dailyHeroDescriptions(intro)).toEqual({ excerpt: first, more: rest });
  });

  it('falls back to a word-boundary cut when no sentence ends within budget', () => {
    const intro = `${'word '.repeat(60)}trailing tail after the cut.`.trim();
    const { excerpt, more } = dailyHeroDescriptions(intro);
    expect(excerpt?.endsWith('…')).toBe(true);
    expect(excerpt && more && `${excerpt.slice(0, -1)} ${more}`).toBe(intro);
  });

  it('returns nothing for a missing or blank intro', () => {
    expect(dailyHeroDescriptions(null)).toEqual({ excerpt: null, more: null });
    expect(dailyHeroDescriptions('   ')).toEqual({ excerpt: null, more: null });
  });
});
