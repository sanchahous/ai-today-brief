import { describe, expect, it } from 'vitest';
import {
  digestLineSummary,
  formatWeeklyDigest,
  selectDigestItems,
  weekLabelUk,
  type DigestCandidate,
} from './weekly-digest';

function cand(over: Partial<DigestCandidate> = {}): DigestCandidate {
  return {
    title_uk: 'Заголовок',
    title_en: 'Title',
    summary_uk: 'Перше речення резюме. Друге речення, яке не потрібне.',
    impact_level: 'medium',
    category_slug: 'tools-and-releases',
    briefSlug: 'brief-slug',
    itemSlug: 'item-slug',
    date: '2026-06-10',
    rank: 1,
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
