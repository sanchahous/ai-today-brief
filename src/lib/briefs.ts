import { getSupabase } from '@/lib/supabase';
import type { Lang } from '@/lib/site';

export interface BriefItemCard {
  id: string;
  rank: number;
  categorySlug: string | null;
  slug: string | null;
  title: string;
  summary: string;
  why: string;
}

export interface LatestBrief {
  id: string;
  date: string;
  slug: string | null;
  title: string;
  intro: string | null;
  items: BriefItemCard[];
}

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

/**
 * Latest published brief + its top items, localized to `lang`.
 * Returns `null` when Supabase is unreachable (no env) so the UI shows a placeholder.
 */
export async function getLatestBrief(lang: Lang, limit = 6): Promise<LatestBrief | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: brief, error: briefError } = await supabase
    .from('briefs')
    .select('id, date, slug, title_en, title_uk, intro_en, intro_uk')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (briefError || !brief) return null;

  const { data: items, error: itemsError } = await supabase
    .from('brief_items')
    .select(
      'id, rank, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, category_slug, slug',
    )
    .eq('brief_id', brief.id)
    .order('rank', { ascending: true })
    .limit(limit);

  const cards: BriefItemCard[] = (itemsError ? [] : (items ?? [])).map((it) => {
    const summary = pick(lang, it.summary_en, it.summary_uk);
    return {
      id: it.id,
      rank: it.rank,
      categorySlug: it.category_slug,
      slug: it.slug,
      title: pick(lang, it.title_en, it.title_uk) || summary,
      summary,
      why: pick(lang, it.why_matters_en, it.why_matters_uk) || summary,
    };
  });

  return {
    id: brief.id,
    date: brief.date,
    slug: brief.slug,
    title: pick(lang, brief.title_en, brief.title_uk),
    intro: pick(lang, brief.intro_en, brief.intro_uk) || null,
    items: cards,
  };
}
