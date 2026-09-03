import { getSupabase } from '@/lib/supabase';
import { getCategory } from '@/lib/categories';
import { categoryMeta } from '@/lib/category-meta';
import type { IconKey } from '@/components/icons';
import { LANGS, type Lang } from '@/lib/site';
import { isWithinNewsSitemapWindow, toNewsPublicationDate } from '@/lib/sitemap-dates';
import { extractToolNames } from '@/lib/tools-mentioned';
import { cachePublicRead, limitPrerenderPaths } from '@/lib/public-content-cache';
import { excludeRelatedById, pickAdjacentStories } from '@/lib/items-nav';

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
  /** Generated brand card illustration (AI hero) — background of the OG card. */
  cardImageUrl: string | null;
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
   * `/news/{categorySlug}/{itemSlug}` this page should actually live at, when
   * that differs from what was requested — either the earliest copy of a
   * later re-publication, or the item's category drifted after publish. The
   * page redirects there instead of rendering under a stale URL.
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

/**
 * One published item by its own slug (globally unique — see migration
 * `20260724120000`) + lang. The URL's category segment is display data, not
 * a lookup key: `canonicalPath` is set whenever it drifts from the item's
 * real category (edited after publish) or the item is a later
 * re-publication, so the page can redirect to the truth instead of 404ing or
 * rendering under a stale category.
 */
async function loadNewsItem(
  categorySlug: string,
  itemSlug: string,
  lang: Lang,
): Promise<BriefItemDetail | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  // A handful of pre-2026-06-12 rows (before cross-day dedup existed) share a
  // slug with their own canonical primary — `nullsFirst` prefers that primary
  // (canonical_item_id IS NULL) when one is among the matches; either way the
  // row below either IS the canonical item or points at one via
  // canonical_item_id, so a single result is always enough to resolve.
  const { data: matches, error: itemError } = await supabase
    .from('brief_items')
    .select(
      'id, slug, rank, brief_id, article_id, canonical_item_id, category_slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, deep_dive_en, deep_dive_uk, body_md_en, body_md_uk, facts_en, facts_uk, code_snippet, when_to_use_en, when_to_use_uk, when_not_to_use_en, when_not_to_use_uk, community_reactions, citations, image_url, card_image_url, editor_take, takeaways_en, takeaways_uk, action_items_en, action_items_uk, impact_level, tools_mentioned, youtube_url, briefs!brief_items_brief_id_fkey(id, slug, date, published_at, status)',
    )
    .eq('slug', itemSlug)
    .order('canonical_item_id', { ascending: true, nullsFirst: true })
    .limit(1);
  const it = matches?.[0];
  if (itemError || !it?.slug) return null;

  const brief = it.briefs as {
    id: string;
    slug: string | null;
    date: string;
    published_at: string | null;
    status: string;
  } | null;
  if (!brief || brief.status !== 'published' || !brief.slug) return null;

  // Later re-publication of an already-covered story → the page redirects to
  // the earliest copy instead of competing with it in the index. Otherwise,
  // a category edited after publish drifts the URL segment from the truth —
  // redirect there instead of rendering under the stale one.
  let canonicalPath: string | null = null;
  if (it.canonical_item_id) {
    const { data: primary } = await supabase
      .from('brief_items')
      .select('slug, category_slug, briefs!brief_items_brief_id_fkey(status)')
      .eq('id', it.canonical_item_id)
      .maybeSingle();
    const primaryBrief = primary?.briefs as { status: string } | null;
    if (primary?.slug && primary.category_slug && primaryBrief?.status === 'published') {
      canonicalPath = `/news/${primary.category_slug}/${primary.slug}`;
    }
  } else if (it.category_slug && it.category_slug !== categorySlug) {
    canonicalPath = `/news/${it.category_slug}/${it.slug}`;
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
    cardImageUrl:
      typeof it.card_image_url === 'string' && it.card_image_url.startsWith('http')
        ? it.card_image_url
        : null,
    editorTake: (it.editor_take ?? '').trim(),
    takeaways: toStringArray(lang === 'uk' ? it.takeaways_uk : it.takeaways_en),
    actionItems: toStringArray(lang === 'uk' ? it.action_items_uk : it.action_items_en),
    impactLevel: parseImpactLevel(it.impact_level),
    tools: extractToolNames(it.tools_mentioned),
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

export const getNewsItem = cachePublicRead('news-item', loadNewsItem);

/**
 * Legacy pack-scoped path (`/:briefSlug/:itemSlug`, pre-2026-07-24) → current
 * canonical path (`/news/:categorySlug/:itemSlug`), following a cross-day
 * republish to its primary so old links redirect in a single hop. `null`
 * when the pack or item was never published — a dead legacy link.
 */
export async function resolveLegacyItemPath(
  briefSlug: string,
  itemSlug: string,
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: brief } = await supabase
    .from('briefs')
    .select('id')
    .eq('slug', briefSlug)
    .eq('status', 'published')
    .maybeSingle();
  if (!brief) return null;

  const { data: it } = await supabase
    .from('brief_items')
    .select('slug, category_slug, canonical_item_id')
    .eq('brief_id', brief.id)
    .eq('slug', itemSlug)
    .maybeSingle();
  if (!it?.slug) return null;

  if (it.canonical_item_id) {
    const { data: primary } = await supabase
      .from('brief_items')
      .select('slug, category_slug, briefs!brief_items_brief_id_fkey(status)')
      .eq('id', it.canonical_item_id)
      .maybeSingle();
    const primaryBrief = primary?.briefs as { status: string } | null;
    if (primary?.slug && primary.category_slug && primaryBrief?.status === 'published') {
      return `/news/${primary.category_slug}/${primary.slug}`;
    }
  }

  return it.category_slug ? `/news/${it.category_slug}/${it.slug}` : null;
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
async function loadBriefStoryRows(briefId: string) {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from('brief_items')
    .select('slug, rank, title_en, title_uk, category_slug')
    .eq('brief_id', briefId)
    .is('canonical_item_id', null)
    .order('rank', { ascending: true });
  return data ?? [];
}

const getBriefStoryRows = cachePublicRead('brief-story-rows', loadBriefStoryRows);

export async function getAdjacentStories(
  briefId: string,
  rank: number,
  lang: Lang,
): Promise<{ prev: AdjacentStory | null; next: AdjacentStory | null }> {
  const rows = await getBriefStoryRows(briefId);
  return pickAdjacentStories(rows, rank, lang);
}

type RelatedStoryRow = {
  id: string;
  href: string;
  title: string;
  date: string;
  rank: number;
};

async function loadRelatedStoryBundle(
  lang: Lang,
  categorySlug: string,
): Promise<{
  categoryName: string | null;
  categoryColor: string | null;
  rows: RelatedStoryRow[];
}> {
  const empty = { categoryName: null, categoryColor: null, rows: [] as RelatedStoryRow[] };
  const supabase = getSupabase();
  if (!supabase) return empty;

  const category = await getCategory(categorySlug, lang);

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, slug, date')
    .eq('status', 'published')
    .order('date', { ascending: false })
    .limit(12);
  if (!briefs || briefs.length === 0) {
    return {
      categoryName: category?.name ?? null,
      categoryColor: category?.color ?? null,
      rows: [],
    };
  }

  const briefById = new Map(briefs.map((b) => [b.id, b]));
  const { data: rows } = await supabase
    .from('brief_items')
    .select('id, slug, brief_id, rank, title_en, title_uk, category_slug')
    .eq('category_slug', categorySlug)
    .in(
      'brief_id',
      briefs.map((b) => b.id),
    )
    .is('canonical_item_id', null);

  const staged: RelatedStoryRow[] = [];
  for (const it of rows ?? []) {
    const brief = briefById.get(it.brief_id);
    if (!brief || !it.slug) continue;
    const title = pick(lang, it.title_en, it.title_uk);
    if (!title) continue;
    staged.push({
      id: it.id,
      href: `/${lang}/news/${categorySlug}/${it.slug}`,
      title,
      date: brief.date,
      rank: it.rank,
    });
  }

  staged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.rank - b.rank));

  return {
    categoryName: category?.name ?? null,
    categoryColor: category?.color ?? null,
    rows: staged,
  };
}

const getRelatedStoryBundle = cachePublicRead('related-story-bundle', loadRelatedStoryBundle);

/** Recent stories in the same category, excluding the current item. */
export async function getRelatedStories(
  lang: Lang,
  categorySlug: string,
  excludeId: string,
  limit = 4,
): Promise<RelatedStory[]> {
  const { categoryName, categoryColor, rows } = await getRelatedStoryBundle(lang, categorySlug);
  return excludeRelatedById(rows, excludeId)
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      href: r.href,
      title: r.title,
      categoryName,
      categoryColor,
    }));
}

/**
 * PostgREST caps a response at 1000 rows; once brief_items grows past that,
 * an unpaged select would silently truncate the sitemap. Pages through a
 * range-aware query until a short page signals the end.
 */
async function fetchAllPages<Row>(
  page: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error || !data) break; // partial result — same degraded mode as a failed single read
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

export interface NewsSitemapEntry {
  lang: Lang;
  category: string;
  item: string;
  title: string;
  /** W3C datetime for Google News (UTC, no offset). */
  publicationDate: string;
}

/** Published items with titles and dates for Google News sitemap. */
async function loadPublishedNewsSitemapEntries(): Promise<NewsSitemapEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, date, published_at')
    .eq('status', 'published');
  if (!briefs?.length) return [];

  const briefById = new Map(briefs.map((b) => [b.id, b]));
  const briefIds = briefs.map((b) => b.id);
  const rows = await fetchAllPages((from, to) =>
    supabase
      .from('brief_items')
      .select('slug, brief_id, category_slug, title_en, title_uk, canonical_item_id')
      .in('brief_id', briefIds)
      .order('id', { ascending: true })
      .range(from, to),
  );

  const entries: NewsSitemapEntry[] = [];
  for (const row of rows) {
    const brief = briefById.get(row.brief_id);
    if (!brief || !row.slug || !row.category_slug) continue;
    if (row.canonical_item_id) continue; // re-publication — redirects to the original
    const publicationDate = toNewsPublicationDate(brief.published_at, brief.date);
    if (!isWithinNewsSitemapWindow(publicationDate)) continue;
    for (const lang of LANGS) {
      entries.push({
        lang,
        category: row.category_slug,
        item: row.slug,
        title: pick(lang, row.title_en, row.title_uk) || row.slug,
        publicationDate,
      });
    }
  }
  return entries;
}

export const getPublishedNewsSitemapEntries = cachePublicRead(
  'news-sitemap-entries',
  loadPublishedNewsSitemapEntries,
);

export interface ItemSitemapEntry {
  lang: string;
  category: string;
  item: string;
  /** Publish timestamp of the parent brief (falls back to the brief date). */
  lastModified: string;
}

/** Published item paths + parent-brief publish dates — sitemap entries with lastmod. */
async function loadPublishedItemSitemapEntries(): Promise<ItemSitemapEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, date, published_at')
    .eq('status', 'published');
  if (!briefs || briefs.length === 0) return [];

  const briefById = new Map(briefs.map((b) => [b.id, b]));
  const briefIds = briefs.map((b) => b.id);
  const items = await fetchAllPages((from, to) =>
    supabase
      .from('brief_items')
      .select('slug, brief_id, category_slug, canonical_item_id')
      .in('brief_id', briefIds)
      .order('id', { ascending: true })
      .range(from, to),
  );

  const entries: ItemSitemapEntry[] = [];
  for (const it of items) {
    const brief = briefById.get(it.brief_id);
    if (!brief || !it.slug || !it.category_slug) continue;
    if (it.canonical_item_id) continue; // re-publication — redirects to the original
    for (const lang of LANGS) {
      entries.push({
        lang,
        category: it.category_slug,
        item: it.slug,
        lastModified: brief.published_at ?? brief.date,
      });
    }
  }
  return entries;
}

export const getPublishedItemSitemapEntries = cachePublicRead(
  'item-sitemap-entries',
  loadPublishedItemSitemapEntries,
);

/**
 * All published (lang, category, item) slug paths — for build-time SSG.
 * Empty without env. Canonicalized re-publications are excluded: next.config
 * already 308s them at the edge, so prerendering them would be wasted work.
 */
export async function getPublishedItemPaths(): Promise<
  { lang: string; category: string; item: string }[]
> {
  const entries = await getPublishedItemSitemapEntries();
  return limitPrerenderPaths(
    entries.map(({ lang, category, item }) => ({ lang, category, item })),
  );
}
