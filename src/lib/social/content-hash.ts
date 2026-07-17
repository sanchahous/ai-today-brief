import { createHash } from 'node:crypto';
import type { SocialAsset, SocialChannel, SocialLocale } from './types';

interface HashableSocialContent {
  channel: SocialChannel;
  locale: SocialLocale;
  format: string;
  text: string;
  firstComment?: string | null;
  assets?: SocialAsset[];
  altText?: string | null;
  scheduledFor: string;
  contentVersion: number;
}

function stableAssets(assets: SocialAsset[] = []) {
  return assets.map(({ url, width, height, mimeType, bytes }) => ({
    url,
    width: width ?? null,
    height: height ?? null,
    mimeType: mimeType ?? null,
    bytes: bytes ?? null,
  }));
}

export function socialContentHash(content: HashableSocialContent): string {
  const canonical = JSON.stringify({
    channel: content.channel,
    locale: content.locale,
    format: content.format,
    text: content.text.trim(),
    firstComment: content.firstComment?.trim() || null,
    assets: stableAssets(content.assets),
    altText: content.altText?.trim() || null,
    scheduledFor: new Date(content.scheduledFor).toISOString(),
    contentVersion: content.contentVersion,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
