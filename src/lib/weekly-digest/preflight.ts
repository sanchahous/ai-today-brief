import type { SocialChannel, SocialLocale } from '@/lib/social/types';
import { WEEKLY_SOCIAL_MATRIX } from './social-matrix';

export { WEEKLY_SOCIAL_MATRIX } from './social-matrix';

/** Workspace tab the editor should open to clear a preflight blocker. */
export type WeeklyPreflightTab =
  | 'overview'
  | 'stories'
  | 'research'
  | 'article'
  | 'visuals'
  | 'social'
  | 'pdf'
  | 'video'
  | 'release';

export type WeeklyArtifactType =
  | 'research_pack'
  | 'content_quality_report'
  | 'article'
  | 'pdf'
  | 'cover'
  | 'story_image'
  | 'video_script'
  | 'video_manifest'
  | 'video_preview'
  | 'video_final'
  | 'captions'
  | 'thumbnail'
  | 'heygen_preview'
  | 'graphics_preview'
  | 'social_asset';

export interface WeeklyPreflightArtifact {
  artifactType: WeeklyArtifactType;
  locale?: SocialLocale | null;
  storyId?: string | null;
  approved?: boolean;
  generationStatus?: string | null;
  reviewStatus?: string | null;
  status?: string | null;
  stale?: boolean;
  /**
   * Content-sim gate for story_image / cover. `undefined` = legacy artifact
   * without a sim report (grandfathered). `false` blocks release until the
   * image loop passes or the owner overrides after escalation.
   */
  contentSimCleared?: boolean;
}

export interface WeeklyPreflightSocial {
  channel: SocialChannel;
  locale: SocialLocale;
  publishEnabled: boolean;
  disabledReason?: string | null;
  disabledByOwner?: boolean;
  manualDocumentStatus?: string | null;
  approved?: boolean;
  status?: string | null;
}

export interface WeeklyPreflightInput {
  storyIds: string[];
  artifacts: WeeklyPreflightArtifact[];
  social: WeeklyPreflightSocial[];
  localeMap?: Partial<Record<SocialChannel, SocialLocale>>;
}

export interface WeeklyPreflightBlocker {
  code:
    | 'stories_missing'
    | 'stories_count'
    | 'artifact_missing'
    | 'artifact_not_approved'
    | 'simulation_not_passed'
    | 'social_missing'
    | 'social_duplicate'
    | 'social_unexpected'
    | 'social_locale'
    | 'social_not_approved'
    | 'social_manual_document'
    | 'social_disabled_owner'
    | 'social_disabled_reason';
  slot: string;
  message: string;
  /** Concrete next step for the editor. */
  fix: string;
  /** Admin workspace tab that owns this gate (`?tab=`). */
  tab: WeeklyPreflightTab;
}

export interface WeeklyPreflightResult {
  ready: boolean;
  blockers: WeeklyPreflightBlocker[];
}

/** Release path order — matches workspace tabs an editor walks left→right. */
export const WEEKLY_PREFLIGHT_SECTIONS = [
  {
    tab: 'stories',
    step: 1,
    title: 'Stories',
    blurb: 'Select Top 3 + Radar (6–7 stories) and save.',
  },
  {
    tab: 'research',
    step: 2,
    title: 'Research',
    blurb: 'Approve Top 3 packs → Start Content Studio → Approve Master quality.',
  },
  {
    tab: 'article',
    step: 3,
    title: 'Article UK / EN',
    blurb: 'Review and approve bilingual articles from the master.',
  },
  {
    tab: 'visuals',
    step: 4,
    title: 'Visuals',
    blurb: 'Approve story images, then the weekly cover.',
  },
  {
    tab: 'social',
    step: 5,
    title: 'Social',
    blurb: 'One variant per channel, correct locale, then Save & approve.',
  },
  {
    tab: 'pdf',
    step: 6,
    title: 'PDF',
    blurb: 'Generate and approve EN, then UK.',
  },
  {
    tab: 'video',
    step: 7,
    title: 'Video',
    blurb: 'Script → manifest → final render → captions → thumbnail.',
  },
  {
    tab: 'release',
    step: 8,
    title: 'Release',
    blurb: 'Final approval and schedule once gates above are green.',
  },
] as const satisfies ReadonlyArray<{
  tab: WeeklyPreflightTab;
  step: number;
  title: string;
  blurb: string;
}>;

export type WeeklyPreflightSection = (typeof WEEKLY_PREFLIGHT_SECTIONS)[number];

export interface WeeklyPreflightBlockerGroup {
  section: WeeklyPreflightSection;
  blockers: WeeklyPreflightBlocker[];
}

const SOCIAL_CHANNEL_ORDER = Object.keys(WEEKLY_SOCIAL_MATRIX) as SocialChannel[];

/** Within a tab: lower = do first. */
const ARTIFACT_TYPE_ORDER: Record<WeeklyArtifactType, number> = {
  research_pack: 10,
  content_quality_report: 20,
  article: 10,
  story_image: 10,
  cover: 20,
  social_asset: 30,
  pdf: 10,
  video_script: 10,
  video_manifest: 20,
  video_preview: 25,
  heygen_preview: 26,
  graphics_preview: 27,
  video_final: 30,
  captions: 40,
  thumbnail: 50,
};

const SOCIAL_CODE_ORDER: Partial<Record<WeeklyPreflightBlocker['code'], number>> = {
  social_missing: 10,
  social_duplicate: 20,
  social_unexpected: 30,
  social_locale: 40,
  social_disabled_owner: 50,
  social_disabled_reason: 60,
  social_not_approved: 70,
  social_manual_document: 80,
};

const LOCALE_ORDER: Record<string, number> = { en: 1, uk: 2, neutral: 3 };

function sectionIndexForTab(tab: WeeklyPreflightTab): number {
  const index = WEEKLY_PREFLIGHT_SECTIONS.findIndex((section) => section.tab === tab);
  return index === -1 ? WEEKLY_PREFLIGHT_SECTIONS.length : index;
}

function storyRank(storyId: string | undefined, storyIds: string[]): number {
  if (!storyId) return 0;
  const index = storyIds.indexOf(storyId);
  return index === -1 ? 900 : index;
}

function parseStoryIdFromSlot(slot: string): string | undefined {
  const marker = ':story:';
  const at = slot.indexOf(marker);
  if (at === -1) return undefined;
  return slot.slice(at + marker.length) || undefined;
}

function parseLocaleFromSlot(slot: string): string | undefined {
  const parts = slot.split(':');
  if (parts.length < 2) return undefined;
  if (parts[1] === 'en' || parts[1] === 'uk' || parts[1] === 'neutral') return parts[1];
  return undefined;
}

function parseArtifactTypeFromSlot(slot: string): WeeklyArtifactType | undefined {
  const head = slot.split(':')[0];
  return head in ARTIFACT_TYPE_ORDER ? (head as WeeklyArtifactType) : undefined;
}

function parseSocialChannelFromSlot(slot: string): string | undefined {
  if (!slot.startsWith('social:')) return undefined;
  return slot.slice('social:'.length) || undefined;
}

function blockerSortKey(
  blocker: WeeklyPreflightBlocker,
  storyIds: string[],
): [number, number, number, number, string] {
  const section = sectionIndexForTab(blocker.tab);
  if (blocker.tab === 'stories') {
    return [section, 0, 0, 0, blocker.slot];
  }
  if (blocker.tab === 'social') {
    const channel = parseSocialChannelFromSlot(blocker.slot) ?? '';
    const channelRank = SOCIAL_CHANNEL_ORDER.indexOf(channel as SocialChannel);
    const channelOrder = channelRank === -1 ? 100 : channelRank;
    const codeOrder = SOCIAL_CODE_ORDER[blocker.code] ?? 90;
    return [section, channelOrder, codeOrder, 0, blocker.slot];
  }
  const artifactType = parseArtifactTypeFromSlot(blocker.slot);
  const typeOrder = artifactType ? ARTIFACT_TYPE_ORDER[artifactType] : 50;
  const storyOrder = storyRank(parseStoryIdFromSlot(blocker.slot), storyIds);
  const localeOrder = LOCALE_ORDER[parseLocaleFromSlot(blocker.slot) ?? ''] ?? 0;
  return [section, typeOrder, storyOrder, localeOrder, blocker.slot];
}

function compareSortKeys(
  left: [number, number, number, number, string],
  right: [number, number, number, number, string],
): number {
  if (left[0] !== right[0]) return left[0] - right[0];
  if (left[1] !== right[1]) return left[1] - right[1];
  if (left[2] !== right[2]) return left[2] - right[2];
  if (left[3] !== right[3]) return left[3] - right[3];
  return left[4].localeCompare(right[4]);
}

/** Stable editorial order for release gates. */
export function sortWeeklyPreflightBlockers(
  blockers: WeeklyPreflightBlocker[],
  storyIds: string[] = [],
): WeeklyPreflightBlocker[] {
  return [...blockers].sort((left, right) =>
    compareSortKeys(blockerSortKey(left, storyIds), blockerSortKey(right, storyIds)),
  );
}

/** Group sorted blockers into release-path sections (empty sections omitted). */
export function groupWeeklyPreflightBlockers(
  blockers: WeeklyPreflightBlocker[],
  storyIds: string[] = [],
): WeeklyPreflightBlockerGroup[] {
  const sorted = sortWeeklyPreflightBlockers(blockers, storyIds);
  const byTab = new Map<WeeklyPreflightTab, WeeklyPreflightBlocker[]>();
  for (const blocker of sorted) {
    const list = byTab.get(blocker.tab) ?? [];
    list.push(blocker);
    byTab.set(blocker.tab, list);
  }
  return WEEKLY_PREFLIGHT_SECTIONS.flatMap((section) => {
    const sectionBlockers = byTab.get(section.tab);
    if (!sectionBlockers?.length) return [];
    return [{ section, blockers: sectionBlockers }];
  });
}

type ArtifactGateGuidance = {
  tab: WeeklyPreflightTab;
  fixMissing: string;
  fixUnapproved: string;
};

const ARTIFACT_GATE_GUIDANCE: Record<WeeklyArtifactType, ArtifactGateGuidance> = {
  research_pack: {
    tab: 'research',
    fixMissing:
      'Open Research → wait for research_pack jobs on Top 3 stories → Approve each pack (owner).',
    fixUnapproved:
      'Open Research → open the Top 3 pack still in review → Approve version (owner).',
  },
  content_quality_report: {
    tab: 'research',
    fixMissing:
      'Open Research → approve all 3 Top research packs → Start / retry Content Studio. When editorial_master succeeds, Master quality appears on that tab — Approve it (owner).',
    fixUnapproved:
      'Open Research → Approve Master quality if only warnings remain. Coded (red) blockers go to Fixes & blockers. Warnings never block Social.',
  },
  article: {
    tab: 'article',
    fixMissing:
      'Open Research → run Content Studio so editorial_master writes EN/UK articles, then open Article UK / EN to review.',
    fixUnapproved: 'Open Article UK / EN → review the locale → Approve version (owner).',
  },
  pdf: {
    tab: 'pdf',
    fixMissing: 'Open PDF → enqueue generation for this locale → reload when ready → Approve.',
    fixUnapproved: 'Open PDF → review the current locale file → Approve version (owner).',
  },
  story_image: {
    tab: 'visuals',
    fixMissing:
      'Open Visuals → copy a concept prompt → generate it in your tool → upload the file into the story slot.',
    fixUnapproved: 'Open Visuals → find the story image still in review → Approve version.',
  },
  cover: {
    tab: 'visuals',
    fixMissing:
      'Open Visuals → copy the cover prompt → generate it in your tool → upload the file into the cover slot.',
    fixUnapproved: 'Open Visuals → review the cover → Approve version (owner).',
  },
  video_script: {
    tab: 'video',
    fixMissing:
      'Open Video → Approve the English article → Generate script (dramatizes it into the TV-news scene plan), or paste/save narration under Video contract → Approve.',
    fixUnapproved: 'Open Video → review the generated scene plan and Shorts → Approve version (owner).',
  },
  video_manifest: {
    tab: 'video',
    fixMissing:
      'Open Video → Generate manifest (after the approved script) → Approve the weekly-video-v3 manifest.',
    fixUnapproved: 'Open Video → review the weekly-video-v3 manifest → Approve version (owner).',
  },
  video_preview: {
    tab: 'video',
    fixMissing: 'Open Video → upload or attach the preview render.',
    fixUnapproved: 'Open Video → Approve the preview artifact (owner).',
  },
  video_final: {
    tab: 'video',
    fixMissing:
      'Open Video → finish Remotion/YouTube render, then upload/import the final MP4 (or use an owner override on Release for trial).',
    fixUnapproved: 'Open Video → Approve the final YouTube video artifact (owner).',
  },
  captions: {
    tab: 'video',
    fixMissing:
      'Open Video → paste EN/UK captions (WebVTT/SRT) under Video contract and save, or import with the final render.',
    fixUnapproved: 'Open Video → Approve captions for this locale (owner).',
  },
  thumbnail: {
    tab: 'video',
    fixMissing: 'Open Video → upload the YouTube thumbnail image → Approve.',
    fixUnapproved: 'Open Video → Approve the thumbnail (owner).',
  },
  heygen_preview: {
    tab: 'video',
    fixMissing: 'Open Video → attach the HeyGen preview.',
    fixUnapproved: 'Open Video → Approve the HeyGen preview (owner).',
  },
  graphics_preview: {
    tab: 'video',
    fixMissing: 'Open Video → attach the graphics preview.',
    fixUnapproved: 'Open Video → Approve the graphics preview (owner).',
  },
  social_asset: {
    tab: 'visuals',
    fixMissing: 'Open Visuals → generate channel crops from the approved cover.',
    fixUnapproved: 'Open Visuals → Approve the social crop assets (owner).',
  },
};

function socialFix(channel: string, detail: string): string {
  return `Open Social → ${channel} card → ${detail}`;
}

function artifactApproved(artifact: WeeklyPreflightArtifact) {
  if (artifact.stale || artifact.status === 'stale') return false;
  if (
    artifact.generationStatus &&
    !['ready', 'completed', 'succeeded'].includes(artifact.generationStatus)
  ) {
    return false;
  }
  if (typeof artifact.approved === 'boolean') return artifact.approved;
  return artifact.reviewStatus === 'approved' || artifact.status === 'approved';
}

function socialApproved(post: WeeklyPreflightSocial) {
  if (typeof post.approved === 'boolean') return post.approved;
  return ['approved', 'scheduled', 'posted'].includes(post.status ?? '');
}

export function validateWeeklyDigestPreflight(input: WeeklyPreflightInput): WeeklyPreflightResult {
  const blockers: WeeklyPreflightBlocker[] = [];

  function requireArtifact(
    artifactType: WeeklyArtifactType,
    options: { locale?: SocialLocale | null; storyId?: string; label: string },
  ) {
    const guidance = ARTIFACT_GATE_GUIDANCE[artifactType];
    const matches = input.artifacts.filter(
      (artifact) =>
        artifact.artifactType === artifactType &&
        (options.locale === undefined || (artifact.locale ?? null) === options.locale) &&
        (options.storyId === undefined || artifact.storyId === options.storyId),
    );
    const slot = [artifactType, options.locale, options.storyId ? `story:${options.storyId}` : null]
      .filter(Boolean)
      .join(':');
    if (matches.length === 0) {
      blockers.push({
        code: 'artifact_missing',
        slot,
        message: `${options.label} is missing.`,
        fix: guidance.fixMissing,
        tab: guidance.tab,
      });
    } else {
      if (!matches.some(artifactApproved)) {
        blockers.push({
          code: 'artifact_not_approved',
          slot,
          message: `${options.label} must be current and approved.`,
          fix: guidance.fixUnapproved,
          tab: guidance.tab,
        });
      }
      if (
        (artifactType === 'story_image' || artifactType === 'cover') &&
        matches.some((artifact) => artifact.contentSimCleared === false)
      ) {
        blockers.push({
          code: 'simulation_not_passed',
          slot,
          message: `${options.label} failed content simulation and has no human override.`,
          fix: 'Open Visuals → review the Content Sim escalation (blockers + suggested fixes) → Regenerate or Approve to override after review.',
          tab: 'visuals',
        });
      }
    }
  }

  // Collect in release-path order; sortWeeklyPreflightBlockers still normalizes
  // story/social sub-order so UI sections stay stable.
  const storyIds = [...new Set(input.storyIds.filter(Boolean))];
  if (storyIds.length === 0) {
    blockers.push({
      code: 'stories_missing',
      slot: 'stories',
      message: 'At least one selected story is required.',
      fix: 'Open Stories → select Top 3 plus 3–4 Radar stories (6–7 total) → Save.',
      tab: 'stories',
    });
  } else if (storyIds.length < 6 || storyIds.length > 7) {
    blockers.push({
      code: 'stories_count',
      slot: 'stories',
      message: 'Content Studio v2 requires Top 3 plus three or four Radar stories (6–7 total).',
      fix: 'Open Stories → keep exactly 6 or 7 selected stories (ranks 1–3 Top, rest Radar) → Save.',
      tab: 'stories',
    });
  }

  for (const storyId of storyIds.slice(0, 3)) {
    requireArtifact('research_pack', {
      storyId,
      label: `Approved research pack for Top 3 story ${storyId}`,
    });
  }
  requireArtifact('content_quality_report', { locale: null, label: 'Master quality report' });

  requireArtifact('article', { locale: 'en', label: 'English article' });
  requireArtifact('article', { locale: 'uk', label: 'Ukrainian article' });

  for (const storyId of storyIds) {
    requireArtifact('story_image', {
      storyId,
      label: `Story image for ${storyId}`,
    });
  }
  requireArtifact('cover', { locale: null, label: 'Weekly cover' });

  for (const post of input.social) {
    if (!Object.hasOwn(WEEKLY_SOCIAL_MATRIX, post.channel)) {
      blockers.push({
        code: 'social_unexpected',
        slot: `social:${String(post.channel)}`,
        message: `${String(post.channel)} is not part of the Weekly Digest social matrix.`,
        fix: socialFix(
          String(post.channel),
          'remove this unexpected channel; only telegram, facebook, x, threads, linkedin, instagram are allowed.',
        ),
        tab: 'social',
      });
    }
  }

  const localeMatrix = { ...WEEKLY_SOCIAL_MATRIX, ...(input.localeMap ?? {}) };
  for (const [channel, locale] of Object.entries(localeMatrix) as Array<
    [SocialChannel, SocialLocale]
  >) {
    const posts = input.social.filter((post) => post.channel === channel);
    if (posts.length === 0) {
      blockers.push({
        code: 'social_missing',
        slot: `social:${channel}`,
        message: `${channel} social variant is missing.`,
        fix: socialFix(
          channel,
          `Open Social → Generate social package / wait for generation → edit if needed → Save & approve (${locale.toUpperCase()} locale).`,
        ),
        tab: 'social',
      });
      continue;
    }
    if (posts.length > 1) {
      blockers.push({
        code: 'social_duplicate',
        slot: `social:${channel}`,
        message: `${channel} must have exactly one weekly variant.`,
        fix: socialFix(channel, 'keep a single variant for this channel (remove duplicates).'),
        tab: 'social',
      });
      continue;
    }

    const post = posts[0];
    if (post.locale !== locale) {
      blockers.push({
        code: 'social_locale',
        slot: `social:${channel}`,
        message: `${channel} must use the ${locale.toUpperCase()} locale.`,
        fix: socialFix(
          channel,
          `switch locale to ${locale.toUpperCase()} (matrix requirement) → Save & approve.`,
        ),
        tab: 'social',
      });
    }
    if (!post.publishEnabled) {
      if (!post.disabledByOwner) {
        blockers.push({
          code: 'social_disabled_owner',
          slot: `social:${channel}`,
          message: `${channel} may be disabled only by an owner.`,
          fix: socialFix(
            channel,
            're-enable publishing, or have an owner disable it with an audited reason.',
          ),
          tab: 'social',
        });
      }
      if (!post.disabledReason?.trim()) {
        blockers.push({
          code: 'social_disabled_reason',
          slot: `social:${channel}`,
          message: `Owner-disabled ${channel} requires a reason.`,
          fix: socialFix(channel, 'owner: add a disable reason, or re-enable and Approve.'),
          tab: 'social',
        });
      }
      continue;
    }
    if (!socialApproved(post)) {
      blockers.push({
        code: 'social_not_approved',
        slot: `social:${channel}`,
        message: `${channel} social variant must be approved.`,
        fix: socialFix(channel, 'review copy → Save & approve (owner).'),
        tab: 'social',
      });
    }
    if (
      channel === 'linkedin' &&
      !['ready', 'completed'].includes(post.manualDocumentStatus ?? '')
    ) {
      blockers.push({
        code: 'social_manual_document',
        slot: `social:${channel}`,
        message: 'LinkedIn PDF/document handoff must be ready for manual upload.',
        fix: socialFix(
          'linkedin',
          'prepare the LinkedIn PDF/document handoff until its status is ready/completed (manual upload still happens outside the app).',
        ),
        tab: 'social',
      });
    }
  }

  requireArtifact('pdf', { locale: 'en', label: 'English PDF' });
  requireArtifact('pdf', { locale: 'uk', label: 'Ukrainian PDF' });

  requireArtifact('video_script', { locale: 'en', label: 'Approved English video script' });
  requireArtifact('video_manifest', { locale: 'en', label: 'Approved weekly-video-v3 manifest' });
  requireArtifact('video_final', { locale: 'en', label: 'Final YouTube video' });
  requireArtifact('captions', { locale: 'en', label: 'English captions' });
  requireArtifact('captions', { locale: 'uk', label: 'Ukrainian captions' });
  requireArtifact('thumbnail', { locale: null, label: 'Video thumbnail' });

  return {
    ready: blockers.length === 0,
    blockers: sortWeeklyPreflightBlockers(blockers, storyIds),
  };
}
