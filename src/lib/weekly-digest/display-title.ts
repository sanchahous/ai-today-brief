import type { Lang } from '@/lib/site';

export type WeeklyRevisionTitleFields = {
  title_en: string | null | undefined;
  title_uk: string | null | undefined;
  display_title_en?: string | null;
  display_title_uk?: string | null;
};

function nonblank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

/**
 * Display titles are editorial adaptations, not translations to borrow across
 * locales. A missing localized display title therefore falls back to that
 * locale's canonical revision title, preserving the SEO/listing contract.
 */
export function weeklyRevisionTitlePresentation(
  lang: Lang,
  revision: WeeklyRevisionTitleFields,
): { canonicalTitle: string; displayTitle: string } {
  const displayTitle = lang === 'uk' ? revision.display_title_uk : revision.display_title_en;
  const canonicalTitle = lang === 'uk' ? revision.title_uk : revision.title_en;
  const otherCanonicalTitle = lang === 'uk' ? revision.title_en : revision.title_uk;
  const canonical = nonblank(canonicalTitle) ?? nonblank(otherCanonicalTitle) ?? '';
  return { canonicalTitle: canonical, displayTitle: nonblank(displayTitle) ?? canonical };
}

export function localizedWeeklyDisplayTitle(
  lang: Lang,
  revision: WeeklyRevisionTitleFields,
): string {
  return weeklyRevisionTitlePresentation(lang, revision).displayTitle;
}
