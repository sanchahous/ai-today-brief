import { getSupabase } from '@/lib/supabase';
import type { Lang } from '@/lib/site';
import { categoryMeta, TOP_CATEGORY_SLUGS } from '@/lib/category-meta';
import { getCategories, getPublishedCategoryCounts } from '@/lib/categories';
import { getConceptNameIndex } from '@/lib/concepts';
import {
  blendTrend,
  entityKeyForTool,
  getRisingByEntity,
  isRising,
  maxTrendForTools,
  recencyScore,
} from '@/lib/trend-index';
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
  /** Source article og:image — card thumbnail; null → category placeholder. */
  imageUrl: string | null;
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
  /** Accelerating in the news right now (GDELT rising signal) — flagged with ▲. */
  rising?: boolean;
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

  const [allCats, publishedCategoryCounts] = await Promise.all([
    getCategories(lang),
    getPublishedCategoryCounts(),
  ]);
  const categoryCount = allCats.length;
  const catBySlug = new Map(allCats.map((c) => [c.slug, c]));

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, slug, date, edition')
    .eq('status', 'published')
    .order('date', { ascending: false })
    .order('edition', { ascending: true })
    .limit(briefWindow * 3);
  const briefList = briefs ?? [];

  const items: HomeItem[] = [];
  const articleIdByItem = new Map<string, string>();

  if (briefList.length > 0) {
    const briefById = new Map(briefList.map((b) => [b.id, b]));
    const { data: rows } = await supabase
      .from('brief_items')
      .select(
        'id, slug, brief_id, rank, category_slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, tools_mentioned, youtube_url, image_url, article_id',
      )
      .in(
        'brief_id',
        briefList.map((b) => b.id),
      );

    const editionByItem = new Map<string, number>();

    for (const it of rows ?? []) {
      const brief = briefById.get(it.brief_id);
      if (!brief) continue;
      editionByItem.set(it.id, brief.edition);
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
        imageUrl: it.image_url?.startsWith('http') ? it.image_url : null,
      });
      articleIdByItem.set(it.id, it.article_id);
    }

    // Newest day first, then pack edition, then rank within the pack.
    items.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      const edA = editionByItem.get(a.id) ?? 1;
      const edB = editionByItem.get(b.id) ?? 1;
      if (edA !== edB) return edA - edB;
      return a.rank - b.rank;
    });
  }

  // Trend-index organizes the showcase by MOMENTUM, not pure recency. Items keep
  // their recency order for the per-category "latest" lists (that label must stay
  // honest); top-of-week + category order are re-ranked by momentum below.
  // `momentum = recency × (1 + maxToolTrend)`: freshness stays the base (3-day
  // half-life), a surging-topic story gets boosted up to 2×. With no rising
  // signal this collapses to the existing recency order.
  const rising = await getRisingByEntity();
  const newestMs = items[0] ? Date.parse(items[0].date) : Date.now();
  const momentumOf = (it: HomeItem): number =>
    blendTrend(
      recencyScore((newestMs - Date.parse(it.date)) / 86_400_000),
      maxTrendForTools(it.tools, rising),
    );

  const byMomentum = items
    .map((it, i) => ({ it, i, m: momentumOf(it) }))
    .sort((a, b) => b.m - a.m || a.i - b.i) // stable: keep date→edition→rank on ties
    .map((x) => x.it);
  const featured = byMomentum[0] ?? null;
  const secondary = byMomentum.slice(1, 5);

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

  // Category order by momentum: the category whose hottest story has the most
  // momentum leads. Stable-tiebroken by the curated TOP_CATEGORY_SLUGS order, so
  // with no signal (or ties) the curated order is preserved.
  const categoryMomentum = new Map<string, number>();
  for (const item of items) {
    if (!item.categorySlug) continue;
    const m = momentumOf(item);
    if (m > (categoryMomentum.get(item.categorySlug) ?? 0)) {
      categoryMomentum.set(item.categorySlug, m);
    }
  }
  const orderedTopSlugs = TOP_CATEGORY_SLUGS.map((slug, i) => ({ slug, i }))
    .sort((a, b) => (categoryMomentum.get(b.slug) ?? 0) - (categoryMomentum.get(a.slug) ?? 0) || a.i - b.i)
    .map((x) => x.slug);

  const categories: HomeCategory[] = [];
  for (const slug of orderedTopSlugs) {
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
      count: publishedCategoryCounts.get(slug) ?? group.length,
    });
  }

  const trending = await buildTrending(lang, items, rising);

  return {
    briefDate: briefList[0]?.date ?? featured?.date ?? null,
    featured,
    secondary,
    categories,
    trending,
    categoryCount,
  };
}

async function buildTrending(
  lang: Lang,
  items: HomeItem[],
  rising: Map<string, number>,
): Promise<TrendingTopic[]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const name of item.tools) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return [];

  // Trend-index: rank by acceleration (GDELT rising signal) on top of mention
  // frequency, not by raw mentions alone. `rising` is the shared map fetched once
  // in getHomeData; empty → falls straight back to mention frequency.
  const index = await getConceptNameIndex();
  return Array.from(counts.entries())
    .map(([name, mentions]) => {
      const slug = index.get(name.toLowerCase());
      const risingScore = rising.get(entityKeyForTool(name));
      return {
        topic: {
          name,
          mentions,
          href: slug ? `/${lang}/concepts/${slug}` : `/${lang}/news?q=${encodeURIComponent(name)}`,
          rising: isRising(risingScore),
        },
        trend: blendTrend(mentions, risingScore ?? 0),
      };
    })
    .sort((a, b) => b.trend - a.trend)
    .slice(0, 12)
    .map((e) => e.topic);
}
