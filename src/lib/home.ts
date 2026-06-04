import { getSupabase } from '@/lib/supabase';
import type { Lang } from '@/lib/site';
import { categoryMeta, TOP_CATEGORY_SLUGS } from '@/lib/category-meta';
import { getCategories } from '@/lib/categories';
import { getConceptNameIndex } from '@/lib/concepts';
import type { IconKey } from '@/components/icons';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

/** `tools_mentioned` is untyped JSONB — extract clean tool names defensively. */
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

export interface HomeItem {
  id: string;
  rank: number;
  categorySlug: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  href: string;
  title: string;
  summary: string;
  why: string;
  date: string;
  hasVideo: boolean;
  tools: string[];
  sourceName: string | null;
  readMinutes: number;
}

export interface HomeCategory {
  slug: string;
  name: string;
  description: string;
  color: string | null;
  icon: IconKey;
  tagline: string;
  latest: HomeItem[];
  count: number;
}

export interface TrendingTopic {
  name: string;
  mentions: number;
  href: string;
}

export interface HomeData {
  briefDate: string | null;
  featured: HomeItem | null;
  secondary: HomeItem[];
  categories: HomeCategory[];
  trending: TrendingTopic[];
  /** Total seeded categories — drives the hero "N categories" stat. */
  categoryCount: number;
}

const EMPTY: HomeData = {
  briefDate: null,
  featured: null,
  secondary: [],
  categories: [],
  trending: [],
  categoryCount: 0,
};

/**
 * Everything the home landing renders, from one fetch pass: recent published
 * items (top-of-week + per-category latest + trending) plus category identity.
 * Server-only; ISR-cached by the page. Degrades to category identity (and
 * finally `EMPTY`) when there are no briefs / no Supabase env, so a build never
 * crashes and the page never looks broken.
 */
export async function getHomeData(lang: Lang, briefWindow = 8): Promise<HomeData> {
  const supabase = getSupabase();
  if (!supabase) return EMPTY;

  const allCats = await getCategories(lang);
  const categoryCount = allCats.length;
  const catBySlug = new Map(allCats.map((c) => [c.slug, c]));

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, slug, date')
    .eq('status', 'published')
    .order('date', { ascending: false })
    .limit(briefWindow);
  const briefList = briefs ?? [];

  const items: HomeItem[] = [];
  const articleIdByItem = new Map<string, string>();

  if (briefList.length > 0) {
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

    for (const it of rows ?? []) {
      const brief = briefById.get(it.brief_id);
      if (!brief) continue;
      const summary = pick(lang, it.summary_en, it.summary_uk);
      const why = pick(lang, it.why_matters_en, it.why_matters_uk);
      const cat = it.category_slug ? catBySlug.get(it.category_slug) : undefined;
      items.push({
        id: it.id,
        rank: it.rank,
        categorySlug: it.category_slug,
        categoryName: cat?.name ?? null,
        categoryColor: cat?.color ?? null,
        href: brief.slug && it.slug ? `/${lang}/${brief.slug}/${it.slug}` : `/${lang}/news`,
        title: pick(lang, it.title_en, it.title_uk) || summary,
        summary,
        why: why || summary,
        date: brief.date,
        hasVideo: Boolean(it.youtube_url),
        tools: toToolNames(it.tools_mentioned),
        sourceName: null,
        readMinutes: Math.max(2, Math.round((wordCount(summary) + wordCount(why)) / 45)),
      });
      articleIdByItem.set(it.id, it.article_id);
    }

    // Newest brief first, then rank — the global "top of the week" order.
    items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.rank - b.rank));
  }

  const featured = items[0] ?? null;
  const secondary = items.slice(1, 5);

  // Attribute the lead story's source (separate query — we never embed the
  // articles table). Only the featured card shows a source line.
  if (featured) {
    const articleId = articleIdByItem.get(featured.id);
    if (articleId) {
      const { data: article } = await supabase
        .from('articles')
        .select('source_name')
        .eq('id', articleId)
        .maybeSingle();
      featured.sourceName = article?.source_name ?? null;
    }
  }

  // Group items by category for the per-category "latest" lists + counts.
  const itemsByCat = new Map<string, HomeItem[]>();
  for (const item of items) {
    if (!item.categorySlug) continue;
    const group = itemsByCat.get(item.categorySlug) ?? [];
    group.push(item);
    itemsByCat.set(item.categorySlug, group);
  }

  const categories: HomeCategory[] = [];
  for (const slug of TOP_CATEGORY_SLUGS) {
    const cat = catBySlug.get(slug);
    if (!cat) continue;
    const meta = categoryMeta(slug);
    const group = itemsByCat.get(slug) ?? [];
    categories.push({
      slug,
      name: cat.name,
      description: cat.description,
      color: cat.color,
      icon: meta.icon,
      tagline: meta.tagline[lang],
      latest: group.slice(0, 3),
      count: group.length,
    });
  }

  const trending = await buildTrending(lang, items);

  return {
    briefDate: featured?.date ?? briefList[0]?.date ?? null,
    featured,
    secondary,
    categories,
    trending,
    categoryCount,
  };
}

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
