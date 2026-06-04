import { getSupabase } from '@/lib/supabase';
import { getCategories } from '@/lib/categories';
import { LANGS, type Lang } from '@/lib/site';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

export interface BriefItemCard {
  id: string;
  rank: number;
  categorySlug: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  slug: string | null;
  title: string;
  summary: string;
  why: string;
}

interface ItemRow {
  id: string;
  rank: number;
  category_slug: string | null;
  slug: string | null;
  title_en: string | null;
  title_uk: string | null;
  summary_en: string;
  summary_uk: string;
  why_matters_en: string | null;
  why_matters_uk: string | null;
}

const ITEM_COLUMNS =
  'id, rank, category_slug, slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk';

function toCard(
  lang: Lang,
  it: ItemRow,
  catBySlug: Map<string, { name: string; color: string | null }>,
): BriefItemCard {
  const summary = pick(lang, it.summary_en, it.summary_uk);
  const cat = it.category_slug ? catBySlug.get(it.category_slug) : undefined;
  return {
    id: it.id,
    rank: it.rank,
    categorySlug: it.category_slug,
    categoryName: cat?.name ?? null,
    categoryColor: cat?.color ?? null,
    slug: it.slug,
    title: pick(lang, it.title_en, it.title_uk) || summary,
    summary,
    why: pick(lang, it.why_matters_en, it.why_matters_uk) || summary,
  };
}

export interface BriefSummary {
  id: string;
  date: string;
  slug: string | null;
  title: string;
  intro: string | null;
  items: BriefItemCard[];
}

/** Latest published brief + its top items, localized. `null` without env. */
export async function getLatestBrief(lang: Lang, limit = 6): Promise<BriefSummary | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: brief, error } = await supabase
    .from('briefs')
    .select('id, date, slug, title_en, title_uk, intro_en, intro_uk')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error || !brief) return null;

  const { data: items } = await supabase
    .from('brief_items')
    .select(ITEM_COLUMNS)
    .eq('brief_id', brief.id)
    .order('rank', { ascending: true })
    .limit(limit);

  const cats = await getCategories(lang);
  const catBySlug = new Map(cats.map((c) => [c.slug, c]));

  return {
    id: brief.id,
    date: brief.date,
    slug: brief.slug,
    title: pick(lang, brief.title_en, brief.title_uk),
    intro: pick(lang, brief.intro_en, brief.intro_uk) || null,
    items: (items ?? []).map((it) => toCard(lang, it, catBySlug)),
  };
}

/** A specific published brief by slug + all its items, localized. `null` if missing. */
export async function getBriefBySlug(slug: string, lang: Lang): Promise<BriefSummary | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: brief, error } = await supabase
    .from('briefs')
    .select('id, date, slug, title_en, title_uk, intro_en, intro_uk')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (error || !brief?.slug) return null;

  const { data: items } = await supabase
    .from('brief_items')
    .select(ITEM_COLUMNS)
    .eq('brief_id', brief.id)
    .order('rank', { ascending: true });

  const cats = await getCategories(lang);
  const catBySlug = new Map(cats.map((c) => [c.slug, c]));

  return {
    id: brief.id,
    date: brief.date,
    slug: brief.slug,
    title: pick(lang, brief.title_en, brief.title_uk),
    intro: pick(lang, brief.intro_en, brief.intro_uk) || null,
    items: (items ?? []).map((it) => toCard(lang, it, catBySlug)),
  };
}

/** All published brief slugs × langs — for build-time SSG. Empty without env. */
export async function getBriefPaths(): Promise<{ lang: string; brief: string }[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from('briefs').select('slug').eq('status', 'published');
  if (!data) return [];
  const paths: { lang: string; brief: string }[] = [];
  for (const b of data) {
    if (!b.slug) continue;
    for (const lang of LANGS) paths.push({ lang, brief: b.slug });
  }
  return paths;
}
