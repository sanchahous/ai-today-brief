import type { Lang } from '@/lib/site';

/** Calendar zone for “is this the latest edition’s day?” — the brief’s publish clock. */
export const EDITION_TIME_ZONE = 'Europe/Kyiv';

const WORDS_PER_MINUTE = 45;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface MastheadStat {
  kind: 'stories7d' | 'categories';
  value: number;
}

export interface CoverageRow {
  date: string;
  edition: number;
  rank: number;
  categorySlug: string | null;
}

export interface WeeklyFactParts {
  summary: string;
  why: string;
  sources: unknown;
  snapshot: unknown;
}

export interface WeeklyBandFacts {
  stories: number;
  minutes: number;
  sources: number;
  issueNumber: number | null;
}

type PluralKind = 'stories' | 'minutes' | 'sources' | 'concepts' | 'categories';

const PLURAL_FORMS: Record<Lang, Record<PluralKind, Record<string, string>>> = {
  en: {
    stories: { one: 'story', other: 'stories' },
    minutes: { one: 'min read', other: 'min read' },
    sources: { one: 'source', other: 'sources' },
    concepts: { one: 'explainer', other: 'explainers' },
    categories: { one: 'category', other: 'categories' },
  },
  uk: {
    stories: { one: 'історія', few: 'історії', many: 'історій', other: 'історії' },
    minutes: { one: 'хв читання', few: 'хв читання', many: 'хв читання', other: 'хв читання' },
    sources: { one: 'джерело', few: 'джерела', many: 'джерел', other: 'джерела' },
    concepts: { one: 'пояснення', few: 'пояснення', many: 'пояснень', other: 'пояснення' },
    categories: { one: 'рубрика', few: 'рубрики', many: 'рубрик', other: 'рубрики' },
  },
};

export function shiftIsoDate(iso: string, days: number): string | null {
  if (!ISO_DATE.test(iso)) return null;
  const [year, month, day] = iso.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function calendarDateInZone(now: Date, timeZone = EDITION_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Only numbers we actually counted. The old “70+” / “120+” claims are not
 * emitted here — there is no source registry total to stand behind “120+”.
 */
export function mastheadStats(input: {
  storiesLast7Days: number | null;
  categoryCount: number;
}): MastheadStat[] {
  const stats: MastheadStat[] = [];
  if (input.storiesLast7Days !== null && input.storiesLast7Days > 0) {
    stats.push({ kind: 'stories7d', value: input.storiesLast7Days });
  }
  if (input.categoryCount > 0) {
    stats.push({ kind: 'categories', value: input.categoryCount });
  }
  return stats;
}

export function pluralLabel(count: number, lang: Lang, kind: PluralKind): string {
  const forms = PLURAL_FORMS[lang][kind];
  const category = new Intl.PluralRules(lang === 'uk' ? 'uk-UA' : 'en-US').select(count);
  return forms[category] ?? forms.other ?? forms.many ?? forms.one ?? '';
}

/** Edition-1 slug for a calendar day (lowest edition if 1 is missing). */
export function leadSlug(
  briefs: readonly { date: string; edition: number; slug: string | null }[],
  date: string,
): string | null {
  let lead: { edition: number; slug: string } | null = null;
  for (const brief of briefs) {
    if (brief.date !== date || !brief.slug) continue;
    if (!lead || brief.edition < lead.edition) lead = { edition: brief.edition, slug: brief.slug };
  }
  return lead?.slug ?? null;
}

/** `items` must already be newest-day first. */
export function itemsOnNewestDay<T extends { date: string }>(items: readonly T[]): T[] {
  const date = items[0]?.date;
  if (!date) return [];
  return items.filter((item) => item.date === date);
}

export function sumReadMinutes(items: readonly { readMinutes: number }[]): number {
  let total = 0;
  for (const item of items) {
    if (item.readMinutes > 0) total += item.readMinutes;
  }
  return total;
}

export function newestCoverageSlugs(rows: readonly CoverageRow[], limit = 100): (string | null)[] {
  const sorted = [...rows].sort((a, b) => compareCoverage(a, b));
  return sorted.slice(0, limit).map((row) => row.categorySlug);
}

function compareCoverage(a: CoverageRow, b: CoverageRow): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.edition !== b.edition) return a.edition - b.edition;
  return a.rank - b.rank;
}

export function coverageShares(
  slugs: readonly (string | null | undefined)[],
): { slug: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const slug of slugs) {
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  const shares: { slug: string; count: number }[] = [];
  for (const [slug, count] of counts) shares.push({ slug, count });
  shares.sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
  return shares;
}

export function mentionWindows(
  items: readonly { tools: readonly string[]; date: string }[],
): Map<string, { mentions: number; delta: number | null }> {
  const result = new Map<string, { mentions: number; delta: number | null }>();
  const newest = newestIso(items);
  if (!newest) return result;
  const recentCutoff = shiftIsoDate(newest, -6);
  const priorCutoff = shiftIsoDate(newest, -13);
  if (!recentCutoff || !priorCutoff) return result;

  const recent = new Map<string, number>();
  const prior = new Map<string, number>();
  const priorExists = tallyMentions(items, recentCutoff, priorCutoff, recent, prior);
  for (const [name, mentions] of recent) {
    const previous = prior.get(name) ?? 0;
    result.set(name, { mentions, delta: priorExists ? mentions - previous : null });
  }
  return result;
}

function newestIso(items: readonly { date: string }[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    if (!best || item.date > best) best = item.date;
  }
  return best;
}

function tallyMentions(
  items: readonly { tools: readonly string[]; date: string }[],
  recentCutoff: string,
  priorCutoff: string,
  recent: Map<string, number>,
  prior: Map<string, number>,
): boolean {
  let priorExists = false;
  for (const item of items) {
    const bucket = mentionBucket(item.date, recentCutoff, priorCutoff);
    if (bucket === 'prior') priorExists = true;
    if (!bucket) continue;
    const target = bucket === 'recent' ? recent : prior;
    addTools(target, item.tools);
  }
  return priorExists;
}

function mentionBucket(
  date: string,
  recentCutoff: string,
  priorCutoff: string,
): 'recent' | 'prior' | null {
  if (date >= recentCutoff) return 'recent';
  if (date >= priorCutoff) return 'prior';
  return null;
}

function addTools(target: Map<string, number>, tools: readonly string[]): void {
  for (const tool of tools) {
    const name = tool.trim();
    if (!name) continue;
    target.set(name, (target.get(name) ?? 0) + 1);
  }
}

export function focusConcepts(
  topics: readonly { name: string; conceptSlug?: string | null }[],
  limit = 5,
): { name: string; slug: string }[] {
  const out: { name: string; slug: string }[] = [];
  const seen = new Set<string>();
  for (const topic of topics) {
    const slug = topic.conceptSlug?.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ name: topic.name, slug });
    if (out.length === limit) break;
  }
  return out;
}

export function readMinutesForParts(parts: readonly { summary: string; why: string }[]): number {
  let total = 0;
  for (const part of parts) {
    const words = wordCount(part.summary) + wordCount(part.why);
    if (words === 0) continue;
    total += Math.max(2, Math.round(words / WORDS_PER_MINUTE));
  }
  return total;
}

export function weeklyFactsFromRows(rows: readonly WeeklyFactParts[]): {
  stories: number;
  minutes: number;
  sources: number;
} {
  return {
    stories: rows.length,
    minutes: readMinutesForParts(rows),
    sources: distinctSourceCount(rows.flatMap((row) => [row.sources, row.snapshot])),
  };
}

export function issueNumberFromWeekStarts(
  weekStarts: readonly string[],
  weekStart: string,
): number | null {
  if (!weekStart) return null;
  const unique = [...new Set(weekStarts)].sort((a, b) => a.localeCompare(b));
  const index = unique.indexOf(weekStart);
  return index === -1 ? null : index + 1;
}

export function distinctSourceCount(values: readonly unknown[]): number {
  const seen = new Set<string>();
  const stack: { value: unknown; depth: number }[] = [];
  for (const value of values) stack.push({ value, depth: 0 });
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) break;
    absorbSource(next.value, next.depth, seen, stack);
  }
  return seen.size;
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function absorbSource(
  value: unknown,
  depth: number,
  seen: Set<string>,
  stack: { value: unknown; depth: number }[],
): void {
  if (value == null || depth > 4) return;
  if (typeof value === 'string') {
    const key = httpKey(value);
    if (key) seen.add(key);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) stack.push({ value: entry, depth: depth + 1 });
    return;
  }
  if (typeof value !== 'object') return;
  const row = value as Record<string, unknown>;
  const key = sourceIdentity(row);
  if (key) seen.add(key);
  if (row.source && row.source !== value) stack.push({ value: row.source, depth: depth + 1 });
}

function sourceIdentity(row: Record<string, unknown>): string | null {
  const url = firstString(row, ['url', 'source_url', 'href']);
  if (url) return httpKey(url);
  const name = firstString(row, ['name', 'source_name']);
  return name ? `name:${name.trim().toLowerCase()}` : null;
}

function firstString(row: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function httpKey(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}
