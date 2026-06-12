import { getSupabase } from '@/lib/supabase';
import { getCategory } from '@/lib/categories';
import { categoryMeta } from '@/lib/category-meta';
import type { IconKey } from '@/components/icons';
import { LANGS, type Lang } from '@/lib/site';
import { isWithinNewsSitemapWindow, toNewsPublicationDate } from '@/lib/sitemap-dates';

function pick(lang: Lang, en: string | null, uk: string | null): string {
  const primary = lang === 'uk' ? uk : en;
  return (primary ?? en ?? uk ?? '').trim();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

export type ItemImpactLevel = 'low' | 'medium' | 'high';

export type ItemFact = { label: string; value: string };
export type ItemCodeSnippet = { language: string; code: string };
export type ItemReaction = { author: string; quote: string; url: string };
export type ItemCitation = { title: string; url: string };

export interface BriefItemDetail {
  id: string;
  rank: number;
  briefId: string;
  briefSlug: string;
  briefDate: string;
  itemSlug: string;
  categorySlug: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: IconKey;
  title: string;
  summary: string;
  why: string;
  deepDive: string;
  /** Markdown body (Phase 1 pipeline); empty for legacy items → render deepDive. */
  bodyMd: string;
  facts: ItemFact[];
  codeSnippet: ItemCodeSnippet | null;
  whenToUse: string[];
  whenNotToUse: string[];
  communityReactions: ItemReaction[];
  citations: ItemCitation[];
  imageUrl: string | null;
  editorTake: string;
  takeaways: string[];
  actionItems: string[];
  impactLevel: ItemImpactLevel | null;
  tools: string[];
  hasVideo: boolean;
  youtubeUrl: string | null;
  readMinutes: number;
  publishedAt: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  /**
   * `/{briefSlug}/{itemSlug}` of the earliest publication of the same story,
   * when this item is a later re-publication — the page redirects there.
   */
  canonicalPath: string | null;
}

function toFacts(value: unknown): ItemFact[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const o = (v ?? {}) as Record<string, unknown>;
      return {
        label: typeof o.label === 'string' ? o.label.trim() : '',
        value: typeof o.value === 'string' ? o.value.trim() : '',
      };
    })
    .filter((f) => f.label && f.value);
}

function toCodeSnippet(value: unknown): ItemCodeSnippet | null {
  if (typeof value !== 'object' || value === null) return null;
  const o = value as Record<string, unknown>;
  const code = typeof o.code === 'string' ? o.code.trim() : '';
  if (!code) return null;
  return { language: typeof o.language === 'string' && o.language ? o.language : 'bash', code };
}

function toReactions(value: unknown): ItemReaction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const o = (v ?? {}) as Record<string, unknown>;
      return {
        author: typeof o.author === 'string' ? o.author.trim() : '',
        quote: typeof o.quote === 'string' ? o.quote.trim() : '',
        url: typeof o.url === 'string' ? o.url.trim() : '',
      };
    })
    .filter((r) => r.quote && r.url.startsWith('http'));
}

function toCitations(value: unknown): ItemCitation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const o = (v ?? {}) as Record<string, unknown>;
      return {
        title: typeof o.title === 'string' ? o.title.trim() : '',
        url: typeof o.url === 'string' ? o.url.trim() : '',
      };
    })
    .filter((c) => c.url.startsWith('http'));
}

function parseImpactLevel(value: string | null): ItemImpactLevel | null {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return null;
}

export interface RelatedStory {
  id: string;
  href: string;
  title: string;
  categoryName: string | null;
  categoryColor: string | null;
}

function toToolNames(value: unknown): string[] {
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

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** YouTube video id from watch/short/embed URLs, or null. */
export function youtubeVideoId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m?.[1] ?? null;
}

function deepDiveParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
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
      'id, slug, rank, article_id, canonical_item_id, category_slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, deep_dive_en, deep_dive_uk, body_md_en, body_md_uk, facts_en, facts_uk, code_snippet, when_to_use_en, when_to_use_uk, when_not_to_use_en, when_not_to_use_uk, community_reactions, citations, image_url, editor_take, takeaways_en, takeaways_uk, action_items_en, action_items_uk, impact_level, tools_mentioned, youtube_url',
    )
    .eq('brief_id', brief.id)
    .eq('slug', itemSlug)
    .maybeSingle();
  if (itemError || !it?.slug) return null;

  // Later re-publication of an already-covered story → the page redirects to
  // the earliest copy instead of competing with it in the index.
  let canonicalPath: string | null = null;
  if (it.canonical_item_id) {
    const { data: primary } = await supabase
      .from('brief_items')
      .select('slug, briefs!brief_items_brief_id_fkey(slug, status)')
      .eq('id', it.canonical_item_id)
      .maybeSingle();
    const primaryBrief = primary?.briefs as { slug: string | null; status: string } | null;
    if (primary?.slug && primaryBrief?.slug && primaryBrief.status === 'published') {
      canonicalPath = `/${primaryBrief.slug}/${primary.slug}`;
    }
  }

  const category = it.category_slug ? await getCategory(it.category_slug, lang) : null;

  const { data: article } = await supabase
    .from('articles')
    .select('source_name, source_url, url')
    .eq('id', it.article_id)
    .maybeSingle();

  const summary = pick(lang, it.summary_en, it.summary_uk);
  const why = pick(lang, it.why_matters_en, it.why_matters_uk);
  const deepDive = pick(lang, it.deep_dive_en, it.deep_dive_uk);
  const bodyMd = pick(lang, it.body_md_en, it.body_md_uk);
  const meta = categoryMeta(it.category_slug);

  return {
    id: it.id,
    rank: it.rank,
    briefId: brief.id,
    briefSlug: brief.slug,
    briefDate: brief.date,
    itemSlug: it.slug,
    categorySlug: it.category_slug,
    categoryName: category?.name ?? null,
    categoryColor: category?.color ?? null,
    categoryIcon: meta.icon,
    title: pick(lang, it.title_en, it.title_uk) || summary,
    summary,
    why: why || summary,
    deepDive,
    bodyMd,
    facts: toFacts(lang === 'uk' ? it.facts_uk : it.facts_en),
    codeSnippet: toCodeSnippet(it.code_snippet),
    whenToUse: toStringArray(lang === 'uk' ? it.when_to_use_uk : it.when_to_use_en),
    whenNotToUse: toStringArray(lang === 'uk' ? it.when_not_to_use_uk : it.when_not_to_use_en),
    communityReactions: toReactions(it.community_reactions),
    citations: toCitations(it.citations),
    imageUrl: typeof it.image_url === 'string' && it.image_url.startsWith('http') ? it.image_url : null,
    editorTake: (it.editor_take ?? '').trim(),
    takeaways: toStringArray(lang === 'uk' ? it.takeaways_uk : it.takeaways_en),
    actionItems: toStringArray(lang === 'uk' ? it.action_items_uk : it.action_items_en),
    impactLevel: parseImpactLevel(it.impact_level),
    tools: toToolNames(it.tools_mentioned),
    hasVideo: Boolean(it.youtube_url),
    youtubeUrl: it.youtube_url ?? null,
    readMinutes: Math.max(
      2,
      Math.round(
        (wordCount(summary) +
          wordCount(why) +
          wordCount(bodyMd || deepDiveParagraphs(deepDive).join(' '))) /
          45,
      ),
    ),
    publishedAt: brief.published_at,
    sourceName: article?.source_name ?? null,
    sourceUrl: article?.url ?? article?.source_url ?? null,
    canonicalPath,
  };
}

export interface AdjacentStory {
  href: string;
  title: string;
}

/**
 * Previous/next story within the same brief by rank — issue-order browsing.
 * RLS limits anon reads to approved items of published briefs, so unapproved
 * neighbours are skipped naturally.
 */
export async function getAdjacentStories(
  briefId: string,
  briefSlug: string,
  rank: number,
  lang: Lang,
): Promise<{ prev: AdjacentStory | null; next: AdjacentStory | null }> {
  const supabase = getSupabase();
  if (!supabase) return { prev: null, next: null };

  const { data } = await supabase
    .from('brief_items')
    .select('slug, rank, title_en, title_uk')
    .eq('brief_id', briefId)
    .neq('rank', rank)
    .order('rank', { ascending: true });

  let prev: AdjacentStory | null = null;
  let next: AdjacentStory | null = null;
  for (const row of data ?? []) {
    if (!row.slug) continue;
    const title = pick(lang, row.title_en, row.title_uk);
    if (!title) continue;
    const story = { href: `/${lang}/${briefSlug}/${row.slug}`, title };
    if (row.rank < rank) prev = story; // keep the closest one below
    else if (!next) next = story; // first one above
  }
  return { prev, next };
}

/** Recent stories in the same category, excluding the current item. */
export async function getRelatedStories(
  lang: Lang,
  categorySlug: string,
  excludeId: string,
  limit = 4,
): Promise<RelatedStory[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const category = await getCategory(categorySlug, lang);

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, slug, date')
    .eq('status', 'published')
    .order('date', { ascending: false })
    .limit(12);
  if (!briefs || briefs.length === 0) return [];

  const briefById = new Map(briefs.map((b) => [b.id, b]));
  const { data: rows } = await supabase
    .from('brief_items')
    .select('id, slug, brief_id, rank, title_en, title_uk, category_slug')
    .eq('category_slug', categorySlug)
    .neq('id', excludeId)
    .in(
      'brief_id',
      briefs.map((b) => b.id),
    );

  const staged: { id: string; href: string; title: string; date: string; rank: number }[] = [];
  for (const it of rows ?? []) {
    const brief = briefById.get(it.brief_id);
    if (!brief?.slug || !it.slug) continue;
    const title = pick(lang, it.title_en, it.title_uk);
    if (!title) continue;
    staged.push({
      id: it.id,
      href: `/${lang}/${brief.slug}/${it.slug}`,
      title,
      date: brief.date,
      rank: it.rank,
    });
  }

  staged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.rank - b.rank));

  return staged.slice(0, limit).map((r) => ({
    id: r.id,
    href: r.href,
    title: r.title,
    categoryName: category?.name ?? null,
    categoryColor: category?.color ?? null,
  }));
}

export interface NewsSitemapEntry {
  lang: Lang;
  brief: string;
  item: string;
  title: string;
  /** W3C datetime for Google News (UTC, no offset). */
  publicationDate: string;
}

/** Published items with titles and dates for Google News sitemap. */
export async function getPublishedNewsSitemapEntries(): Promise<NewsSitemapEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, slug, date, published_at')
    .eq('status', 'published');
  if (!briefs?.length) return [];

  const briefById = new Map(briefs.map((b) => [b.id, b]));
  const { data: rows } = await supabase
    .from('brief_items')
    .select('slug, brief_id, title_en, title_uk, canonical_item_id')
    .in(
      'brief_id',
      briefs.map((b) => b.id),
    );

  const entries: NewsSitemapEntry[] = [];
  for (const row of rows ?? []) {
    const brief = briefById.get(row.brief_id);
    if (!brief?.slug || !row.slug) continue;
    if (row.canonical_item_id) continue; // re-publication — redirects to the original
    const publicationDate = toNewsPublicationDate(brief.published_at, brief.date);
    if (!isWithinNewsSitemapWindow(publicationDate)) continue;
    for (const lang of LANGS) {
      entries.push({
        lang,
        brief: brief.slug,
        item: row.slug,
        title: pick(lang, row.title_en, row.title_uk) || row.slug,
        publicationDate,
      });
    }
  }
  return entries;
}

export interface ItemSitemapEntry {
  lang: string;
  brief: string;
  item: string;
  /** Publish timestamp of the parent brief (falls back to the brief date). */
  lastModified: string;
}

/** Published item paths + parent-brief publish dates — sitemap entries with lastmod. */
export async function getPublishedItemSitemapEntries(): Promise<ItemSitemapEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, slug, date, published_at')
    .eq('status', 'published');
  if (!briefs || briefs.length === 0) return [];

  const briefById = new Map(briefs.map((b) => [b.id, b]));
  const { data: items } = await supabase
    .from('brief_items')
    .select('slug, brief_id, canonical_item_id')
    .in(
      'brief_id',
      briefs.map((b) => b.id),
    );

  const entries: ItemSitemapEntry[] = [];
  for (const it of items ?? []) {
    const brief = briefById.get(it.brief_id);
    if (!brief?.slug || !it.slug) continue;
    if (it.canonical_item_id) continue; // re-publication — redirects to the original
    for (const lang of LANGS) {
      entries.push({
        lang,
        brief: brief.slug,
        item: it.slug,
        lastModified: brief.published_at ?? brief.date,
      });
    }
  }
  return entries;
}

/** All published (lang, brief, item) slug paths — for build-time SSG. Empty without env. */
export async function getPublishedItemPaths(): Promise<
  { lang: string; brief: string; item: string }[]
> {
  const entries = await getPublishedItemSitemapEntries();
  return entries.map(({ lang, brief, item }) => ({ lang, brief, item }));
}
