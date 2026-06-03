import { getSupabase } from '@/lib/supabase';
import { LANGS, type Lang } from '@/lib/site';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

export interface BriefItemDetail {
  briefSlug: string;
  briefDate: string;
  itemSlug: string;
  categorySlug: string | null;
  title: string;
  summary: string;
  why: string;
  deepDive: string;
  takeaways: string[];
  publishedAt: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
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
      'slug, article_id, category_slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, deep_dive_en, deep_dive_uk, takeaways_en, takeaways_uk',
    )
    .eq('brief_id', brief.id)
    .eq('slug', itemSlug)
    .maybeSingle();
  if (itemError || !it?.slug) return null;

  const { data: article } = await supabase
    .from('articles')
    .select('source_name, source_url, url')
    .eq('id', it.article_id)
    .maybeSingle();

  const summary = pick(lang, it.summary_en, it.summary_uk);
  return {
    briefSlug: brief.slug,
    briefDate: brief.date,
    itemSlug: it.slug,
    categorySlug: it.category_slug,
    title: pick(lang, it.title_en, it.title_uk) || summary,
    summary,
    why: pick(lang, it.why_matters_en, it.why_matters_uk),
    deepDive: pick(lang, it.deep_dive_en, it.deep_dive_uk),
    takeaways: toStringArray(lang === 'uk' ? it.takeaways_uk : it.takeaways_en),
    publishedAt: brief.published_at,
    sourceName: article?.source_name ?? null,
    sourceUrl: article?.url ?? article?.source_url ?? null,
  };
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
