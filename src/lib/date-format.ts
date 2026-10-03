import type { Lang } from '@/lib/site';

/**
 * Formats a date string for the edition row in the header.
 * Uses en-GB to produce "14 October" format for English.
 */
export function formatEditionDate(dateString: string | null | undefined, lang: Lang): string | null {
  if (!dateString) return null;
  
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateString);
  const parsed = new Date(dateString);
  
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-GB', {
    timeZone: isDateOnly ? 'UTC' : undefined,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(parsed);
}
