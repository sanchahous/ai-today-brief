import { getSupabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type BriefItemRow = Database['public']['Tables']['brief_items']['Row'];

export type BriefItemCard = Pick<
  BriefItemRow,
  'id' | 'rank' | 'title_en' | 'summary_en' | 'why_matters_en' | 'category_slug' | 'slug'
>;

export interface LatestBrief {
  id: string;
  date: string;
  slug: string | null;
  title_en: string;
  intro_en: string | null;
  items: BriefItemCard[];
}

/**
 * Latest published brief + its top items, for the homepage.
 * Returns `null` when Supabase is unreachable (no env) so the UI shows a
 * placeholder rather than failing.
 */
export async function getLatestBrief(limit = 6): Promise<LatestBrief | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: brief, error: briefError } = await supabase
    .from('briefs')
    .select('id, date, slug, title_en, intro_en')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (briefError || !brief) return null;

  const { data: items, error: itemsError } = await supabase
    .from('brief_items')
    .select('id, rank, title_en, summary_en, why_matters_en, category_slug, slug')
    .eq('brief_id', brief.id)
    .order('rank', { ascending: true })
    .limit(limit);

  if (itemsError) return { ...brief, items: [] };

  return { ...brief, items: items ?? [] };
}
