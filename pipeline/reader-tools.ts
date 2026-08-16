/**
 * Daily-tool lifecycle: which headlines are about the reader's working IDE
 * (Cursor, Claude Code, Codex, …) changing owner, shutting down, or closing a
 * deal — vs generic AI-industry M&A/funding the playbook filter should still
 * drop. Used by rank demotion, same-event clustering, and semantic-dedup
 * false-positive checks.
 */

export const FOLLOW_UP_OWNERSHIP_DAYS = 14;

const READER_TOOL_PATTERNS: Array<[RegExp, string]> = [
  [/\bclaude code\b|\bclaude-code\b/i, 'claude-code'],
  [/\bcursor\b/i, 'cursor'],
  [/\bcodex\b/i, 'codex'],
  [/\bcopilot\b/i, 'copilot'],
  [/\bgemini cli\b/i, 'gemini-cli'],
  [/\bclaude\b|\banthropic\b/i, 'anthropic'],
  [/\bopenai\b|\bchatgpt\b/i, 'openai'],
  [/\bgemini\b/i, 'gemini'],
];

const ORG_PATTERNS: Array<[RegExp, string]> = [
  [/\bspacexai\b|\bspacex\b|\bspace x\b/i, 'spacex'],
  [/\banysphere\b/i, 'anysphere'],
  [/\bgoogle\b|\balphabet\b|\bdeepmind\b/i, 'google'],
  [/\bmicrosoft\b/i, 'microsoft'],
  [/\bamazon\b|\baws\b/i, 'amazon'],
  [/\bmeta\b|\bfacebook\b/i, 'meta'],
  [/\bnvidia\b/i, 'nvidia'],
  [/\bxai\b|\bx\.ai\b/i, 'xai'],
  [/\banthropic\b/i, 'anthropic'],
  [/\bopenai\b/i, 'openai'],
];

/** Ownership / close / takeover of a named product — not funding, IPO, or hires. */
const OWNERSHIP_RE =
  /\b(acquisitions?|acquired|acquires|acquiring|bought|buyout|takeover|\bmerger\b|to buy|is buying|will (?:buy|acquire)|agrees to (?:buy|acquire)|now a part of|is now part of|closes?(?: its)?(?: \w+)? acquisition)\b/i;

const OWNERSHIP_CLOSE_RE =
  /\b(closes?|completed|officially (?:acquired|bought|closed)|now a part of|is now part of)\b/i;

const OWNERSHIP_ANNOUNCE_RE =
  /\b(to buy|agrees to|will acquire|is buying|to acquire)\b/i;

const RUMOR_RE = /\b(rumo(?:u)?rs?|denies|clarifies|independent|not selling)\b/i;

export type StoryShape =
  | 'ownership'
  | 'rumor'
  | 'security'
  | 'funding'
  | 'pricing'
  | 'release'
  | 'other';

function addMatches(ids: Set<string>, title: string, patterns: Array<[RegExp, string]>) {
  for (const [re, id] of patterns) {
    if (re.test(title)) ids.add(id);
  }
}

/** Reader-tool + company ids mentioned in a headline. */
export function titleEntityIds(title: string): Set<string> {
  const ids = new Set<string>();
  addMatches(ids, title, READER_TOOL_PATTERNS);
  addMatches(ids, title, ORG_PATTERNS);
  return ids;
}

export function mentionsReaderTool(title: string): boolean {
  return READER_TOOL_PATTERNS.some(([re]) => re.test(title));
}

export function isAcquisitionRumor(title: string): boolean {
  if (!RUMOR_RE.test(title) || OWNERSHIP_CLOSE_RE.test(title)) return false;
  return OWNERSHIP_RE.test(title);
}

/**
 * True when the headline is an ownership change of a daily tool (Cursor bought
 * by SpaceX) — not a funding round that merely name-drops the tool.
 */
export function isReaderToolOwnershipChange(title: string): boolean {
  if (!mentionsReaderTool(title)) return false;
  if (isAcquisitionRumor(title)) return false;
  return OWNERSHIP_RE.test(title);
}

export function isOwnershipClose(title: string): boolean {
  return isReaderToolOwnershipChange(title) && OWNERSHIP_CLOSE_RE.test(title);
}

export function isOwnershipAnnounce(title: string): boolean {
  return isReaderToolOwnershipChange(title) && OWNERSHIP_ANNOUNCE_RE.test(title);
}

/**
 * Same corporate takeover told with different verbs ("part of SpaceX" vs
 * "bought Cursor for $60B"). Requires two shared entities so "Cursor acquires
 * Continue" does not merge with "SpaceX acquires Cursor".
 */
export function sameOwnershipEvent(titleA: string, titleB: string): boolean {
  if (!isReaderToolOwnershipChange(titleA) || !isReaderToolOwnershipChange(titleB)) {
    return false;
  }
  const shared = [...titleEntityIds(titleA)].filter((id) => titleEntityIds(titleB).has(id));
  return shared.length >= 2;
}

export function storyShape(title: string): StoryShape {
  if (isAcquisitionRumor(title)) return 'rumor';
  if (isReaderToolOwnershipChange(title)) return 'ownership';
  if (/\b(cve-?\d|0day|0-day|rce|vulnerabilit|exploit|advisory)\b/i.test(title)) return 'security';
  if (/\b(series [a-f]\b|funding round|valuation|\bipo\b)\b/i.test(title)) return 'funding';
  if (/raises? \$\d/i.test(title)) return 'funding';
  if (/\b(price|pricing|subscription|\$\/mo|free tier)\b/i.test(title)) return 'pricing';
  if (/\b(released?|ships?|launch(?:es)?|adds?|introduces?)\b/i.test(title)) return 'release';
  return 'other';
}

function utcDayDiff(fromDate: string, toDate: string): number {
  const from = Date.parse(fromDate.length <= 10 ? `${fromDate}T00:00:00Z` : fromDate);
  const to = Date.parse(toDate.length <= 10 ? `${toDate}T00:00:00Z` : toDate);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.floor((to - from) / 86_400_000);
}

export interface EmbedFalsePositiveInput {
  candidateTitle: string;
  publishedTitle: string;
  publishedDate: string;
  candidateDate: string;
}

/**
 * Cosine said "same story" but the headlines are a different event (0day vs
 * acquisition) or a close months after the announce. True → keep the candidate.
 */
export function isEmbedFalsePositive(input: EmbedFalsePositiveInput): boolean {
  const { candidateTitle, publishedTitle, publishedDate, candidateDate } = input;
  if (isAcquisitionRumor(publishedTitle) && isReaderToolOwnershipChange(candidateTitle)) {
    return true;
  }
  if (
    isOwnershipClose(candidateTitle) &&
    isOwnershipAnnounce(publishedTitle) &&
    utcDayDiff(publishedDate, candidateDate) > FOLLOW_UP_OWNERSHIP_DAYS
  ) {
    return true;
  }
  if (sameOwnershipEvent(candidateTitle, publishedTitle)) return false;
  const candShape = storyShape(candidateTitle);
  const pubShape = storyShape(publishedTitle);
  if (candShape !== pubShape && candShape !== 'other' && pubShape !== 'other') {
    return mentionsReaderTool(candidateTitle) && mentionsReaderTool(publishedTitle);
  }
  return false;
}

/** Path `/2024/` more than one calendar year behind `now` is a stale primary. */
export function newsUrlPathYear(url: string): number | null {
  try {
    const match = new URL(url).pathname.match(/\/(20\d{2})\b/);
    if (!match?.[1]) return null;
    return Number(match[1]);
  } catch {
    return null;
  }
}

export function isStaleNewsUrl(url: string, now = new Date()): boolean {
  const year = newsUrlPathYear(url);
  if (year == null) return false;
  return year < now.getUTCFullYear() - 1;
}
