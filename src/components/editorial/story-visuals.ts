import { parseFactValue, type ParsedFactValue } from '@/lib/facts-visual';
import type { ItemFact } from '@/lib/items';
import type { ProcessDiagramNode } from './diagram-process';

/**
 * Charts render only numbers copied from story fields. Bar geometry is a ratio
 * of those magnitudes; the visible text is always the original fact string.
 * No numeric field → no chart and no empty frame.
 */

export type SourcedMetric = {
  label: string;
  /** Exact fact value from the story. Never a normalized magnitude. */
  display: string;
  /** Share of the largest value in this group. Presentation only. */
  ratio: number;
};

export type SourcedNumber = {
  label: string;
  display: string;
};

export type StoryVisuals = {
  comparison: SourcedMetric[] | null;
  metrics: SourcedMetric[] | null;
  keyNumbers: SourcedNumber[] | null;
  steps: ProcessDiagramNode[] | null;
};

type NumericFact = { fact: ItemFact; parsed: ParsedFactValue };

const MAX_BARS = 6;
const MAX_KEY_NUMBERS = 4;
const MAX_STEPS = 3;
const MAX_STAT_VALUE_CHARS = 16;
/** A version buried in a name ("Apache-2.0") is not a metric. */
const LEADS_WITH_NUMBER = /^[$€£]?\s*\d/;
/** Same first-number span as `parseFactValue`, so the residual is the unread tail. */
const FACT_NUMBER_RE =
  /([$€£])?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*([kKmMbBtT](?![a-z])|%)?/;

/**
 * Grouping key that keeps letters from every script. The shared parser drops
 * Cyrillic when it builds its key, which would compare "25 дій" with "13 парсерів".
 */
function seriesKey(raw: string, parsed: ParsedFactValue): string {
  const value = raw.trim();
  const matched = FACT_NUMBER_RE.exec(value);
  const marker = parsed.key.slice(0, parsed.key.indexOf('|'));
  if (!matched) return parsed.key;
  const residual = value
    .replace(matched[0], ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%/]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${marker}|${residual}`;
}

function comparableGroups(facts: ItemFact[]): NumericFact[][] {
  const groups = new Map<string, NumericFact[]>();
  for (const fact of facts) {
    if (!LEADS_WITH_NUMBER.test(fact.value.trim())) continue;
    const parsed = parseFactValue(fact.value);
    if (!parsed || parsed.yearLike) continue;
    const row = { fact, parsed };
    const key = seriesKey(fact.value, parsed);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const comparable: NumericFact[][] = [];
  for (const group of groups.values()) {
    if (group.length >= 2) comparable.push(group);
  }
  comparable.sort((a, b) => b.length - a.length);
  return comparable;
}

function maxMagnitude(rows: NumericFact[]): number {
  let max = 0;
  for (const row of rows) {
    if (row.parsed.num > max) max = row.parsed.num;
  }
  return max;
}

function toBars(rows: NumericFact[] | undefined): SourcedMetric[] | null {
  if (!rows || rows.length < 2) return null;
  const limited = rows.slice(0, MAX_BARS);
  const max = maxMagnitude(limited);
  if (max <= 0) return null;

  const items: SourcedMetric[] = [];
  for (const row of limited) {
    items.push({
      label: row.fact.label,
      display: row.fact.value.trim(),
      ratio: row.parsed.num / max,
    });
  }
  return items.length >= 2 ? items : null;
}

function keyNumbers(facts: ItemFact[], usedLabels: Set<string>): SourcedNumber[] | null {
  const items: SourcedNumber[] = [];
  for (const fact of facts) {
    if (items.length >= MAX_KEY_NUMBERS) break;
    if (usedLabels.has(fact.label)) continue;
    if (!LEADS_WITH_NUMBER.test(fact.value.trim())) continue;
    const parsed = parseFactValue(fact.value);
    if (!parsed) continue;
    const display = fact.value.trim();
    if (display.length > MAX_STAT_VALUE_CHARS) continue;
    items.push({ label: fact.label, display });
  }
  return items.length > 0 ? items : null;
}

function labelsIn(series: Array<SourcedMetric[] | null>): Set<string> {
  const used = new Set<string>();
  for (const items of series) {
    if (!items) continue;
    for (const item of items) used.add(item.label);
  }
  return used;
}

function processSteps(actionItems: string[] | undefined): ProcessDiagramNode[] | null {
  const nodes: ProcessDiagramNode[] = [];
  for (const raw of actionItems ?? []) {
    const title = raw.trim();
    if (!title) continue;
    nodes.push({ title });
    if (nodes.length === MAX_STEPS) break;
  }
  return nodes.length >= 2 ? nodes : null;
}

export function buildStoryVisuals(detail: {
  facts?: ItemFact[];
  actionItems?: string[];
}): StoryVisuals {
  const facts = detail.facts ?? [];
  const groups = comparableGroups(facts);
  const comparison = toBars(groups[0]);
  const metrics = toBars(groups[1]);
  return {
    comparison,
    metrics,
    keyNumbers: keyNumbers(facts, labelsIn([comparison, metrics])),
    steps: processSteps(detail.actionItems),
  };
}
