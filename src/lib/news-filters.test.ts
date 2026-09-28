import { describe, expect, it } from 'vitest';
import type { HomeItem } from '@/lib/home';
import {
  calculateRelevanceScore,
  daysAgo,
  matchesQuery,
  normalizePage,
  parseNewsUrlParams,
  serializeNewsUrlParams,
  sortItems,
  withinPreset,
  type NewsFilters,
} from '@/lib/news-filters';

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

  it('matches category or source name', () => {
    const row = item({
      id: '1',
      title: 'New tool',
      date: '2026-06-01',
      categoryName: 'Agents & MCP',
      sourceName: 'Anthropic Blog',
    });
    expect(matchesQuery(row, 'agents')).toBe(true);
    expect(matchesQuery(row, 'anthropic')).toBe(true);
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

  it('calculates daysAgo timestamp correctly', () => {
    const now = Date.now();
    const oneDayAgo = daysAgo(1);
    expect(now - oneDayAgo).toBeGreaterThanOrEqual(86_390_000);
  });
});

describe('calculateRelevanceScore & sortItems', () => {
  const rows = [
    item({
      id: 'a',
      title: 'Anthropic updates Claude model',
      summary: 'A new release',
      why: 'Key update',
      date: '2026-06-03',
      rank: 2,
    }),
    item({
      id: 'b',
      title: 'Deep dive into MCP servers',
      summary: 'Learn Claude and MCP integration',
      why: 'Critical for agents',
      date: '2026-06-01',
      rank: 1,
    }),
    item({
      id: 'c',
      title: 'Claude MCP protocol masterclass',
      summary: 'Comprehensive guide to Claude MCP',
      why: 'Why Claude MCP matters for architecture',
      date: '2026-06-02',
      rank: 3,
    }),
  ];

  it('sorts newest first by date and rank', () => {
    const sorted = sortItems(rows, 'newest');
    expect(sorted[0]?.id).toBe('a');
    expect(sorted[1]?.id).toBe('c');
    expect(sorted[2]?.id).toBe('b');
  });

  it('sorts oldest first', () => {
    const sorted = sortItems(rows, 'oldest');
    expect(sorted[0]?.id).toBe('b');
    expect(sorted[1]?.id).toBe('c');
    expect(sorted[2]?.id).toBe('a');
  });

  it('calculates higher relevance for strong phrase match in title', () => {
    const scoreTitle = calculateRelevanceScore(rows[2]!, 'Claude MCP');
    const scoreOther = calculateRelevanceScore(rows[0]!, 'Claude MCP');
    expect(scoreTitle).toBeGreaterThan(scoreOther);
  });

  it('sorts by true relevance when query is provided', () => {
    const sorted = sortItems(rows, 'relevance', 'Claude MCP');
    expect(sorted[0]?.id).toBe('c'); // 'Claude MCP' is in title
  });

  it('defaults relevance to newest if query is empty', () => {
    const sorted = sortItems(rows, 'relevance', '');
    expect(sorted[0]?.id).toBe('a');
  });
});

describe('parseNewsUrlParams & serializeNewsUrlParams', () => {
  it('parses empty query params to defaults', () => {
    const { filters, page } = parseNewsUrlParams('');
    expect(filters.q).toBe('');
    expect(filters.categories).toEqual([]);
    expect(filters.date).toBe('all');
    expect(filters.sort).toBe('newest');
    expect(page).toBe(1);
  });

  it('parses complete query parameters accurately', () => {
    const query = '?q=mcp&categories=agents,models&date=month&sort=oldest&page=3';
    const { filters, page } = parseNewsUrlParams(query);
    expect(filters.q).toBe('mcp');
    expect(filters.categories).toEqual(['agents', 'models']);
    expect(filters.date).toBe('month');
    expect(filters.sort).toBe('oldest');
    expect(page).toBe(3);
  });

  it('defaults sort to relevance when q is non-empty without explicit sort', () => {
    const { filters } = parseNewsUrlParams('?q=mcp');
    expect(filters.sort).toBe('relevance');
  });

  it('normalizes invalid parameters gracefully', () => {
    const { filters, page } = parseNewsUrlParams('?date=invalid&sort=unknown&page=-5');
    expect(filters.date).toBe('all');
    expect(filters.sort).toBe('newest');
    expect(page).toBe(1);
  });

  it('serializes default filters to an empty string', () => {
    const filters: NewsFilters = {
      q: '',
      categories: [],
      date: 'all',
      sort: 'newest',
    };
    expect(serializeNewsUrlParams(filters, 1)).toBe('');
  });

  it('serializes active filters and page into query string', () => {
    const filters: NewsFilters = {
      q: 'agents',
      categories: ['agents-and-mcp'],
      date: 'week',
      sort: 'newest', // non-default for query
    };
    const serialized = serializeNewsUrlParams(filters, 2);
    expect(serialized).toContain('q=agents');
    expect(serialized).toContain('categories=agents-and-mcp');
    expect(serialized).toContain('date=week');
    expect(serialized).toContain('sort=newest');
    expect(serialized).toContain('page=2');
  });
});

describe('normalizePage', () => {
  it('handles standard and edge cases', () => {
    expect(normalizePage(1, 5)).toBe(1);
    expect(normalizePage(3, 5)).toBe(3);
    expect(normalizePage(10, 5)).toBe(5);
    expect(normalizePage(-2, 5)).toBe(1);
    expect(normalizePage('invalid', 5)).toBe(1);
    expect(normalizePage(1, 0)).toBe(1);
  });
});
