import { createHash } from 'node:crypto';
import type { DailyVisualInstagramCarouselSpec } from './daily-visual-carousel';
import type { InstagramCarouselSpec } from './instagram-carousel';
import type { SocialAsset, SocialChannel, SocialLocale } from './types';

interface HashableSocialContent {
  channel: SocialChannel;
  locale: SocialLocale;
  format: string;
  text: string;
  contentParts?: string[];
  firstComment?: string | null;
  assets?: SocialAsset[];
  altText?: string | null;
  scheduledFor: string;
  contentVersion: number;
  instagramCarousel?: InstagramCarouselSpec | DailyVisualInstagramCarouselSpec | null;
}

function stableAssets(assets: SocialAsset[] = []) {
  return assets.map((asset) => ({
    artifactId: asset.artifactId ?? null,
    url: asset.artifactId ? null : (asset.url ?? null),
    width: asset.width ?? null,
    height: asset.height ?? null,
    mimeType: asset.mimeType ?? null,
    bytes: asset.bytes ?? null,
  }));
}

export function socialContentHash(content: HashableSocialContent): string {
  const canonical = JSON.stringify({
    channel: content.channel,
    locale: content.locale,
    format: content.format,
    text: content.text.trim(),
    contentParts: (content.contentParts ?? []).map((part) => part.trim()),
    firstComment: content.firstComment?.trim() || null,
    assets: stableAssets(content.assets),
    altText: content.altText?.trim() || null,
    scheduledFor: new Date(content.scheduledFor).toISOString(),
    contentVersion: content.contentVersion,
    instagramCarousel: content.instagramCarousel ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
