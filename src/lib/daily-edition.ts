import type { Lang } from '@/lib/site';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface BriefDateParts {
  iso: string;
  day: string;
  month: string;
  weekday: string;
  full: string;
  short: string;
}

export interface TakeawayLine {
  text: string;
  categorySlug: string | null;
  categoryName: string | null;
  categoryColor: string | null;
}

export interface PracticeStep {
  itemId: string;
  step: string;
}

interface TakeawaySource {
  takeaways: readonly string[];
  categorySlug: string | null;
  categoryName: string | null;
  categoryColor: string | null;
}

interface PracticeSource {
  id: string;
  actionItems: readonly string[];
}

function localeFor(lang: Lang): string {
  return lang === 'uk' ? 'uk-UA' : 'en-US';
}

function calendarDate(iso: string): Date | null {
  if (!ISO_DATE.test(iso)) return null;
  const [year, month, day] = iso.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** Masthead and breadcrumb dates. Invalid calendar days return null — never a guessed label. */
export function briefDateParts(iso: string, lang: Lang): BriefDateParts | null {
  const date = calendarDate(iso);
  if (!date) return null;
  const locale = localeFor(lang);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, options).format(date);
  return {
    iso,
    day: format({ day: 'numeric' }),
    month: format({ month: 'short' }),
    weekday: format({ weekday: 'long' }),
    full: format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    short: format({ day: 'numeric', month: 'short' }),
  };
}

export function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const lines: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (trimmed) lines.push(trimmed);
  }
  return lines;
}

/** Prefer the page language; fall back to the other locale only when it is empty. */
export function localizedList(lang: Lang, en: unknown, uk: unknown): string[] {
  const primary = stringList(lang === 'uk' ? uk : en);
  if (primary.length > 0) return primary;
  return stringList(lang === 'uk' ? en : uk);
}

/**
 * Source name stored on a citation, when the pipeline wrote one.
 * Citation titles are article titles, not publication names — they are not used.
 */
export function citationSourceName(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const name = (entry as { source_name?: unknown }).source_name;
    if (typeof name !== 'string') continue;
    const trimmed = name.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/** First takeaway of each item, in issue order, capped. Items without takeaways are skipped. */
export function openingTakeaways(items: readonly TakeawaySource[], limit = 3): TakeawayLine[] {
  const lines: TakeawayLine[] = [];
  const cap = limit > 0 ? limit : 0;
  for (const item of items) {
    const text = item.takeaways.find((line) => line.trim());
    if (!text) continue;
    lines.push({
      text: text.trim(),
      categorySlug: item.categorySlug,
      categoryName: item.categoryName,
      categoryColor: item.categoryColor,
    });
    if (lines.length === cap) break;
  }
  return lines;
}

/** The first real action step in the issue. No step means the practice block stays off. */
export function firstPracticeStep(items: readonly PracticeSource[]): PracticeStep | null {
  for (const item of items) {
    const step = item.actionItems.find((line) => line.trim());
    if (!step) continue;
    return { itemId: item.id, step: step.trim() };
  }
  return null;
}

/** Hide "why it matters" when the field is empty or only repeats the summary. */
export function distinctWhy(why: string, summary: string): string | null {
  const cleaned = why.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  if (cleaned === summary.replace(/\s+/g, ' ').trim()) return null;
  return cleaned;
}

export function fillCountTemplate(template: string, read: number, total: number): string {
  return template.replaceAll('{read}', String(read)).replaceAll('{total}', String(total));
}
