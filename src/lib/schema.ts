/**
 * Canonical schema.org entity nodes — exactly one Person (the human editor) and
 * one Organization (the brand), each with a stable `@id` referenced from every
 * page. This is what lets Google reconcile authorship across the whole site into
 * a single entity (the E-E-A-T / Google News consistent-author signal).
 *
 * Person `sameAs` = the editor's real personal profiles (`EDITOR_PROFILE.links`);
 * Organization `sameAs` = brand accounts (`SOCIALS`, set on the home page node).
 * Keep the two separate — a Person pointing at brand accounts defeats the signal.
 *
 * The home page defines the full `#org` + `#person` nodes (most-crawled); other
 * pages either define them too (author/about) or reference them by `@id`.
 */

import {
  EDITOR_ALT_NAME,
  EDITOR_NAME,
  EDITOR_PROFILE,
  EDITOR_ROLE,
  SITE_NAME,
  SITE_URL,
  type Lang,
} from './site';

export const PERSON_ID = `${SITE_URL}/#person`;
export const ORG_ID = `${SITE_URL}/#org`;

/**
 * Full editor Person node. Use as an article/guide `author` (its `@id` makes
 * every occurrence resolve to the same entity) or as a standalone graph node.
 */
export function authorNode(lang: Lang): Record<string, unknown> {
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: EDITOR_NAME,
    alternateName: EDITOR_ALT_NAME,
    url: `${SITE_URL}/${lang}/author`,
    jobTitle: EDITOR_ROLE[lang],
    sameAs: EDITOR_PROFILE.links.map((l) => l.url),
    knowsAbout: EDITOR_PROFILE.expertise[lang],
    worksFor: { '@id': ORG_ID },
  };
}

/**
 * Publisher Organization node carrying the canonical `#org` `@id` + logo
 * (required for NewsArticle/Article rich results). Use as a `publisher`.
 */
export function publisherNode(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png`, width: 512, height: 512 },
  };
}
