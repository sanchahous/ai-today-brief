/**
 * External trend signal — the standing "rising index" that substitutes for the
 * pipeline's own engagement time-series (which can't be reconstructed: `url` is
 * unique, so there's one snapshot per article). See
 * docs/TREND-ENGINE-BACKTEST-FINDINGS.md.
 *
 * GDELT DOC 2.0 `timelinevol` gives a free, historical news-volume timeline per
 * entity; we turn its trailing trend into a [0,1] rising score and temper it with
 * a lifecycle prior (the niche turns over fast — Sora went peak→shutdown in <9
 * months — so a still-noisy-but-dying entity must not read as "rising").
 *
 * Pure logic only (URL build, JSON parse, scoring). Network IO + DB writes live
 * in pipeline/scripts/backfill-trend-signals.ts. This file is unit-tested; the
 * exact GDELT field names are also printed by the runner's --dry-run on first
 * live run, since this sandbox can't reach the API to confirm them.
 */

export type Lifecycle = 'surge' | 'flat' | 'decay';

export interface TrendEntity {
  /** Canonical key stored on the row. */
  key: string;
  /** GDELT query — a quoted phrase plus disambiguation co-terms for noisy names. */
  query: string;
  /** Lifecycle prior from the 2026-06 niche scan (see findings doc §2). */
  lifecycle: Lifecycle;
}

/**
 * The ~two dozen entities that dominate the dev/AI niche, with disambiguation and
 * a lifecycle prior. Maintained by hand — re-validate quarterly (lifecycles flip
 * fast). Surge/decay come from the external-signals research in the findings doc.
 */
export const TREND_ENTITIES: readonly TrendEntity[] = [
  { key: 'mcp', query: '"model context protocol"', lifecycle: 'surge' },
  { key: 'agent-memory', query: '"agent memory" OR "context engineering"', lifecycle: 'surge' },
  { key: 'claude-code', query: '"claude code"', lifecycle: 'surge' },
  { key: 'ollama', query: '"ollama" (AI OR LLM OR "local model")', lifecycle: 'surge' },
  { key: 'qwen', query: '"qwen" (AI OR model OR alibaba)', lifecycle: 'surge' },
  { key: 'veo', query: '"google veo" OR "veo 3"', lifecycle: 'surge' },
  { key: 'kling', query: '"kling" (AI OR video OR kuaishou)', lifecycle: 'surge' },
  { key: 'seedance', query: '"seedance"', lifecycle: 'surge' },
  { key: 'gemini', query: '"gemini" (google OR AI OR model)', lifecycle: 'surge' },
  { key: 'langgraph', query: '"langgraph"', lifecycle: 'surge' },
  { key: 'a2a', query: '"agent2agent" OR "a2a protocol"', lifecycle: 'flat' },
  { key: 'agents-md', query: '"agents.md"', lifecycle: 'flat' },
  { key: 'cursor', query: '"cursor" (AI OR "code editor" OR anysphere)', lifecycle: 'flat' },
  { key: 'gpt', query: '"gpt-5"', lifecycle: 'flat' },
  { key: 'grok', query: '"grok" (xai OR AI OR model)', lifecycle: 'flat' },
  { key: 'deepseek', query: '"deepseek"', lifecycle: 'flat' },
  { key: 'crewai', query: '"crewai"', lifecycle: 'flat' },
  { key: 'claude', query: '"claude" (anthropic OR AI)', lifecycle: 'flat' },
  { key: 'ai-coding', query: '"ai coding" OR "vibe coding"', lifecycle: 'decay' },
  { key: 'sora', query: '"openai sora" OR "sora 2"', lifecycle: 'decay' },
  { key: 'autogen', query: '"autogen" (microsoft OR agent)', lifecycle: 'decay' },
  { key: 'pika', query: '"pika labs" OR "pika ai"', lifecycle: 'decay' },
  { key: 'llama', query: '"llama" (meta OR AI OR model)', lifecycle: 'decay' },
];

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

/** DOC 2.0 timelinevol request URL for an entity query over `timespan` (e.g. '3m'). */
export function buildGdeltUrl(query: string, timespan = '3m'): string {
  const params = new URLSearchParams({ query, mode: 'timelinevol', format: 'json', timespan });
  return `${GDELT_BASE}?${params.toString()}`;
}

export interface TimelinePoint {
  date: string;
  value: number;
}

/**
 * Defensive parse of a DOC 2.0 timelinevol response → chronological points.
 * Tolerates the documented shape `{ timeline: [{ data: [{ date, value }] }] }`,
 * a numeric-or-string `value`, and junk/empty bodies (→ []).
 */
export function parseGdeltTimeline(jsonText: string): TimelinePoint[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const timeline = (parsed as { timeline?: Array<{ data?: unknown }> } | null)?.timeline;
  const data = Array.isArray(timeline) && timeline.length > 0 ? timeline[0]?.data : undefined;
  if (!Array.isArray(data)) return [];
  const points: TimelinePoint[] = [];
  for (const d of data) {
    const rec = d as { date?: unknown; value?: unknown };
    const value = typeof rec.value === 'number' ? rec.value : Number(rec.value);
    const date = typeof rec.date === 'string' ? rec.date : '';
    if (date && Number.isFinite(value)) points.push({ date, value });
  }
  return points;
}

/** Saturating 0→1 curve — `value` half-saturates at `half`, never reaches 1. */
function saturate(value: number, half: number): number {
  if (value <= 0) return 0;
  return 1 - 0.5 ** (value / half);
}

/**
 * Trailing rising score in [0,1]: how far the recent window's mean volume exceeds
 * the earlier baseline, relative to that baseline (a normalized acceleration
 * proxy). Recent = last third of the series. Flat or declining → 0; +50% growth
 * → ~0.5; a doubling → ~0.75. Needs ≥3 points.
 */
export function risingScore(values: number[]): number {
  if (values.length < 3) return 0;
  const cut = Math.floor((values.length * 2) / 3);
  const earlier = values.slice(0, cut);
  const recent = values.slice(cut);
  if (recent.length === 0 || earlier.length === 0) return 0;
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const e = mean(earlier);
  const r = mean(recent);
  if (e <= 0) return r > 0 ? 1 : 0;
  return saturate((r - e) / e, 0.5);
}

/**
 * Temper the raw rising score with the lifecycle prior: a `decay` entity (dying
 * but still newsy — Sora, AutoGen) is halved so a controversy spike can't read as
 * a real trend; a `surge` entity gets a floor so a momentary dip doesn't bury it.
 */
export function applyLifecycle(raw: number, lifecycle: Lifecycle): number {
  if (lifecycle === 'decay') return raw * 0.5;
  if (lifecycle === 'surge') return Math.max(raw, 0.5);
  return raw;
}
