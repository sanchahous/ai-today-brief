import { describe, expect, it } from 'vitest';
import {
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
    briefSlug: 'brief-slug',
    itemSlug,
    date: '2026-06-10',
    rank: 1,
    citationUrls: ['https://example.com/source'],
    factsEnCount: 3,
    factsUkCount: 3,
    sourceName: 'Official source',
    sourceUrl: `https://example.com/${itemSlug}`,
    compositeScore: 0.5,
    authorityScore: 1,
    crossSourceScore: 0,
    breadthScore: 0,
    scoreVersion: 2,
    clusterId: `cluster-${itemSlug}`,
    mentionsCount: 1,
    ...over,
  };
}

describe('selectDigestItems', () => {
  it('puts high impact first and caps per category', () => {
    const out = selectDigestItems(
      [
        cand({ itemSlug: 'a', impact_level: 'low' }), // 3rd in tools category — capped
        cand({ itemSlug: 'b', impact_level: 'high' }),
        cand({ itemSlug: 'c', impact_level: 'high' }),
        cand({ itemSlug: 'd', impact_level: 'high' }), // also capped (same category)
        cand({ itemSlug: 'e', impact_level: 'medium', category_slug: 'agents-and-mcp' }),
      ],
      7,
      2,
    );
    expect(out.map((o) => o.itemSlug)).toEqual(['b', 'c', 'e']);
  });

  it('breaks impact ties by freshness then rank', () => {
    const out = selectDigestItems([
      cand({ itemSlug: 'older', date: '2026-06-08', category_slug: 'a' }),
      cand({ itemSlug: 'newer', date: '2026-06-10', category_slug: 'b' }),
      cand({ itemSlug: 'newer-r2', date: '2026-06-10', rank: 2, category_slug: 'c' }),
    ]);
    expect(out.map((o) => o.itemSlug)).toEqual(['newer', 'newer-r2', 'older']);
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
        authorityScore: 1,
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

  it('deduplicates an event and keeps no more than two stories per category', () => {
    const result = selectEditorialDigestItems([
      cand({ itemSlug: 'event-primary', clusterId: 'same-event', impact_level: 'high' }),
      cand({ itemSlug: 'event-copy', clusterId: 'same-event', impact_level: 'high', rank: 2 }),
      cand({ itemSlug: 'tools-2', impact_level: 'high', rank: 3 }),
      cand({ itemSlug: 'tools-3', impact_level: 'high', rank: 4 }),
      cand({ itemSlug: 'models', category_slug: 'models-and-research' }),
    ]);

    const selected = result.selected.map(({ candidate }) => candidate.itemSlug);
    expect(selected).toContain('event-primary');
    expect(selected).not.toContain('event-copy');
    expect(
      selected.filter((slug) => slug.startsWith('tools') || slug === 'event-primary'),
    ).toHaveLength(2);
    expect(selected).toContain('models');
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
    expect(text).toContain('href="https://aitodaybrief.com/uk/brief-slug/x"');
    expect(text).toContain('1. ');
    expect(text).toContain('Перше речення резюме.');
    expect(text).toContain('https://aitodaybrief.com/uk/news');
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
