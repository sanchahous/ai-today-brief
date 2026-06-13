/**
 * Single source of truth for brand / domain / contact / locale.
 * Change the brand or domain here, not scattered across components.
 */

export const SITE_NAME = 'AI Today Brief';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aitodaybrief.com';

export const SITE_TAGLINE = {
  en: 'The daily AI-engineering brief — for builders.',
  uk: 'Щоденний бриф з AI-інженерії — для тих, хто будує.',
} as const;

/** Locales — EN primary, UK secondary (low-competition wedge). */
export const LANGS = ['en', 'uk'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/**
 * Editor byline — E-E-A-T + Discover consistent-author signal. `EDITOR_NAME` is
 * the real/formal name; `EDITOR_ALT_NAME` is the public handle the personal
 * domain + LinkedIn slug use — schema carries both (`name`/`alternateName`) so
 * Google reconciles the two forms into one Person entity.
 */
export const EDITOR_NAME = 'Oleksandr Kuzmenko';
export const EDITOR_ALT_NAME = 'Sasha Kuzmenko';
export const EDITOR_ROLE = { en: 'Editor', uk: 'Редактор' } as const;

/**
 * Editor E-E-A-T profile. `links` are the editor's REAL personal profiles —
 * they back the Person `sameAs` (the human entity). Brand/social accounts live
 * in `SOCIALS` and back the Organization `sameAs`; keep the two separate.
 */
export const EDITOR_PROFILE = {
  expertise: {
    en: ['AI agents & MCP', 'developer tools', 'MLOps', 'LLM APIs'],
    uk: ['AI-агенти й MCP', 'інструменти для розробників', 'MLOps', 'LLM API'],
  },
  links: [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/sashakuzmenko' },
    { label: 'GitHub', url: 'https://github.com/sanchahous' },
    { label: 'Website', url: 'https://sashakuzmenko.com' },
  ],
} as const;
/** Accent for the brand monogram mark. */
export const MARK_COLOR = '#47E4D3';

export const CONTACT_EMAIL = 'hello@sashakuzmenko.com';
export const ADVERTISE_EMAIL = 'hello@sashakuzmenko.com';
export const RSS_URL = `${SITE_URL}/rss.xml`;

export type SocialKey = 'x' | 'telegram' | 'linkedin' | 'youtube' | 'rss';
export interface SocialLink {
  key: SocialKey;
  label: string;
  url: string;
}

/** Footer / share destinations. Handles to be reserved before launch. */
export const SOCIALS: readonly SocialLink[] = [
  { key: 'x', label: 'X', url: 'https://x.com/aitodaybrief' },
  { key: 'telegram', label: 'Telegram', url: 'https://t.me/aitodaybrief' },
  { key: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/aitodaybrief' },
  { key: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@aitodaybrief' },
  { key: 'rss', label: 'RSS', url: RSS_URL },
];
