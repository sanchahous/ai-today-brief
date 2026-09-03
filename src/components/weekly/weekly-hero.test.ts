import { describe, expect, it } from 'vitest';
import { weeklyHeroDescriptions } from '@/components/weekly/weekly-hero';

describe('weeklyHeroDescriptions', () => {
  it('keeps the standfirst visible and puts the full intro behind Show more', () => {
    expect(
      weeklyHeroDescriptions({
        standfirst: 'The short orientation.',
        intro: 'The full editorial explanation readers reach after opening Show more.',
      }),
    ).toEqual({
      standfirst: 'The short orientation.',
      more: 'The full editorial explanation readers reach after opening Show more.',
    });
  });

  it('shows the intro directly, with no Show more, when no standfirst exists', () => {
    expect(
      weeklyHeroDescriptions({ standfirst: null, intro: 'Only available description.' }),
    ).toEqual({
      standfirst: 'Only available description.',
      more: null,
    });
  });

  it('shows the standfirst directly, with no Show more, when no intro exists', () => {
    expect(
      weeklyHeroDescriptions({ standfirst: 'Only available description.', intro: null }),
    ).toEqual({
      standfirst: 'Only available description.',
      more: null,
    });
  });

  it('skips Show more when the standfirst and intro are the same copy', () => {
    expect(weeklyHeroDescriptions({ standfirst: 'Same copy.', intro: ' Same copy. ' })).toEqual({
      standfirst: 'Same copy.',
      more: null,
    });
  });

  it('returns nothing when neither field has copy', () => {
    expect(weeklyHeroDescriptions({ standfirst: null, intro: '   ' })).toEqual({
      standfirst: null,
      more: null,
    });
  });
});
