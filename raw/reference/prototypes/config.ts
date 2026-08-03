/**
 * Single source of truth for brand / domain / contact strings.
 *
 * These were previously hard-coded in several components (`SITE` in
 * features.tsx, HomePrototype.tsx, PostCard.tsx). Centralising them means the
 * still-open founder decisions — separate product domain vs. the personal
 * sub-path, and the working name "AI Brief" vs. "Latent" — become a one-line
 * change here instead of a find-and-replace across the prototype.
 */

/** Canonical origin + base path. Update here if the product moves to its own domain. */
export const SITE_URL = 'https://sashakuzmenko.com/ai-news-scrapper';

/** Working product name (research shortlist: "Latent"). */
export const SITE_NAME = 'AI Brief';

/** Curator / founder — drives the E-E-A-T byline and Organization schema. */
export const FOUNDER_NAME = 'Oleksandr Kuzmenko';
export const FOUNDER_INITIALS = 'OK';
/** Accent used for the founder/brand monogram mark. */
export const MARK_COLOR = '#47E4D3';

/** Contact + distribution endpoints (placeholders until the product domain lands). */
export const CONTACT_EMAIL = 'hello@aibrief.example';
export const ADVERTISE_EMAIL = 'sponsors@aibrief.example';
export const RSS_URL = `${SITE_URL}/rss.xml`;

export interface SocialLink {
  key: 'x' | 'telegram' | 'linkedin' | 'youtube' | 'rss';
  label: string;
  url: string;
}

/** Footer / share destinations. URLs are placeholders for the prototype. */
export const SOCIALS: SocialLink[] = [
  { key: 'x', label: 'X', url: 'https://x.com/' },
  { key: 'telegram', label: 'Telegram', url: 'https://t.me/' },
  { key: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/' },
  { key: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/' },
  { key: 'rss', label: 'RSS', url: RSS_URL },
];
