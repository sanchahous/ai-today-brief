import { describe, expect, it } from 'vitest';
import { dailyHeroDescriptions } from './daily-hero';

describe('dailyHeroDescriptions', () => {
  it('keeps the entire intro behind Show more so the first view stays visual', () => {
    expect(
      dailyHeroDescriptions(
        'The meaningful shift is lower inference cost. The full editorial explanation stays behind Show more.',
      ),
    ).toEqual({
      fullDescription:
        'The meaningful shift is lower inference cost. The full editorial explanation stays behind Show more.',
    });
  });

  it('preserves a short intro only as expandable content', () => {
    expect(dailyHeroDescriptions('One concise published introduction.')).toEqual({
      fullDescription: 'One concise published introduction.',
    });
  });
});
