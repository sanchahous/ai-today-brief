import { describe, expect, it } from 'vitest';
import {
  isWithinNewsSitemapWindow,
  NEWS_SITEMAP_MAX_AGE_MS,
  toNewsPublicationDate,
} from '@/lib/sitemap-dates';

describe('toNewsPublicationDate', () => {
  it('uses published_at when present', () => {
    expect(toNewsPublicationDate('2026-06-01T12:30:00.000Z', '2026-06-01')).toBe(
      '2026-06-01T12:30:00Z',
    );
  });

  it('defaults to 09:00 UTC on brief date', () => {
    expect(toNewsPublicationDate(null, '2026-06-01')).toBe('2026-06-01T09:00:00Z');
  });

  it('falls back on invalid timestamp', () => {
    expect(toNewsPublicationDate('invalid', '2026-06-01')).toBe('2026-06-01T09:00:00Z');
  });
});

describe('isWithinNewsSitemapWindow', () => {
  it('accepts dates within 48h', () => {
    const now = Date.parse('2026-06-04T12:00:00Z');
    const recent = new Date(now - NEWS_SITEMAP_MAX_AGE_MS + 3_600_000).toISOString();
    expect(isWithinNewsSitemapWindow(recent, now)).toBe(true);
  });

  it('rejects older dates', () => {
    const now = Date.parse('2026-06-04T12:00:00Z');
    expect(isWithinNewsSitemapWindow('2026-01-01T09:00:00Z', now)).toBe(false);
  });
});
