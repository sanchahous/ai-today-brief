import { describe, expect, it } from 'vitest';
import { socialMeta } from './seo';

describe('socialMeta', () => {
  it('builds OG + twitter block with locale and canonical URL', () => {
    const meta = socialMeta({
      title: 'News',
      description: 'Daily AI news',
      path: '/en/news',
      lang: 'en',
    });

    expect(meta.openGraph).toMatchObject({
      title: 'News',
      description: 'Daily AI news',
      url: expect.stringContaining('/en/news'),
      type: 'website',
      locale: 'en_US',
      alternateLocale: ['uk_UA'],
    });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', title: 'News' });
  });

  it('uses Ukrainian locale for uk pages', () => {
    const meta = socialMeta({
      title: 'Новини',
      description: 'Щоденні AI-новини',
      path: '/uk/news',
      lang: 'uk',
    });

    expect(meta.openGraph?.locale).toBe('uk_UA');
    expect(meta.openGraph?.alternateLocale).toEqual(['en_US']);
  });

  it('includes article timestamps only when provided', () => {
    const plain = socialMeta({
      title: 'Hub',
      description: 'Hub page',
      path: '/en/concepts/mcp',
      lang: 'en',
    });
    expect(plain.openGraph).not.toHaveProperty('publishedTime');
    expect(plain.openGraph).not.toHaveProperty('modifiedTime');

    const article = socialMeta({
      title: 'Guide',
      description: 'A guide',
      path: '/en/guides/mcp',
      lang: 'en',
      type: 'article',
      modifiedTime: '2026-08-01',
    });
    expect(article.openGraph).not.toHaveProperty('publishedTime');
    expect(article.openGraph).toHaveProperty('modifiedTime', '2026-08-01');
  });
});
