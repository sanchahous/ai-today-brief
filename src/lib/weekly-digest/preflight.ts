import type { SocialChannel, SocialLocale } from '@/lib/social/types';

export const WEEKLY_SOCIAL_MATRIX = {
  telegram: 'uk',
  facebook: 'uk',
  x: 'en',
  threads: 'uk',
  linkedin: 'en',
  instagram: 'en',
} as const satisfies Record<SocialChannel, SocialLocale>;

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
}

export interface WeeklyPreflightResult {
  ready: boolean;
  blockers: WeeklyPreflightBlocker[];
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
      });
    } else if (!matches.some(artifactApproved)) {
      blockers.push({
        code: 'artifact_not_approved',
        slot,
        message: `${options.label} must be current and approved.`,
      });
    }
  }

  requireArtifact('article', { locale: 'en', label: 'English article' });
  requireArtifact('article', { locale: 'uk', label: 'Ukrainian article' });
  requireArtifact('content_quality_report', { locale: null, label: 'Master quality report' });
  requireArtifact('video_script', { locale: 'en', label: 'Approved English video script' });
  requireArtifact('video_manifest', { locale: 'en', label: 'Approved weekly-video-v2 manifest' });
  requireArtifact('pdf', { locale: 'en', label: 'English PDF' });
  requireArtifact('pdf', { locale: 'uk', label: 'Ukrainian PDF' });
  requireArtifact('cover', { locale: null, label: 'Weekly cover' });
  requireArtifact('video_final', { locale: 'en', label: 'Final YouTube video' });
  requireArtifact('captions', { locale: 'en', label: 'English captions' });
  requireArtifact('captions', { locale: 'uk', label: 'Ukrainian captions' });
  requireArtifact('thumbnail', { locale: null, label: 'Video thumbnail' });

  const storyIds = [...new Set(input.storyIds.filter(Boolean))];
  if (storyIds.length === 0) {
    blockers.push({
      code: 'stories_missing',
      slot: 'stories',
      message: 'At least one selected story is required.',
    });
  } else if (storyIds.length < 6 || storyIds.length > 7) {
    blockers.push({
      code: 'stories_count',
      slot: 'stories',
      message: 'Content Studio v2 requires Top 3 plus three or four Radar stories (6–7 total).',
    });
  }
  for (const storyId of storyIds) {
    requireArtifact('story_image', {
      storyId,
      label: `Story image for ${storyId}`,
    });
  }
  for (const storyId of storyIds.slice(0, 3)) {
    requireArtifact('research_pack', {
      storyId,
      label: `Approved research pack for Top 3 story ${storyId}`,
    });
  }

  for (const post of input.social) {
    if (!Object.hasOwn(WEEKLY_SOCIAL_MATRIX, post.channel)) {
      blockers.push({
        code: 'social_unexpected',
        slot: `social:${String(post.channel)}`,
        message: `${String(post.channel)} is not part of the Weekly Digest social matrix.`,
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
      });
      continue;
    }
    if (posts.length > 1) {
      blockers.push({
        code: 'social_duplicate',
        slot: `social:${channel}`,
        message: `${channel} must have exactly one weekly variant.`,
      });
      continue;
    }

    const post = posts[0];
    if (post.locale !== locale) {
      blockers.push({
        code: 'social_locale',
        slot: `social:${channel}`,
        message: `${channel} must use the ${locale.toUpperCase()} locale.`,
      });
    }
    if (!post.publishEnabled) {
      if (!post.disabledByOwner) {
        blockers.push({
          code: 'social_disabled_owner',
          slot: `social:${channel}`,
          message: `${channel} may be disabled only by an owner.`,
        });
      }
      if (!post.disabledReason?.trim()) {
        blockers.push({
          code: 'social_disabled_reason',
          slot: `social:${channel}`,
          message: `Owner-disabled ${channel} requires a reason.`,
        });
      }
      continue;
    }
    if (!socialApproved(post)) {
      blockers.push({
        code: 'social_not_approved',
        slot: `social:${channel}`,
        message: `${channel} social variant must be approved.`,
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
      });
    }
  }

  return { ready: blockers.length === 0, blockers };
}
