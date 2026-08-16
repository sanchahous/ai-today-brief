/**
 * Seed story copy for a freshly composed weekly digest.
 *
 * Every approved daily item already carries the long-form work the daily
 * pipeline paid an LLM for: a markdown body, a deep dive, takeaways, action
 * items, when-to-use notes. The weekly seed used to ignore all of it and write
 * `body = summary`, `takeaway = why it matters`, `practical = null` — so with
 * Content Studio off (the current default) every story reached the owner with
 * two of five fields filled and two of those literal duplicates of the other
 * two. This module maps the daily fields onto the weekly story shape instead.
 *
 * It is deliberately non-generative: it only re-uses text a human already
 * approved. A field with no daily source stays `null` so the owner writes it,
 * rather than being padded with a copy of a neighbouring field.
 */

import type { Lang } from '@/lib/site';

export interface SeedStorySource {
  summary_en: string;
  summary_uk: string;
  body_md_en?: string | null;
  body_md_uk?: string | null;
  deep_dive_en?: string | null;
  deep_dive_uk?: string | null;
  takeaways_en?: unknown;
  takeaways_uk?: unknown;
  action_items_en?: unknown;
  action_items_uk?: unknown;
  when_to_use_en?: unknown;
  when_to_use_uk?: unknown;
}

export interface SeedStoryContent {
  body: string;
  practical: string | null;
  takeaway: string | null;
}

/** Lead-in used when the only practical material is a when-to-use list. */
const WHEN_TO_USE_LEAD_IN: Record<Lang, string> = {
  en: 'Worth reaching for when:',
  uk: 'Варто застосовувати, коли:',
};

/** How many bullets of a daily list survive into one weekly paragraph. */
const MAX_TAKEAWAY_BULLETS = 3;
const MAX_PRACTICAL_BULLETS = 2;

function text(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

/** JSONB arrays are `unknown` until guarded — daily lists are arrays of strings. */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => (typeof entry === 'string' && entry.trim() ? [entry.trim()] : []));
}

/** Bullets read as sentences already; joined they render as one paragraph. */
function paragraph(bullets: string[]): string {
  return bullets.map((bullet) => (/[.!?…]$/.test(bullet) ? bullet : `${bullet}.`)).join(' ');
}

export function seedStoryContent(item: SeedStorySource, lang: Lang): SeedStoryContent {
  const summary = lang === 'uk' ? item.summary_uk : item.summary_en;
  const body =
    text(lang === 'uk' ? item.body_md_uk : item.body_md_en) ||
    text(lang === 'uk' ? item.deep_dive_uk : item.deep_dive_en) ||
    text(summary);

  const takeaways = stringList(lang === 'uk' ? item.takeaways_uk : item.takeaways_en);
  const actions = stringList(lang === 'uk' ? item.action_items_uk : item.action_items_en);
  const whenToUse = stringList(lang === 'uk' ? item.when_to_use_uk : item.when_to_use_en);

  const practical = actions.length
    ? paragraph(actions.slice(0, MAX_PRACTICAL_BULLETS))
    : whenToUse.length
      ? `${WHEN_TO_USE_LEAD_IN[lang]} ${paragraph(whenToUse.slice(0, MAX_PRACTICAL_BULLETS))}`
      : null;

  return {
    body,
    practical,
    takeaway: takeaways.length ? paragraph(takeaways.slice(0, MAX_TAKEAWAY_BULLETS)) : null,
  };
}
