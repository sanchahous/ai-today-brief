import { getSupabase } from '@/lib/supabase';
import { getCategory } from '@/lib/categories';
import { categoryMeta } from '@/lib/category-meta';
import type { IconKey } from '@/components/icons';
import { LANGS, type Lang } from '@/lib/site';
import { isWithinNewsSitemapWindow, toNewsPublicationDate } from '@/lib/sitemap-dates';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

export type ItemImpactLevel = 'low' | 'medium' | 'high';

export interface BriefItemDetail {
  id: string;
  rank: number;
  briefSlug: string;
  briefDate: string;
  itemSlug: string;
  categorySlug: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: IconKey;
  title: string;
  summary: string;
  why: string;
  deepDive: string;
  takeaways: string[];
  actionItems: string[];
  impactLevel: ItemImpactLevel | null;
  tools: string[];
  hasVideo: boolean;
  readMinutes: number;
  publishedAt: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
}

function parseImpactLevel(value: string | null): ItemImpactLevel | null {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return null;
}

export interface RelatedStory {
  id: string;
  href: string;
  title: string;
  categoryName: string | null;
  categoryColor: string | null;
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

function deepDiveParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** One published brief item by brief slug + item slug, localized. `null` if missing/unpublished. */
export async function getBriefItem(
  briefSlug: string,
  itemSlug: string,
  lang: Lang,
): Promise<BriefItemDetail | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: brief, error: briefError } = await supabase
    .from('briefs')
    .select('id, slug, date, published_at')
    .eq('slug', briefSlug)
    .eq('status', 'published')
    .maybeSingle();
  if (briefError || !brief?.slug) return null;

  const { data: it, error: itemError } = await supabase
    .from('brief_items')
    .select(
      'id, slug, rank, article_id, category_slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, deep_dive_en, deep_dive_uk, takeaways_en, takeaways_uk, action_items_en, action_items_uk, impact_level, tools_mentioned, youtube_url',
    )
    .eq('brief_id', brief.id)
    .eq('slug', itemSlug)
    .maybeSingle();
  if (itemError || !it?.slug) return null;

  const category = it.category_slug ? await getCategory(it.category_slug, lang) : null;

  const { data: article } = await supabase
    .from('articles')
    .select('source_name, source_url, url')
    .eq('id', it.article_id)
    .maybeSingle();

  const summary = pick(lang, it.summary_en, it.summary_uk);
  const why = pick(lang, it.why_matters_en, it.why_matters_uk);
  const deepDive = pick(lang, it.deep_dive_en, it.deep_dive_uk);
  const meta = categoryMeta(it.category_slug);

  return {
    id: it.id,
    rank: it.rank,
    briefSlug: brief.slug,
    briefDate: brief.date,
    itemSlug: it.slug,
    categorySlug: it.category_slug,
    categoryName: category?.name ?? null,
    categoryColor: category?.color ?? null,
    categoryIcon: meta.icon,
    title: pick(lang, it.title_en, it.title_uk) || summary,
    summary,
    why: why || summary,
    deepDive,
    takeaways: toStringArray(lang === 'uk' ? it.takeaways_uk : it.takeaways_en),
    actionItems: toStringArray(lang === 'uk' ? it.action_items_uk : it.action_items_en),
    impactLevel: parseImpactLevel(it.impact_level),
    tools: toToolNames(it.tools_mentioned),
    hasVideo: Boolean(it.youtube_url),
    readMinutes: Math.max(
      2,
      Math.round(
        (wordCount(summary) + wordCount(why) + deepDiveParagraphs(deepDive).join(' ').split(/\s+/).length) /
          45,
      ),
    ),
    publishedAt: brief.published_at,
    sourceName: article?.source_name ?? null,
    sourceUrl: article?.url ?? article?.source_url ?? null,
  };
}

/** Recent stories in the same category, excluding the current item. */
export async function getRelatedStories(
  lang: Lang,
  categorySlug: string,
  excludeId: string,
  limit = 4,
): Promise<RelatedStory[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const category = await getCategory(categorySlug, lang);

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, slug, date')
    .eq('status', 'published')
    .order('date', { ascending: false })
    .limit(12);
  if (!briefs || briefs.length === 0) return [];

  const briefById = new Map(briefs.map((b) => [b.id, b]));
  const { data: rows } = await supabase
    .from('brief_items')
    .select('id, slug, brief_id, rank, title_en, title_uk, category_slug')
    .eq('category_slug', categorySlug)
    .neq('id', excludeId)
    .in(
      'brief_id',
      briefs.map((b) => b.id),
    );

  const staged: { id: string; href: string; title: string; date: string; rank: number }[] = [];
  for (const it of rows ?? []) {
    const brief = briefById.get(it.brief_id);
    if (!brief?.slug || !it.slug) continue;
    const title = pick(lang, it.title_en, it.title_uk);
    if (!title) continue;
    staged.push({
      id: it.id,
      href: `/${lang}/${brief.slug}/${it.slug}`,
      title,
      date: brief.date,
      rank: it.rank,
    });
  }

  staged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.rank - b.rank));

  return staged.slice(0, limit).map((r) => ({
    id: r.id,
    href: r.href,
    title: r.title,
    categoryName: category?.name ?? null,
    categoryColor: category?.color ?? null,
  }));
}

export interface NewsSitemapEntry {
  lang: Lang;
  brief: string;
  item: string;
  title: string;
  /** W3C datetime for Google News (UTC, no offset). */
  publicationDate: string;
}

/** Published items with titles and dates for Google News sitemap. */
export async function getPublishedNewsSitemapEntries(): Promise<NewsSitemapEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, slug, date, published_at')
    .eq('status', 'published');
  if (!briefs?.length) return [];

  const briefById = new Map(briefs.map((b) => [b.id, b]));
  const { data: rows } = await supabase
    .from('brief_items')
    .select('slug, brief_id, title_en, title_uk')
    .in(
      'brief_id',
      briefs.map((b) => b.id),
    );

  const entries: NewsSitemapEntry[] = [];
  for (const row of rows ?? []) {
    const brief = briefById.get(row.brief_id);
    if (!brief?.slug || !row.slug) continue;
    const publicationDate = toNewsPublicationDate(brief.published_at, brief.date);
    if (!isWithinNewsSitemapWindow(publicationDate)) continue;
    for (const lang of LANGS) {
      entries.push({
        lang,
        brief: brief.slug,
        item: row.slug,
        title: pick(lang, row.title_en, row.title_uk) || row.slug,
        publicationDate,
      });
    }
  }
  return entries;
}

/** All published (lang, brief, item) slug paths — for build-time SSG. Empty without env. */
export async function getPublishedItemPaths(): Promise<
  { lang: string; brief: string; item: string }[]
> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, slug')
    .eq('status', 'published');
  if (!briefs || briefs.length === 0) return [];

  const slugById = new Map(briefs.map((b) => [b.id, b.slug]));
  const { data: items } = await supabase
    .from('brief_items')
    .select('slug, brief_id')
    .in(
      'brief_id',
      briefs.map((b) => b.id),
    );

  const paths: { lang: string; brief: string; item: string }[] = [];
  for (const it of items ?? []) {
    const briefSlug = slugById.get(it.brief_id);
    if (!briefSlug || !it.slug) continue;
    for (const lang of LANGS) paths.push({ lang, brief: briefSlug, item: it.slug });
  }
  return paths;
}
