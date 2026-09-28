import type { HomeItem } from '@/lib/home';

export type SortMode = 'newest' | 'oldest' | 'relevance';
export type DatePreset = 'today' | 'week' | 'month' | 'all';

export interface NewsFilters {
  q: string;
  categories: string[];
  date: DatePreset;
  sort: SortMode;
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
