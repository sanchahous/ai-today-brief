import type { HomeItem } from '@/lib/home';
import { parseTopicParam, resolveTopicNames } from '@/lib/topic-normalize';

export type SortMode = 'newest' | 'oldest' | 'relevance';
export type DatePreset = 'today' | 'week' | 'month' | 'all';

export interface NewsFilters {
  q: string;
  categories: string[];
  /** Canonical topic slugs (see `topic-normalize`); OR within, AND with every other facet. */
  topics: string[];
  date: DatePreset;
  sort: SortMode;
}

/** D8: a topic is offered only when it has at least this many stories in the current slice. */
export const MIN_TOPIC_STORIES = 2;
/** The facet is a shortlist, not the whole long tail. Selected topics are never cut. */
export const MAX_TOPIC_OPTIONS = 12;

export type NewsFacet = 'categories' | 'topics';

export interface FilterScope {
  /** Server-side search already narrowed `items`, so the text query is not re-applied. */
  serverSearch?: boolean;
  /** Leave one facet out — used to count that facet's alternatives. */
  omit?: NewsFacet;
}

export interface TopicFacetOption {
  slug: string;
  name: string;
  /** Stories matching every OTHER active filter. */
  count: number;
  selected: boolean;
}

export function daysAgo(n: number): number {
  return Date.now() - n * 86_400_000;
}

export function withinPreset(iso: string, preset: DatePreset): boolean {
  if (preset === 'all') return true;
  const ts = new Date(`${iso}T00:00:00`).getTime();
  const span = preset === 'today' ? 1 : preset === 'week' ? 7 : 31;
  return ts >= daysAgo(span);
}

export function matchesQuery(item: HomeItem, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = `${item.title} ${item.summary} ${item.why} ${item.categoryName ?? ''} ${item.sourceName ?? ''}`.toLowerCase();
  return hay.includes(needle);
}

export function matchesCategories(item: HomeItem, categories: readonly string[]): boolean {
  if (categories.length === 0) return true;
  return item.categorySlug !== null && categories.includes(item.categorySlug);
}

/** OR within the facet: one shared topic is enough. */
export function matchesTopics(item: HomeItem, topics: readonly string[]): boolean {
  if (topics.length === 0) return true;
  return topics.some((slug) => item.topics.includes(slug));
}

export function knownTopicSlugs(items: readonly HomeItem[]): Set<string> {
  const known = new Set<string>();
  for (const item of items) for (const slug of item.topics) known.add(slug);
  return known;
}

/**
 * Every active filter applied: OR inside a facet, AND between facets. A topic
 * that no story carries (stale link, typo) is ignored rather than emptying the
 * feed.
 */
export function applyNewsFilters(
  items: readonly HomeItem[],
  filters: NewsFilters,
  scope: FilterScope = {},
): HomeItem[] {
  const known = filters.topics.length > 0 ? knownTopicSlugs(items) : null;
  const topics = known ? filters.topics.filter((slug) => known.has(slug)) : [];

  return items.filter(
    (item) =>
      (scope.omit === 'categories' || matchesCategories(item, filters.categories)) &&
      (scope.omit === 'topics' || matchesTopics(item, topics)) &&
      withinPreset(item.date, filters.date) &&
      (scope.serverSearch === true || matchesQuery(item, filters.q)),
  );
}

/** Story count per category with every filter except the category facet itself applied. */
export function countCategories(
  items: readonly HomeItem[],
  filters: NewsFilters,
  scope: FilterScope = {},
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of applyNewsFilters(items, filters, { ...scope, omit: 'categories' })) {
    if (!item.categorySlug) continue;
    counts.set(item.categorySlug, (counts.get(item.categorySlug) ?? 0) + 1);
  }
  return counts;
}

/**
 * Options for the Topics facet. Empty when the data does not support one:
 * nothing is invented, and a topic below `MIN_TOPIC_STORIES` in the current
 * slice stays hidden unless the reader already selected it (so it can always
 * be removed).
 */
export function buildTopicFacet(
  items: readonly HomeItem[],
  filters: NewsFilters,
  scope: FilterScope = {},
): TopicFacetOption[] {
  const known = knownTopicSlugs(items);
  const selected = new Set(filters.topics.filter((slug) => known.has(slug)));
  const counts = new Map<string, number>();
  for (const item of applyNewsFilters(items, filters, { ...scope, omit: 'topics' })) {
    for (const slug of new Set(item.topics)) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  const names = resolveTopicNames(items.map((item) => item.tools));
  const options: TopicFacetOption[] = [];
  for (const slug of new Set([...counts.keys(), ...selected])) {
    const count = counts.get(slug) ?? 0;
    const isSelected = selected.has(slug);
    if (count < MIN_TOPIC_STORIES && !isSelected) continue;
    options.push({ slug, name: names.get(slug) ?? slug, count, selected: isSelected });
  }

  options.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'));
  return options.filter((option, index) => index < MAX_TOPIC_OPTIONS || option.selected);
}

export function calculateRelevanceScore(item: HomeItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const title = item.title.toLowerCase();
  const why = item.why.toLowerCase();
  const summary = item.summary.toLowerCase();
  const cat = (item.categoryName ?? '').toLowerCase();
  const source = (item.sourceName ?? '').toLowerCase();

  let score = 0;

  // Exact phrase match bonuses
  if (title.includes(q)) score += 100;
  if (why.includes(q)) score += 40;
  if (summary.includes(q)) score += 20;

  // Token-level scoring
  const tokens = q.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (title.includes(token)) score += 25;
    if (why.includes(token)) score += 15;
    if (summary.includes(token)) score += 10;
    if (cat.includes(token) || source.includes(token)) score += 8;
  }

  // Small rank-based tie breaker (lower rank number = higher editorial importance)
  score += Math.max(0, 10 - item.rank);

  return score;
}

export function sortItems(rows: HomeItem[], sort: SortMode, query = ''): HomeItem[] {
  const copy = [...rows];
  const q = query.trim();

  switch (sort) {
    case 'oldest':
      return copy.sort((a, b) => {
        if (a.date !== b.date) return a.date > b.date ? 1 : -1;
        return a.rank - b.rank;
      });

    case 'relevance':
      if (q) {
        return copy.sort((a, b) => {
          const scoreA = calculateRelevanceScore(a, q);
          const scoreB = calculateRelevanceScore(b, q);
          if (scoreA !== scoreB) return scoreB - scoreA;
          if (a.date !== b.date) return a.date < b.date ? 1 : -1;
          return a.rank - b.rank;
        });
      }
      // If no query, relevance defaults to newest
      return copy.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return a.rank - b.rank;
      });

    case 'newest':
    default:
      return copy.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return a.rank - b.rank;
      });
  }
}

export function parseNewsUrlParams(
  search: URLSearchParams | string,
): { filters: NewsFilters; page: number } {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;

  const q = (params.get('q') ?? '').trim();

  // Support both comma-separated `categories=a,b` and repeated `categories=a&categories=b`
  const rawCategories = params.getAll('categories');
  const categories: string[] = [];
  for (const raw of rawCategories) {
    for (const piece of raw.split(',')) {
      const trimmed = piece.trim();
      if (trimmed && !categories.includes(trimmed)) {
        categories.push(trimmed);
      }
    }
  }

  const topics = parseTopicParam(params.getAll('topics'));

  const rawDate = params.get('date');
  const date: DatePreset =
    rawDate === 'today' || rawDate === 'week' || rawDate === 'month' || rawDate === 'all'
      ? rawDate
      : 'all';

  const rawSort = params.get('sort');
  let sort: SortMode;
  if (rawSort === 'newest' || rawSort === 'oldest' || rawSort === 'relevance') {
    sort = rawSort;
  } else {
    sort = q ? 'relevance' : 'newest';
  }

  const rawPage = parseInt(params.get('page') ?? '1', 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  return {
    filters: {
      q,
      categories,
      topics,
      date,
      sort,
    },
    page,
  };
}

export function serializeNewsUrlParams(filters: NewsFilters, page: number): string {
  const params = new URLSearchParams();

  const q = filters.q.trim();
  if (q) {
    params.set('q', q);
  }

  if (filters.categories.length > 0) {
    params.set('categories', filters.categories.join(','));
  }

  if (filters.topics.length > 0) {
    params.set('topics', filters.topics.join(','));
  }

  if (filters.date !== 'all') {
    params.set('date', filters.date);
  }

  const defaultSort = q ? 'relevance' : 'newest';
  if (filters.sort !== defaultSort) {
    params.set('sort', filters.sort);
  }

  if (page > 1) {
    params.set('page', String(page));
  }

  return params.toString();
}

export function normalizePage(page: unknown, maxPages: number): number {
  const p = typeof page === 'number' ? page : parseInt(String(page), 10);
  const safeMax = Math.max(1, maxPages);
  if (!Number.isFinite(p) || p < 1) return 1;
  return Math.min(p, safeMax);
}
