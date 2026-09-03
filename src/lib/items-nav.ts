import type { Lang } from '@/lib/site';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

export interface AdjacentStoryRow {
  slug: string | null;
  rank: number;
  title_en: string | null;
  title_uk: string | null;
  category_slug: string | null;
}

export interface AdjacentStoryLink {
  href: string;
  title: string;
}

/**
 * Closest lower rank → prev, first higher rank → next. Rows may include the
 * current item; it is skipped by comparing `rank`.
 */
export function pickAdjacentStories(
  rows: AdjacentStoryRow[],
  rank: number,
  lang: Lang,
): { prev: AdjacentStoryLink | null; next: AdjacentStoryLink | null } {
  let prev: AdjacentStoryLink | null = null;
  let next: AdjacentStoryLink | null = null;
  for (const row of rows) {
    if (!row.slug || !row.category_slug || row.rank === rank) continue;
    const title = pick(lang, row.title_en, row.title_uk);
    if (!title) continue;
    const story = { href: `/${lang}/news/${row.category_slug}/${row.slug}`, title };
    if (row.rank < rank) prev = story;
    else if (!next) next = story;
  }
  return { prev, next };
}

export function excludeRelatedById<T extends { id: string }>(rows: T[], excludeId: string): T[] {
  return rows.filter((row) => row.id !== excludeId);
}
