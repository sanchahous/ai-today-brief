import { getSupabase } from '@/lib/supabase';
import type { Lang } from '@/lib/site';
import { categoryMeta } from '@/lib/category-meta';
import { getCategories } from '@/lib/categories';
import { getConceptNameIndex } from '@/lib/concepts';
import type { HomeItem, TrendingTopic } from '@/lib/home';
import type { IconKey } from '@/components/icons';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

/** @deprecated Use HomeItem — kept for narrow imports. */
export interface NewsCard {
  id: string;
  href: string;
  category: string | null;
  title: string;
  summary: string;
  date: string;
}

function toToolNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const entry of value) {
    if (entry && typeof entry === 'object' && 'name' in entry) {
      const name = (entry as { name: unknown }).name;
      if (typeof name === 'string' && name.trim()) names.push(name.trim());
    } else if (typeof entry === 'string' && entry.trim()) {
      names.push(entry.trim());
    }
  }
  return names;
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export interface NewsCategoryFilter {
  slug: string;
  name: string;
  color: string | null;
  icon: IconKey;
}

export interface NewsPageData {
  items: HomeItem[];
  categories: NewsCategoryFilter[];
  trending: TrendingTopic[];
  updatedAt: string | null;
}

const EMPTY_PAGE: NewsPageData = {
  items: [],
  categories: [],
  trending: [],
  updatedAt: null,
};

async function buildTrending(lang: Lang, items: HomeItem[]): Promise<TrendingTopic[]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const name of item.tools) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return [];

  const index = await getConceptNameIndex();
  return Array.from(counts.entries())
    .map(([name, mentions]) => {
      const slug = index.get(name.toLowerCase());
      return {
        name,
        mentions,
        href: slug ? `/${lang}/concepts/${slug}` : `/${lang}/news?q=${encodeURIComponent(name)}`,
      };
    })
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 12);
}

function mapRowToItem(
  lang: Lang,
  row: {
    id: string;
    slug: string | null;
    rank: number;
    date: string;
    briefSlug: string | null;
    titleEn: string | null;
    titleUk: string | null;
    summaryEn: string;
    summaryUk: string;
    whyEn: string | null;
    whyUk: string | null;
    categorySlug: string | null;
    youtubeUrl: string | null;
    tools: unknown;
    sourceName: string | null;
  },
  catBySlug: Map<string, { name: string; color: string | null }>,
): HomeItem {
  const summary = pick(lang, row.summaryEn, row.summaryUk);
  const why = pick(lang, row.whyEn, row.whyUk);
  const cat = row.categorySlug ? catBySlug.get(row.categorySlug) : undefined;
  return {
    id: row.id,
    rank: row.rank,
    categorySlug: row.categorySlug,
    categoryName: cat?.name ?? null,
    categoryColor: cat?.color ?? null,
    href: row.briefSlug && row.slug ? `/${lang}/${row.briefSlug}/${row.slug}` : `/${lang}/news`,
    title: pick(lang, row.titleEn, row.titleUk) || summary,
    summary,
    why: why || summary,
    date: row.date,
    hasVideo: Boolean(row.youtubeUrl),
    tools: toToolNames(row.tools),
    sourceName: row.sourceName,
    readMinutes: Math.max(2, Math.round((wordCount(summary) + wordCount(why)) / 45)),
  };
}

/** Full archive for the news page: items, sidebar categories, trending. */
export async function getNewsPageData(lang: Lang, limit = 100): Promise<NewsPageData> {
  const supabase = getSupabase();
  if (!supabase) return EMPTY_PAGE;

  const allCats = await getCategories(lang);
  const catBySlug = new Map(allCats.map((c) => [c.slug, c]));

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, slug, date')
    .eq('status', 'published')
    .order('date', { ascending: false })
    .limit(24);
  const briefList = briefs ?? [];
  if (briefList.length === 0) {
    return {
      ...EMPTY_PAGE,
      categories: allCats.map((c) => ({
        slug: c.slug,
        name: c.name,
        color: c.color,
        icon: categoryMeta(c.slug).icon,
      })),
    };
  }

  const briefById = new Map(briefList.map((b) => [b.id, b]));
  const { data: rows } = await supabase
    .from('brief_items')
    .select(
      'id, slug, brief_id, rank, category_slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, tools_mentioned, youtube_url, article_id',
    )
    .in(
      'brief_id',
      briefList.map((b) => b.id),
    );

  const articleIds = new Set<string>();
  const staged: {
    id: string;
    slug: string | null;
    rank: number;
    date: string;
    briefSlug: string | null;
    titleEn: string | null;
    titleUk: string | null;
    summaryEn: string;
    summaryUk: string;
    whyEn: string | null;
    whyUk: string | null;
    categorySlug: string | null;
    youtubeUrl: string | null;
    tools: unknown;
    articleId: string;
  }[] = [];

  for (const it of rows ?? []) {
    const brief = briefById.get(it.brief_id);
    if (!brief) continue;
    articleIds.add(it.article_id);
    staged.push({
      id: it.id,
      slug: it.slug,
      rank: it.rank,
      date: brief.date,
      briefSlug: brief.slug,
      titleEn: it.title_en,
      titleUk: it.title_uk,
      summaryEn: it.summary_en,
      summaryUk: it.summary_uk,
      whyEn: it.why_matters_en,
      whyUk: it.why_matters_uk,
      categorySlug: it.category_slug,
      youtubeUrl: it.youtube_url,
      tools: it.tools_mentioned,
      articleId: it.article_id,
    });
  }

  staged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.rank - b.rank));

  const sources = new Map<string, string | null>();
  if (articleIds.size > 0) {
    const { data: articles } = await supabase
      .from('articles')
      .select('id, source_name')
      .in('id', [...articleIds]);
    for (const a of articles ?? []) sources.set(a.id, a.source_name);
  }

  const items = staged.slice(0, limit).map((r) =>
    mapRowToItem(
      lang,
      {
        ...r,
        sourceName: sources.get(r.articleId) ?? null,
      },
      catBySlug,
    ),
  );

  const categories: NewsCategoryFilter[] = allCats.map((c) => ({
    slug: c.slug,
    name: c.name,
    color: c.color,
    icon: categoryMeta(c.slug).icon,
  }));

  const trending = await buildTrending(lang, items);

  return {
    items,
    categories,
    trending,
    updatedAt: items[0]?.date ?? briefList[0]?.date ?? null,
  };
}

function mapSearchRow(
  lang: Lang,
  r: {
    id: string;
    rank: number;
    category_slug: string | null;
    brief_slug: string | null;
    slug: string | null;
    title_en: string | null;
    title_uk: string | null;
    summary_en: string;
    summary_uk: string;
    brief_date: string;
    source_name: string | null;
  },
  catBySlug: Map<string, { name: string; color: string | null }>,
): HomeItem {
  const summary = pick(lang, r.summary_en, r.summary_uk);
  const cat = r.category_slug ? catBySlug.get(r.category_slug) : undefined;
  return {
    id: r.id,
    rank: r.rank,
    categorySlug: r.category_slug,
    categoryName: cat?.name ?? null,
    categoryColor: cat?.color ?? null,
    href: r.brief_slug && r.slug ? `/${lang}/${r.brief_slug}/${r.slug}` : `/${lang}/news`,
    title: pick(lang, r.title_en, r.title_uk) || summary,
    summary,
    why: summary,
    date: r.brief_date,
    hasVideo: false,
    tools: [],
    sourceName: r.source_name ?? null,
    readMinutes: Math.max(2, Math.round(wordCount(summary) / 45)),
  };
}

export type SearchNewsResult = { items: HomeItem[]; total: number };

/** Full-text search with total count (RPC `total_count` on each row). */
export async function searchNewsWithMeta(
  lang: Lang,
  query: string,
  limit = 80,
): Promise<SearchNewsResult> {
  const supabase = getSupabase();
  const q = query.trim();
  if (!supabase || q.length === 0) return { items: [], total: 0 };

  const allCats = await getCategories(lang);
  const catBySlug = new Map(allCats.map((c) => [c.slug, { name: c.name, color: c.color }]));

  const { data, error } = await supabase.rpc('search_brief_items', {
    p_query: q,
    p_lang: lang,
    p_limit: limit,
    p_offset: 0,
    p_sort: 'relevance',
  });
  if (error || !data?.length) return { items: [], total: 0 };

  const total = Number(data[0]?.total_count ?? data.length);
  const items = data.map((r) => mapSearchRow(lang, r, catBySlug));
  return { items, total };
}

/** Full-text search for the news page (pre-filled from hero / trending). */
export async function searchNewsItems(lang: Lang, query: string, limit = 80): Promise<HomeItem[]> {
  const { items } = await searchNewsWithMeta(lang, query, limit);
  return items;
}

/** @deprecated Prefer getNewsPageData / searchNewsItems. */
export async function getNewsList(lang: Lang, limit = 60): Promise<NewsCard[]> {
  const { items } = await getNewsPageData(lang, limit);
  return items.map((it) => ({
    id: it.id,
    href: it.href,
    category: it.categorySlug,
    title: it.title,
    summary: it.summary,
    date: it.date,
  }));
}

/** @deprecated Prefer searchNewsItems. */
export async function searchNews(lang: Lang, query: string, limit = 50): Promise<NewsCard[]> {
  const items = await searchNewsItems(lang, query, limit);
  return items.map((it) => ({
    id: it.id,
    href: it.href,
    category: it.categorySlug,
    title: it.title,
    summary: it.summary,
    date: it.date,
  }));
}
