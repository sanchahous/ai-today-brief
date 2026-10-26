/**
 * Consent region — decides whether analytics are opt-in or opt-out for a
 * visitor. Opt-in everywhere (PR #396) hid ~90% of readers from GA4 and from
 * the first-party reward beacon: `item_events` human sessions fell from 41–46
 * to 4–6 a week after 2026-10-02. Prior consent is a legal requirement only
 * under the ePrivacy rules of the EEA, the UK and Switzerland, so those stay
 * opt-in; everyone else gets analytics by default and can switch them off in
 * the cookie card.
 *
 * The proxy writes the region into a cookie from `x-vercel-ip-country`, so
 * ISR-cached HTML stays shared while the inline Consent Mode defaults and the
 * client analytics gate can read it. A missing or unknown country is `strict`.
 */
export const CONSENT_REGION_COOKIE = 'atb-consent-region';

export type ConsentRegion = 'strict' | 'standard';

/** EU-27 + EEA (IS, LI, NO) + UK + Switzerland, ISO 3166-1 alpha-2. */
export const STRICT_CONSENT_COUNTRIES: ReadonlySet<string> = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'GB', 'CH',
]);

export function consentRegionForCountry(country: string | null | undefined): ConsentRegion {
  const code = country?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return 'strict';
  return STRICT_CONSENT_COUNTRIES.has(code) ? 'strict' : 'standard';
}

/** Reads the region from a `document.cookie`-style string; anything else is `strict`. */
export function readConsentRegion(cookies: string | null | undefined): ConsentRegion {
  const match = (cookies ?? '').match(/(?:^|;\s*)atb-consent-region=(strict|standard)(?:;|$)/);
  return match?.[1] === 'standard' ? 'standard' : 'strict';
}

/** Analytics default when the visitor has not made a choice yet. */
export function analyticsDefaultFor(region: ConsentRegion): boolean {
  return region === 'standard';
}
