import { getSupabase } from '@/lib/supabase';
import type { Lang } from '@/lib/site';
import { categoryMeta, TOP_CATEGORY_SLUGS } from '@/lib/category-meta';
import { getCategories, getPublishedCategoryCounts } from '@/lib/categories';
import { getConceptNameIndex } from '@/lib/concepts';
import { cachePublicRead } from '@/lib/public-content-cache';
import { extractToolNames } from '@/lib/tools-mentioned';
import { topicSlugs } from '@/lib/topic-normalize';
import {
  blendTrend,
  entityKeyForTool,
  getRisingByEntity,
  isRising,
  maxTrendForTools,
  recencyScore,
} from '@/lib/trend-index';
import {
  coverageShares,
  focusConcepts,
  itemsOnNewestDay,
  leadSlug,
  mentionWindows,
  newestCoverageSlugs,
  shiftIsoDate,
  sumReadMinutes,
  type CoverageRow,
} from '@/lib/home-stats';
import type { IconKey } from '@/components/icons';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
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
  /** Canonical topic slugs derived from `tools` (see `topic-normalize`) — the news Topics facet. */
  topics: string[];
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
  /** Mentions in the latest 7 days minus the previous 7. Null when that prior week is not in the sample. */
  delta?: number | null;
  /** Concept hub slug when the tool name resolves. The home bars still link to the filtered feed. */
  conceptSlug?: string | null;
}

export interface HomeEdition {
  date: string;
  slug: string | null;
  readMinutes: number;
}

export interface HomeFocusConcept {
  name: string;
  slug: string;
}

export interface HomeCoverageSegment {
  slug: string;
  name: string;
  count: number;
  color: string | null;
}

export interface HomeData {
  briefDate: string | null;
  featured: HomeItem | null;
  secondary: HomeItem[];
  categories: HomeCategory[];
  trending: TrendingTopic[];
  /** Total seeded categories — drives the hero "N categories" stat. */
  categoryCount: number;
  /** Published items whose brief date falls in the 7 days ending on the newest edition. */
  storiesLast7Days: number | null;
  edition: HomeEdition | null;
  /** Up to three items from the newest published day — the “short version” rail. */
  rail: HomeItem[];
  focus: HomeFocusConcept[];
  /** Category shares inside the newest 100 published items. */
  coverage: HomeCoverageSegment[];
  coverageSampleSize: number;
  conceptCount: number;
}

const EMPTY: HomeData = {
  briefDate: null,
  featured: null,
  secondary: [],
  categories: [],
  trending: [],
  categoryCount: 0,
  storiesLast7Days: null,
  edition: null,
  rail: [],
  focus: [],
  coverage: [],
  coverageSampleSize: 0,
  conceptCount: 0,
};

/**
 * Everything the home landing renders, from one fetch pass: recent published
 * items (top-of-week + per-category latest + trending) plus category identity.
 * Server-only; ISR-cached by the page. Degrades to category identity (and
 * finally `EMPTY`) when there are no briefs / no Supabase env, so a build never
 * crashes and the page never looks broken.
 */
async function loadHomeData(lang: Lang, briefWindow = 8): Promise<HomeData> {
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
    .select('id, date, edition, slug')
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
        'id, slug, brief_id, rank, category_slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, tools_mentioned, youtube_url, image_url, card_image_url, article_id',
      )
      .in(
        'brief_id',
        briefList.map((b) => b.id),
      )
      .is('canonical_item_id', null);

    const editionByItem = new Map<string, number>();

    for (const it of rows ?? []) {
      const brief = briefById.get(it.brief_id);
      if (!brief) continue;
      editionByItem.set(it.id, brief.edition);
      const summary = pick(lang, it.summary_en, it.summary_uk);
      const why = pick(lang, it.why_matters_en, it.why_matters_uk);
      const cat = it.category_slug ? catBySlug.get(it.category_slug) : undefined;
      const tools = extractToolNames(it.tools_mentioned);
      items.push({
        id: it.id,
        rank: it.rank,
        categorySlug: it.category_slug,
        categoryName: cat?.name ?? null,
        categoryColor: cat?.color ?? null,
        href: it.category_slug && it.slug ? `/${lang}/news/${it.category_slug}/${it.slug}` : `/${lang}/news`,
        title: pick(lang, it.title_en, it.title_uk) || summary,
        summary,
        why: why || summary,
        date: brief.date,
        hasVideo: Boolean(it.youtube_url),
        tools,
        topics: topicSlugs(tools),
        sourceName: null,
        readMinutes: Math.max(2, Math.round((wordCount(summary) + wordCount(why)) / 45)),
        imageUrl: (it.card_image_url ?? it.image_url)?.startsWith('http')
          ? (it.card_image_url ?? it.image_url)
          : null,
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
      count: publishedCategoryCounts.get(slug) ?? group.length,
    });
  }

  const trending = await buildTrending(lang, items, rising);
  const newestDay = itemsOnNewestDay(items);
  const editionDate = newestDay[0]?.date ?? briefList[0]?.date ?? null;
  const [storiesLast7Days, coverage, conceptCount] = await Promise.all([
    countStoriesLast7Days(supabase, editionDate),
    loadCoverage(supabase, catBySlug),
    countConcepts(supabase),
  ]);

  return {
    briefDate: editionDate ?? featured?.date ?? null,
    featured,
    secondary,
    categories,
    trending,
    categoryCount,
    storiesLast7Days,
    edition: editionDate
      ? {
          date: editionDate,
          slug: leadSlug(briefList, editionDate),
          readMinutes: sumReadMinutes(newestDay),
        }
      : null,
    rail: newestDay.slice(0, 3),
    focus: focusConcepts(trending),
    coverage: coverage.segments,
    coverageSampleSize: coverage.sampleSize,
    conceptCount,
  };
}

const cachedLoadHomeData = cachePublicRead('home-data', loadHomeData);

export async function getHomeData(lang: Lang): Promise<HomeData> {
  const data = await cachedLoadHomeData(lang);
  if (!data) return EMPTY;
  return {
    ...EMPTY,
    ...data,
    rail: data.rail ?? [],
    focus: data.focus ?? [],
    coverage: data.coverage ?? [],
    categories: data.categories ?? [],
    trending: data.trending ?? [],
    secondary: data.secondary ?? [],
  };
}

async function buildTrending(
  lang: Lang,
  items: HomeItem[],
  rising: Map<string, number>,
): Promise<TrendingTopic[]> {
  const windows = mentionWindows(items);
  if (windows.size === 0) return [];

  // Mentions are the latest 7 days; delta is against the previous 7 when that
  // week is in the sample. GDELT still breaks ties. Bars open the archive search,
  // not a concept page and not an already-applied news filter.
  const index = await getConceptNameIndex();
  return Array.from(windows.entries())
    .map(([name, window]) => {
      const slug = index.get(name.toLowerCase()) ?? null;
      const risingScore = rising.get(entityKeyForTool(name));
      return {
        topic: {
          name,
          mentions: window.mentions,
          href: `/${lang}/news/search?q=${encodeURIComponent(name)}`,
          rising: isRising(risingScore),
          delta: window.delta,
          conceptSlug: slug,
        },
        trend: blendTrend(window.mentions, risingScore ?? 0),
      };
    })
    .filter((entry) => entry.topic.mentions > 0)
    .sort((a, b) => b.trend - a.trend)
    .slice(0, 8)
    .map((entry) => entry.topic);
}

async function countStoriesLast7Days(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  newestDate: string | null,
): Promise<number | null> {
  if (!newestDate) return null;
  const cutoff = shiftIsoDate(newestDate, -6);
  if (!cutoff) return null;
  const { data: briefs, error } = await supabase
    .from('briefs')
    .select('id')
    .eq('status', 'published')
    .gte('date', cutoff)
    .lte('date', newestDate);
  if (error || !briefs?.length) return error ? null : 0;
  const { count, error: itemsError } = await supabase
    .from('brief_items')
    .select('id', { count: 'exact', head: true })
    .in(
      'brief_id',
      briefs.map((brief) => brief.id),
    )
    .is('canonical_item_id', null);
  if (itemsError || count === null) return null;
  return count;
}

async function countConcepts(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
): Promise<number> {
  const { count, error } = await supabase
    .from('concepts')
    .select('slug', { count: 'exact', head: true });
  if (error || count === null) return 0;
  return count;
}

async function loadCoverage(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  catBySlug: ReadonlyMap<string, { name: string; color: string | null }>,
): Promise<{ segments: HomeCoverageSegment[]; sampleSize: number }> {
  const empty = { segments: [], sampleSize: 0 };
  const { data: briefs, error } = await supabase
    .from('briefs')
    .select('id, date, edition')
    .eq('status', 'published')
    .order('date', { ascending: false })
    .order('edition', { ascending: true })
    .limit(40);
  if (error || !briefs?.length) return empty;
  const { data: rows, error: itemsError } = await supabase
    .from('brief_items')
    .select('brief_id, category_slug, rank')
    .in(
      'brief_id',
      briefs.map((brief) => brief.id),
    )
    .is('canonical_item_id', null);
  if (itemsError || !rows?.length) return empty;

  const briefById = new Map(briefs.map((brief) => [brief.id, brief]));
  const coverageRows: CoverageRow[] = [];
  for (const row of rows) {
    const brief = briefById.get(row.brief_id);
    if (!brief) continue;
    coverageRows.push({
      date: brief.date,
      edition: brief.edition,
      rank: row.rank,
      categorySlug: row.category_slug,
    });
  }
  const slugs = newestCoverageSlugs(coverageRows, 100);
  const segments: HomeCoverageSegment[] = [];
  for (const share of coverageShares(slugs)) {
    const cat = catBySlug.get(share.slug);
    if (!cat) continue;
    segments.push({ slug: share.slug, name: cat.name, count: share.count, color: cat.color });
  }
  return { segments, sampleSize: slugs.length };
}
