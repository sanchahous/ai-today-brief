import { isSocialImageMime, parsePersistedSocialAssetRefs } from '@/lib/social/asset-ref';
import {
  selectInstagramCarouselSources,
  selectedImageToAssetRef,
  selectWeeklyChannelImage,
  type SocialSelectableArtifact,
} from '@/lib/social/channel-assets';
import { socialContentHash } from '@/lib/social/content-hash';
import {
  instagramCarouselIssues,
  parseInstagramCarouselSpec,
  readableInstagramParts,
  type InstagramCarouselSpec,
} from '@/lib/social/instagram-carousel';
import { containsServiceMarkers } from '@/lib/social/service-markers';
import { isSocialChannel, SOCIAL_CHANNELS, type SocialAsset, type SocialChannel } from '@/lib/social/types';

const IMAGE_CHANNELS = ['telegram', 'facebook', 'x', 'threads', 'linkedin'] as const;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
export const SOCIAL_REPAIR_REASON =
  'Replace PDF/stale social image refs with approved landscape images and regenerate the Instagram carousel.';

export type RepairSocialPost = {
  id: string;
  channel: string;
  status: string;
  publish_enabled: boolean;
  scheduled_for: string | null;
  asset_urls: unknown;
  content_parts: unknown;
  post_text: string | null;
  first_comment: string | null;
  alt_text: string | null;
  format: string | null;
  locale: string | null;
  content_version: number;
  content_hash: string | null;
  meta: unknown;
};

export type RepairSocialPackage = {
  id: string;
  weekly_digest_id: string | null;
  weekly_digest_revision_id: string | null;
  status: string;
  kind: string;
};

export type ImageRefMutation = {
  type: 'replace_image_ref';
  channel: (typeof IMAGE_CHANNELS)[number];
  postId: string;
  fromArtifactId: string | null;
  to: ReturnType<typeof selectedImageToAssetRef>;
};

export type InstagramMutation = {
  type: 'regenerate_instagram';
  postId: string;
  reason: string;
  spec: InstagramCarouselSpec | null;
};

export type LinkedInDocumentMutation = {
  type: 'ensure_linkedin_document';
  postId: string;
  documentArtifactId: string;
};

export type RepairMutation = ImageRefMutation | InstagramMutation | LinkedInDocumentMutation;

export type RepairScheduleHint = {
  channel: string;
  scheduledFor: string;
  reason: string;
};

export type RepairPlan = {
  ok: boolean;
  blockers: string[];
  mutations: RepairMutation[];
  scheduleHints: RepairScheduleHint[];
  imageRefChanges: number;
  instagramJpegs: number;
};

function isImageChannel(channel: string): channel is (typeof IMAGE_CHANNELS)[number] {
  return (IMAGE_CHANNELS as readonly string[]).includes(channel);
}

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstArtifactId(assetUrls: unknown): string | null {
  return parsePersistedSocialAssetRefs(assetUrls)[0]?.artifactId ?? null;
}

function stringParts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
    : [];
}

function currentCarouselComplete(artifacts: SocialSelectableArtifact[]) {
  const keys = new Set(
    artifacts
      .filter(
        (artifact) =>
          artifact.is_current &&
          artifact.generation_status === 'ready' &&
          artifact.artifact_type === 'social_asset' &&
          artifact.width === 1080 &&
          artifact.height === 1350 &&
          /^instagram-carousel:[1-7]:en$/.test(artifact.slot_key),
      )
      .map((artifact) => artifact.slot_key),
  );
  return keys.size === 7;
}

function linkedinPdfArtifactId(artifacts: SocialSelectableArtifact[]): string | null {
  const pdf = artifacts.find(
    (artifact) =>
      artifact.is_current &&
      artifact.generation_status === 'ready' &&
      artifact.slot_key === 'linkedin-document:en',
  );
  return pdf?.id ?? null;
}

const COVER_HEADLINE_MAX = 72;
const SLIDE_HEADLINE_MAX = 54;
const SLIDE_BODY_MAX = 120;

function normalizeSlideText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function trimToCharLimit(value: string, max: number) {
  const text = normalizeSlideText(value);
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const breakAt = slice.lastIndexOf(' ');
  let kept = (breakAt >= 12 ? slice.slice(0, breakAt) : slice).trim();
  while (kept.length > 0 && /[.,;:!?-]$/u.test(kept)) {
    kept = kept.slice(0, -1).trim();
  }
  return kept;
}

function firstSentenceEnd(text: string) {
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    const next = text[i + 1];
    if (next === undefined || next === ' ') return i + 1;
  }
  return -1;
}

function splitLegacySlide(part: string, headlineMax: number, bodyMax: number) {
  const lines = part.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines[0] && lines.length >= 2 && lines[0].length <= headlineMax) {
    return {
      headline: trimToCharLimit(lines[0], headlineMax),
      body: trimToCharLimit(lines.slice(1).join(' '), bodyMax),
    };
  }
  const text = normalizeSlideText(part);
  const sentenceEnd = firstSentenceEnd(text);
  const sentence = sentenceEnd > 0 ? text.slice(0, sentenceEnd).trim() : text;
  const rest = sentenceEnd > 0 ? text.slice(sentenceEnd).trim() : '';
  const headline = trimToCharLimit(sentence, headlineMax);
  const bodySource = rest || text.slice(headline.length).trim() || text;
  return {
    headline,
    body: trimToCharLimit(bodySource, bodyMax),
  };
}

function mapLegacyCarouselParts(parts: string[]) {
  if (parts.length < 7) return null;
  const comparisonParts = parts.slice(4, parts.length - 2);
  const cover = parts[0];
  const storyOne = parts[1];
  const storyTwo = parts[2];
  const storyThree = parts[3];
  const caveat = parts[parts.length - 2];
  const takeaway = parts[parts.length - 1];
  if (
    !cover ||
    !storyOne ||
    !storyTwo ||
    !storyThree ||
    comparisonParts.length === 0 ||
    !caveat ||
    !takeaway
  ) {
    return null;
  }
  return {
    cover,
    stories: [storyOne, storyTwo, storyThree] as const,
    comparison: comparisonParts.join(' '),
    caveat,
    takeaway,
  };
}

function usableHookCandidates(value: [string, string, string] | undefined) {
  if (!value) return undefined;
  if (value.some((candidate) => containsServiceMarkers(candidate) || !candidate.trim())) {
    return undefined;
  }
  return value;
}

export function instagramSpecFromLegacyParts(input: {
  caption: string;
  parts: string[];
  storyIds: [string, string, string];
  angle?: string;
  hookCandidates?: [string, string, string];
}): InstagramCarouselSpec | null {
  if (input.storyIds.some((id) => !id)) return null;
  const mapped = mapLegacyCarouselParts(input.parts);
  if (!mapped) return null;
  const cover = splitLegacySlide(mapped.cover, COVER_HEADLINE_MAX, SLIDE_BODY_MAX);
  const storyOne = splitLegacySlide(mapped.stories[0], SLIDE_HEADLINE_MAX, SLIDE_BODY_MAX);
  const storyTwo = splitLegacySlide(mapped.stories[1], SLIDE_HEADLINE_MAX, SLIDE_BODY_MAX);
  const storyThree = splitLegacySlide(mapped.stories[2], SLIDE_HEADLINE_MAX, SLIDE_BODY_MAX);
  const comparison = splitLegacySlide(mapped.comparison, SLIDE_HEADLINE_MAX, SLIDE_BODY_MAX);
  const caveat = splitLegacySlide(mapped.caveat, SLIDE_HEADLINE_MAX, SLIDE_BODY_MAX);
  const takeaway = splitLegacySlide(mapped.takeaway, SLIDE_HEADLINE_MAX, SLIDE_BODY_MAX);
  if (
    !cover.headline ||
    !storyOne.headline ||
    !storyOne.body ||
    !storyTwo.headline ||
    !storyTwo.body ||
    !storyThree.headline ||
    !storyThree.body ||
    !comparison.headline ||
    !comparison.body ||
    !caveat.headline ||
    !caveat.body ||
    !takeaway.headline ||
    !takeaway.body
  ) {
    return null;
  }
  const spec: InstagramCarouselSpec = {
    version: 1,
    angle: (input.angle ?? 'Weekly digest').trim(),
    hookCandidates:
      usableHookCandidates(input.hookCandidates) ??
      [cover.headline, storyOne.headline, storyTwo.headline],
    caption: input.caption.trim(),
    slides: [
      { kind: 'cover', headline: cover.headline },
      {
        kind: 'story',
        revisionItemId: input.storyIds[0],
        headline: storyOne.headline,
        body: storyOne.body,
      },
      {
        kind: 'story',
        revisionItemId: input.storyIds[1],
        headline: storyTwo.headline,
        body: storyTwo.body,
      },
      {
        kind: 'story',
        revisionItemId: input.storyIds[2],
        headline: storyThree.headline,
        body: storyThree.body,
      },
      { kind: 'comparison', headline: comparison.headline, body: comparison.body },
      { kind: 'caveat', headline: caveat.headline, body: caveat.body },
      { kind: 'takeaway', headline: takeaway.headline, body: takeaway.body },
    ],
  };
  if (instagramCarouselIssues(spec, input.storyIds).length > 0) return null;
  return spec;
}

function scheduleHint(post: RepairSocialPost, now: Date): RepairScheduleHint | null {
  if (!post.scheduled_for) return null;
  const scheduled = new Date(post.scheduled_for).getTime();
  if (!Number.isFinite(scheduled)) return null;
  const delta = scheduled - now.getTime();
  if (delta >= TWO_HOURS_MS) return null;
  return {
    channel: post.channel,
    scheduledFor: post.scheduled_for,
    reason:
      delta <= 0
        ? 'Schedule is already in the past. Pick a new Europe/Kyiv time before enabling publishing.'
        : 'Schedule is less than two hours away. Confirm or pick a new Europe/Kyiv time before enabling publishing.',
  };
}

function preconditions(input: {
  socialPackage: RepairSocialPackage;
  posts: RepairSocialPost[];
  revisionIsCurrent: boolean;
  artifacts: SocialSelectableArtifact[];
}): string[] {
  const blockers: string[] = [];
  if (input.socialPackage.kind !== 'weekly_digest') {
    blockers.push('Repair only accepts a weekly_digest social package.');
  }
  if (input.socialPackage.status !== 'in_review') {
    blockers.push(`Package status must be in_review (found ${input.socialPackage.status}).`);
  }
  if (!input.revisionIsCurrent) {
    blockers.push('The package revision is not the current weekly digest revision.');
  }
  const channels = input.posts.map((post) => post.channel);
  for (const channel of SOCIAL_CHANNELS) {
    if (!channels.includes(channel)) blockers.push(`Missing ${channel} variant.`);
  }
  if (input.posts.some((post) => post.status === 'publishing' || post.status === 'posted')) {
    blockers.push('A variant is already publishing or posted.');
  }
  if (input.posts.some((post) => post.publish_enabled)) {
    blockers.push('Pause publishing on every channel before repair.');
  }
  const instagramSources = selectInstagramCarouselSources(input.artifacts);
  if (!instagramSources.ok) blockers.push(instagramSources.blocker.message);
  if (!selectWeeklyChannelImage(input.artifacts, 'telegram')) {
    blockers.push('An approved landscape or cover image is required.');
  }
  return blockers;
}

function instagramRepairSpec(
  post: RepairSocialPost,
  artifacts: SocialSelectableArtifact[],
): { spec: InstagramCarouselSpec | null; reason: string } {
  const meta = metaRecord(post.meta);
  const existing = parseInstagramCarouselSpec(meta.instagram_carousel);
  const sources = selectInstagramCarouselSources(artifacts);
  if (!sources.ok) return { spec: existing, reason: sources.blocker.message };
  const storyIds: [string, string, string] = [
    sources.stories[0].revisionItemId ?? '',
    sources.stories[1].revisionItemId ?? '',
    sources.stories[2].revisionItemId ?? '',
  ];
  if (existing) return { spec: existing, reason: 'Regenerate seven 1080×1350 JPEG slides from the stored spec.' };
  const hooks = Array.isArray(meta.hook_candidates)
    ? meta.hook_candidates.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const legacy = instagramSpecFromLegacyParts({
    caption: post.post_text ?? '',
    parts: stringParts(post.content_parts),
    storyIds,
    angle: typeof meta.hook_angle === 'string' ? meta.hook_angle : undefined,
    hookCandidates: hooks.length === 3 ? [hooks[0], hooks[1], hooks[2]] : undefined,
  });
  if (legacy) {
    return { spec: legacy, reason: 'Build a v1 carousel spec from stored slide texts, then render JPEGs.' };
  }
  return { spec: null, reason: 'Instagram has no carousel spec and cannot be reconstructed from stored parts.' };
}

export function planWeeklySocialPackageRepair(input: {
  socialPackage: RepairSocialPackage;
  posts: RepairSocialPost[];
  artifacts: SocialSelectableArtifact[];
  revisionIsCurrent: boolean;
  now?: Date;
}): RepairPlan {
  const now = input.now ?? new Date();
  const blockers = preconditions(input);
  const mutations: RepairMutation[] = [];
  const scheduleHints = input.posts.flatMap((post) => {
    const hint = scheduleHint(post, now);
    return hint ? [hint] : [];
  });
  if (blockers.length > 0) {
    return { ok: false, blockers, mutations: [], scheduleHints, imageRefChanges: 0, instagramJpegs: 0 };
  }

  const landscape = selectWeeklyChannelImage(input.artifacts, 'telegram');
  if (!landscape) {
    return {
      ok: false,
      blockers: ['An approved landscape or cover image is required.'],
      mutations: [],
      scheduleHints,
      imageRefChanges: 0,
      instagramJpegs: 0,
    };
  }
  const imageRef = selectedImageToAssetRef(landscape);

  for (const post of input.posts) {
    if (!isImageChannel(post.channel)) continue;
    const currentId = firstArtifactId(post.asset_urls);
    if (currentId === landscape.artifactId) continue;
    mutations.push({
      type: 'replace_image_ref',
      channel: post.channel,
      postId: post.id,
      fromArtifactId: currentId,
      to: imageRef,
    });
  }

  const linkedin = input.posts.find((post) => post.channel === 'linkedin');
  const pdfId = linkedinPdfArtifactId(input.artifacts);
  const linkedinMeta = linkedin ? metaRecord(linkedin.meta) : {};
  if (linkedin && pdfId && linkedinMeta.document_artifact_id !== pdfId) {
    mutations.push({
      type: 'ensure_linkedin_document',
      postId: linkedin.id,
      documentArtifactId: pdfId,
    });
  }

  const instagram = input.posts.find((post) => post.channel === 'instagram');
  let instagramJpegs = 0;
  if (instagram) {
    const { spec, reason } = instagramRepairSpec(instagram, input.artifacts);
    const carouselReady = currentCarouselComplete(input.artifacts) && Boolean(parseInstagramCarouselSpec(metaRecord(instagram.meta).instagram_carousel));
    if (!carouselReady) {
      if (!spec) blockers.push(reason);
      else {
        mutations.push({ type: 'regenerate_instagram', postId: instagram.id, reason, spec });
        instagramJpegs = 7;
      }
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
    mutations,
    scheduleHints,
    imageRefChanges: mutations.filter((mutation) => mutation.type === 'replace_image_ref').length,
    instagramJpegs,
  };
}

export function repairedSocialHash(
  post: RepairSocialPost,
  assets: SocialAsset[],
  spec?: InstagramCarouselSpec | null,
) {
  const locale = post.locale === 'uk' ? 'uk' : 'en';
  const channel: SocialChannel = isSocialChannel(post.channel) ? post.channel : 'telegram';
  return socialContentHash({
    channel,
    locale,
    format: post.format ?? 'weekly',
    text: spec?.caption ?? post.post_text ?? '',
    contentParts: spec ? readableInstagramParts(spec) : stringParts(post.content_parts),
    firstComment: post.first_comment,
    assets,
    altText: post.alt_text,
    scheduledFor: post.scheduled_for ?? '2099-01-01T10:00:00.000Z',
    contentVersion: post.content_version + 1,
    instagramCarousel: spec ?? parseInstagramCarouselSpec(metaRecord(post.meta).instagram_carousel),
  });
}

export type RepairPostPatch = {
  id: string;
  asset_urls: unknown;
  meta: Record<string, unknown>;
  post_text: string;
  content_parts: string[];
  content_version: number;
  content_hash: string;
  status: 'in_review';
};

export function buildRepairPatches(input: {
  posts: RepairSocialPost[];
  plan: RepairPlan;
  instagramAssets?: ReturnType<typeof selectedImageToAssetRef>[];
}): RepairPostPatch[] {
  const byPost = new Map<string, RepairMutation[]>();
  for (const mutation of input.plan.mutations) {
    const list = byPost.get(mutation.postId) ?? [];
    list.push(mutation);
    byPost.set(mutation.postId, list);
  }
  const patches: RepairPostPatch[] = [];
  for (const post of input.posts) {
    const mutations = byPost.get(post.id);
    if (!mutations?.length) continue;
    let assetUrls = post.asset_urls;
    let meta = { ...metaRecord(post.meta) };
    let postText = post.post_text ?? '';
    let contentParts = stringParts(post.content_parts);
    let spec = parseInstagramCarouselSpec(meta.instagram_carousel);
    for (const mutation of mutations) {
      if (mutation.type === 'replace_image_ref') {
        assetUrls = [mutation.to];
      } else if (mutation.type === 'ensure_linkedin_document') {
        meta = {
          ...meta,
          document_artifact_id: mutation.documentArtifactId,
          document_status:
            typeof meta.document_status === 'string' ? meta.document_status : 'draft_ready',
        };
      } else {
        if (!input.instagramAssets || input.instagramAssets.length !== 7) {
          throw new Error('Instagram repair needs seven rendered JPEG asset refs.');
        }
        spec = mutation.spec;
        assetUrls = input.instagramAssets;
        if (spec) {
          postText = spec.caption;
          contentParts = readableInstagramParts(spec);
          meta = { ...meta, instagram_carousel: spec };
        }
      }
    }
    const assets: SocialAsset[] = parsePersistedSocialAssetRefs(assetUrls).flatMap((ref) => {
      const mimeType = isSocialImageMime(ref.mimeType) ? ref.mimeType : undefined;
      return [
        {
          artifactId: ref.artifactId,
          width: ref.width,
          height: ref.height,
          ...(mimeType ? { mimeType } : {}),
          bytes: ref.bytes,
        },
      ];
    });
    patches.push({
      id: post.id,
      asset_urls: assetUrls,
      meta,
      post_text: postText,
      content_parts: contentParts,
      content_version: post.content_version + 1,
      content_hash: repairedSocialHash(
        { ...post, post_text: postText, content_parts: contentParts, meta },
        assets,
        spec,
      ),
      status: 'in_review',
    });
  }
  return patches;
}

