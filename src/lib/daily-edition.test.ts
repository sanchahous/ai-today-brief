import { describe, expect, it } from 'vitest';
import { getStrings } from '@/lib/i18n';
import {
  briefDateParts,
  citationSourceName,
  distinctWhy,
  fillCountTemplate,
  firstPracticeStep,
  localizedList,
  openingTakeaways,
  stringList,
} from '@/lib/daily-edition';

const item = {
  takeaways: ['Keep the cache boundary explicit.'],
  categorySlug: 'agents-and-mcp',
  categoryName: 'Agents',
  categoryColor: null,
};

describe('briefDateParts', () => {
  it('formats the masthead with Intl for both locales', () => {
    const en = briefDateParts('2026-10-04', 'en');
    const uk = briefDateParts('2026-10-04', 'uk');
    expect(en?.day).toBe('4');
    expect(en?.iso).toBe('2026-10-04');
    expect(en?.weekday.length).toBeGreaterThan(0);
    expect(en?.full).toContain('2026');
    expect(uk?.day).toBe('4');
    expect(uk?.full).not.toBe(en?.full);
  });

  it('rejects dates that are not a real calendar day', () => {
    expect(briefDateParts('2026-02-31', 'en')).toBeNull();
    expect(briefDateParts('04-10-2026', 'en')).toBeNull();
    expect(briefDateParts('', 'uk')).toBeNull();
  });
});

describe('daily edition facts', () => {
  it('reads string lists and prefers the requested language', () => {
    expect(stringList(['  a ', '', 1, 'b'])).toEqual(['a', 'b']);
    expect(stringList(null)).toEqual([]);
    expect(localizedList('uk', ['English only'], [])).toEqual(['English only']);
    expect(localizedList('uk', ['English'], ['Українська'])).toEqual(['Українська']);
  });

  it('takes the first three real takeaways and skips empty items', () => {
    const lines = openingTakeaways(
      [
        { ...item, takeaways: ['   '] },
        item,
        { ...item, takeaways: ['Second.'] },
        { ...item, takeaways: ['Third.'] },
        { ...item, takeaways: ['Fourth.'] },
      ],
      3,
    );
    expect(lines.map((line) => line.text)).toEqual([
      'Keep the cache boundary explicit.',
      'Second.',
      'Third.',
    ]);
    expect(openingTakeaways([], 3)).toEqual([]);
  });

  it('returns one practice step only when an action item exists', () => {
    expect(firstPracticeStep([{ id: 'a', actionItems: [] }])).toBeNull();
    expect(
      firstPracticeStep([
        { id: 'a', actionItems: ['  '] },
        { id: 'b', actionItems: [' Pin the server version. '] },
      ]),
    ).toEqual({ itemId: 'b', step: 'Pin the server version.' });
  });

  it('uses a citation source name and ignores titles', () => {
    expect(citationSourceName([{ title: 'Launch post', url: 'https://example.com' }])).toBeNull();
    expect(citationSourceName([{ source_name: '  Cursor  ' }])).toBe('Cursor');
    expect(citationSourceName('nope')).toBeNull();
  });

  it('drops a why-line that only repeats the summary', () => {
    expect(distinctWhy('  Same text. ', 'Same text.')).toBeNull();
    expect(distinctWhy('', 'Summary')).toBeNull();
    expect(distinctWhy('A distinct consequence.', 'Summary')).toBe('A distinct consequence.');
  });

  it('fills the read-status template', () => {
    expect(fillCountTemplate('{read} of {total}', 2, 6)).toBe('2 of 6');
  });

  it('does not put an unconfirmed edition clock into the daily copy', () => {
    for (const lang of ['en', 'uk'] as const) {
      const t = getStrings(lang);
      const blob = [t.briefComplete, t.nextEdition, t.previousEdition, t.dailyBriefEyebrow].join('\n');
      expect(blob).not.toMatch(/07:00/);
      expect(blob).not.toMatch(/пн–сб/);
      expect(blob).not.toMatch(/Mon–Sat/);
    }
  });
});
