/** Shared, platform-neutral social publishing helpers. */

export const SOCIAL_CHANNELS = ['telegram', 'threads', 'x', 'instagram', 'facebook'] as const;

export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];

const DEFAULT_SOCIAL_CHANNELS: SocialChannel[] = ['telegram', 'x'];

function isSocialChannel(value: string): value is SocialChannel {
  return (SOCIAL_CHANNELS as readonly string[]).includes(value);
}

/**
 * Parse the explicit publication allowlist. Existing Telegram/X delivery stays
 * unchanged until an operator adds a different SOCIAL_CHANNELS value.
 */
export function parseSocialChannels(raw: string | undefined): SocialChannel[] {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return [...DEFAULT_SOCIAL_CHANNELS];
  if (normalized === 'none') return [];

  const values = normalized
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const invalid = values.filter((value) => !isSocialChannel(value));
  if (invalid.length > 0) {
    throw new Error(`[social] Unknown SOCIAL_CHANNELS value(s): ${invalid.join(', ')}`);
  }
  return [...new Set(values as SocialChannel[])];
}

export interface SocialItemUrlInput {
  lang: 'en' | 'uk';
  briefSlug: string;
  itemSlug: string;
  channel: SocialChannel;
  campaign?: string;
  content?: string;
}

/**
 * Canonical article URL plus a stable UTM convention. Keeping this in one
 * place lets GA4 attribute sessions, newsletter signups and item engagement to
 * both the platform and the individual post variant.
 */
export function buildSocialItemUrl(siteUrl: string, input: SocialItemUrlInput): string {
  const base = new URL(siteUrl);
  const prefix = base.pathname.replace(/\/$/, '');
  const path = [input.lang, input.briefSlug, input.itemSlug].map(encodeURIComponent).join('/');
  base.pathname = `${prefix}/${path}`;
  base.search = '';
  base.hash = '';
  base.searchParams.set('utm_source', input.channel);
  base.searchParams.set('utm_medium', 'social');
  base.searchParams.set('utm_campaign', input.campaign ?? 'daily_news');
  if (input.content) base.searchParams.set('utm_content', input.content);
  return base.toString();
}
