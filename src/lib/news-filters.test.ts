import { describe, expect, it } from 'vitest';
import type { HomeItem } from '@/lib/home';
import {
  applyNewsFilters,
  buildTopicFacet,
  calculateRelevanceScore,
  countCategories,
  daysAgo,
  knownTopicSlugs,
  matchesCategories,
  matchesQuery,
  matchesTopics,
  MAX_TOPIC_OPTIONS,
  normalizePage,
  parseNewsUrlParams,
  serializeNewsUrlParams,
  sortItems,
  withinPreset,
  type NewsFilters,
} from '@/lib/news-filters';
import { topicSlugs } from '@/lib/topic-normalize';

function item(partial: Partial<HomeItem> & Pick<HomeItem, 'id' | 'title' | 'date'>): HomeItem {
  const tools = partial.tools ?? [];
  return {
    rank: 1,
    categorySlug: null,
    categoryName: null,
    categoryColor: null,
    href: '/en/news',
    summary: '',
    why: '',
    hasVideo: false,
    tools,
    topics: topicSlugs(tools),
    sourceName: null,
    readMinutes: 3,
    imageUrl: null,
    ...partial,
  };
}

function filtersOf(partial: Partial<NewsFilters> = {}): NewsFilters {
  return { q: '', categories: [], topics: [], date: 'all', sort: 'newest', ...partial };
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
    expect(filters.topics).toEqual([]);
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
      topics: [],
      date: 'all',
      sort: 'newest',
    };
    expect(serializeNewsUrlParams(filters, 1)).toBe('');
  });

  it('serializes active filters and page into query string', () => {
    const filters: NewsFilters = {
      q: 'agents',
      categories: ['agents-and-mcp'],
      topics: ['claudecode'],
      date: 'week',
      sort: 'newest', // non-default for query
    };
    const serialized = serializeNewsUrlParams(filters, 2);
    expect(serialized).toContain('q=agents');
    expect(serialized).toContain('categories=agents-and-mcp');
    expect(serialized).toContain('topics=claudecode');
    expect(serialized).toContain('date=week');
    expect(serialized).toContain('sort=newest');
    expect(serialized).toContain('page=2');
  });
});

describe('topics in the URL', () => {
  it('canonicalizes spelling variants: "Claude Code", "claude-code", "ClaudeCode" become one value', () => {
    for (const raw of ['Claude Code', 'claude-code', 'ClaudeCode']) {
      const { filters } = parseNewsUrlParams(new URLSearchParams({ topics: raw }));
      expect(filters.topics).toEqual(['claudecode']);
    }
  });

  it('reads comma-separated and repeated params and drops junk and duplicates', () => {
    const { filters } = parseNewsUrlParams('?topics=cursor,,---&topics=Cursor&topics=mcp');
    expect(filters.topics).toEqual(['cursor', 'mcp']);
  });

  it('round-trips through serialize and parse together with the other facets', () => {
    const original = filtersOf({
      q: 'agents',
      categories: ['agents-and-mcp', 'models'],
      topics: ['claudecode', 'cursor'],
      date: 'month',
      sort: 'oldest',
    });
    const { filters, page } = parseNewsUrlParams(serializeNewsUrlParams(original, 3));
    expect(filters).toEqual(original);
    expect(page).toBe(3);
  });

  it('omits topics from the URL when none are selected', () => {
    expect(serializeNewsUrlParams(filtersOf(), 1)).not.toContain('topics');
  });
});

describe('matchesCategories / matchesTopics', () => {
  const row = item({
    id: '1',
    title: 'x',
    date: '2026-06-01',
    categorySlug: 'agents',
    tools: ['Cursor', 'MCP'],
  });

  it('pass everything when the facet is empty', () => {
    expect(matchesCategories(row, [])).toBe(true);
    expect(matchesTopics(row, [])).toBe(true);
  });

  it('match on category slug, never on an item without one', () => {
    expect(matchesCategories(row, ['agents', 'models'])).toBe(true);
    expect(matchesCategories(row, ['models'])).toBe(false);
    expect(matchesCategories(item({ id: '2', title: 'x', date: '2026-06-01' }), ['agents'])).toBe(false);
  });

  it('match topics with OR: one shared topic is enough', () => {
    expect(matchesTopics(row, ['cursor', 'codex'])).toBe(true);
    expect(matchesTopics(row, ['codex', 'gemini'])).toBe(false);
  });
});

describe('applyNewsFilters and counters', () => {
  const rows = [
    item({ id: 'a', title: 'A', date: '2026-06-03', categorySlug: 'agents', tools: ['Claude Code', 'MCP'] }),
    item({ id: 'b', title: 'B', date: '2026-06-02', categorySlug: 'agents', tools: ['claude-code', 'Cursor'] }),
    item({ id: 'c', title: 'C', date: '2026-06-01', categorySlug: 'models', tools: ['Cursor', 'Gemini'] }),
    item({ id: 'd', title: 'D', date: '2026-05-30', categorySlug: 'models', tools: ['Gemini'] }),
    item({ id: 'e', title: 'E', date: '2026-05-29', categorySlug: null, tools: [] }),
  ];
  const ids = (list: HomeItem[]) => list.map((r) => r.id);

  it('returns everything without filters', () => {
    expect(ids(applyNewsFilters(rows, filtersOf()))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('ORs inside the topics facet', () => {
    expect(ids(applyNewsFilters(rows, filtersOf({ topics: ['mcp', 'gemini'] })))).toEqual(['a', 'c', 'd']);
  });

  it('ANDs topics with categories', () => {
    const result = applyNewsFilters(rows, filtersOf({ categories: ['models'], topics: ['cursor'] }));
    expect(ids(result)).toEqual(['c']);
  });

  it('ANDs topics with the text query', () => {
    expect(ids(applyNewsFilters(rows, filtersOf({ topics: ['cursor'], q: 'b' })))).toEqual(['b']);
  });

  it('treats one story tagged with two spellings of a tool as one match', () => {
    expect(ids(applyNewsFilters(rows, filtersOf({ topics: ['claudecode'] })))).toEqual(['a', 'b']);
  });

  it('ignores topics that no story carries instead of emptying the feed', () => {
    expect(applyNewsFilters(rows, filtersOf({ topics: ['nonexistent'] }))).toHaveLength(5);
    expect(ids(applyNewsFilters(rows, filtersOf({ topics: ['nonexistent', 'gemini'] })))).toEqual(['c', 'd']);
  });

  it('skips the text query when the server already searched', () => {
    expect(applyNewsFilters(rows, filtersOf({ q: 'zzz' }), { serverSearch: true })).toHaveLength(5);
    expect(applyNewsFilters(rows, filtersOf({ q: 'zzz' }))).toHaveLength(0);
  });

  it('can leave one facet out to count its alternatives', () => {
    const f = filtersOf({ categories: ['agents'], topics: ['gemini'] });
    expect(ids(applyNewsFilters(rows, f, { omit: 'categories' }))).toEqual(['c', 'd']);
    expect(ids(applyNewsFilters(rows, f, { omit: 'topics' }))).toEqual(['a', 'b']);
  });

  it('counts categories with topics applied but the category facet itself left out', () => {
    expect(Object.fromEntries(countCategories(rows, filtersOf()))).toEqual({ agents: 2, models: 2 });
    expect(Object.fromEntries(countCategories(rows, filtersOf({ topics: ['cursor'] })))).toEqual({
      agents: 1,
      models: 1,
    });
    // Selecting a category must not shrink its own counter or hide the sibling categories.
    expect(Object.fromEntries(countCategories(rows, filtersOf({ categories: ['agents'] })))).toEqual({
      agents: 2,
      models: 2,
    });
  });

  it('collects the topics present in the data', () => {
    expect([...knownTopicSlugs(rows)].sort()).toEqual(['claudecode', 'cursor', 'gemini', 'mcp']);
  });
});

describe('buildTopicFacet', () => {
  const rows = [
    item({ id: 'a', title: 'A', date: '2026-06-03', categorySlug: 'agents', tools: ['Claude Code', 'MCP'] }),
    item({ id: 'b', title: 'B', date: '2026-06-02', categorySlug: 'agents', tools: ['claude-code', 'Cursor'] }),
    item({ id: 'c', title: 'C', date: '2026-06-01', categorySlug: 'models', tools: ['Cursor', 'Gemini'] }),
    item({ id: 'd', title: 'D', date: '2026-05-30', categorySlug: 'models', tools: ['Gemini', 'vLLM'] }),
    item({ id: 'e', title: 'E', date: '2026-05-29', categorySlug: 'models', tools: ['VLLM'] }),
  ];

  it('is empty without data — no invented chips', () => {
    expect(buildTopicFacet([], filtersOf())).toEqual([]);
    expect(buildTopicFacet([item({ id: 'x', title: 'x', date: '2026-06-01' })], filtersOf())).toEqual([]);
  });

  it('hides topics with fewer than two stories in the slice (D8)', () => {
    const slugs = buildTopicFacet(rows, filtersOf()).map((o) => o.slug);
    expect(slugs).not.toContain('mcp');
    // A slice where every topic is a one-off yields no facet at all.
    expect(buildTopicFacet([rows[0]!], filtersOf())).toEqual([]);
  });

  it('counts spelling variants together, names them, and sorts by count then name', () => {
    expect(buildTopicFacet(rows, filtersOf())).toEqual([
      { slug: 'claudecode', name: 'Claude Code', count: 2, selected: false },
      { slug: 'cursor', name: 'Cursor', count: 2, selected: false },
      { slug: 'gemini', name: 'Gemini', count: 2, selected: false },
      { slug: 'vllm', name: 'vLLM', count: 2, selected: false },
    ]);
  });

  it('counts each story once per topic even when it lists two spellings', () => {
    const dup = [
      item({ id: '1', title: '1', date: '2026-06-01', tools: ['Codex', 'OpenAI Codex'] }),
      item({ id: '2', title: '2', date: '2026-06-01', tools: ['OpenAI Codex'] }),
    ];
    expect(buildTopicFacet(dup, filtersOf())).toEqual([
      { slug: 'codex', name: 'Codex', count: 2, selected: false },
    ]);
  });

  it('counts against the other facets, not its own selection', () => {
    const inModels = buildTopicFacet(rows, filtersOf({ categories: ['models'] }));
    expect(inModels.map((o) => [o.slug, o.count])).toEqual([
      ['gemini', 2],
      ['vllm', 2],
    ]);

    // Picking cursor must keep the alternatives visible with their own counts (OR inside the facet).
    const withCursor = buildTopicFacet(rows, filtersOf({ topics: ['cursor'] }));
    expect(withCursor.find((o) => o.slug === 'cursor')).toMatchObject({ count: 2, selected: true });
    expect(withCursor.find((o) => o.slug === 'gemini')).toMatchObject({ count: 2, selected: false });
  });

  it('keeps a selected topic visible even below the threshold or with zero matches', () => {
    const facet = buildTopicFacet(rows, filtersOf({ categories: ['models'], topics: ['claudecode', 'mcp'] }));
    expect(facet.find((o) => o.slug === 'claudecode')).toMatchObject({ count: 0, selected: true });
    expect(facet.find((o) => o.slug === 'mcp')).toMatchObject({ count: 0, selected: true });
  });

  it('ignores a selected topic no story carries', () => {
    const facet = buildTopicFacet(rows, filtersOf({ topics: ['nonexistent'] }));
    expect(facet.some((o) => o.slug === 'nonexistent')).toBe(false);
  });

  it('caps the shortlist but never drops a selected topic', () => {
    const tool = (i: number) => `Tool${String(i).padStart(2, '0')}`;
    const many = Array.from({ length: MAX_TOPIC_OPTIONS + 6 }, (_, i) => i).flatMap((i) => [
      item({ id: `m${i}a`, title: 't', date: '2026-06-01', tools: [tool(i)] }),
      item({ id: `m${i}b`, title: 't', date: '2026-06-01', tools: [tool(i)] }),
    ]);
    expect(buildTopicFacet(many, filtersOf())).toHaveLength(MAX_TOPIC_OPTIONS);

    const lastSlug = tool(MAX_TOPIC_OPTIONS + 5).toLowerCase();
    const withSelected = buildTopicFacet(many, filtersOf({ topics: [lastSlug] }));
    expect(withSelected).toHaveLength(MAX_TOPIC_OPTIONS + 1);
    expect(withSelected.find((o) => o.slug === lastSlug)?.selected).toBe(true);
  });

  it('respects a server-side search that already narrowed the items', () => {
    const facet = buildTopicFacet(rows, filtersOf({ q: 'no-such-word' }), { serverSearch: true });
    expect(facet.length).toBeGreaterThan(0);
    expect(buildTopicFacet(rows, filtersOf({ q: 'no-such-word' }))).toEqual([]);
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
