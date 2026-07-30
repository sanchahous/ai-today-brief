import { describe, expect, it } from 'vitest';
import {
  chunkPairs,
  clusterConfirmedPairs,
  compareClusterOrder,
  DEDUP_CHUNK_SIZE,
  DEDUP_CONFIDENCE_THRESHOLD,
  buildDedupPrompt,
  formatDedupReport,
  parseDedupVerdicts,
  UnionFind,
  type ClusterableItem,
  type DedupPairDetail,
  type MergeReportEntry,
} from './dedup-scan';

describe('UnionFind', () => {
  it('merges transitively (A~B, B~C ⇒ one component)', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    uf.union('b', 'c');
    expect(uf.find('a')).toBe(uf.find('c'));
    expect(uf.find('a')).toBe(uf.find('b'));
  });

  it('keeps unrelated ids in separate components', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    expect(uf.find('a')).not.toBe(uf.find('z'));
  });
});

describe('compareClusterOrder', () => {
  it('orders by date first', () => {
    const a: ClusterableItem = { id: '1', date: '2026-07-01', edition: 1, rank: 1 };
    const b: ClusterableItem = { id: '2', date: '2026-07-02', edition: 1, rank: 1 };
    expect(compareClusterOrder(a, b)).toBeLessThan(0);
  });

  it('same day, different edition — earlier edition wins', () => {
    const a: ClusterableItem = { id: '1', date: '2026-07-01', edition: 2, rank: 1 };
    const b: ClusterableItem = { id: '2', date: '2026-07-01', edition: 1, rank: 1 };
    expect(compareClusterOrder(a, b)).toBeGreaterThan(0);
  });

  it('same day + edition — lower rank wins', () => {
    const a: ClusterableItem = { id: '1', date: '2026-07-01', edition: 1, rank: 3 };
    const b: ClusterableItem = { id: '2', date: '2026-07-01', edition: 1, rank: 1 };
    expect(compareClusterOrder(a, b)).toBeGreaterThan(0);
  });

  it('same day + edition + rank — id breaks the tie', () => {
    const a: ClusterableItem = { id: 'b', date: '2026-07-01', edition: 1, rank: 1 };
    const b: ClusterableItem = { id: 'a', date: '2026-07-01', edition: 1, rank: 1 };
    expect(compareClusterOrder(a, b)).toBeGreaterThan(0);
  });
});

describe('clusterConfirmedPairs', () => {
  const items = new Map<string, ClusterableItem>([
    ['a', { id: 'a', date: '2026-07-01', edition: 1, rank: 1 }],
    ['b', { id: 'b', date: '2026-07-02', edition: 1, rank: 1 }],
    ['c', { id: 'c', date: '2026-07-03', edition: 1, rank: 1 }],
    ['z', { id: 'z', date: '2026-07-04', edition: 1, rank: 1 }],
  ]);

  it('merges a transitive 3-way cluster onto the earliest member', () => {
    const merges = clusterConfirmedPairs(
      [
        { earlier_id: 'a', later_id: 'b' },
        { earlier_id: 'b', later_id: 'c' },
      ],
      items,
    );
    expect(merges.get('b')).toBe('a');
    expect(merges.get('c')).toBe('a');
    expect(merges.has('a')).toBe(false);
  });

  it('ignores pairs referencing unknown items', () => {
    const merges = clusterConfirmedPairs([{ earlier_id: 'a', later_id: 'missing' }], items);
    expect(merges.size).toBe(0);
  });

  it('items with no confirmed pair produce no merge', () => {
    const merges = clusterConfirmedPairs([], items);
    expect(merges.size).toBe(0);
  });
});

describe('chunkPairs', () => {
  it('splits into chunks of the default size', () => {
    const items = Array.from({ length: 85 }, (_, i) => i);
    const chunks = chunkPairs(items);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(DEDUP_CHUNK_SIZE);
    expect(chunks[1]).toHaveLength(DEDUP_CHUNK_SIZE);
    expect(chunks[2]).toHaveLength(5);
  });

  it('returns a single empty-safe chunk list for empty input', () => {
    expect(chunkPairs([])).toEqual([]);
  });
});

function makePairDetail(pairIndex: number): DedupPairDetail {
  return {
    pairIndex,
    earlier: {
      id: 'e',
      slug: 'e-slug',
      categorySlug: 'tools',
      title: 'Tool v1 launches',
      summary: 'A summary',
      rank: 1,
      briefId: 'brief-e',
      date: '2026-07-01',
      edition: 1,
    },
    later: {
      id: 'l',
      slug: 'l-slug',
      categorySlug: 'tools',
      title: 'Tool v1 launches (again)',
      summary: 'A summary, reworded',
      rank: 1,
      briefId: 'brief-l',
      date: '2026-07-05',
      edition: 1,
    },
    distance: 0.18,
  };
}

describe('buildDedupPrompt', () => {
  it('includes both titles and the pair index', () => {
    const prompt = buildDedupPrompt([makePairDetail(0)]);
    expect(prompt).toContain('[0]');
    expect(prompt).toContain('Tool v1 launches');
    expect(prompt).toContain('Tool v1 launches (again)');
    expect(prompt).toContain('same_event');
  });
});

describe('parseDedupVerdicts', () => {
  it('accepts a confident same_event verdict', () => {
    const text = JSON.stringify({ results: [{ pair: 0, same_event: true, confidence: 0.9 }] });
    const out = parseDedupVerdicts(text, new Set([0]));
    expect(out.get(0)).toBe(true);
  });

  it('rejects same_event below the confidence threshold', () => {
    const text = JSON.stringify({
      results: [{ pair: 0, same_event: true, confidence: DEDUP_CONFIDENCE_THRESHOLD - 0.01 }],
    });
    const out = parseDedupVerdicts(text, new Set([0]));
    expect(out.get(0)).toBe(false);
  });

  it('drops hallucinated pair indexes not in the valid set', () => {
    const text = JSON.stringify({ results: [{ pair: 99, same_event: true, confidence: 1 }] });
    const out = parseDedupVerdicts(text, new Set([0]));
    expect(out.has(99)).toBe(false);
    expect(out.size).toBe(0);
  });

  it('treats same_event: false as a negative regardless of confidence', () => {
    const text = JSON.stringify({ results: [{ pair: 0, same_event: false, confidence: 0.99 }] });
    const out = parseDedupVerdicts(text, new Set([0]));
    expect(out.get(0)).toBe(false);
  });

  it('handles malformed results gracefully', () => {
    const out = parseDedupVerdicts(JSON.stringify({ results: 'not-an-array' }), new Set([0]));
    expect(out.size).toBe(0);
  });
});

describe('formatDedupReport', () => {
  const entry: MergeReportEntry = {
    laterTitle: 'Later title',
    laterDate: '2026-07-05',
    primaryTitle: 'Primary title',
    primaryDate: '2026-07-01',
    primaryUrl: 'https://aitodaybrief.com/en/news/tools/primary-title',
  };

  it('labels a live run vs a dry-run', () => {
    expect(formatDedupReport([entry], { dryRun: false })).toContain('злито дублі');
    expect(formatDedupReport([entry], { dryRun: true })).toContain('dry-run');
  });

  it('includes both titles and the canonical URL', () => {
    const text = formatDedupReport([entry], { dryRun: false });
    expect(text).toContain('Later title');
    expect(text).toContain('Primary title');
    expect(text).toContain(entry.primaryUrl);
  });

  it('truncates output beyond the Telegram message cap', () => {
    const many = Array.from({ length: 200 }, () => entry);
    const text = formatDedupReport(many, { dryRun: false });
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(text).toContain('обрізано');
  });
});
