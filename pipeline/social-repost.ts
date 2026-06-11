/**
 * Daily top-story repost — pure selection, formatting and OAuth1 signing
 * (unit-tested). The network/DB runner lives in
 * `pipeline/scripts/social-repost.ts`.
 *
 * Only PUBLISHED, human-approved items are eligible (same safety argument as
 * the weekly digest: no new content, the editorial gate already ran). One
 * story per channel per day.
 *
 * X-specific shape: the link goes into a REPLY, not the main post — X
 * suppresses link-post reach and (since Feb 2026) bills URL-bearing posts at
 * ~13x the standard pay-per-use rate, so the main post is a native hook.
 */

import { createHmac } from 'node:crypto';
import { escapeHtml } from './review-format';
import { digestLineSummary } from './weekly-digest';

export interface RepostCandidate {
  id: string;
  title_en: string;
  title_uk: string;
  social_hook_en: string | null;
  social_hook_uk: string | null;
  summary_en: string;
  summary_uk: string;
  impact_level: string | null;
  briefSlug: string;
  itemSlug: string;
  /** Brief date (ISO) — newer wins inside the same impact tier. */
  date: string;
  rank: number;
}

const IMPACT_SCORE: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** The day's top story: impact first, fresh first, editor rank last. */
export function selectTopStory(
  candidates: RepostCandidate[],
  excludeIds: ReadonlySet<string> = new Set(),
): RepostCandidate | null {
  const eligible = candidates.filter((c) => !excludeIds.has(c.id));
  if (eligible.length === 0) return null;
  return eligible.reduce((best, c) => {
    const ib = IMPACT_SCORE[best.impact_level ?? ''] ?? 1;
    const ic = IMPACT_SCORE[c.impact_level ?? ''] ?? 1;
    if (ic !== ib) return ic > ib ? c : best;
    if (c.date !== best.date) return c.date > best.date ? c : best;
    return c.rank < best.rank ? c : best;
  });
}

const X_POST_LIMIT = 280;

export interface XPost {
  /** Native, link-free main post. */
  text: string;
  /** Link reply posted under the main post. */
  reply: string;
}

/** Main X post from the hook (fallback: title), link in the reply. */
export function formatXPost(item: RepostCandidate, siteUrl: string): XPost {
  const hook = (item.social_hook_en ?? '').trim() || item.title_en.trim();
  const text = hook.length > X_POST_LIMIT ? `${hook.slice(0, X_POST_LIMIT - 1)}…` : hook;
  const url = `${siteUrl}/en/${item.briefSlug}/${item.itemSlug}`;
  return { text, reply: `Full brief → ${url}` };
}

/** Telegram-HTML channel post (UK-first, like the weekly digest). */
export function formatTelegramPost(item: RepostCandidate, siteUrl: string): string {
  const url = `${siteUrl}/uk/${item.briefSlug}/${item.itemSlug}`;
  const hook = (item.social_hook_uk ?? '').trim() || digestLineSummary(item.summary_uk);
  return [
    `🔥 <b>Новина дня</b>`,
    '',
    `<a href="${escapeHtml(url)}"><b>${escapeHtml(item.title_uk || item.title_en)}</b></a>`,
    escapeHtml(hook),
    '',
    `Щоденний бриф → ${siteUrl}/uk`,
  ].join('\n');
}

// ─── OAuth 1.0a (X API) ──────────────────────────────────────────────────────

export interface OAuth1Credentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessSecret: string;
}

/** RFC 3986 strict percent-encoding (OAuth1 requires !*'() escaped too). */
export function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * OAuth1 HMAC-SHA1 Authorization header. `extraParams` are query/form params
 * that take part in the signature; a JSON request body does NOT (per spec) —
 * which is exactly the X API v2 `POST /2/tweets` case.
 * `nonce`/`timestamp` are injected so the function stays pure and testable.
 */
export function buildOAuth1Header(
  method: string,
  url: string,
  creds: OAuth1Credentials,
  nonce: string,
  timestamp: string,
  extraParams: Record<string, string> = {},
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...extraParams, ...oauthParams };
  const paramString = Object.keys(allParams)
    .map((k) => [percentEncode(k), percentEncode(allParams[k]!)] as const)
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.accessSecret)}`;
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');

  const header = { ...oauthParams, oauth_signature: signature };
  return `OAuth ${Object.keys(header)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(header[k as keyof typeof header]!)}"`)
    .join(', ')}`;
}
