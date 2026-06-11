import { getSupabase } from '@/lib/supabase';
import { categoryMeta } from '@/lib/category-meta';
import type { HomeItem } from '@/lib/home';
import { LANGS, type Lang } from '@/lib/site';
import type { NewsCard } from '@/lib/news';
import type { IconKey } from '@/components/icons';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

export interface CategoryInfo {
  slug: string;
  name: string;
  description: string;
  color: string | null;
}

export async function getCategory(slug: string, lang: Lang): Promise<CategoryInfo | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('categories')
    .select('slug, name_en, name_uk, description_en, description_uk, color')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return {
    slug: data.slug,
    name: pick(lang, data.name_en, data.name_uk),
    description: pick(lang, data.description_en, data.description_uk),
    color: data.color,
  };
}

export interface CategoryListItem {
  slug: string;
  name: string;
  description: string;
  color: string | null;
}

/** All seeded categories, ordered by display position. Empty without env. */
export async function getCategories(lang: Lang): Promise<CategoryListItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from('categories')
    .select('slug, name_en, name_uk, description_en, description_uk, color, position')
    .order('position', { ascending: true });
  return (data ?? []).map((c) => ({
    slug: c.slug,
    name: pick(lang, c.name_en, c.name_uk),
    description: pick(lang, c.description_en, c.description_uk),
    color: c.color,
  }));
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

export interface CategoryHubView {
  slug: string;
  name: string;
  description: string;
  color: string | null;
  icon: IconKey;
  tagline: string;
  subtopics: string[];
  items: HomeItem[];
}

/** Full category hub payload for the prototype layout (glyph header + PostFeed). */
export async function getCategoryHub(slug: string, lang: Lang, limit = 80): Promise<CategoryHubView | null> {
  const category = await getCategory(slug, lang);
  if (!category) return null;
  const meta = categoryMeta(slug);

  const supabase = getSupabase();
  if (!supabase) {
    return {
      slug: category.slug,
      name: category.name,
      description: category.description,
      color: category.color,
      icon: meta.icon,
      tagline: meta.tagline[lang],
      subtopics: meta.subtopics ?? [],
      items: [],
    };
  }

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, slug, date')
    .eq('status', 'published')
    .order('date', { ascending: false });
  if (!briefs || briefs.length === 0) {
    return {
      slug: category.slug,
      name: category.name,
      description: category.description,
      color: category.color,
      icon: meta.icon,
      tagline: meta.tagline[lang],
      subtopics: meta.subtopics ?? [],
      items: [],
    };
  }

  const briefById = new Map(briefs.map((b) => [b.id, b]));
  const { data: rows } = await supabase
    .from('brief_items')
    .select(
      'id, slug, brief_id, rank, category_slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, tools_mentioned, youtube_url, image_url, article_id',
    )
    .eq('category_slug', slug)
    .in(
      'brief_id',
      briefs.map((b) => b.id),
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
    youtubeUrl: string | null;
    imageUrl: string | null;
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
      youtubeUrl: it.youtube_url,
      imageUrl: it.image_url,
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

  const items: HomeItem[] = staged.slice(0, limit).map((r) => {
    const summary = pick(lang, r.summaryEn, r.summaryUk);
    const why = pick(lang, r.whyEn, r.whyUk);
    return {
      id: r.id,
      rank: r.rank,
      categorySlug: slug,
      categoryName: category.name,
      categoryColor: category.color,
      href: r.briefSlug && r.slug ? `/${lang}/${r.briefSlug}/${r.slug}` : `/${lang}/news`,
      title: pick(lang, r.titleEn, r.titleUk) || summary,
      summary,
      why: why || summary,
      date: r.date,
      hasVideo: Boolean(r.youtubeUrl),
      tools: toToolNames(r.tools),
      sourceName: sources.get(r.articleId) ?? null,
      readMinutes: Math.max(2, Math.round((wordCount(summary) + wordCount(why)) / 45)),
      imageUrl: r.imageUrl?.startsWith('http') ? r.imageUrl : null,
    };
  });

  return {
    slug: category.slug,
    name: category.name,
    description: category.description,
    color: category.color,
    icon: meta.icon,
    tagline: meta.tagline[lang],
    subtopics: meta.subtopics ?? [],
    items,
  };
}

export async function getCategoryItems(slug: string, lang: Lang, limit = 60): Promise<NewsCard[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, slug, date')
    .eq('status', 'published')
    .order('date', { ascending: false });
  if (!briefs || briefs.length === 0) return [];

  const briefById = new Map(briefs.map((b) => [b.id, b]));
  const { data: items } = await supabase
    .from('brief_items')
    .select('id, slug, brief_id, rank, title_en, title_uk, summary_en, summary_uk, category_slug')
    .eq('category_slug', slug)
    .in(
      'brief_id',
      briefs.map((b) => b.id),
    );

  const rows: {
    id: string;
    slug: string | null;
    rank: number;
    date: string;
    briefSlug: string | null;
    titleEn: string | null;
    titleUk: string | null;
    summaryEn: string;
    summaryUk: string;
  }[] = [];
  for (const it of items ?? []) {
    const brief = briefById.get(it.brief_id);
    if (!brief) continue;
    rows.push({
      id: it.id,
      slug: it.slug,
      rank: it.rank,
      date: brief.date,
      briefSlug: brief.slug,
      titleEn: it.title_en,
      titleUk: it.title_uk,
      summaryEn: it.summary_en,
      summaryUk: it.summary_uk,
    });
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.rank - b.rank));

  return rows.slice(0, limit).map((r) => {
    const summary = pick(lang, r.summaryEn, r.summaryUk);
    return {
      id: r.id,
      href: r.briefSlug && r.slug ? `/${lang}/${r.briefSlug}/${r.slug}` : `/${lang}/news`,
      category: slug,
      title: pick(lang, r.titleEn, r.titleUk) || summary,
      summary,
      date: r.date,
      imageUrl: null, // lightweight query — no image column selected
    };
  });
}

/** Published item counts per category — single source of truth for homepage + hubs. */
export async function getPublishedCategoryCounts(): Promise<Map<string, number>> {
  const supabase = getSupabase();
  if (!supabase) return new Map();

  const { data: briefs } = await supabase.from('briefs').select('id').eq('status', 'published');
  if (!briefs?.length) return new Map();

  const { data: rows } = await supabase
    .from('brief_items')
    .select('category_slug')
    .in(
      'brief_id',
      briefs.map((b) => b.id),
    );

  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    if (!row.category_slug) continue;
    counts.set(row.category_slug, (counts.get(row.category_slug) ?? 0) + 1);
  }
  return counts;
}

export async function getCategoryPaths(): Promise<{ lang: string; slug: string }[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from('categories').select('slug');
  if (!data) return [];
  const paths: { lang: string; slug: string }[] = [];
  for (const c of data) for (const lang of LANGS) paths.push({ lang, slug: c.slug });
  return paths;
}
