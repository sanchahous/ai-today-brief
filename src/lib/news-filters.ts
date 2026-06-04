import type { HomeItem } from '@/lib/home';

export type SortMode = 'newest' | 'oldest' | 'relevance' | 'discussed';
export type DatePreset = 'today' | 'week' | 'month' | 'all';

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

export function sortItems(rows: HomeItem[], sort: SortMode): HomeItem[] {
  const copy = [...rows];
  switch (sort) {
    case 'newest':
      return copy.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.rank - b.rank));
    case 'oldest':
      return copy.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : a.rank - b.rank));
    case 'discussed':
      return copy.sort((a, b) => b.rank - a.rank);
    case 'relevance':
    default:
      return copy.sort((a, b) => a.rank - b.rank);
  }
}
