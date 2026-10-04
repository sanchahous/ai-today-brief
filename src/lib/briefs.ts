import { getSupabase } from '@/lib/supabase';
import { getCategories } from '@/lib/categories';
import { getStrings } from '@/lib/i18n';
import { LANGS, type Lang } from '@/lib/site';
import { extractToolNames } from '@/lib/tools-mentioned';
import { limitPrerenderPaths } from '@/lib/public-content-cache';
import { readMinutesForParts } from '@/lib/home-stats';
import { citationSourceName, distinctWhy, localizedList } from '@/lib/daily-edition';

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
  takeaways: string[];
  actionItems: string[];
  /** Publication name when the public search projection has one. */
  sourceName: string | null;
  readMinutes: number;
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
  takeaways_en: unknown;
  takeaways_uk: unknown;
  action_items_en: unknown;
  action_items_uk: unknown;
  citations: unknown;
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

interface DailyVisualPublicationRow {
  daily_visual_set_id: string;
  candidate_id: string;
  public_url: string;
  width: number;
  height: number;
  alt_en: string;
  alt_uk: string;
  display_title_en: string;
  display_title_uk: string;
}

const ITEM_COLUMNS =
  'id, rank, category_slug, slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, takeaways_en, takeaways_uk, action_items_en, action_items_uk, citations, tools_mentioned';

const PACK_COLUMNS =
  'id, date, slug, edition, title_en, title_uk, intro_en, intro_uk, published_at';

// This is deliberately the public projection only. Public brief pages must
// never infer a URL from the private candidate/set tables.
const DAILY_VISUAL_PUBLICATION_COLUMNS =
  'daily_visual_set_id, candidate_id, public_url, width, height, alt_en, alt_uk, display_title_en, display_title_uk';

function toCard(
  lang: Lang,
  it: ItemRow,
  catBySlug: Map<string, { name: string; color: string | null }>,
  sourceName: string | null,
): BriefItemCard {
  const summary = pick(lang, it.summary_en, it.summary_uk);
  const why = distinctWhy(pick(lang, it.why_matters_en, it.why_matters_uk), summary) ?? '';
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
    why,
    takeaways: localizedList(lang, it.takeaways_en, it.takeaways_uk),
    actionItems: localizedList(lang, it.action_items_en, it.action_items_uk),
    sourceName: sourceName ?? citationSourceName(it.citations),
    readMinutes: readMinutesForParts([{ summary, why }]),
    tools: extractToolNames(it.tools_mentioned),
  };
}

/**
 * `articles` is not anon-readable. `search_brief_items` is the public projection
 * that already exposes `source_name` for approved items.
 */
async function publicSourceNames(lang: Lang, date: string): Promise<Map<string, string>> {
  const supabase = getSupabase();
  const names = new Map<string, string>();
  if (!supabase || !date) return names;
  const { data, error } = await supabase.rpc('search_brief_items', {
    p_query: '',
    p_lang: lang,
    p_from_date: date,
    p_to_date: date,
    p_limit: 80,
    p_offset: 0,
    p_sort: 'newest',
  });
  if (error || !data) return names;
  for (const row of data) {
    const name = row.source_name?.trim();
    if (name) names.set(row.id, name);
  }
  return names;
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
  visual: DailyVisualPublication | null;
  packs: BriefPackSection[];
  allItems: BriefItemCard[];
}

export interface DailyVisualPublication {
  visualSetId: string;
  candidateId: string;
  publicUrl: string;
  width: number;
  height: number;
  alt: string;
  displayTitle: string;
}

export interface BriefSummary {
  id: string;
  date: string;
  slug: string | null;
  title: string;
  intro: string | null;
  items: BriefItemCard[];
}

function isPublicHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Localize and validate the reader-safe projection. The writer publishes this
 * row atomically only after visual QA; the public page does not inspect a
 * candidate, a storage path, or any other private workflow state.
 */
export function dailyVisualPublicationFromRow(
  lang: Lang,
  row: DailyVisualPublicationRow | null | undefined,
): DailyVisualPublication | null {
  if (
    !row ||
    !row.daily_visual_set_id ||
    !row.candidate_id ||
    !isPublicHttpsUrl(row.public_url) ||
    row.width <= 0 ||
    row.height <= 0
  ) {
    return null;
  }
  const displayTitle = pick(lang, row.display_title_en, row.display_title_uk);
  const alt = pick(lang, row.alt_en, row.alt_uk);
  if (!displayTitle || !alt) return null;
  return {
    visualSetId: row.daily_visual_set_id,
    candidateId: row.candidate_id,
    publicUrl: row.public_url,
    width: row.width,
    height: row.height,
    alt,
    displayTitle,
  };
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
  const sourceNames = await publicSourceNames(lang, packs[0]?.date ?? '');
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

    const cards = (items ?? []).map((it) => toCard(lang, it, catBySlug, sourceNames.get(it.id) ?? null));
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

  const [{ data: packsRaw }, { data: visualRow, error: visualError }] = await Promise.all([
    supabase
      .from('briefs')
      .select(PACK_COLUMNS)
      .eq('date', anchor.date)
      .eq('status', 'published')
      .order('edition', { ascending: true }),
    supabase
      .from('daily_visual_publications')
      .select(DAILY_VISUAL_PUBLICATION_COLUMNS)
      .eq('editorial_date', anchor.date)
      .maybeSingle(),
  ]);

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
    visual: visualError ? null : dailyVisualPublicationFromRow(lang, visualRow),
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

export interface DailyBriefNeighbor {
  slug: string;
  date: string;
  title: string;
}

function toNeighbor(
  lang: Lang,
  row: { slug: string | null; date: string; title_en: string; title_uk: string } | null,
): DailyBriefNeighbor | null {
  if (!row?.slug) return null;
  return {
    slug: row.slug,
    date: row.date,
    title: pick(lang, row.title_en, row.title_uk) || row.date,
  };
}

/** Published edition-1 neighbours. No row means that side of the nav is omitted. */
export async function getAdjacentDailyBriefs(
  date: string,
  lang: Lang,
): Promise<{ previous: DailyBriefNeighbor | null; next: DailyBriefNeighbor | null }> {
  const empty = { previous: null, next: null };
  const supabase = getSupabase();
  if (!supabase || !date) return empty;

  const columns = 'date, slug, title_en, title_uk';
  const [older, newer] = await Promise.all([
    supabase
      .from('briefs')
      .select(columns)
      .eq('status', 'published')
      .eq('edition', 1)
      .lt('date', date)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('briefs')
      .select(columns)
      .eq('status', 'published')
      .eq('edition', 1)
      .gt('date', date)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    previous: older.error ? null : toNeighbor(lang, older.data),
    next: newer.error ? null : toNeighbor(lang, newer.data),
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
  return limitPrerenderPaths(paths);
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
