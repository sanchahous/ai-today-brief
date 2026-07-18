import type { Json } from '@/lib/database.types';

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

export interface SocialAsset {
  url: string;
  width?: number;
  height?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  bytes?: number;
}

export interface QualityIssue {
  code: string;
  message: string;
  field?: 'post_text' | 'first_comment' | 'asset_urls' | 'alt_text' | 'source';
}

export interface QualityReport {
  blocking: QualityIssue[];
  warnings: QualityIssue[];
  checkedAt: string;
  critic?: {
    score: number;
    flags: string[];
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
  };
}

export interface SocialDraft {
  channel: SocialChannel;
  locale: SocialLocale;
  format: string;
  text: string;
  firstComment?: string | null;
  assets: SocialAsset[];
  altText?: string | null;
  scheduledFor: string;
  sourceApproved: boolean;
  sourceFacts: string[];
  sourceUrl: string;
  qualityReport?: QualityReport;
}

export interface SocialPostForDelivery {
  id: string;
  channel: SocialChannel;
  text: string;
  firstComment: string | null;
  assets: SocialAsset[];
  altText: string | null;
  idempotencyKey: string;
  attempt: number;
}

export interface PublishReceipt {
  externalId: string;
  url?: string | null;
  providerMeta?: Json;
}

export type PublishErrorKind = 'retryable' | 'permanent' | 'ambiguous';

export class SocialPublishError extends Error {
  constructor(
    message: string,
    readonly kind: PublishErrorKind,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'SocialPublishError';
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
