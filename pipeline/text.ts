/**
 * Shared text helpers: title similarity (same-event clustering) and URL slugs.
 *
 * `rank.ts` clusters same-event coverage within a run; `summarize.ts` derives a
 * stable per-item URL slug from the English title. Both primitives live here so
 * the notion of "same story" and "URL-safe slug" is defined once.
 */

/** Lowercase, strip punctuation, collapse whitespace. */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaro similarity (0..1). Efficient enough for the ~100-pair workloads here. */
export function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - range);
    const end = Math.min(i + range + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  return (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'with', 'is', 'are',
  'new', 'now', 'how', 'why', 'what', 'this', 'that', 'your', 'you', 'its', 'it',
  'as', 'at', 'by', 'from', 'into', 'via', 'can', 'will', 'has', 'have',
]);

/** Significant tokens of a (possibly raw) title: length ≥ 3, not a stopword. */
export function titleTokens(title: string): Set<string> {
  return new Set(
    normaliseTitle(title)
      .split(' ')
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  );
}

/** Jaccard overlap of two token sets (0..1). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface SimilarityThresholds {
  /** Jaro on normalized titles. */
  jaro: number;
  /** Jaccard on significant tokens. */
  jaccard: number;
}

export const DEFAULT_SIMILARITY: SimilarityThresholds = { jaro: 0.82, jaccard: 0.6 };

/**
 * True when two headlines look like the same story. A reworded headline of the
 * same event keeps most of its significant tokens (high Jaccard) even when the
 * character-level Jaro drops, so either signal crossing its threshold counts.
 */
export function titlesSimilar(
  a: string,
  b: string,
  thresholds: SimilarityThresholds = DEFAULT_SIMILARITY,
): boolean {
  const na = normaliseTitle(a);
  const nb = normaliseTitle(b);
  if (jaro(na, nb) >= thresholds.jaro) return true;
  return jaccard(titleTokens(a), titleTokens(b)) >= thresholds.jaccard;
}

const SLUG_MAX_CHARS = 80;

/**
 * URL-safe slug from a title. Mirrors the SQL backfill in migration 012:
 * lowercase, ASCII-fold, collapse non-alphanumeric runs to single dashes, trim,
 * truncate to 80 chars. Non-ASCII (e.g. Cyrillic) is dropped, so always derive
 * the slug from the English title. Falls back to `fallback` when nothing
 * survives (e.g. a title that was entirely non-ASCII).
 */
export function slugify(title: string, fallback = 'item'): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics left by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_CHARS)
    .replace(/-+$/g, ''); // a trailing dash can reappear after the slice
  return slug.length > 0 ? slug : fallback;
}

/**
 * Make every slug in a brief unique by suffixing collisions with -2, -3, …
 * (within-batch pass only). `resolveItemSlug` in db.ts separately guards
 * against collisions with already-published items from other packs, since
 * `brief_items_slug_uniq` enforces uniqueness across the whole table. Order
 * is preserved.
 */
export function dedupeSlugs(slugs: string[]): string[] {
  const seen = new Map<string, number>();
  return slugs.map((slug) => {
    const n = seen.get(slug) ?? 0;
    seen.set(slug, n + 1);
    return n === 0 ? slug : `${slug}-${n + 1}`;
  });
}
