/**
 * Deterministic pool selection before the (paid) LLM editor call.
 *
 * Clusters are already deduped + scored + source-capped by rank.ts. Here we only
 * enforce quality and topic variety: drop anything under the score floor, cap how
 * many candidates share a fine-grained topic (no wall of Claude stories), cap
 * cold singletons (zero-engagement single-source media headlines — always-on RSS
 * would otherwise fill quiet days with unvetted churn), keep the top `poolSize`.
 * Input is pre-sorted by score, and that order is preserved.
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
  /**
   * Max pooled entries with zero engagement, a single source and sub-official
   * authority. First-party announcements are exempt (their velocity is floored
   * at the official level in rank.ts, so they never read as cold).
   */
  maxColdSingletons: number;
}

/** Zero-engagement, single-coverage, non-first-party — RSS/media churn shape. */
export function isColdSingleton(entry: RankedEntry): boolean {
  return (
    entry.components.velocity === 0 &&
    entry.clusterSize === 1 &&
    entry.components.authority < 1
  );
}

/**
 * Exact cross-day guard: drop candidates whose URL already backs a recent
 * brief item. Refs are re-numbered so the editor sees contiguous 1..N.
 */
export function dropKnownUrls(pool: PoolItem[], knownUrls: ReadonlySet<string>): PoolItem[] {
  return pool
    .filter((item) => !knownUrls.has(item.url))
    .map((item, i) => ({ ...item, ref: i + 1 }));
}

export function selectPool(ranked: RankedEntry[], opts: PoolOptions): PoolItem[] {
  const topicCounts: Record<string, number> = {};
  const pooled: RankedEntry[] = [];
  let coldSingletons = 0;

  for (const entry of ranked) {
    if (entry.score < opts.minScore) continue;
    const count = topicCounts[entry.topic] ?? 0;
    if (count >= opts.perTopicCap) continue;
    if (isColdSingleton(entry)) {
      if (coldSingletons >= opts.maxColdSingletons) continue;
      coldSingletons++;
    }
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
