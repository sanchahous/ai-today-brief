/**
 * Deterministic pool selection before the (paid) LLM editor call.
 *
 * Clusters are already deduped + scored + source-capped by rank.ts. Here we only
 * enforce quality and topic variety: drop anything under the score floor, cap how
 * many candidates share a fine-grained topic (no wall of Claude stories), keep the
 * top `poolSize`. Input is pre-sorted by score, and that order is preserved.
 */

import type { RankedEntry } from './rank';
import type { CategorySlug } from './topics';

export interface PoolItem {
  /** 1-based handle the editor selects/reorders/drops by (position is not reliable). */
  ref: number;
  title: string;
  url: string;
  source: string;
  topic: string;
  /** Deterministic default category; the editor may override it. */
  category: CategorySlug;
}

export interface PoolOptions {
  minScore: number;
  perTopicCap: number;
  poolSize: number;
}

export function selectPool(ranked: RankedEntry[], opts: PoolOptions): PoolItem[] {
  const topicCounts: Record<string, number> = {};
  const pooled: RankedEntry[] = [];

  for (const entry of ranked) {
    if (entry.score < opts.minScore) continue;
    const count = topicCounts[entry.topic] ?? 0;
    if (count >= opts.perTopicCap) continue;
    topicCounts[entry.topic] = count + 1;
    pooled.push(entry);
    if (pooled.length >= opts.poolSize) break;
  }

  return pooled.map((entry, i) => ({
    ref: i + 1,
    title: entry.lead.title,
    url: entry.lead.url,
    source: entry.lead.source_name,
    topic: entry.topic,
    category: entry.category,
  }));
}
