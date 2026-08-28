import 'server-only';

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';
import { LANGS, type Lang } from '@/lib/site';
import { weeklyRevisionTitlePresentation } from '@/lib/weekly-digest/display-title';
import { normalizeYouTubeVideo } from '@/lib/weekly-digest/video';

interface WeeklySnapshot {
  title_en: string;
  title_uk: string;
  summary_en: string;
  summary_uk: string;
  why_en: string;
  why_uk: string;
  item_slug: string;
  brief_slug: string;
  brief_date: string;
}

interface WeeklyDigestRow {
  id: string;
  week_start: string;
  week_end: string | null;
  slug: string;
  status: string;
  title_en: string;
  title_uk: string;
  intro_en: string | null;
  intro_uk: string | null;
  published_at: string | null;
  release_at: string | null;
  updated_at: string;
  published_revision_id: string | null;
}

interface WeeklyRevisionRow {
  id: string;
  weekly_digest_id: string;
  revision_number: number;
  title_en: string;
  title_uk: string;
  display_title_en: string | null;
  display_title_uk: string | null;
  intro_en: string | null;
  intro_uk: string | null;
  editor_note_en: string | null;
  editor_note_uk: string | null;
  key_takeaways_en: Json | null;
  key_takeaways_uk: Json | null;
  created_at: string;
}

interface WeeklyRevisionItemRow {
  id: string;
  revision_id: string;
  brief_item_id: string | null;
  rank: number;
  title_en: string;
  title_uk: string;
  summary_en: string;
  summary_uk: string;
  body_en: string | null;
  body_uk: string | null;
  why_en: string | null;
  why_uk: string | null;
  practical_en: string | null;
  practical_uk: string | null;
  takeaway_en: string | null;
  takeaway_uk: string | null;
  event_date: string | null;
  sources: Json;
  source_snapshot: Json;
}

interface WeeklyArtifactRow {
  id: string;
  weekly_digest_id: string;
  revision_id: string;
  revision_item_id: string | null;
  artifact_type: string;
  locale: string;
  slot_key: string;
  is_current: boolean;
  generation_status: string;
  review_status: string;
  external_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  provider_id: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  content: Json | null;
  published_at: string | null;
  updated_at: string;
}

interface LegacyDigestRow {
  id: string;
  week_start: string;
  slug: string;
  title_en: string;
  title_uk: string;
  intro_en: string | null;
  intro_uk: string | null;
  published_at: string | null;
}

export interface DigestArchiveEntry {
  id: string;
  kind: 'daily' | 'weekly';
  date: string;
  slug: string;
  title: string;
  href: string;
}

export interface WeeklyDigestImage {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface WeeklyDigestSource {
  name: string | null;
  url: string;
}

export interface WeeklyDigestVideo {
  youtubeUrl: string;
  youtubeId: string;
  thumbnailUrl: string;
  durationSeconds: number | null;
  uploadedAt: string | null;
}

export interface WeeklyDigestItemView {
  id: string;
  rank: number;
  title: string;
  summary: string;
  body: string;
  why: string;
  practicalExample: string;
  takeaway: string;
  /** Editor's-caveat sidebar copy, feature and radar stories alike. */
  limitation: string;
  /**
   * Marked editorial speculation ("Погляд редакції") -- feature stories only.
   * Empty for radar stories and any edition generated before 2026-08-06.
   */
  editorsView: string;
  /** Closing discussion question -- feature stories only, same availability as editorsView. */
  discussionQuestion: string;
  sources: WeeklyDigestSource[];
  sourceName: string | null;
  sourceUrl: string | null;
  date: string | null;
  image: WeeklyDigestImage | null;
  href: string | null;
}

export interface WeeklyDigestSibling {
  slug: string;
  title: string;
}

export interface WeeklyDigestView {
  id: string;
  revisionId: string | null;
  slug: string;
  weekStart: string;
  weekEnd: string;
  /** Concise, locale-specific title for the hero only; canonical title stays below. */
  displayTitle: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  standfirst: string | null;
  theme: string | null;
  entities: string[];
  internalLinks: Array<{ anchor: string; query: string }>;
  intro: string | null;
  editorNote: string | null;
  keyTakeaways: string[];
  publishedAt: string | null;
  modifiedAt: string;
  cover: WeeklyDigestImage | null;
  hasPdf: boolean;
  video: WeeklyDigestVideo | null;
  items: WeeklyDigestItemView[];
  previous: WeeklyDigestSibling | null;
  next: WeeklyDigestSibling | null;
}

export interface WeeklyDigestHomeView {
  id: string;
  slug: string;
  weekStart: string;
  weekEnd: string;
  title: string;
  intro: string | null;
  highlights: string[];
  cover: WeeklyDigestImage | null;
  hasPdf: boolean;
  video: WeeklyDigestVideo | null;
}

export interface PublishedPdfArtifact {
  bucket: string;
  path: string;
}

function pick(lang: Lang, en: string | null | undefined, uk: string | null | undefined) {
  return ((lang === 'uk' ? uk : en) ?? en ?? uk ?? '').trim();
}

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function stringValue(value: Json | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function articleFrame(artifact: WeeklyArtifactRow | null | undefined) {
  const content = asRecord(artifact?.content);
  const internalLinks = Array.isArray(content.internalLinks)
    ? content.internalLinks.flatMap((entry) => {
        const row = asRecord(entry);
        const anchor = stringValue(row.anchor);
        const query = stringValue(row.query);
        return anchor && query ? [{ anchor, query }] : [];
      })
    : [];
  return {
    seoTitle: stringValue(content.seoTitle),
    metaDescription: stringValue(content.metaDescription),
    ogTitle: stringValue(content.ogTitle),
    ogDescription: stringValue(content.ogDescription),
    standfirst: stringValue(content.standfirst),
    theme: stringValue(content.theme),
    entities: stringArray(content.entities),
    internalLinks,
  };
}

/**
 * Reads the editorial-voice-overhaul fields persisted alongside each revision
 * item's `source_snapshot.content_studio` (generation-worker.ts createMasterRevision)
 * -- not their own columns, so this is the one place that knows the path.
 * Absent on editions generated before 2026-08-06, hence the null-safe reads.
 */
function contentStudioFrame(value: Json | null | undefined) {
  const row = asRecord(asRecord(value).content_studio);
  return {
    limitationEn: stringValue(row.limitation_en),
    limitationUk: stringValue(row.limitation_uk),
    editorsViewEn: stringValue(row.editors_view_en),
    editorsViewUk: stringValue(row.editors_view_uk),
    discussionEn: stringValue(row.discussion_en),
    discussionUk: stringValue(row.discussion_uk),
  };
}

function numberValue(value: Json | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArray(value: Json | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()),
  );
}

function httpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function sourcesFromJson(
  sources: Json | null | undefined,
  sourceSnapshot: Json | null | undefined,
): WeeklyDigestSource[] {
  const records: Json[] = [];
  if (Array.isArray(sources)) records.push(...sources);
  else if (sources != null) records.push(sources);
  if (sourceSnapshot != null) records.push(sourceSnapshot);

  const parsed: WeeklyDigestSource[] = [];
  const seen = new Set<string>();
  for (const value of records) {
    if (typeof value === 'string') {
      const url = httpUrl(value);
      if (url && !seen.has(url)) {
        seen.add(url);
        parsed.push({ name: null, url });
      }
      continue;
    }
    const row = asRecord(value);
    const nested = asRecord(row.source);
    const url =
      httpUrl(
        stringValue(row.url) ??
          stringValue(row.source_url) ??
          stringValue(row.href) ??
          stringValue(nested.url),
      ) ?? null;
    if (!url || seen.has(url)) continue;
    const name =
      stringValue(row.name) ??
      stringValue(row.source_name) ??
      stringValue(row.publisher) ??
      stringValue(row.title) ??
      stringValue(nested.name);
    seen.add(url);
    parsed.push({ name, url });
  }

  return parsed;
}

function sourceSnapshotHref(value: Json | null | undefined, lang: Lang): string | null {
  const row = asRecord(value);
  const briefSlug = stringValue(row.brief_slug);
  const itemSlug = stringValue(row.item_slug);
  const safeSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return briefSlug && itemSlug && safeSlug.test(briefSlug) && safeSlug.test(itemSlug)
    ? `/${lang}/${briefSlug}/${itemSlug}`
    : null;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function snapshot(value: Json): WeeklySnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, Json | undefined>;
  const required = ['title_en', 'title_uk', 'summary_en', 'summary_uk', 'item_slug', 'brief_slug'];
  if (required.some((key) => typeof row[key] !== 'string')) return null;
  return {
    title_en: String(row.title_en),
    title_uk: String(row.title_uk),
    summary_en: String(row.summary_en),
    summary_uk: String(row.summary_uk),
    why_en: typeof row.why_en === 'string' ? row.why_en : '',
    why_uk: typeof row.why_uk === 'string' ? row.why_uk : '',
    item_slug: String(row.item_slug),
    brief_slug: String(row.brief_slug),
    brief_date: typeof row.brief_date === 'string' ? row.brief_date : '',
  };
}

function artifactUrl(db: SupabaseClient, artifact: WeeklyArtifactRow): string | null {
  const externalUrl = httpUrl(artifact.external_url);
  if (externalUrl) return externalUrl;
  if (!artifact.storage_bucket || !artifact.storage_path || artifact.artifact_type === 'pdf') {
    return null;
  }
  return db.storage.from(artifact.storage_bucket).getPublicUrl(artifact.storage_path).data
    .publicUrl;
}

function localizedArtifact(
  artifacts: WeeklyArtifactRow[],
  artifactType: string,
  lang: Lang,
  revisionItemId: string | null = null,
): WeeklyArtifactRow | null {
  const matches = artifacts.filter(
    (artifact) =>
      artifact.artifact_type === artifactType && artifact.revision_item_id === revisionItemId,
  );
  return (
    matches.find((artifact) => artifact.locale === lang) ??
    matches.find((artifact) => artifact.locale === 'neutral') ??
    matches[0] ??
    null
  );
}

function localeSpecificArtifact(
  artifacts: WeeklyArtifactRow[],
  artifactType: string,
  lang: Lang,
): WeeklyArtifactRow | null {
  return (
    artifacts.find(
      (artifact) =>
        artifact.artifact_type === artifactType &&
        artifact.revision_item_id == null &&
        artifact.locale === lang,
    ) ?? null
  );
}

function imageFromArtifact(
  db: SupabaseClient,
  artifact: WeeklyArtifactRow | null,
  lang: Lang,
  fallbackAlt: string,
): WeeklyDigestImage | null {
  if (!artifact) return null;
  const url = artifactUrl(db, artifact);
  if (!url) return null;
  const content = asRecord(artifact.content);
  return {
    url,
    alt:
      stringValue(content[lang === 'uk' ? 'alt_uk' : 'alt_en']) ??
      stringValue(content.alt) ??
      fallbackAlt,
    width: artifact.width ?? 1200,
    height: artifact.height ?? 630,
  };
}

function videoFromArtifacts(
  db: SupabaseClient,
  artifacts: WeeklyArtifactRow[],
  lang: Lang,
): WeeklyDigestVideo | null {
  const artifact = localizedArtifact(artifacts, 'video_final', lang);
  if (!artifact) return null;
  const content = asRecord(artifact.content);
  const youtubeUrl = httpUrl(artifact.external_url) ?? httpUrl(stringValue(content.youtube_url));
  if (!youtubeUrl) return null;
  const normalizedVideo = normalizeYouTubeVideo(youtubeUrl);
  if (!normalizedVideo) return null;
  const youtubeId = normalizedVideo.videoId;
  const thumbnailArtifact = localizedArtifact(artifacts, 'thumbnail', lang);
  const thumbnailUrl =
    (thumbnailArtifact ? artifactUrl(db, thumbnailArtifact) : null) ??
    httpUrl(stringValue(content.thumbnail_url)) ??
    normalizedVideo.thumbnailUrl;
  return {
    youtubeUrl: normalizedVideo.watchUrl,
    youtubeId,
    thumbnailUrl,
    durationSeconds: artifact.duration_seconds ?? numberValue(content.duration_seconds),
    uploadedAt: artifact.published_at,
  };
}

async function readDigestRow(
  db: SupabaseClient,
  slug: string,
): Promise<WeeklyDigestRow | LegacyDigestRow | null> {
  const modern = await db
    .from('weekly_digests')
    .select(
      'id,week_start,week_end,slug,status,title_en,title_uk,intro_en,intro_uk,published_at,release_at,updated_at,published_revision_id',
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!modern.error && modern.data) return modern.data as WeeklyDigestRow;

  // Transitional fallback: it keeps already-published v1 URLs alive until the
  // migration has backfilled immutable revision pointers.
  const legacy = await db
    .from('weekly_digests')
    .select('id,week_start,slug,title_en,title_uk,intro_en,intro_uk,published_at')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return (legacy.data as LegacyDigestRow | null) ?? null;
}

async function readPublishedRevision(
  db: SupabaseClient,
  revisionId: string,
): Promise<WeeklyRevisionRow | null> {
  const { data } = await db
    .from('weekly_digest_revisions')
    .select(
      'id,weekly_digest_id,revision_number,title_en,title_uk,display_title_en,display_title_uk,intro_en,intro_uk,editor_note_en,editor_note_uk,key_takeaways_en,key_takeaways_uk,created_at',
    )
    .eq('id', revisionId)
    .maybeSingle();
  return (data as WeeklyRevisionRow | null) ?? null;
}

async function readPublishedArtifacts(
  db: SupabaseClient,
  digestId: string,
  revisionId: string,
): Promise<WeeklyArtifactRow[] | null> {
  const { data, error } = await db
    .from('weekly_digest_artifacts')
    .select(
      'id,weekly_digest_id,revision_id,revision_item_id,artifact_type,locale,slot_key,is_current,generation_status,review_status,external_url,storage_bucket,storage_path,width,height,duration_seconds,content,published_at,updated_at',
    )
    .eq('weekly_digest_id', digestId)
    .eq('revision_id', revisionId)
    .eq('is_current', true)
    .eq('generation_status', 'ready')
    .eq('review_status', 'approved')
    .not('published_at', 'is', null);
  if (error) return null;
  return (data as WeeklyArtifactRow[] | null) ?? [];
}

async function readSibling(
  db: SupabaseClient,
  weekStart: string,
  lang: Lang,
  direction: 'previous' | 'next',
): Promise<WeeklyDigestSibling | null> {
  let query = db.from('weekly_digests').select('slug,title_en,title_uk').eq('status', 'published');
  query =
    direction === 'previous'
      ? query.lt('week_start', weekStart)
      : query.gt('week_start', weekStart);
  query = query.order('week_start', { ascending: direction === 'next' }).limit(1);
  const { data } = await query.maybeSingle();
  const row = data as { slug: string; title_en: string; title_uk: string } | null;
  return row ? { slug: row.slug, title: pick(lang, row.title_en, row.title_uk) } : null;
}

async function readLegacyDigest(
  db: SupabaseClient,
  digest: LegacyDigestRow,
  lang: Lang,
): Promise<WeeklyDigestView> {
  const { data: rows } = await db
    .from('weekly_digest_items')
    .select('brief_item_id,rank,snapshot')
    .eq('weekly_digest_id', digest.id)
    .order('rank');
  const items = (
    (rows as Array<{ brief_item_id: string; rank: number; snapshot: Json }> | null) ?? []
  ).flatMap((row): WeeklyDigestItemView[] => {
    const item = snapshot(row.snapshot);
    if (!item) return [];
    return [
      {
        id: row.brief_item_id,
        rank: row.rank,
        title: pick(lang, item.title_en, item.title_uk),
        summary: pick(lang, item.summary_en, item.summary_uk),
        body: '',
        why: pick(lang, item.why_en, item.why_uk),
        practicalExample: '',
        takeaway: '',
        limitation: '',
        editorsView: '',
        discussionQuestion: '',
        sources: [],
        sourceName: null,
        sourceUrl: null,
        date: item.brief_date || null,
        image: null,
        href: `/${lang}/${item.brief_slug}/${item.item_slug}`,
      },
    ];
  });
  const [previous, next] = await Promise.all([
    readSibling(db, digest.week_start, lang, 'previous'),
    readSibling(db, digest.week_start, lang, 'next'),
  ]);
  return {
    id: digest.id,
    revisionId: null,
    slug: digest.slug,
    weekStart: digest.week_start,
    weekEnd: addDays(digest.week_start, 6),
    displayTitle: pick(lang, digest.title_en, digest.title_uk),
    title: pick(lang, digest.title_en, digest.title_uk),
    seoTitle: pick(lang, digest.title_en, digest.title_uk),
    metaDescription: pick(lang, digest.intro_en, digest.intro_uk),
    ogTitle: pick(lang, digest.title_en, digest.title_uk),
    ogDescription: pick(lang, digest.intro_en, digest.intro_uk),
    standfirst: pick(lang, digest.intro_en, digest.intro_uk) || null,
    theme: null,
    entities: [],
    internalLinks: [],
    intro: pick(lang, digest.intro_en, digest.intro_uk) || null,
    editorNote: null,
    keyTakeaways: [],
    publishedAt: digest.published_at,
    modifiedAt: digest.published_at ?? digest.week_start,
    cover: null,
    hasPdf: false,
    video: null,
    items,
    previous,
    next,
  };
}

const getWeeklyDigestCached = cache(
  async (slug: string, lang: Lang): Promise<WeeklyDigestView | null> => {
    const typed = getSupabase();
    if (!typed) return null;
    const db = typed as unknown as SupabaseClient;
    const digest = await readDigestRow(db, slug);
    if (!digest) return null;
    if (!('published_revision_id' in digest) || !digest.published_revision_id) {
      return readLegacyDigest(db, digest, lang);
    }

    const [revision, revisionItems, artifacts, previous, next] = await Promise.all([
      readPublishedRevision(db, digest.published_revision_id),
      db
        .from('weekly_digest_revision_items')
        .select(
          'id,revision_id,brief_item_id,rank,title_en,title_uk,summary_en,summary_uk,body_en,body_uk,why_en,why_uk,practical_en,practical_uk,takeaway_en,takeaway_uk,event_date,sources,source_snapshot',
        )
        .eq('revision_id', digest.published_revision_id)
        .order('rank'),
      readPublishedArtifacts(db, digest.id, digest.published_revision_id),
      readSibling(db, digest.week_start, lang, 'previous'),
      readSibling(db, digest.week_start, lang, 'next'),
    ]);
    if (!revision || revisionItems.error || !artifacts) return null;

    const { canonicalTitle: title, displayTitle } = weeklyRevisionTitlePresentation(lang, revision);
    const rows = (revisionItems.data as WeeklyRevisionItemRow[] | null) ?? [];
    const items = rows.map((item): WeeklyDigestItemView => {
      const itemTitle = pick(lang, item.title_en, item.title_uk);
      const sources = sourcesFromJson(item.sources, item.source_snapshot);
      const primarySource = sources[0] ?? null;
      const image = imageFromArtifact(
        db,
        localizedArtifact(artifacts, 'story_image', lang, item.id),
        lang,
        itemTitle,
      );
      const studio = contentStudioFrame(item.source_snapshot);
      return {
        id: item.id,
        rank: item.rank,
        title: itemTitle,
        summary: pick(lang, item.summary_en, item.summary_uk),
        body: pick(lang, item.body_en, item.body_uk),
        why: pick(lang, item.why_en, item.why_uk),
        practicalExample: pick(lang, item.practical_en, item.practical_uk),
        takeaway: pick(lang, item.takeaway_en, item.takeaway_uk),
        limitation: pick(lang, studio.limitationEn, studio.limitationUk),
        editorsView: pick(lang, studio.editorsViewEn, studio.editorsViewUk),
        discussionQuestion: pick(lang, studio.discussionEn, studio.discussionUk),
        sources,
        sourceName: primarySource?.name ?? null,
        sourceUrl: primarySource?.url ?? null,
        date: item.event_date,
        image,
        href: sourceSnapshotHref(item.source_snapshot, lang),
      };
    });
    const cover = imageFromArtifact(db, localizedArtifact(artifacts, 'cover', lang), lang, title);
    const video = videoFromArtifacts(db, artifacts, lang);
    const hasPdf = Boolean(localeSpecificArtifact(artifacts, 'pdf', lang));
    const article = articleFrame(localeSpecificArtifact(artifacts, 'article', lang));
    const intro = pick(lang, revision.intro_en, revision.intro_uk) || null;

    return {
      id: digest.id,
      revisionId: revision.id,
      slug: digest.slug,
      weekStart: digest.week_start,
      weekEnd: digest.week_end ?? addDays(digest.week_start, 6),
      displayTitle,
      title,
      seoTitle: article.seoTitle ?? title,
      metaDescription: article.metaDescription ?? article.standfirst ?? intro ?? title,
      ogTitle: article.ogTitle ?? article.seoTitle ?? title,
      ogDescription:
        article.ogDescription ?? article.metaDescription ?? article.standfirst ?? intro ?? title,
      standfirst: article.standfirst ?? intro,
      theme: article.theme,
      entities: article.entities,
      internalLinks: article.internalLinks,
      intro,
      editorNote: pick(lang, revision.editor_note_en, revision.editor_note_uk) || null,
      keyTakeaways: stringArray(
        lang === 'uk' ? revision.key_takeaways_uk : revision.key_takeaways_en,
      ),
      publishedAt: digest.published_at,
      // Latest of: revision creation, digest row update (post-release edits),
      // and artifact updates — so dateModified never goes backwards.
      modifiedAt:
        [
          revision.created_at,
          'updated_at' in digest ? digest.updated_at : undefined,
          ...artifacts.map((a) => a.updated_at),
        ]
          .filter((v): v is string => Boolean(v))
          .sort()
          .at(-1) ?? revision.created_at,
      cover,
      hasPdf,
      video,
      items,
      previous,
      next,
    };
  },
);

export async function getWeeklyDigest(slug: string, lang: Lang): Promise<WeeklyDigestView | null> {
  return getWeeklyDigestCached(slug, lang);
}

export async function getLatestWeeklyDigest(lang: Lang): Promise<WeeklyDigestHomeView | null> {
  const typed = getSupabase();
  if (!typed) return null;
  const db = typed as unknown as SupabaseClient;
  const modern = await db
    .from('weekly_digests')
    .select('id,slug,week_start,week_end,published_revision_id')
    .eq('status', 'published')
    .not('published_revision_id', 'is', null)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = modern.data as {
    id: string;
    slug: string;
    week_start: string;
    week_end: string | null;
    published_revision_id: string;
  } | null;
  if (!row) {
    const legacy = await db
      .from('weekly_digests')
      .select('slug')
      .eq('status', 'published')
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    const slug = (legacy.data as { slug: string } | null)?.slug;
    if (!slug) return null;
    const digest = await getWeeklyDigestCached(slug, lang);
    return digest
      ? {
          id: digest.id,
          slug: digest.slug,
          weekStart: digest.weekStart,
          weekEnd: digest.weekEnd,
          title: digest.title,
          intro: digest.intro,
          highlights: digest.keyTakeaways.length
            ? digest.keyTakeaways.slice(0, 5)
            : digest.items.slice(0, 5).map((item) => item.title),
          cover: digest.cover,
          hasPdf: digest.hasPdf,
          video: digest.video,
        }
      : null;
  }

  const [revision, artifacts, highlights] = await Promise.all([
    readPublishedRevision(db, row.published_revision_id),
    readPublishedArtifacts(db, row.id, row.published_revision_id),
    db
      .from('weekly_digest_revision_items')
      .select('rank,title_en,title_uk')
      .eq('revision_id', row.published_revision_id)
      .order('rank')
      .limit(5),
  ]);
  if (!revision || !artifacts || highlights.error) return null;
  const title = pick(lang, revision.title_en, revision.title_uk);
  const keyTakeaways = stringArray(
    lang === 'uk' ? revision.key_takeaways_uk : revision.key_takeaways_en,
  );
  const itemTitles = (
    (highlights.data as Array<{ title_en: string; title_uk: string }> | null) ?? []
  ).map((item) => pick(lang, item.title_en, item.title_uk));

  return {
    id: row.id,
    slug: row.slug,
    weekStart: row.week_start,
    weekEnd: row.week_end ?? addDays(row.week_start, 6),
    title,
    intro: pick(lang, revision.intro_en, revision.intro_uk) || null,
    highlights: (keyTakeaways.length ? keyTakeaways : itemTitles).slice(0, 5),
    cover: imageFromArtifact(db, localizedArtifact(artifacts, 'cover', lang), lang, title),
    hasPdf: Boolean(localeSpecificArtifact(artifacts, 'pdf', lang)),
    video: videoFromArtifacts(db, artifacts, lang),
  };
}

export async function getPublishedPdfArtifact(
  slug: string,
  lang: Lang,
): Promise<PublishedPdfArtifact | null> {
  const typed = getSupabase();
  if (!typed) return null;
  const db = typed as unknown as SupabaseClient;
  const digest = await readDigestRow(db, slug);
  if (!digest || !('published_revision_id' in digest) || !digest.published_revision_id) {
    return null;
  }
  const artifacts = await readPublishedArtifacts(db, digest.id, digest.published_revision_id);
  if (!artifacts) return null;
  const pdf = localeSpecificArtifact(artifacts, 'pdf', lang);
  return pdf?.storage_bucket && pdf.storage_path
    ? { bucket: pdf.storage_bucket, path: pdf.storage_path }
    : null;
}

export async function getDigestArchive(lang: Lang): Promise<DigestArchiveEntry[]> {
  const typed = getSupabase();
  if (!typed) return [];
  const db = typed as unknown as SupabaseClient;
  const [{ data: dailies }, { data: weeklies }] = await Promise.all([
    db
      .from('briefs')
      .select('id,date,slug,title_en,title_uk')
      .eq('status', 'published')
      .eq('edition', 1)
      .order('date', { ascending: false })
      .limit(45),
    db
      .from('weekly_digests')
      .select('id,week_start,slug,title_en,title_uk,published_at')
      .eq('status', 'published')
      .order('week_start', { ascending: false })
      .limit(20),
  ]);
  return [
    ...((weeklies as LegacyDigestRow[] | null) ?? []).map((row) => ({
      id: row.id,
      kind: 'weekly' as const,
      date: row.week_start,
      slug: row.slug,
      title: pick(lang, row.title_en, row.title_uk),
      href: `/${lang}/weekly/${row.slug}`,
    })),
    ...(
      (dailies as Array<{
        id: string;
        date: string;
        slug: string | null;
        title_en: string | null;
        title_uk: string | null;
      }> | null) ?? []
    ).flatMap((row) =>
      row.slug
        ? [
            {
              id: row.id,
              kind: 'daily' as const,
              date: row.date,
              slug: row.slug,
              title: pick(lang, row.title_en, row.title_uk),
              href: `/${lang}/${row.slug}`,
            },
          ]
        : [],
    ),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getPublishedWeeklyDigestPaths() {
  const typed = getSupabase();
  if (!typed) return [];
  const db = typed as unknown as SupabaseClient;
  const { data } = await db.from('weekly_digests').select('slug').eq('status', 'published');
  return ((data as Array<{ slug: string }> | null) ?? []).flatMap(({ slug }) =>
    LANGS.map((lang) => ({ lang, slug })),
  );
}

export async function getWeeklySitemapEntries() {
  const typed = getSupabase();
  if (!typed) return [];
  const db = typed as unknown as SupabaseClient;
  const { data } = await db
    .from('weekly_digests')
    .select('slug,published_at,week_start,updated_at')
    .eq('status', 'published');
  return (
    (data as Array<{
      slug: string;
      published_at: string | null;
      week_start: string;
      updated_at: string;
    }> | null) ?? []
  );
}
