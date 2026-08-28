import type { Json } from '@/lib/database.types';
import type { DailyVisualInstagramCarouselSpec } from './daily-visual-carousel';
import type { InstagramCarouselSpec } from './instagram-carousel';

export const SOCIAL_CHANNELS = [
  'telegram',
  'x',
  'threads',
  'linkedin',
  'instagram',
  'facebook',
] as const;

export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];
export type PackageKind = 'daily_digest' | 'top_story' | 'weekly_digest' | 'breaking' | 'evergreen';
export type RiskLevel = 'green' | 'yellow' | 'red';
export type SocialStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'posted'
  | 'failed'
  | 'needs_reconciliation'
  | 'cancelled';

export type SocialLocale = 'uk' | 'en';

export const SOCIAL_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type SocialImageMimeType = (typeof SOCIAL_IMAGE_MIME_TYPES)[number];

export interface SocialAsset {
  url?: string;
  artifactId?: string;
  width?: number;
  height?: number;
  mimeType?: SocialImageMimeType;
  bytes?: number;
}

export interface PersistedSocialAssetRef {
  artifactId?: string;
  url?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  bytes?: number;
}

export interface ResolvedSocialAsset {
  url: string;
  artifactId?: string;
  width?: number;
  height?: number;
  mimeType: string;
  bytes?: number;
  slotKey?: string;
  artifactType?: string;
}

export interface QualityIssue {
  code: string;
  message: string;
  field?: 'post_text' | 'content_parts' | 'first_comment' | 'asset_urls' | 'alt_text' | 'source';
  span?: string;
  suggestedFix?: string;
}

export interface QualityReport {
  blocking: QualityIssue[];
  warnings: QualityIssue[];
  checkedAt: string;
  critic?: {
    score: number;
    flags: string[];
    platformFitScore?: number;
    platformFlags?: string[];
    /** How original/non-formulaic the copy reads, 0-100 -- weekly-only (PR7). */
    originalityScore?: number;
    originalityFlags?: string[];
    provider?: 'gemini' | 'openrouter' | 'ollama';
    model?: string;
    fallbackUsed?: boolean;
    attempts?: Array<{
      provider: 'gemini' | 'openrouter' | 'ollama';
      status: 'success' | 'failed' | 'unconfigured';
      model?: string;
      reason?: 'missing_config' | 'request_failed' | 'invalid_response';
    }>;
    auditedAt?: string;
    usage?: {
      promptTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
    };
  };
  platformFitScore?: number;
  hookAngle?: string;
  hookCandidates?: string[];
  /** Number of bounded writer repair rounds used before the copy passed every gate. */
  repairRounds?: number;
  /** Number of distinct candidates independently audited for this saved adaptation. */
  auditedCandidates?: number;
  writer?: {
    provider: 'gemini' | 'openrouter' | 'ollama';
    model: string;
    fallbackUsed: boolean;
    usage?: {
      promptTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
    };
  };
}

export interface SocialDraft {
  channel: SocialChannel;
  locale: SocialLocale;
  format: string;
  text: string;
  contentParts?: string[];
  firstComment?: string | null;
  assets: SocialAsset[];
  altText?: string | null;
  scheduledFor: string;
  sourceApproved: boolean;
  sourceFacts: string[];
  sourceUrl: string;
  qualityReport?: QualityReport;
  instagramCarousel?: InstagramCarouselSpec | DailyVisualInstagramCarouselSpec | null;
  currentRevisionItemIds?: string[];
}

export interface SocialPostForDelivery {
  id: string;
  channel: SocialChannel;
  text: string;
  contentParts?: string[];
  firstComment: string | null;
  assets: SocialAsset[];
  altText: string | null;
  idempotencyKey: string;
  attempt: number;
  providerMeta?: Json;
}

export interface PublishReceipt {
  externalId: string;
  url?: string | null;
  providerMeta?: Json;
}

export type PublishErrorKind = 'retryable' | 'permanent' | 'ambiguous';

interface SocialPublishErrorOptions extends ErrorOptions {
  providerMeta?: Json;
}

export class SocialPublishError extends Error {
  readonly providerMeta?: Json;

  constructor(
    message: string,
    readonly kind: PublishErrorKind,
    readonly code: string,
    options?: SocialPublishErrorOptions,
  ) {
    super(message, options);
    this.name = 'SocialPublishError';
    this.providerMeta = options?.providerMeta;
  }
}

export interface SocialPublisher {
  channel: SocialChannel;
  validate(post: SocialPostForDelivery): Promise<void> | void;
  publish(post: SocialPostForDelivery): Promise<PublishReceipt>;
  refreshCredentials?(): Promise<void>;
  fetchMetrics?(externalId: string): Promise<Json>;
}

export function isSocialChannel(value: string): value is SocialChannel {
  return (SOCIAL_CHANNELS as readonly string[]).includes(value);
}
