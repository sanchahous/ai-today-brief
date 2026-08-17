import type { Json } from '@/lib/database.types';
import { SOCIAL_CHANNELS, type SocialChannel } from '@/lib/social/types';
import type { WeeklySocialAdaptation } from './social-adapter';

export const SOCIAL_COPY_CHECKPOINT_SCHEMA_VERSION = 2;

export interface SocialAssetCheckpoint {
  artifactId: string;
  storagePath: string;
  slideIndex: number;
  width: number;
  height: number;
  bytes: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface SocialCopyCheckpoint {
  schemaVersion: typeof SOCIAL_COPY_CHECKPOINT_SCHEMA_VERSION;
  inputHash: string;
  tokens: Record<SocialChannel, string>;
  adaptations: Partial<Record<SocialChannel, WeeklySocialAdaptation>>;
  instagramAssets: SocialAssetCheckpoint[];
  linkedinDocumentArtifactId: string | null;
  socialPackageId: string | null;
  postIds: Partial<Record<SocialChannel, string>>;
  reviewedPostIds: string[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function tokensFrom(value: unknown): Record<SocialChannel, string> | null {
  const candidate = record(value);
  const entries = SOCIAL_CHANNELS.map((channel) => [channel, candidate[channel]] as const);
  if (entries.some(([, token]) => typeof token !== 'string' || !token.trim())) return null;
  return Object.fromEntries(entries) as Record<SocialChannel, string>;
}

function adaptationsFrom(value: unknown): Partial<Record<SocialChannel, WeeklySocialAdaptation>> {
  const candidate = record(value);
  return Object.fromEntries(
    SOCIAL_CHANNELS.flatMap((channel) => {
      const adaptation = record(candidate[channel]);
      const quality = record(adaptation.qualityReport);
      const critic = record(quality.critic);
      const approvalReady =
        Array.isArray(quality.blocking) &&
        quality.blocking.length === 0 &&
        typeof critic.auditedAt === 'string' &&
        Boolean(critic.auditedAt);
      return adaptation.channel === channel && typeof adaptation.text === 'string' && approvalReady
        ? [[channel, candidate[channel] as WeeklySocialAdaptation] as const]
        : [];
    }),
  );
}

function channelIdsFrom(value: unknown): Partial<Record<SocialChannel, string>> {
  const candidate = record(value);
  return Object.fromEntries(
    SOCIAL_CHANNELS.flatMap((channel) => {
      const id = candidate[channel];
      return typeof id === 'string' && id ? [[channel, id] as const] : [];
    }),
  );
}

function instagramAssetsFrom(value: unknown): SocialAssetCheckpoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const asset = record(entry);
    if (
      typeof asset.artifactId !== 'string' ||
      typeof asset.storagePath !== 'string' ||
      typeof asset.slideIndex !== 'number' ||
      typeof asset.width !== 'number' ||
      typeof asset.height !== 'number' ||
      typeof asset.bytes !== 'number' ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(String(asset.mimeType))
    ) {
      return [];
    }
    return [asset as unknown as SocialAssetCheckpoint];
  });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry))
    : [];
}

/**
 * Reads both the v2 state and the legacy top-level v1 channel checkpoint.
 * Keeping the legacy reader is intentional: linked retries created for an
 * already failed production job can reuse the six writer/critic results that
 * were paid for before this state machine shipped.
 */
export function socialCopyCheckpointFromOutput(
  value: Json | null | undefined,
  expectedHash: string,
): SocialCopyCheckpoint | null {
  const output = record(value);
  const stored = record(output.social_copy_checkpoint);
  if (
    stored.schemaVersion === SOCIAL_COPY_CHECKPOINT_SCHEMA_VERSION &&
    stored.inputHash === expectedHash
  ) {
    const tokens = tokensFrom(stored.tokens);
    if (!tokens) return null;
    const adaptations = adaptationsFrom(stored.adaptations);
    return {
      schemaVersion: SOCIAL_COPY_CHECKPOINT_SCHEMA_VERSION,
      inputHash: expectedHash,
      tokens,
      adaptations,
      // Carousel images are derived from the Instagram copy. If that copy did
      // not pass the approval boundary, its downstream assets are stale too.
      instagramAssets: adaptations.instagram ? instagramAssetsFrom(stored.instagramAssets) : [],
      linkedinDocumentArtifactId:
        typeof stored.linkedinDocumentArtifactId === 'string'
          ? stored.linkedinDocumentArtifactId
          : null,
      socialPackageId: typeof stored.socialPackageId === 'string' ? stored.socialPackageId : null,
      postIds: channelIdsFrom(stored.postIds),
      reviewedPostIds: stringArray(stored.reviewedPostIds),
    };
  }

  if (output.socialCopyCheckpointHash !== expectedHash) return null;
  const legacyTokens = tokensFrom(output.tokens);
  if (!legacyTokens) return null;
  return {
    schemaVersion: SOCIAL_COPY_CHECKPOINT_SCHEMA_VERSION,
    inputHash: expectedHash,
    tokens: legacyTokens,
    adaptations: adaptationsFrom(output.adaptations),
    instagramAssets: [],
    linkedinDocumentArtifactId: null,
    socialPackageId: null,
    postIds: {},
    reviewedPostIds: [],
  };
}

export function socialCopyCheckpointOutput(
  checkpoint: SocialCopyCheckpoint,
): Record<string, Json | undefined> {
  return { social_copy_checkpoint: checkpoint as unknown as Json };
}

/** Higher scores represent a strictly later durable stage in the pipeline. */
export function socialCopyCheckpointScore(checkpoint: SocialCopyCheckpoint): number {
  return (
    Object.keys(checkpoint.adaptations).length * 1_000_000 +
    checkpoint.instagramAssets.length * 10_000 +
    Number(Boolean(checkpoint.linkedinDocumentArtifactId)) * 1_000 +
    Number(Boolean(checkpoint.socialPackageId)) * 100 +
    Object.keys(checkpoint.postIds).length * 10 +
    checkpoint.reviewedPostIds.length
  );
}
