import { describe, expect, it } from 'vitest';

import {
  calendarDateInZone,
  coverageShares,
  distinctSourceCount,
  focusConcepts,
  issueNumberFromWeekStarts,
  itemsOnNewestDay,
  leadSlug,
  mastheadStats,
  mentionWindows,
  newestCoverageSlugs,
  pluralLabel,
  readMinutesForParts,
  shiftIsoDate,
  sumReadMinutes,
  weeklyFactsFromRows,
} from './home-stats';

describe('shiftIsoDate', () => {
  it('moves a calendar date by whole days', () => {
    expect(shiftIsoDate('2026-10-04', -6)).toBe('2026-09-28');
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('rejects strings that are not an ISO date', () => {
    expect(shiftIsoDate('04-10-2026', 1)).toBeNull();
    expect(shiftIsoDate('2026-10-4', 1)).toBeNull();
  });
});

describe('calendarDateInZone', () => {
  it('uses the Kyiv calendar, not UTC', () => {
    expect(calendarDateInZone(new Date('2026-10-04T21:30:00Z'))).toBe('2026-10-05');
    expect(calendarDateInZone(new Date('2026-10-04T20:30:00Z'))).toBe('2026-10-04');
  });
});

describe('mastheadStats', () => {
  it('omits missing or zero counts and never invents 70 or 120', () => {
    expect(mastheadStats({ storiesLast7Days: null, categoryCount: 0 })).toEqual([]);
    expect(mastheadStats({ storiesLast7Days: 0, categoryCount: 9 })).toEqual([
      { kind: 'categories', value: 9 },
    ]);
    expect(mastheadStats({ storiesLast7Days: 12, categoryCount: 9 })).toEqual([
      { kind: 'stories7d', value: 12 },
      { kind: 'categories', value: 9 },
    ]);
  });
});

describe('pluralLabel', () => {
  it('follows English and Ukrainian plural rules', () => {
    expect(pluralLabel(1, 'en', 'stories')).toBe('story');
    expect(pluralLabel(2, 'en', 'stories')).toBe('stories');
    expect(pluralLabel(1, 'uk', 'stories')).toBe('історія');
    expect(pluralLabel(2, 'uk', 'sources')).toBe('джерела');
    expect(pluralLabel(5, 'uk', 'concepts')).toBe('пояснень');
    expect(pluralLabel(21, 'uk', 'categories')).toBe('рубрика');
  });
});

describe('leadSlug', () => {
  it('picks the lowest edition slug on that day', () => {
    expect(
      leadSlug(
        [
          { date: '2026-10-04', edition: 2, slug: 'later' },
          { date: '2026-10-04', edition: 1, slug: 'lead' },
          { date: '2026-10-03', edition: 1, slug: 'old' },
        ],
        '2026-10-04',
      ),
    ).toBe('lead');
  });

  it('returns null when the day has no slug', () => {
    expect(leadSlug([{ date: '2026-10-04', edition: 1, slug: null }], '2026-10-04')).toBeNull();
  });
});

describe('edition slices', () => {
  it('keeps only the newest day and sums its read minutes', () => {
    const items = [
      { date: '2026-10-04', rank: 1, readMinutes: 3 },
      { date: '2026-10-04', rank: 2, readMinutes: 2 },
      { date: '2026-10-03', rank: 1, readMinutes: 9 },
    ];
    expect(itemsOnNewestDay(items)).toHaveLength(2);
    expect(sumReadMinutes(itemsOnNewestDay(items))).toBe(5);
    expect(itemsOnNewestDay([])).toEqual([]);
    expect(sumReadMinutes([{ readMinutes: 0 }])).toBe(0);
  });
});

describe('coverage', () => {
  it('orders newest day, then edition, then rank and caps the sample', () => {
    const slugs = newestCoverageSlugs(
      [
        { date: '2026-10-01', edition: 1, rank: 1, categorySlug: 'old' },
        { date: '2026-10-04', edition: 2, rank: 1, categorySlug: 'second-pack' },
        { date: '2026-10-04', edition: 1, rank: 2, categorySlug: 'tools' },
        { date: '2026-10-04', edition: 1, rank: 1, categorySlug: 'agents' },
      ],
      2,
    );
    expect(slugs).toEqual(['agents', 'tools']);
  });

  it('counts category shares and skips blanks', () => {
    expect(coverageShares(['agents', null, 'agents', 'tools', undefined])).toEqual([
      { slug: 'agents', count: 2 },
      { slug: 'tools', count: 1 },
    ]);
  });
});

describe('mentionWindows', () => {
  it('counts the latest 7 days and the delta against the previous 7', () => {
    const windows = mentionWindows([
      { date: '2026-10-04', tools: ['MCP'] },
      { date: '2026-10-03', tools: ['MCP'] },
      { date: '2026-09-22', tools: ['MCP'] },
      { date: '2026-09-20', tools: ['Ignored'] },
    ]);
    expect(windows.get('MCP')).toEqual({ mentions: 2, delta: 1 });
    expect(windows.has('Ignored')).toBe(false);
  });

  it('omits delta when the previous week is absent', () => {
    const windows = mentionWindows([{ date: '2026-10-04', tools: ['Evals'] }]);
    expect(windows.get('Evals')).toEqual({ mentions: 1, delta: null });
  });

  it('returns an empty map with no dates', () => {
    expect(mentionWindows([]).size).toBe(0);
  });
});

describe('focusConcepts', () => {
  it('keeps up to five real slugs, in order, without duplicates', () => {
    const focus = focusConcepts(
      [
        { name: 'MCP', conceptSlug: 'mcp' },
        { name: 'MCP again', conceptSlug: 'mcp' },
        { name: 'No hub', conceptSlug: null },
        { name: 'Blank', conceptSlug: '  ' },
        { name: 'Evals', conceptSlug: 'evals' },
        { name: 'Cache', conceptSlug: 'prompt-caching' },
        { name: 'Local', conceptSlug: 'local-llm' },
        { name: 'Agents', conceptSlug: 'sub-agents' },
        { name: 'Sixth', conceptSlug: 'sixth' },
      ],
      5,
    );
    expect(focus.map((item) => item.slug)).toEqual([
      'mcp',
      'evals',
      'prompt-caching',
      'local-llm',
      'sub-agents',
    ]);
  });
});

describe('weekly facts', () => {
  it('counts stories, minutes and distinct sources', () => {
    const facts = weeklyFactsFromRows([
      {
        summary: 'one two three four five',
        why: 'six',
        sources: [{ url: 'https://example.com/a', name: 'A' }],
        snapshot: { source_url: 'https://example.com/a' },
      },
      {
        summary: '',
        why: '',
        sources: ['https://example.com/b'],
        snapshot: { name: 'Lab' },
      },
    ]);
    expect(facts.stories).toBe(2);
    expect(facts.minutes).toBe(readMinutesForParts([{ summary: 'one two three four five', why: 'six' }]));
    expect(facts.sources).toBe(3);
    expect(distinctSourceCount(['not a url', { url: 'ftp://files.example/x' }])).toBe(0);
  });

  it('numbers a published week by sorted unique starts', () => {
    expect(issueNumberFromWeekStarts(['2026-09-28', '2026-10-05', '2026-09-28'], '2026-10-05')).toBe(2);
    expect(issueNumberFromWeekStarts(['2026-09-28'], '2026-10-05')).toBeNull();
    expect(issueNumberFromWeekStarts(['2026-09-28'], '')).toBeNull();
  });
});
