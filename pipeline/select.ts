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

export interface PoolDrop {
  title: string;
  url: string;
  score: number;
  reason: 'min_score' | 'topic_cap' | 'cold_singleton';
}

export interface PoolSelection {
  pool: PoolItem[];
  dropped: PoolDrop[];
}

function toPoolItem(entry: RankedEntry, ref: number): PoolItem {
  return {
    ref,
    title: entry.lead.title,
    url: entry.lead.url,
    source: entry.lead.source_name,
    topic: entry.topic,
    category: entry.category,
  };
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

export function selectPoolWithReasons(ranked: RankedEntry[], opts: PoolOptions): PoolSelection {
  const topicCounts: Record<string, number> = {};
  const pooled: RankedEntry[] = [];
  const dropped: PoolDrop[] = [];
  let coldSingletons = 0;

  for (const entry of ranked) {
    if (entry.score < opts.minScore) {
      dropped.push({
        title: entry.lead.title,
        url: entry.lead.url,
        score: entry.score,
        reason: 'min_score',
      });
      continue;
    }
    const count = topicCounts[entry.topic] ?? 0;
    if (count >= opts.perTopicCap) {
      dropped.push({
        title: entry.lead.title,
        url: entry.lead.url,
        score: entry.score,
        reason: 'topic_cap',
      });
      continue;
    }
    if (isColdSingleton(entry)) {
      if (coldSingletons >= opts.maxColdSingletons) {
        dropped.push({
          title: entry.lead.title,
          url: entry.lead.url,
          score: entry.score,
          reason: 'cold_singleton',
        });
        continue;
      }
      coldSingletons++;
    }
    topicCounts[entry.topic] = count + 1;
    pooled.push(entry);
    if (pooled.length >= opts.poolSize) break;
  }

  return {
    pool: pooled.map((entry, i) => toPoolItem(entry, i + 1)),
    dropped,
  };
}

export function selectPool(ranked: RankedEntry[], opts: PoolOptions): PoolItem[] {
  return selectPoolWithReasons(ranked, opts).pool;
}
