import { getSupabase } from '@/lib/supabase';
import type { Lang } from '@/lib/site';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

export interface NewsCard {
  id: string;
  href: string;
  category: string | null;
  title: string;
  summary: string;
  date: string;
}

/** All published items, newest brief first. Empty without env. */
export async function getNewsList(lang: Lang, limit = 60): Promise<NewsCard[]> {
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
    category: string | null;
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
      category: it.category_slug,
    });
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.rank - b.rank));

  return rows.slice(0, limit).map((r) => {
    const summary = pick(lang, r.summaryEn, r.summaryUk);
    return {
      id: r.id,
      href: r.briefSlug && r.slug ? `/${lang}/${r.briefSlug}/${r.slug}` : `/${lang}/news`,
      category: r.category,
      title: pick(lang, r.titleEn, r.titleUk) || summary,
      summary,
      date: r.date,
    };
  });
}

/** Full-text search via the search_brief_items RPC. Empty for blank query / no env. */
export async function searchNews(lang: Lang, query: string, limit = 50): Promise<NewsCard[]> {
  const supabase = getSupabase();
  const q = query.trim();
  if (!supabase || q.length === 0) return [];

  const { data, error } = await supabase.rpc('search_brief_items', {
    p_query: q,
    p_lang: lang,
    p_limit: limit,
    p_offset: 0,
  });
  if (error || !data) return [];

  return data.map((r) => {
    const summary = pick(lang, r.summary_en, r.summary_uk);
    return {
      id: r.id,
      href: r.brief_slug && r.slug ? `/${lang}/${r.brief_slug}/${r.slug}` : `/${lang}/news`,
      category: r.category_slug,
      title: pick(lang, r.title_en, r.title_uk) || summary,
      summary,
      date: r.brief_date,
    };
  });
}
