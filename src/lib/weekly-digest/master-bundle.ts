import type { Json } from '@/lib/database.types';
import {
  placementForRank,
  type WeeklyArticleMaster,
  type WeeklyMasterBundle,
  type WeeklyMasterStory,
} from './content-studio';

export interface WeeklyMasterBundleRevision {
  title_en: string;
  title_uk: string;
  intro_en: string | null;
  intro_uk: string | null;
  editor_note_en: string | null;
  editor_note_uk: string | null;
  key_takeaways_en: Json | null;
  key_takeaways_uk: Json | null;
}

export interface WeeklyMasterBundleItem {
  id: string;
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
  source_snapshot: Json;
}

export interface WeeklyMasterBundleArtifact {
  artifact_type: string;
  locale: string | null;
  is_current: boolean;
  content: Json;
}

/**
 * Minimal context for social / video_script / PDF / LinkedIn. The generation
 * worker loads this from the active revision; tests pass the 2026-08-17
 * production shape (normalized article without `stories`).
 */
export interface WeeklyMasterBundleContext {
  revision: WeeklyMasterBundleRevision;
  items: WeeklyMasterBundleItem[];
  artifacts: WeeklyMasterBundleArtifact[];
}

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function text(value: Json | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: Json | null | undefined) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

function firstNonEmptyText(...values: Array<Json | null | undefined>) {
  for (const value of values) {
    const resolved = text(value ?? undefined);
    if (resolved) return resolved;
  }
  return null;
}

function requiredMasterText(
  locale: 'en' | 'uk',
  field: string,
  ...values: Array<Json | null | undefined>
) {
  const resolved = firstNonEmptyText(...values);
  if (resolved) return resolved;
  throw new Error(`Approved ${locale.toUpperCase()} article is missing ${field}.`);
}

function masterInternalLinks(value: Json | null | undefined) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const link = asRecord(entry);
    const anchor = text(link.anchor);
    const query = text(link.query);
    return anchor && query ? [{ anchor, query }] : [];
  });
}

function revisionStudio(item: { source_snapshot?: Json | null }) {
  return asRecord(asRecord(item.source_snapshot).content_studio);
}

function revisionStudioText(
  studio: Record<string, Json | undefined>,
  locale: 'en' | 'uk',
  enKey: string,
  ukKey: string,
) {
  return firstNonEmptyText(locale === 'uk' ? studio[ukKey] : studio[enKey]) ?? '';
}

function approvedFactsForItem(item: {
  rank: number;
  summary_en: string;
  why_en: string | null;
  source_snapshot: Json;
}) {
  const snapshot = asRecord(item.source_snapshot);
  const facts = Array.isArray(snapshot.facts_en)
    ? snapshot.facts_en.flatMap((entry) => {
        if (typeof entry === 'string') return [entry];
        const row = asRecord(entry);
        return [text(row.fact), text(row.text), text(row.claim), text(row.value)]
          .filter((value): value is string => Boolean(value))
          .slice(0, 1);
      })
    : [];
  return [item.summary_en, item.why_en ?? '', ...facts]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter(
      (value, index, all) =>
        all.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index,
    )
    .slice(0, 10)
    .map((claim, index) => ({
      id: `W${item.rank}-C${index + 1}`,
      text: claim,
      evidenceUrls: [] as string[],
    }));
}

function revisionStoryClaimIds(
  stored: Record<string, Json | undefined>,
  studio: Record<string, Json | undefined>,
  item: {
    rank: number;
    summary_en: string;
    why_en: string | null;
    source_snapshot: Json;
  },
) {
  const fromStored = stringArray(stored.claimIds);
  if (fromStored.length > 0) return fromStored;
  const fromStudio = stringArray(studio.claim_ids);
  if (fromStudio.length > 0) return fromStudio;
  return approvedFactsForItem(item).map((claim) => claim.id);
}

function masterStoriesFromRevision(
  context: WeeklyMasterBundleContext,
  locale: 'en' | 'uk',
  persisted: Json | null | undefined,
): WeeklyMasterStory[] {
  const persistedStories = Array.isArray(persisted) ? persisted.map(asRecord) : [];
  const localized = (en: string | null, uk: string | null) => (locale === 'uk' ? uk : en) ?? '';
  return context.items.map((item, index) => {
    const stored =
      persistedStories.find((story) => text(story.revisionItemId) === item.id) ??
      persistedStories[index] ??
      {};
    const studio = revisionStudio(item);
    const fromStored = (field: string, fallback: string) =>
      firstNonEmptyText(stored[field], fallback) ?? '';
    const headline = fromStored('headline', localized(item.title_en, item.title_uk));
    const summary = fromStored('summary', localized(item.summary_en, item.summary_uk));
    return {
      revisionItemId: item.id,
      placement: placementForRank(item.rank),
      headline,
      summary,
      hook: fromStored('hook', revisionStudioText(studio, locale, 'hook_en', 'hook_uk') || summary),
      body: fromStored('body', localized(item.body_en, item.body_uk)),
      why: fromStored('why', localized(item.why_en, item.why_uk)),
      practical: fromStored('practical', localized(item.practical_en, item.practical_uk)),
      limitation: fromStored(
        'limitation',
        revisionStudioText(studio, locale, 'limitation_en', 'limitation_uk'),
      ),
      takeaway: fromStored('takeaway', localized(item.takeaway_en, item.takeaway_uk)),
      claimIds: revisionStoryClaimIds(stored, studio, item),
      editorsView: fromStored(
        'editorsView',
        revisionStudioText(studio, locale, 'editors_view_en', 'editors_view_uk'),
      ),
      discussionQuestion: fromStored(
        'discussionQuestion',
        revisionStudioText(studio, locale, 'discussion_en', 'discussion_uk'),
      ),
    };
  });
}

function masterArticleFromArtifact(
  context: WeeklyMasterBundleContext,
  artifact: WeeklyMasterBundleArtifact,
  locale: 'en' | 'uk',
): WeeklyArticleMaster {
  const content = asRecord(artifact.content);
  const localizedRevision = (en: string | null, uk: string | null) => (locale === 'uk' ? uk : en);
  const artifactTakeaways = [content.keyTakeaways, content.key_takeaways]
    .map((value) => stringArray(value))
    .find((value) => value.length > 0);
  const keyTakeaways =
    artifactTakeaways ??
    stringArray(
      locale === 'uk' ? context.revision.key_takeaways_uk : context.revision.key_takeaways_en,
    );
  if (!keyTakeaways.length) {
    throw new Error(`Approved ${locale.toUpperCase()} article is missing key takeaways.`);
  }
  const editorNote = requiredMasterText(
    locale,
    'editorNote',
    content.editorNote,
    content.editor_note,
    localizedRevision(context.revision.editor_note_en, context.revision.editor_note_uk),
  );
  return {
    locale,
    title: requiredMasterText(
      locale,
      'title',
      content.title,
      localizedRevision(context.revision.title_en, context.revision.title_uk),
    ),
    seoTitle: requiredMasterText(locale, 'seoTitle', content.seoTitle, content.seo_title),
    metaDescription: requiredMasterText(
      locale,
      'metaDescription',
      content.metaDescription,
      content.meta_description,
    ),
    ogTitle: requiredMasterText(locale, 'ogTitle', content.ogTitle, content.og_title),
    ogDescription: requiredMasterText(
      locale,
      'ogDescription',
      content.ogDescription,
      content.og_description,
    ),
    standfirst: requiredMasterText(locale, 'standfirst', content.standfirst),
    theme: requiredMasterText(locale, 'theme', content.theme),
    intro: requiredMasterText(
      locale,
      'intro',
      content.intro,
      localizedRevision(context.revision.intro_en, context.revision.intro_uk),
    ),
    editorNote,
    keyTakeaways,
    topics: stringArray(content.topics),
    entities: stringArray(content.entities),
    internalLinks: masterInternalLinks(content.internalLinks ?? content.internal_links),
    conclusion: requiredMasterText(locale, 'conclusion', content.conclusion, editorNote),
    stories: masterStoriesFromRevision(context, locale, content.stories),
  };
}

/**
 * Article artifacts may be stored in either the rich Content Studio shape or
 * the normalized revision shape. Rehydrate stories from the active revision
 * so social, video and PDF jobs work with both representations.
 */
export function masterBundleFromArtifacts(context: WeeklyMasterBundleContext): WeeklyMasterBundle {
  const articleEn = context.artifacts.find(
    (artifact) =>
      artifact.artifact_type === 'article' && artifact.locale === 'en' && artifact.is_current,
  );
  const articleUk = context.artifacts.find(
    (artifact) =>
      artifact.artifact_type === 'article' && artifact.locale === 'uk' && artifact.is_current,
  );
  if (!articleEn || !articleUk) {
    throw new Error('Approved master article artifacts are required.');
  }
  return {
    en: masterArticleFromArtifact(context, articleEn, 'en'),
    uk: masterArticleFromArtifact(context, articleUk, 'uk'),
  };
}

/** Alias used by downstream jobs and the release-graph regression test. */
export function loadWeeklyStoriesForDownstream(
  context: WeeklyMasterBundleContext,
): WeeklyMasterBundle {
  return masterBundleFromArtifacts(context);
}
