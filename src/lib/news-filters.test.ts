import { describe, expect, it } from 'vitest';
import type { HomeItem } from '@/lib/home';
import { matchesQuery, sortItems, withinPreset } from '@/lib/news-filters';

function item(partial: Partial<HomeItem> & Pick<HomeItem, 'id' | 'title' | 'date'>): HomeItem {
  return {
    rank: 1,
    categorySlug: null,
    categoryName: null,
    categoryColor: null,
    href: '/en/news',
    summary: '',
    why: '',
    hasVideo: false,
    tools: [],
    sourceName: null,
    readMinutes: 3,
    imageUrl: null,
    ...partial,
  };
}

describe('matchesQuery', () => {
  it('matches title substring', () => {
    const row = item({ id: '1', title: 'Claude Code release', date: '2026-06-01' });
    expect(matchesQuery(row, 'claude')).toBe(true);
    expect(matchesQuery(row, 'gemini')).toBe(false);
  });

  it('passes empty query', () => {
    expect(matchesQuery(item({ id: '1', title: 'x', date: '2026-06-01' }), '  ')).toBe(true);
  });
});

describe('withinPreset', () => {
  it('filters by date preset', () => {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    expect(withinPreset(today, 'today')).toBe(true);
    expect(withinPreset('2020-01-01', 'today')).toBe(false);
    expect(withinPreset('2020-01-01', 'all')).toBe(true);
  });
});

describe('sortItems', () => {
  const rows = [
    item({ id: 'a', title: 'a', date: '2026-06-03', rank: 2 }),
    item({ id: 'b', title: 'b', date: '2026-06-01', rank: 1 }),
  ];

  it('sorts newest first', () => {
    const sorted = sortItems(rows, 'newest');
    expect(sorted[0]?.id).toBe('a');
  });

  it('sorts by rank for discussed', () => {
    const sorted = sortItems(rows, 'discussed');
    expect(sorted[0]?.id).toBe('a');
  });
});
