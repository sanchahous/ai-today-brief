import { describe, expect, it } from 'vitest';
import { buildFactsVisual, parseFactValue } from './facts-visual';

describe('parseFactValue', () => {
  it('parses plain numbers, magnitudes, currency and percent', () => {
    expect(parseFactValue('128')).toMatchObject({ num: 128 });
    expect(parseFactValue('200K tokens')).toMatchObject({ num: 200_000 });
    expect(parseFactValue('1M context window')).toMatchObject({ num: 1_000_000 });
    expect(parseFactValue('$3 / 1M input tokens')).toMatchObject({ num: 3 });
    expect(parseFactValue('70.3%')).toMatchObject({ num: 70.3 });
    expect(parseFactValue('1,250,000 requests')).toMatchObject({ num: 1_250_000 });
  });

  it('builds matching keys for comparable values and distinct keys otherwise', () => {
    const a = parseFactValue('$3 / 1M input tokens')!;
    const b = parseFactValue('$15 / 1M input tokens')!;
    const c = parseFactValue('$20 / month')!;
    expect(a.key).toBe(b.key);
    expect(a.key).not.toBe(c.key);

    const p1 = parseFactValue('70.3%')!;
    const p2 = parseFactValue('82%')!;
    expect(p1.key).toBe(p2.key);
    expect(p1.key).not.toBe(parseFactValue('70.3')!.key);
  });

  it('flags bare years and rejects non-numeric values', () => {
    expect(parseFactValue('2026')!.yearLike).toBe(true);
    expect(parseFactValue('2026 release')!.yearLike).toBe(false);
    expect(parseFactValue('$2,026')!.yearLike).toBe(false);
    expect(parseFactValue('open weights')).toBeNull();
    expect(parseFactValue('')).toBeNull();
  });

  it('does not treat a word starting with k/m as a magnitude suffix', () => {
    // "5 minutes" — 'm' belongs to "minutes", not a 1e6 multiplier
    expect(parseFactValue('5 minutes')!.num).toBe(5);
    expect(parseFactValue('40 km')!.num).toBe(40);
  });
});

describe('buildFactsVisual', () => {
  it('returns comparison bars for same-key numeric groups, scaled to max', () => {
    const visual = buildFactsVisual([
      { label: 'Input price', value: '$3 / 1M tokens' },
      { label: 'Output price', value: '$15 / 1M tokens' },
      { label: 'Availability', value: 'GA' },
    ]);
    expect(visual).toEqual({
      kind: 'comparison',
      items: [
        { label: 'Input price', display: '$3 / 1M tokens', ratio: 0.2 },
        { label: 'Output price', display: '$15 / 1M tokens', ratio: 1 },
      ],
    });
  });

  it('falls back to stat cards when numbers are not comparable', () => {
    const visual = buildFactsVisual([
      { label: 'Context', value: '200K tokens' },
      { label: 'Price', value: '$20/mo' },
      { label: 'Benchmark', value: '70.3%' },
      { label: 'Notes', value: 'A very long non-card-able explanation of things' },
    ]);
    expect(visual?.kind).toBe('stats');
    expect(visual && visual.items.map((s) => s.label)).toEqual(['Context', 'Price', 'Benchmark']);
  });

  it('never builds bars out of bare years', () => {
    const visual = buildFactsVisual([
      { label: 'Founded', value: '2021' },
      { label: 'Latest release', value: '2026' },
    ]);
    expect(visual?.kind).not.toBe('comparison');
  });

  it('returns null for thin or non-numeric boxes', () => {
    expect(buildFactsVisual([])).toBeNull();
    expect(buildFactsVisual([{ label: 'Price', value: '$5' }])).toBeNull();
    expect(
      buildFactsVisual([
        { label: 'License', value: 'an unusually long license description here' },
        { label: 'Status', value: 'another long non numeric descriptive value' },
      ]),
    ).toBeNull();
  });

  it('caps comparison bars at 6 and stat cards at 4', () => {
    const bars = buildFactsVisual(
      Array.from({ length: 9 }, (_, i) => ({ label: `m${i}`, value: `${i + 1}0%` })),
    );
    expect(bars?.kind).toBe('comparison');
    expect(bars?.items).toHaveLength(6);

    const stats = buildFactsVisual([
      { label: 'a', value: '$1/mo' },
      { label: 'b', value: '2 GB' },
      { label: 'c', value: '3 seats' },
      { label: 'd', value: '4 regions' },
      { label: 'e', value: '5 zones' },
    ]);
    expect(stats?.kind).toBe('stats');
    expect(stats?.items.length).toBeLessThanOrEqual(4);
  });
});
