import { describe, expect, it } from 'vitest';
import {
  clickbaitDemotion,
  clusterIdFor,
  compositeScore,
  newsGenreDemotion,
  rankCandidates,
  scoreComponents,
  SCORE_VERSION,
  sourceTrust,
  WEIGHTS,
  type Candidate,
} from './rank';

const NOW = Date.parse('2026-06-05T12:00:00Z');

function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    id: over.url ?? over.id ?? 'https://example.com/a',
    title: 'A generic AI story',
    url: over.url ?? 'https://example.com/a',
    source_name: 'Hacker News',
    published_at: new Date(NOW - 3 * 3_600_000).toISOString(), // 3h old
    hn_score: 100,
    hn_comments: 20,
    reddit_score: null,
    reddit_comments: null,
    inbrief_score: null,
    mentions_count: 1,
    ...over,
  };
}

describe('score telemetry', () => {
  it('SCORE_VERSION is the normalized generation', () => {
    expect(SCORE_VERSION).toBe(2);
  });

  it('clusterIdFor is a stable 12-hex id, independent of member order', () => {
    const a = clusterIdFor(['https://x/2', 'https://x/1']);
    const b = clusterIdFor(['https://x/1', 'https://x/2']);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  it('scored keeps clusters the per-source cap drops from ranked', () => {
    // 5 unrelated stories from ONE source → 5 clusters; MAX_PER_SOURCE=3.
    const titles = [
      'OpenAI ships a new reasoning model',
      'Cursor adds an inline agent mode',
      'Postgres improves vector index recall',
      'Rust compiler speeds up incremental builds',
      'Kubernetes retires a legacy ingress API',
    ];
    const items = titles.map((title, i) =>
      candidate({ url: `https://news.ycombinator.com/${i}`, title }),
    );
    const { ranked, scored } = rankCandidates(items, 0, NOW);
    expect(scored.length).toBe(5);
    expect(ranked.length).toBe(3);
    // every scored entry carries its member urls + a cluster id for the telemetry write
    for (const e of scored) {
      expect(e.memberUrls.length).toBeGreaterThan(0);
      expect(e.clusterId).toMatch(/^[0-9a-f]{12}$/);
    }
  });
});

describe('sourceTrust', () => {
  it('rates first-party labs highest and unknown at the neutral midpoint', () => {
    expect(sourceTrust('Anthropic')).toBe(1);
    expect(sourceTrust('NVIDIA Blog')).toBe(1);
    expect(sourceTrust('Hugging Face Blog')).toBe(1);
    expect(sourceTrust('MIT Technology Review')).toBe(0.75);
    expect(sourceTrust('Hacker News')).toBe(0.9);
    expect(sourceTrust('Lobsters')).toBe(0.85);
    expect(sourceTrust('Reddit · r/cursor')).toBe(0.7);
    expect(sourceTrust('AINews')).toBe(0.7);
    expect(sourceTrust('Mastodon')).toBe(0.55);
    expect(sourceTrust('Some Random Blog')).toBe(0.6);
  });
});

describe('clickbaitDemotion', () => {
  it('demotes punditry and clickbait, leaves real news alone', () => {
    expect(clickbaitDemotion('Sam Altman says AGI is near')).toBeGreaterThan(0);
    expect(clickbaitDemotion('You won’t believe this AI trick')).toBe(0.5);
    expect(clickbaitDemotion('Cursor 2.0 ships agent mode')).toBe(0);
  });
});

describe('newsGenreDemotion', () => {
  it('demotes off-niche business / personnel / legal / celebrity drama', () => {
    expect(newsGenreDemotion('Noam Shazeer leaves Google for OpenAI')).toBe(0.5);
    expect(newsGenreDemotion('Anthropic files confidential S-1 for IPO')).toBe(0.5);
    expect(newsGenreDemotion('Anysphere raises $60M as Cursor clarifies plans')).toBe(0.5);
    expect(newsGenreDemotion('OpenAI is losing billions of dollars a year')).toBe(0.5);
    expect(newsGenreDemotion('Google sues cybercrime group over Gemini phishing')).toBe(0.5);
    expect(newsGenreDemotion("Amazon shelves Sam Altman biopic 'Artificial'")).toBe(0.5);
  });

  it('leaves practical tools, releases and monetisation items alone', () => {
    expect(newsGenreDemotion('Headroom compresses LLM inputs by 60–95%')).toBe(0);
    expect(newsGenreDemotion('Moonshot AI releases Kimi Code K2.7 open-source model')).toBe(0);
    expect(newsGenreDemotion('OpenRouter upgrades free tier to 1,000 requests/day')).toBe(0);
    expect(newsGenreDemotion('Microsoft open-sources MarkItDown to convert Office files')).toBe(0);
    expect(newsGenreDemotion('How I make $5k/month shipping AI side-projects')).toBe(0);
    expect(newsGenreDemotion('TimesFM: a pretrained foundation model for time-series')).toBe(0);
  });
});

describe('scoreComponents', () => {
  it('every component lands in [0,1]', () => {
    const c = scoreComponents([candidate({ inbrief_score: 80 })], NOW);
    for (const v of Object.values(c)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it('recency decays with age (12h half-life)', () => {
    const fresh = scoreComponents([candidate({ published_at: new Date(NOW).toISOString() })], NOW);
    const old = scoreComponents(
      [candidate({ published_at: new Date(NOW - 12 * 3_600_000).toISOString() })],
      NOW,
    );
    expect(fresh.recency).toBeGreaterThan(old.recency);
    expect(old.recency).toBeCloseTo(0.5, 1);
  });
  it('cross-source and breadth grow with cluster size and distinct sources', () => {
    const solo = scoreComponents([candidate()], NOW);
    const cluster = scoreComponents(
      [
        candidate({ id: 'a', url: 'a', source_name: 'Hacker News' }),
        candidate({ id: 'b', url: 'b', source_name: 'Reddit · r/cursor' }),
        candidate({ id: 'c', url: 'c', source_name: 'InBrief' }),
      ],
      NOW,
    );
    expect(cluster.crossSource).toBeGreaterThan(solo.crossSource);
    expect(cluster.breadth).toBeGreaterThan(solo.breadth);
    expect(solo.crossSource).toBe(0);
  });
  it('floors velocity for official first-party sources with zero engagement', () => {
    const official = scoreComponents(
      [candidate({ source_name: 'Anthropic Blog', hn_score: null, hn_comments: null })],
      NOW,
    );
    expect(official.velocity).toBe(0.5);

    const community = scoreComponents(
      [candidate({ source_name: 'Hacker News', hn_score: 0, hn_comments: 0 })],
      NOW,
    );
    expect(community.velocity).toBe(0);
  });
  it('keeps real engagement above the official floor', () => {
    const hot = scoreComponents(
      [candidate({ source_name: 'OpenAI Blog', hn_score: 500, hn_comments: 100 })],
      NOW,
    );
    expect(hot.velocity).toBeGreaterThan(0.5);
  });
  it('inbrief is clamped to 1', () => {
    expect(scoreComponents([candidate({ inbrief_score: 250 })], NOW).inbrief).toBe(1);
  });
});

describe('compositeScore', () => {
  it('weights sum to 1 and an all-1 vector scores 1', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(
      compositeScore({
        velocity: 1,
        crossSource: 1,
        authority: 1,
        recency: 1,
        inbrief: 1,
        breadth: 1,
      }),
    ).toBeCloseTo(1);
  });
});

describe('rankCandidates', () => {
  it('clusters same-event coverage and sums its mentions', () => {
    const items = [
      candidate({ id: '1', url: '1', title: 'Claude Opus 4.8 released by Anthropic' }),
      candidate({
        id: '2',
        url: '2',
        source_name: 'Reddit · r/ClaudeAI',
        title: 'Anthropic releases Claude Opus 4.8',
      }),
    ];
    const { ranked, clusters } = rankCandidates(items, 0, NOW);
    expect(clusters).toBe(1);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.mentions).toBe(2);
    expect(ranked[0]!.breadth).toBe(2);
  });

  it('sorts by score descending', () => {
    const hot = candidate({ id: 'hot', url: 'hot', title: 'Hot story', hn_score: 500 });
    const cold = candidate({ id: 'cold', url: 'cold', title: 'Cold story', hn_score: 1 });
    const { ranked } = rankCandidates([cold, hot], 0, NOW);
    expect(ranked[0]!.lead.id).toBe('hot');
  });

  it('caps items per source at three', () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      candidate({ id: `s${i}`, url: `s${i}`, title: `Distinct story number ${i}` }),
    );
    const { ranked } = rankCandidates(items, 0, NOW);
    expect(ranked.length).toBeLessThanOrEqual(3);
  });

  it('drops clusters below minScore', () => {
    const weak = candidate({
      id: 'w',
      url: 'w',
      hn_score: 0,
      hn_comments: 0,
      source_name: 'Some Random Blog',
      published_at: new Date(NOW - 23 * 3_600_000).toISOString(),
    });
    const { ranked } = rankCandidates([weak], 0.9, NOW);
    expect(ranked).toHaveLength(0);
  });
});
