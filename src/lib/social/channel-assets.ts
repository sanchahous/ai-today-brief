import type { QualityIssue } from './types';
import { isSocialImageMime } from './asset-ref';
import type { SocialChannel } from './types';

export interface SocialSelectableArtifact {
  id: string;
  artifact_type: string;
  slot_key: string;
  is_current: boolean;
  generation_status: string;
  review_status: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  revision_item_id: string | null;
}

export interface SelectedSocialImage {
  artifactId: string;
  slotKey: string;
  artifactType: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  bytes: number;
  revisionItemId: string | null;
}

function isApprovedImage(
  artifact: SocialSelectableArtifact,
): artifact is SocialSelectableArtifact & {
  mime_type: SelectedSocialImage['mimeType'];
  width: number;
  height: number;
  byte_size: number;
} {
  return (
    artifact.is_current &&
    artifact.generation_status === 'ready' &&
    artifact.review_status === 'approved' &&
    isSocialImageMime(artifact.mime_type) &&
    typeof artifact.width === 'number' &&
    artifact.width > 0 &&
    typeof artifact.height === 'number' &&
    artifact.height > 0 &&
    typeof artifact.byte_size === 'number' &&
    artifact.byte_size > 0
  );
}

function toSelected(artifact: SocialSelectableArtifact & {
  mime_type: SelectedSocialImage['mimeType'];
  width: number;
  height: number;
  byte_size: number;
}): SelectedSocialImage {
  return {
    artifactId: artifact.id,
    slotKey: artifact.slot_key,
    artifactType: artifact.artifact_type,
    mimeType: artifact.mime_type,
    width: artifact.width,
    height: artifact.height,
    bytes: artifact.byte_size,
    revisionItemId: artifact.revision_item_id,
  };
}

function approvedImages(artifacts: SocialSelectableArtifact[]) {
  return artifacts.filter(isApprovedImage);
}

function pickLandscape(artifacts: SocialSelectableArtifact[]): SelectedSocialImage | null {
  const images = approvedImages(artifacts);
  const landscape = images.find(
    (artifact) =>
      artifact.artifact_type === 'social_asset' && artifact.slot_key.includes('social-landscape'),
  );
  if (landscape) return toSelected(landscape);
  const cover =
    images.find(
      (artifact) => artifact.artifact_type === 'cover' && artifact.slot_key === 'cover:neutral',
    ) ??
    images.find(
      (artifact) => artifact.artifact_type === 'cover' && artifact.slot_key === 'cover:main',
    ) ??
    images.find((artifact) => artifact.artifact_type === 'cover');
  return cover ? toSelected(cover) : null;
}

export type InstagramSourceSelection =
  | {
      ok: true;
      cover: SelectedSocialImage;
      stories: [SelectedSocialImage, SelectedSocialImage, SelectedSocialImage];
    }
  | { ok: false; blocker: QualityIssue };

export function selectWeeklyChannelImage(
  artifacts: SocialSelectableArtifact[],
  channel: SocialChannel,
): SelectedSocialImage | null {
  if (channel === 'instagram') return null;
  return pickLandscape(artifacts);
}

export function selectInstagramCarouselSources(
  artifacts: SocialSelectableArtifact[],
): InstagramSourceSelection {
  const images = approvedImages(artifacts);
  const cover =
    images.find(
      (artifact) => artifact.artifact_type === 'cover' && artifact.slot_key === 'cover:neutral',
    ) ??
    images.find(
      (artifact) => artifact.artifact_type === 'cover' && artifact.slot_key === 'cover:main',
    ) ??
    images.find((artifact) => artifact.artifact_type === 'cover');
  const stories: ReturnType<typeof approvedImages> = [];
  const seenItems = new Set<string>();
  for (const artifact of images) {
    if (artifact.artifact_type !== 'story_image' || !artifact.revision_item_id) continue;
    if (seenItems.has(artifact.revision_item_id)) continue;
    seenItems.add(artifact.revision_item_id);
    stories.push(artifact);
    if (stories.length === 3) break;
  }
  if (!cover || stories.length < 3) {
    return {
      ok: false,
      blocker: {
        code: 'instagram_story_images',
        message:
          'Instagram needs an approved cover and three different approved story images on the current revision.',
        field: 'asset_urls',
      },
    };
  }
  return {
    ok: true,
    cover: toSelected(cover),
    stories: [toSelected(stories[0]), toSelected(stories[1]), toSelected(stories[2])],
  };
}

export function selectedImageToAssetRef(image: SelectedSocialImage) {
  return {
    artifactId: image.artifactId,
    width: image.width,
    height: image.height,
    mimeType: image.mimeType,
    bytes: image.bytes,
  };
}
