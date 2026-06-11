import { describe, expect, it } from 'vitest';
import { selectPool } from './select';
import type { RankedEntry } from './rank';
import type { CategorySlug } from './topics';

function entry(
  score: number,
  topic: string,
  url: string,
  category: CategorySlug = 'tools-and-releases',
): RankedEntry {
  return {
    lead: {
      id: url,
      title: `Story ${url}`,
      url,
      source_name: 'Hacker News',
      published_at: '2026-06-05T09:00:00Z',
      hn_score: 10,
      hn_comments: 1,
      reddit_score: null,
      reddit_comments: null,
      inbrief_score: null,
      mentions_count: 1,
    },
    score,
    components: {
      velocity: 0,
      crossSource: 0,
      authority: 0,
      recency: 0,
      inbrief: 0,
      breadth: 0,
    },
    mentions: 1,
    breadth: 1,
    topic,
    category,
    clusterSize: 1,
  };
}

describe('selectPool', () => {
  const opts = { minScore: 0.2, perTopicCap: 2, poolSize: 5, maxColdSingletons: 10 };

  it('drops entries under the score floor', () => {
    const pool = selectPool([entry(0.1, 'claude', 'a')], opts);
    expect(pool).toHaveLength(0);
  });

  it('caps how many items share a topic', () => {
    const pool = selectPool(
      [
        entry(0.9, 'claude', 'a'),
        entry(0.8, 'claude', 'b'),
        entry(0.7, 'claude', 'c'),
        entry(0.6, 'cursor', 'd'),
      ],
      opts,
    );
    expect(pool.map((p) => p.url)).toEqual(['a', 'b', 'd']);
  });

  it('honours poolSize and numbers refs 1..n in order', () => {
    const entries = Array.from({ length: 8 }, (_, i) => entry(0.9 - i * 0.01, `t${i}`, `u${i}`));
    const pool = selectPool(entries, opts);
    expect(pool).toHaveLength(5);
    expect(pool.map((p) => p.ref)).toEqual([1, 2, 3, 4, 5]);
    expect(pool[0]!.category).toBe('tools-and-releases');
  });

  it('caps cold singletons but lets engaged and first-party entries through', () => {
    const cold = (url: string) => entry(0.5, url, url); // velocity 0, cluster 1, authority 0
    const engaged = (url: string) => {
      const e = entry(0.4, url, url);
      e.components = { ...e.components, velocity: 0.6 };
      return e;
    };
    const official = (url: string) => {
      const e = entry(0.4, url, url);
      e.components = { ...e.components, velocity: 0.5, authority: 1 };
      return e;
    };
    const pool = selectPool(
      [cold('c1'), cold('c2'), cold('c3'), engaged('e1'), official('o1')],
      { minScore: 0.2, perTopicCap: 2, poolSize: 10, maxColdSingletons: 2 },
    );
    expect(pool.map((p) => p.url)).toEqual(['c1', 'c2', 'e1', 'o1']);
  });
});
