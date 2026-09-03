import {
  weeklyPageUrl,
  weeklyTrackedUrl,
  withSocialClickToken,
  withWeeklySlug,
} from '@/lib/social/tracked-url';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collapseDuplicateUrl(text: string, url: string) {
  const pattern = new RegExp(`${escapeRegex(url)}(?:\\s+${escapeRegex(url)})+`, 'g');
  return text.replace(pattern, url);
}

export function rewriteSocialCopyUrls(
  text: string,
  input: { token: string; trackedUrl: string; oldSlug: string; newSlug: string },
): string {
  const origin = new URL(input.trackedUrl).origin;
  let next = text.replaceAll(`${origin}/r/s/${input.token}`, input.trackedUrl);
  next = next.replaceAll(`/r/s/${input.token}`, input.trackedUrl);
  const slugs = [...new Set([input.oldSlug, input.newSlug])];
  for (const slug of slugs) {
    const pattern = new RegExp(
      `${escapeRegex(origin)}/(en|uk)/weekly/${escapeRegex(slug)}(?:\\?[^\\s]*)?`,
      'g',
    );
    next = next.replace(pattern, input.trackedUrl);
  }
  return collapseDuplicateUrl(next, input.trackedUrl);
}

export function previewWeeklyTrackedUrl(
  locale: string,
  slug: string,
  channel: string,
  token: string,
  utmUrl: string | null,
) {
  if (utmUrl) return withSocialClickToken(withWeeklySlug(utmUrl, slug), token);
  return weeklyTrackedUrl(locale, slug, token, { source: channel });
}

export { weeklyPageUrl };
