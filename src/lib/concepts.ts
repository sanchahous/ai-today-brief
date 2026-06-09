import { conceptIcon } from '@/lib/concept-meta';
import { searchNewsItems } from '@/lib/news';
import { getCategories } from '@/lib/categories';
import type { HomeItem } from '@/lib/home';
import { getSupabase } from '@/lib/supabase';
import { LANGS, type Lang } from '@/lib/site';
import type { IconKey } from '@/components/icons';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function extractToolNames(value: unknown): string[] {
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

export interface ConceptSummary {
  slug: string;
  name: string;
  description: string;
  type: string;
  category: string | null;
}

export interface ConceptFaqItem {
  q: string;
  a: string;
}

export interface ConceptDetail extends ConceptSummary {
  officialUrl: string | null;
  aliases: string[];
  body: string;
  faq: ConceptFaqItem[];
}

function parseFaq(value: unknown): ConceptFaqItem[] {
  if (!Array.isArray(value)) return [];
  const items: ConceptFaqItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || !('q' in entry) || !('a' in entry)) continue;
    const q = (entry as { q: unknown }).q;
    const a = (entry as { a: unknown }).a;
    if (typeof q === 'string' && typeof a === 'string' && q.trim() && a.trim()) {
      items.push({ q: q.trim(), a: a.trim() });
    }
  }
  return items;
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
      'slug, name_en, name_uk, description_en, description_uk, type, category, official_url, aliases, body_en, body_uk, faq_en, faq_uk',
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
    body: pick(lang, c.body_en, c.body_uk),
    faq: parseFaq(lang === 'uk' ? c.faq_uk : c.faq_en),
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

/** Concept hub page: items via junction table (primary) with FTS fallback. */
export async function getConceptHub(
  slug: string,
  lang: Lang,
  storyLimit = 80,
): Promise<ConceptHubView | null> {
  const concept = await getConcept(slug, lang);
  if (!concept) return null;

  let stories = await getConceptItemsViaJunction(slug, lang, storyLimit);

  if (stories.length === 0) {
    const queryParts = [concept.name, ...concept.aliases.slice(0, 3)];
    const query = queryParts.join(' ');
    stories = await searchNewsItems(lang, query, storyLimit);
  }

  const all = await getConcepts(lang);
  const others = all.filter((c) => c.slug !== slug).slice(0, 12);

  return {
    concept,
    icon: conceptIcon(slug, concept.type),
    stories,
    others,
  };
}

async function getConceptItemsViaJunction(
  conceptSlug: string,
  lang: Lang,
  limit: number,
): Promise<HomeItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('get_concept_items', {
    p_concept_slug: conceptSlug,
    p_lang: lang,
    p_limit: limit,
  });

  if (error || !data?.length) return [];

  const allCats = await getCategories(lang);
  const catBySlug = new Map(allCats.map((c) => [c.slug, { name: c.name, color: c.color }]));

  return (data as Record<string, unknown>[]).map((r) => {
    const catSlug = (r.category_slug as string) ?? null;
    const cat = catSlug ? catBySlug.get(catSlug) : undefined;
    const title = pick(lang, r.title_en as string | null, r.title_uk as string | null);
    const summary = pick(lang, r.summary_en as string | null, r.summary_uk as string | null);

    return {
      id: r.id as string,
      rank: (r.rank as number) ?? 99,
      categorySlug: catSlug,
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
      href: `/${lang}/${r.brief_slug}/${r.slug}`,
      title: title || summary.slice(0, 80),
      summary,
      why: pick(lang, r.why_en as string | null, r.why_uk as string | null),
      date: r.brief_date as string,
      hasVideo: (r.has_video as boolean) ?? false,
      tools: extractToolNames(r.tools_mentioned),
      sourceName: (r.source_name as string) ?? null,
      readMinutes: Math.max(2, Math.round(wordCount(summary) / 45)),
    };
  });
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
