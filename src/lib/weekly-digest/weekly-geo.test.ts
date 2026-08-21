import { describe, expect, it } from 'vitest';
import { weeklyFaqFromDigest, weeklyMetaDescription, weeklyMetricsFromItems } from './weekly-geo';

describe('weekly GEO helpers', () => {
  it('never returns a 1000-character standfirst as the meta description', () => {
    const standfirst = 'Qwen3.8 active parameters and IBM memory '.repeat(40);
    expect(standfirst.length).toBeGreaterThan(160);
    const description = weeklyMetaDescription({
      title: 'Weekly',
      metaDescription: '',
      standfirst,
      intro: null,
      items: [],
    });
    expect([...description].length).toBeLessThanOrEqual(160);
    expect(description.endsWith('…')).toBe(true);
  });

  it('builds FAQ from feature discussion questions', () => {
    const faq = weeklyFaqFromDigest({
      title: 'Weekly',
      metaDescription: 'Meta',
      standfirst: null,
      intro: null,
      items: [
        {
          rank: 1,
          title: 'Qwen3.8',
          summary: '95B active parameters, not 2.4T.',
          why: 'Serving cost.',
          takeaway: 'Measure active params before you buy GPUs.',
          discussionQuestion: 'Why does 95B matter more than 2.4T?',
        },
      ],
    });
    expect(faq).toEqual([
      {
        question: 'Why does 95B matter more than 2.4T?',
        answer: 'Measure active params before you buy GPUs.',
      },
    ]);
  });

  it('extracts comparable metrics from story copy', () => {
    const rows = weeklyMetricsFromItems([
      {
        rank: 1,
        title: 'Qwen3.8',
        summary: 'Qwen3.8 runs 95B active parameters, not the 2.4T headline.',
        why: 'HF listed 0 of 178 Chinese releases as non-commercial.',
        takeaway: 'IBM cut token cost 14–40%.',
        discussionQuestion: '',
      },
    ]);
    expect(rows.some((row) => row.value.includes('95B'))).toBe(true);
    expect(rows.some((row) => /0 of 178/i.test(row.value))).toBe(true);
  });
});
