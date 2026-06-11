import type { ItemFact } from '@/lib/items';

/**
 * Turn an item's facts box ({label, value} rows) into a chart-able structure —
 * the "diagram from facts data" layer (audit P12, iteration 2).
 *
 * Facts only become comparison bars when their values are genuinely
 * comparable: same currency/percent marker and the same residual text once
 * the number is stripped ("$3 / 1M tokens" groups with "$15 / 1M tokens",
 * but never with "$20 / month"). Anything else degrades to big-number stat
 * cards, and non-numeric boxes render no visual at all — the table is always
 * the source of truth, the chart is sugar.
 */

export interface ParsedFactValue {
  /** Magnitude-normalized number (200K → 200_000). */
  num: number;
  /** Grouping key: currency/percent marker + residual text without the number. */
  key: string;
  /** True for bare 1900–2100 numbers — years, not magnitudes; never charted as bars. */
  yearLike: boolean;
}

const MAGNITUDE: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
  t: 1e12,
};

const NUM_RE = /([$€£])?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*([kKmMbBtT](?![a-z])|%)?/;

/** Parse the first number out of a fact value, or null when there is none. */
export function parseFactValue(raw: string): ParsedFactValue | null {
  const value = raw.trim();
  const m = NUM_RE.exec(value);
  if (!m) return null;

  const [matched, currency, numText, suffix] = m;
  const base = Number(numText!.replace(/,/g, ''));
  if (!Number.isFinite(base)) return null;

  const isPercent = suffix === '%';
  const magnitude = !isPercent && suffix ? MAGNITUDE[suffix.toLowerCase()]! : 1;
  const num = base * magnitude;

  const residual = value
    .replace(matched, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9%/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const key = `${currency ?? ''}${isPercent ? '%' : ''}|${residual}`;

  const yearLike =
    !currency && !suffix && residual === '' && Number.isInteger(base) && base >= 1900 && base <= 2100;

  return { num, key, yearLike };
}

export type FactsVisual =
  | { kind: 'comparison'; items: Array<{ label: string; display: string; ratio: number }> }
  | { kind: 'stats'; items: Array<{ label: string; display: string }> };

const MAX_BARS = 6;
const MAX_STATS = 4;
/** Stat cards only fit short values ("$20/mo", "128K", "70.3%"). */
const MAX_STAT_VALUE_CHARS = 16;

/** Build the chart structure for a facts box, or null when a table is all it deserves. */
export function buildFactsVisual(facts: ItemFact[]): FactsVisual | null {
  if (facts.length < 2) return null;

  const parsed = facts.map((fact) => ({ fact, value: parseFactValue(fact.value) }));

  // Largest group of same-key, non-year numeric facts → comparison bars.
  const groups = new Map<string, Array<{ fact: ItemFact; num: number }>>();
  for (const { fact, value } of parsed) {
    if (!value || value.yearLike) continue;
    const group = groups.get(value.key) ?? [];
    group.push({ fact, num: value.num });
    groups.set(value.key, group);
  }
  let best: Array<{ fact: ItemFact; num: number }> = [];
  for (const group of groups.values()) {
    if (group.length > best.length) best = group;
  }

  if (best.length >= 2) {
    const bars = best.slice(0, MAX_BARS);
    const max = Math.max(...bars.map((b) => b.num));
    if (max > 0) {
      return {
        kind: 'comparison',
        items: bars.map((b) => ({
          label: b.fact.label,
          display: b.fact.value,
          ratio: b.num / max,
        })),
      };
    }
  }

  const stats = parsed
    .filter(({ fact, value }) => value && fact.value.trim().length <= MAX_STAT_VALUE_CHARS)
    .slice(0, MAX_STATS)
    .map(({ fact }) => ({ label: fact.label, display: fact.value.trim() }));
  return stats.length >= 2 ? { kind: 'stats', items: stats } : null;
}
