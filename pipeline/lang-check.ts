/**
 * Lightweight Ukrainian-text heuristic for the `_uk` fields the LLM returns.
 *
 * The realistic failure mode is the model echoing English (or the parser
 * falling back to the EN value) — not subtle dialect issues — so a
 * Cyrillic-share check is enough. Tech copy legitimately keeps product names
 * in Latin ("Claude Code 2.0 вийшов"), hence a share threshold rather than
 * requiring Cyrillic to dominate outright. Russian-specific letters fail the
 * check outright: they never appear in valid Ukrainian.
 */

/** Minimum share of Cyrillic among letters for text to count as Ukrainian. */
const MIN_CYRILLIC_SHARE = 0.3;

const CYRILLIC = /[Ѐ-ӿ]/g;
const LATIN = /[a-z]/gi;
const RUSSIAN_ONLY = /[ыэъё]/i;

export function looksUkrainian(
  text: string,
  options: { minShare?: number } = {},
): boolean {
  const t = text.trim();
  if (!t) return false;
  if (RUSSIAN_ONLY.test(t)) return false;
  const cyrillic = (t.match(CYRILLIC) ?? []).length;
  if (cyrillic === 0) return false;
  const latin = (t.match(LATIN) ?? []).length;
  return cyrillic / (cyrillic + latin) >= (options.minShare ?? MIN_CYRILLIC_SHARE);
}

/**
 * Names of the `_uk` fields whose text does not look Ukrainian. Empty fields
 * are skipped when their EN counterpart is empty too (nothing was expected).
 * Titles are short and product-name-heavy ("OpenAI Codex CLI 2.0 вийшов"), so
 * they only need Cyrillic presence; the share threshold would flag valid
 * Ukrainian there. Longer fields use the share check — the failure mode being
 * caught is the model echoing English, which has no Cyrillic at all.
 */
export function ukQualityFlags(item: {
  title_en: string;
  title_uk: string;
  summary_en: string;
  summary_uk: string;
  deep_dive_en: string;
  deep_dive_uk: string;
  body_md_en?: string;
  body_md_uk?: string;
}): string[] {
  const flags: string[] = [];
  if (item.title_en && !looksUkrainian(item.title_uk, { minShare: 0 })) flags.push('title_uk');
  if (item.summary_en && !looksUkrainian(item.summary_uk)) flags.push('summary_uk');
  if (item.deep_dive_en && !looksUkrainian(item.deep_dive_uk)) flags.push('deep_dive_uk');
  if (item.body_md_en && !looksUkrainian(item.body_md_uk ?? '')) flags.push('body_md_uk');
  return flags;
}
