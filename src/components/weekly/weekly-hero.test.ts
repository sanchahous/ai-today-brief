import { describe, expect, it } from 'vitest';
import { weeklyHeroDescriptions } from '@/components/weekly/weekly-hero';

describe('weeklyHeroDescriptions', () => {
  it('keeps all description copy behind Show more while the display title orients first view', () => {
    expect(
      weeklyHeroDescriptions({
        standfirst: 'The short orientation.',
        intro: 'The full editorial explanation readers reach after opening Show more.',
      }),
    ).toEqual({
      fullDescription: 'The full editorial explanation readers reach after opening Show more.',
    });
  });

  it('falls back to the standfirst as expandable copy when no full intro exists', () => {
    expect(
      weeklyHeroDescriptions({ standfirst: 'Only available description.', intro: null }),
    ).toEqual({
      fullDescription: 'Only available description.',
    });
  });

  it('uses an identical standfirst and intro only once', () => {
    expect(weeklyHeroDescriptions({ standfirst: 'Same copy.', intro: ' Same copy. ' })).toEqual({
      fullDescription: 'Same copy.',
    });
  });
});
