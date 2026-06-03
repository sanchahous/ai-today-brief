import { getSupabase } from '@/lib/supabase';
import { LANGS, type Lang } from '@/lib/site';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

export interface ConceptSummary {
  slug: string;
  name: string;
  description: string;
  type: string;
  category: string | null;
}

export interface ConceptDetail extends ConceptSummary {
  officialUrl: string | null;
  aliases: string[];
}

export async function getConcepts(lang: Lang): Promise<ConceptSummary[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from('concepts')
    .select('slug, name_en, name_uk, description_en, description_uk, type, category')
    .order('name_en', { ascending: true });
  return (data ?? []).map((c) => ({
    slug: c.slug,
    name: pick(lang, c.name_en, c.name_uk),
    description: pick(lang, c.description_en, c.description_uk),
    type: c.type,
    category: c.category,
  }));
}

export async function getConcept(slug: string, lang: Lang): Promise<ConceptDetail | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: c, error } = await supabase
    .from('concepts')
    .select(
      'slug, name_en, name_uk, description_en, description_uk, type, category, official_url, aliases',
    )
    .eq('slug', slug)
    .maybeSingle();
  if (error || !c) return null;
  return {
    slug: c.slug,
    name: pick(lang, c.name_en, c.name_uk),
    description: pick(lang, c.description_en, c.description_uk),
    type: c.type,
    category: c.category,
    officialUrl: c.official_url,
    aliases: Array.isArray(c.aliases) ? c.aliases : [],
  };
}

export async function getConceptPaths(): Promise<{ lang: string; slug: string }[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from('concepts').select('slug');
  if (!data) return [];
  const paths: { lang: string; slug: string }[] = [];
  for (const c of data) for (const lang of LANGS) paths.push({ lang, slug: c.slug });
  return paths;
}
