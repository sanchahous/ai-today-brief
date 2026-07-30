import { getSupabase } from '@/lib/supabase';
import { getCategories } from '@/lib/categories';
import { getStrings } from '@/lib/i18n';
import { LANGS, type Lang } from '@/lib/site';
import { extractToolNames } from '@/lib/tools-mentioned';

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
  /** Tool names mentioned in the item — resolve to concept hubs for linking. */
  tools: string[];
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
  tools_mentioned: unknown;
}

interface PackRow {
  id: string;
  date: string;
  slug: string | null;
  edition: number;
  title_en: string;
  title_uk: string;
  intro_en: string | null;
  intro_uk: string | null;
  published_at: string | null;
}

const ITEM_COLUMNS =
  'id, rank, category_slug, slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, tools_mentioned';

const PACK_COLUMNS =
  'id, date, slug, edition, title_en, title_uk, intro_en, intro_uk, published_at';

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
    tools: extractToolNames(it.tools_mentioned),
  };
}

export interface BriefPackSection {
  edition: number;
  slug: string;
  publishedAt: string | null;
  intro: string | null;
  items: BriefItemCard[];
}

export interface DailyBriefView {
  id: string;
  date: string;
  canonicalSlug: string;
  title: string;
  intro: string | null;
  packs: BriefPackSection[];
  allItems: BriefItemCard[];
}

export interface BriefSummary {
  id: string;
  date: string;
  slug: string | null;
  title: string;
  intro: string | null;
  items: BriefItemCard[];
}

/** Eyebrow for pack 2+ sections — "Update · 6:30 PM" / "Оновлення · 18:30". */
export function formatPackUpdateLabel(lang: Lang, publishedAt: string | null): string {
  const t = getStrings(lang);
  if (!publishedAt) return t.briefPackUpdate;
  const time = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(publishedAt));
  return `${t.briefPackUpdate} · ${time}`;
}

async function loadPackSections(
  lang: Lang,
  packs: PackRow[],
): Promise<{ sections: BriefPackSection[]; allItems: BriefItemCard[] }> {
  const supabase = getSupabase();
  if (!supabase) return { sections: [], allItems: [] };

  const cats = await getCategories(lang);
  const catBySlug = new Map(cats.map((c) => [c.slug, c]));
  const sections: BriefPackSection[] = [];
  const allItems: BriefItemCard[] = [];

  for (const pack of packs) {
    if (!pack.slug) continue;
    const { data: items } = await supabase
      .from('brief_items')
      .select(ITEM_COLUMNS)
      .eq('brief_id', pack.id)
      .is('canonical_item_id', null)
      .order('rank', { ascending: true });

    const cards = (items ?? []).map((it) => toCard(lang, it, catBySlug));
    sections.push({
      edition: pack.edition,
      slug: pack.slug,
      publishedAt: pack.published_at,
      intro: pack.edition === 1 ? null : pick(lang, pack.intro_en, pack.intro_uk) || null,
      items: cards,
    });
    allItems.push(...cards);
  }

  return { sections, allItems };
}

/**
 * Aggregated daily brief: all published packs for the anchor slug's calendar day.
 * Any pack slug resolves to the same merged view; canonical points at edition 1.
 */
export async function getDailyBriefBySlug(slug: string, lang: Lang): Promise<DailyBriefView | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: anchor, error } = await supabase
    .from('briefs')
    .select(PACK_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (error || !anchor?.slug) return null;

  const { data: packsRaw } = await supabase
    .from('briefs')
    .select(PACK_COLUMNS)
    .eq('date', anchor.date)
    .eq('status', 'published')
    .order('edition', { ascending: true });

  const packs = (packsRaw ?? []) as PackRow[];
  const lead = packs.find((p) => p.edition === 1) ?? packs[0];
  if (!lead?.slug) return null;

  const { sections, allItems } = await loadPackSections(lang, packs);

  return {
    id: lead.id,
    date: lead.date,
    canonicalSlug: lead.slug,
    title: pick(lang, lead.title_en, lead.title_uk),
    intro: pick(lang, lead.intro_en, lead.intro_uk) || null,
    packs: sections,
    allItems,
  };
}

/** Latest published day (all packs merged) + top items. `null` without env. */
export async function getLatestBrief(lang: Lang, limit = 6): Promise<BriefSummary | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: latest, error } = await supabase
    .from('briefs')
    .select('date')
    .eq('status', 'published')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !latest) return null;

  const { data: lead } = await supabase
    .from('briefs')
    .select('slug')
    .eq('date', latest.date)
    .eq('edition', 1)
    .eq('status', 'published')
    .maybeSingle();
  if (!lead?.slug) return null;

  const daily = await getDailyBriefBySlug(lead.slug, lang);
  if (!daily) return null;

  return {
    id: daily.id,
    date: daily.date,
    slug: daily.canonicalSlug,
    title: daily.title,
    intro: daily.intro,
    items: daily.allItems.slice(0, limit),
  };
}

/** @deprecated Use getDailyBriefBySlug — kept for narrow imports. */
export async function getBriefBySlug(slug: string, lang: Lang): Promise<BriefSummary | null> {
  const daily = await getDailyBriefBySlug(slug, lang);
  if (!daily) return null;
  return {
    id: daily.id,
    date: daily.date,
    slug: daily.canonicalSlug,
    title: daily.title,
    intro: daily.intro,
    items: daily.allItems,
  };
}

/** Lead-pack slugs × langs — for build-time SSG (one page per calendar day). */
export async function getBriefPaths(): Promise<{ lang: string; brief: string }[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from('briefs')
    .select('slug')
    .eq('status', 'published')
    .eq('edition', 1);
  if (!data) return [];
  const paths: { lang: string; brief: string }[] = [];
  for (const b of data) {
    if (!b.slug) continue;
    for (const lang of LANGS) paths.push({ lang, brief: b.slug });
  }
  return paths;
}

export interface BriefSitemapEntry {
  slug: string;
  /** Publish timestamp of the lead pack (falls back to the brief date). */
  lastModified: string;
}

/** Lead-pack slugs + publish dates — sitemap entries for daily brief pages. */
export async function getBriefSitemapEntries(): Promise<BriefSitemapEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from('briefs')
    .select('slug, date, published_at')
    .eq('status', 'published')
    .eq('edition', 1);
  if (!data) return [];
  const entries: BriefSitemapEntry[] = [];
  for (const b of data) {
    if (!b.slug) continue;
    entries.push({ slug: b.slug, lastModified: b.published_at ?? b.date });
  }
  return entries;
}
