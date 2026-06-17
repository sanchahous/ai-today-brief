import { describe, expect, it } from 'vitest';
import { isExternalLink } from '@/components/item-engagement-tracker';

const BASE = 'https://aitodaybrief.com/en/ai-news/some-item';

describe('isExternalLink', () => {
  it('treats a different host as external', () => {
    expect(isExternalLink('https://news.ycombinator.com/item?id=1', BASE)).toBe(true);
    expect(isExternalLink('http://example.com', BASE)).toBe(true);
  });

  it('treats same-host and relative links as internal', () => {
    expect(isExternalLink('https://aitodaybrief.com/en/news', BASE)).toBe(false);
    expect(isExternalLink('/en/concepts/mcp', BASE)).toBe(false);
    expect(isExternalLink('#sources', BASE)).toBe(false);
  });

  it('ignores non-http schemes (mailto, javascript)', () => {
    expect(isExternalLink('mailto:hi@example.com', BASE)).toBe(false);
    expect(isExternalLink('javascript:void(0)', BASE)).toBe(false);
  });

  it('is safe on malformed hrefs', () => {
    expect(isExternalLink('', BASE)).toBe(false);
    expect(isExternalLink('http://', BASE)).toBe(false);
  });
});
