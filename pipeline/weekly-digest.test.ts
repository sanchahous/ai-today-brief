import { describe, expect, it } from 'vitest';
import {
  buildDigestSelectionContext,
  citationUrlsFromUnknown,
  digestLineSummary,
  factCountFromUnknown,
  formatWeeklyDigest,
  selectEditorialDigestItems,
  selectDigestItems,
  weekLabelUk,
  type DigestCandidate,
} from './weekly-digest';

function cand(over: Partial<DigestCandidate> = {}): DigestCandidate {
  const itemSlug = over.itemSlug ?? 'item-slug';
  return {
    id: over.id ?? itemSlug,
    articleId: over.articleId ?? `article-${itemSlug}`,
    canonicalItemId: null,
    title_uk: 'Заголовок',
    title_en: 'Title',
    summary_en: 'First summary sentence.',
    summary_uk: 'Перше речення резюме. Друге речення, яке не потрібне.',
    why_matters_en: 'This changes how engineering teams work.',
    why_matters_uk: 'Це змінює роботу інженерних команд.',
    impact_level: 'medium',
    category_slug: 'tools-and-releases',
    itemSlug,
    date: '2026-06-10',
    rank: 1,
    citationUrls: ['https://example.com/source'],
    factsEnCount: 3,
    factsUkCount: 3,
    sourceName: 'Official source',
    // Distinct host per item so the per-source diversity price only appears in
    // the tests that deliberately reuse a host.
    sourceUrl: `https://${itemSlug}.example.com/story`,
    compositeScore: 0.5,
    crossSourceScore: 0,
    breadthScore: 0,
    scoreVersion: 2,
    clusterId: `cluster-${itemSlug}`,
    mentionsCount: 1,
    ...over,
  };
}

describe('selectDigestItems', () => {
  it('puts high impact first and prices repeated categories', () => {
    const out = selectDigestItems(
      [
        cand({ itemSlug: 'a', impact_level: 'low' }),
        cand({ itemSlug: 'b', impact_level: 'high' }),
        cand({ itemSlug: 'c', impact_level: 'high' }),
        cand({ itemSlug: 'd', impact_level: 'high' }), // 3rd in tools — pays, does not vanish
        cand({ itemSlug: 'e', impact_level: 'medium', category_slug: 'agents-and-mcp' }),
      ],
      7,
      2,
    );
    // The two free tools slots go first, then the third tools story still beats
    // a much weaker one after paying the diversity price; low impact ranks last.
    expect(out.map((o) => o.itemSlug)).toEqual(['b', 'c', 'd', 'e', 'a']);
  });

  it('does not let one day inside the week outrank a stronger daily pick', () => {
    const out = selectDigestItems([
      cand({ itemSlug: 'older-rank-1', date: '2026-06-08', category_slug: 'a' }),
      cand({ itemSlug: 'newest-rank-3', date: '2026-06-10', rank: 3, category_slug: 'c' }),
    ]);
    // Two days of freshness is worth <0.3 points inside the digest week, so the
    // better daily rank wins even though the other story is newer.
    expect(out.map((o) => o.itemSlug)).toEqual(['older-rank-1', 'newest-rank-3']);
  });

  it('honours the max size', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      cand({ itemSlug: `i${i}`, category_slug: `cat-${i}` }),
    );
    expect(selectDigestItems(many, 7)).toHaveLength(7);
  });

  it('blocks incomplete or stale candidates before scoring', () => {
    const result = selectEditorialDigestItems([
      cand({ itemSlug: 'ready' }),
      cand({ itemSlug: 'no-citation', citationUrls: [] }),
      cand({ itemSlug: 'no-facts', factsEnCount: 0 }),
      cand({ itemSlug: 'duplicate', canonicalItemId: 'canonical-id' }),
      cand({ itemSlug: 'old-score', scoreVersion: 1 }),
    ]);

    expect(result.selected.map(({ candidate }) => candidate.itemSlug)).toEqual(['ready']);
    expect(
      Object.fromEntries(
        result.rejected.map(({ candidate, reasons }) => [candidate.itemSlug, reasons]),
      ),
    ).toMatchObject({
      'no-citation': ['missing_citations'],
      'no-facts': ['missing_bilingual_facts'],
      duplicate: ['duplicate_story'],
      'old-score': ['stale_score_telemetry'],
    });
  });

  it('keeps editorial importance above noisy engagement', () => {
    const result = selectEditorialDigestItems([
      cand({
        itemSlug: 'important-release',
        impact_level: 'high',
        date: '2026-06-08',
        compositeScore: 0.42,
      }),
      cand({
        itemSlug: 'viral-gadget',
        impact_level: 'low',
        date: '2026-06-10',
        compositeScore: 0.95,
        crossSourceScore: 1,
        breadthScore: 1,
        mentionsCount: 8,
        category_slug: 'creative-ai',
      }),
    ]);

    expect(result.selected[0]?.candidate.itemSlug).toBe('important-release');
    expect(result.selected[0]?.score).toBeGreaterThan(result.selected[1]?.score ?? 0);
  });

  it('deduplicates an event but only prices a repeated category', () => {
    const result = selectEditorialDigestItems([
      cand({ itemSlug: 'event-primary', clusterId: 'same-event', impact_level: 'high' }),
      cand({ itemSlug: 'event-copy', clusterId: 'same-event', impact_level: 'high', rank: 2 }),
      cand({ itemSlug: 'tools-2', impact_level: 'high', rank: 3 }),
      cand({ itemSlug: 'tools-3', impact_level: 'high', rank: 4 }),
      cand({ itemSlug: 'models', category_slug: 'models-and-research', date: '2026-06-09' }),
    ]);

    const selected = result.selected.map(({ candidate }) => candidate.itemSlug);
    // Same-event dedup stays hard: that is deduplication, not balance.
    expect(selected).toContain('event-primary');
    expect(selected).not.toContain('event-copy');
    // The third tools story ships, but the snapshot records what it cost:
    // 5 for the repeated category plus 3 for the third story of the same day.
    expect(selected).toContain('tools-3');
    expect(result.selected.find(({ candidate }) => candidate.itemSlug === 'tools-3')).toMatchObject({
      diversityPenalty: 8,
    });
    expect(result.selected.find(({ candidate }) => candidate.itemSlug === 'models')).toMatchObject({
      diversityPenalty: 0,
    });
  });

  it('keeps a clearly stronger story that a category cap used to delete', () => {
    const result = selectEditorialDigestItems(
      [
        cand({ itemSlug: 'opt-1', impact_level: 'high', category_slug: 'optimization' }),
        cand({ itemSlug: 'opt-2', impact_level: 'high', category_slug: 'optimization', rank: 2 }),
        // Third optimization story, but high impact and a first-party publisher.
        cand({
          itemSlug: 'opt-3-strong',
          impact_level: 'high',
          category_slug: 'optimization',
          sourceName: 'Hacker News',
          sourceUrl: 'https://openai.com/index/ultrafast',
          rank: 2,
        }),
        // Fresh category, but medium impact on a social post.
        cand({
          itemSlug: 'weak-but-diverse',
          impact_level: 'medium',
          category_slug: 'creative-ai',
          sourceName: 'Mastodon',
          sourceUrl: 'https://mastodon.social/@dev/1',
          rank: 6,
        }),
      ],
      { max: 3 },
    );

    const selected = result.selected.map(({ candidate }) => candidate.itemSlug);
    expect(selected).toContain('opt-3-strong');
    expect(selected).not.toContain('weak-but-diverse');
  });

  it('yields to variety when the capped story is only marginally better', () => {
    const result = selectEditorialDigestItems(
      [
        cand({ itemSlug: 'opt-1', impact_level: 'high', category_slug: 'optimization' }),
        cand({ itemSlug: 'opt-2', impact_level: 'high', category_slug: 'optimization', rank: 2 }),
        // A third optimization story two points ahead of the alternative is not
        // worth the repeat; the diversity price decides it.
        cand({ itemSlug: 'opt-3', impact_level: 'high', category_slug: 'optimization', rank: 3 }),
        cand({
          itemSlug: 'other-category',
          impact_level: 'high',
          category_slug: 'agents-and-mcp',
          rank: 5,
        }),
      ],
      { max: 3 },
    );

    expect(result.selected.map(({ candidate }) => candidate.itemSlug)).toEqual([
      'opt-1',
      'opt-2',
      'other-category',
    ]);
  });

  it('scores the publisher, not the aggregator that surfaced it', () => {
    const result = selectEditorialDigestItems([
      cand({
        itemSlug: 'personal-blog',
        impact_level: 'high',
        sourceName: 'Hacker News',
        sourceUrl: 'https://sankalp.bearblog.dev/232x-kernel/',
        category_slug: 'optimization',
      }),
      cand({
        itemSlug: 'lab-release',
        impact_level: 'high',
        sourceName: 'Hugging Face Blog',
        sourceUrl: 'https://huggingface.co/blog/altk-evolve',
        category_slug: 'optimization',
      }),
    ]);

    const byslug = new Map(result.eligible.map((scored) => [scored.candidate.itemSlug, scored]));
    // Both used to score 17.2 evidence: one inherited Hacker News' 0.9 trust.
    expect(byslug.get('lab-release')!.breakdown.evidence).toBeGreaterThan(
      byslug.get('personal-blog')!.breakdown.evidence + 5,
    );
    expect(result.selected[0]?.candidate.itemSlug).toBe('lab-release');
  });

  it('keeps freshness inside the week to a sub-point tiebreak', () => {
    const result = selectEditorialDigestItems([
      cand({ itemSlug: 'saturday', date: '2026-06-13', category_slug: 'a' }),
      cand({ itemSlug: 'monday', date: '2026-06-08', category_slug: 'b' }),
    ]);
    const recency = Object.fromEntries(
      result.eligible.map((scored) => [scored.candidate.itemSlug, scored.breakdown.recency]),
    );

    expect(recency.saturday).toBe(5);
    expect(recency.saturday - recency.monday).toBeLessThanOrEqual(1);
  });

  it('counts independent citations as corroboration and discussion links as none', () => {
    const result = selectEditorialDigestItems([
      cand({
        itemSlug: 'independent',
        citationUrls: ['https://gowers.wordpress.com/post', 'https://arxiv.org/abs/2601.01'],
        sourceUrl: 'https://gowers.wordpress.com/post',
      }),
      cand({
        itemSlug: 'thread-only',
        citationUrls: [
          'https://sankalp.bearblog.dev/post',
          'https://news.ycombinator.com/item?id=1',
        ],
        sourceUrl: 'https://sankalp.bearblog.dev/post',
      }),
    ]);
    const corroboration = Object.fromEntries(
      result.eligible.map((scored) => [scored.candidate.itemSlug, scored.breakdown.corroboration]),
    );

    expect(corroboration.independent).toBe(1.5);
    expect(corroboration['thread-only']).toBe(0);
  });
});

describe('buildDigestSelectionContext', () => {
  it('explains the whole digest with reproducible selection metrics', () => {
    const selection = selectEditorialDigestItems([
      cand({
        itemSlug: 'lead',
        impact_level: 'high',
        category_slug: 'models-and-research',
        crossSourceScore: 0.8,
        mentionsCount: 3,
      }),
      cand({ itemSlug: 'tool', category_slug: 'tools-and-releases' }),
      cand({ itemSlug: 'extra-tool', category_slug: 'tools-and-releases', rank: 3 }),
      cand({ itemSlug: 'category-capped', category_slug: 'tools-and-releases', rank: 4 }),
      cand({ itemSlug: 'blocked', citationUrls: [] }),
    ], { max: 3 });

    const context = buildDigestSelectionContext(selection);

    expect(context.rationale.metrics).toMatchObject({
      candidateCount: 5,
      eligibleCount: 4,
      rejectedCount: 1,
      selectedCount: 3,
      eligibleNotSelectedCount: 1,
      categoryCount: 2,
      highImpactCount: 1,
      corroboratedCount: 1,
    });
    expect(context.rationale.summary_uk).toContain('Відібрано 3 із 5');
    expect(context.rationale.tradeoffs_uk).toContain('придатних новин: 1');
    expect(context.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          brief_item_id: 'category-capped',
          status: 'eligible_not_selected',
          exclusion_reasons: ['diversity_penalty'],
          diversity_penalty: 11,
        }),
        expect.objectContaining({
          brief_item_id: 'blocked',
          status: 'rejected',
          exclusion_reasons: ['missing_citations'],
        }),
      ]),
    );
  });
});

describe('editorial evidence parsing', () => {
  it('keeps unique HTTPS citations and ignores unsafe values', () => {
    expect(
      citationUrlsFromUnknown([
        { title: 'Primary', url: 'https://example.com/source' },
        'https://example.com/source',
        'http://example.com/insecure',
        'not a url',
      ]),
    ).toEqual(['https://example.com/source']);
  });

  it('counts only substantive fact entries', () => {
    expect(
      factCountFromUnknown(['A real fact', '   ', { claim: 'Another fact' }, { text: '' }, null]),
    ).toBe(2);
  });
});

describe('digestLineSummary', () => {
  it('keeps the first sentence and trims overlong text', () => {
    expect(digestLineSummary('Перше речення. Друге.')).toBe('Перше речення.');
    expect(digestLineSummary('а'.repeat(200)).length).toBeLessThanOrEqual(160);
  });
});

describe('formatWeeklyDigest', () => {
  it('renders numbered linked items and the archive footer', () => {
    const text = formatWeeklyDigest([cand({ itemSlug: 'x' })], {
      siteUrl: 'https://aitodaybrief.com',
      weekLabel: '2–8 червня',
    });
    expect(text).toContain('Тиждень в AI — найважливіше');
    expect(text).toContain('2–8 червня');
    expect(text).toContain('href="https://aitodaybrief.com/uk/news/tools-and-releases/x"');
    expect(text).toContain('1. ');
    expect(text).toContain('Перше речення резюме.');
    expect(text).toContain('https://aitodaybrief.com/uk/news');
  });

  it('falls back to the news listing when an item has no category', () => {
    const text = formatWeeklyDigest([cand({ itemSlug: 'x', category_slug: null })], {
      siteUrl: 'https://aitodaybrief.com',
      weekLabel: '2–8 червня',
    });
    expect(text).toContain('href="https://aitodaybrief.com/uk/news"');
  });
});

describe('weekLabelUk', () => {
  it('formats a same-month range with one genitive month', () => {
    expect(weekLabelUk(new Date('2026-06-08T12:00:00Z'))).toBe('2–8 червня');
  });
  it('formats a cross-month range with both months', () => {
    expect(weekLabelUk(new Date('2026-06-03T12:00:00Z'))).toBe('28 травня – 3 червня');
  });
});
