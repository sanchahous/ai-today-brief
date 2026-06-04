import { conceptIcon } from '@/lib/concept-meta';
import { searchNewsItems } from '@/lib/news';
import type { HomeItem } from '@/lib/home';
import { getSupabase } from '@/lib/supabase';
import { LANGS, type Lang } from '@/lib/site';
import type { IconKey } from '@/components/icons';

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

/**
 * Lower-cased concept name + alias → slug, for resolving a tool mention
 * (from `brief_items.tools_mentioned`) to its concept hub. Empty without env.
 */
export async function getConceptNameIndex(): Promise<Map<string, string>> {
  const supabase = getSupabase();
  if (!supabase) return new Map();
  const { data } = await supabase.from('concepts').select('slug, name_en, name_uk, aliases');
  const index = new Map<string, string>();
  for (const c of data ?? []) {
    index.set(c.name_en.trim().toLowerCase(), c.slug);
    index.set(c.name_uk.trim().toLowerCase(), c.slug);
    if (Array.isArray(c.aliases)) {
      for (const alias of c.aliases) index.set(alias.trim().toLowerCase(), c.slug);
    }
  }
  return index;
}

export interface ConceptHubView {
  concept: ConceptDetail;
  icon: IconKey;
  stories: HomeItem[];
  others: ConceptSummary[];
}

/** Concept hub page: detail, matching stories (FTS), and sibling concept chips. */
export async function getConceptHub(
  slug: string,
  lang: Lang,
  storyLimit = 80,
): Promise<ConceptHubView | null> {
  const concept = await getConcept(slug, lang);
  if (!concept) return null;

  const queryParts = [concept.name, ...concept.aliases.slice(0, 3)];
  const query = queryParts.join(' ');
  const stories = await searchNewsItems(lang, query, storyLimit);

  const all = await getConcepts(lang);
  const others = all.filter((c) => c.slug !== slug).slice(0, 12);

  return {
    concept,
    icon: conceptIcon(slug, concept.type),
    stories,
    others,
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
