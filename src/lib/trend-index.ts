/**
 * Trend-index v0 — re-ranks the homepage "Trending topics" by how much each topic
 * is ACCELERATING, not just how often it's mentioned. The acceleration comes from
 * the external GDELT rising signal (migration 033, computed in the pipeline at
 * `pipeline/trend-signals.ts`); this module reads the latest score per entity and
 * blends it with the in-brief mention frequency.
 *
 * Read-only and graceful: if the signals can't be read (RLS not yet open, or the
 * table is empty), `getRisingByEntity` returns an empty map and the ranking falls
 * straight back to mention frequency — the block never breaks.
 */

import { getSupabase } from '@/lib/supabase';

/**
 * Tool display name → trend-entity key. Most names slugify straight onto a key
 * (`Claude Code` → `claude-code`); the aliases cover the cases where the tracked
 * entity key is broader than a literal slug of the tool name.
 */
const ENTITY_ALIASES: Record<string, string> = {
  'gpt-5': 'gpt',
  'gpt-5.5': 'gpt',
  chatgpt: 'gpt',
  openai: 'gpt',
  'model context protocol': 'mcp',
  'agent memory': 'agent-memory',
  'context engineering': 'agent-memory',
  'google veo': 'veo',
  'veo 3': 'veo',
  'vibe coding': 'ai-coding',
  'ai coding': 'ai-coding',
  'openai sora': 'sora',
};

/** Normalize a tool name to the trend-entity key used in `entity_trend_signals`. */
export function entityKeyForTool(name: string): string {
  const norm = name.trim().toLowerCase();
  return ENTITY_ALIASES[norm] ?? norm.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Blend mention frequency with the rising signal: a rising topic outranks an
 * equally-mentioned flat one. `rising` ∈ [0,1] boosts the weight up to +100%.
 */
export function blendTrend(mentions: number, rising: number): number {
  return mentions * (1 + Math.max(0, Math.min(1, rising)));
}

/** At/above this the entity is surging or genuinely accelerating — shown as ▲. */
export const RISING_THRESHOLD = 0.5;

/** Whether a topic's rising score is high enough to flag it as rising. */
export function isRising(score: number | undefined): boolean {
  return (score ?? 0) >= RISING_THRESHOLD;
}

/**
 * Latest `rising_score` per entity key (the freshest append-only row each).
 * Empty map on any failure or when RLS hides the table — callers degrade to
 * pure mention frequency.
 */
export async function getRisingByEntity(): Promise<Map<string, number>> {
  const supabase = getSupabase();
  if (!supabase) return new Map();
  // entity_trend_signals isn't in the generated Database type yet (added in 033);
  // narrow cast to just the query shape we need rather than widening to `any`.
  const client = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: { entity: string; rising_score: number | null }[] | null }>;
        };
      };
    };
  };
  try {
    const { data } = await client
      .from('entity_trend_signals')
      .select('entity, rising_score, captured_at')
      .order('entity', { ascending: true })
      .order('captured_at', { ascending: false });
    const latest = new Map<string, number>();
    for (const row of data ?? []) {
      if (!latest.has(row.entity) && typeof row.rising_score === 'number') {
        latest.set(row.entity, row.rising_score);
      }
    }
    return latest;
  } catch {
    return new Map();
  }
}
