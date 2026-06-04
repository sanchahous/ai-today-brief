import { getSupabase } from '@/lib/supabase';
import { LANGS, type Lang } from '@/lib/site';
import type { NewsCard } from '@/lib/news';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

export interface CategoryInfo {
  slug: string;
  name: string;
  description: string;
}

export async function getCategory(slug: string, lang: Lang): Promise<CategoryInfo | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('categories')
    .select('slug, name_en, name_uk, description_en, description_uk')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return {
    slug: data.slug,
    name: pick(lang, data.name_en, data.name_uk),
    description: pick(lang, data.description_en, data.description_uk),
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
    };
  });
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
