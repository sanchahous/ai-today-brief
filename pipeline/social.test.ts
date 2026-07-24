import { describe, expect, it } from 'vitest';
import { buildSocialItemUrl, parseSocialChannels } from './social';

describe('parseSocialChannels', () => {
  it('preserves the existing Telegram/X delivery default', () => {
    expect(parseSocialChannels(undefined)).toEqual(['telegram', 'x']);
  });

  it('parses a unique, explicit channel allowlist', () => {
    expect(parseSocialChannels(' telegram, threads,telegram ')).toEqual(['telegram', 'threads']);
    expect(parseSocialChannels('none')).toEqual([]);
  });

  it('rejects unrecognised channels rather than silently publishing nowhere', () => {
    expect(() => parseSocialChannels('telegram,tiktok')).toThrow('tiktok');
  });
});

describe('buildSocialItemUrl', () => {
  it('builds the canonical item URL with platform attribution', () => {
    expect(
      buildSocialItemUrl('https://aitodaybrief.com', {
        lang: 'en',
        categorySlug: 'tools-and-releases',
        itemSlug: 'new-model',
        channel: 'threads',
        content: 'top_story',
      }),
    ).toBe(
      'https://aitodaybrief.com/en/news/tools-and-releases/new-model?utm_source=threads&utm_medium=social&utm_campaign=daily_news&utm_content=top_story',
    );
  });

  it('keeps an optional base path and safely encodes path segments', () => {
    expect(
      buildSocialItemUrl('https://example.com/news/', {
        lang: 'uk',
        categorySlug: 'tools and releases',
        itemSlug: 'модель',
        channel: 'telegram',
        campaign: 'weekly_digest',
      }),
    ).toBe(
      'https://example.com/news/uk/news/tools%20and%20releases/%D0%BC%D0%BE%D0%B4%D0%B5%D0%BB%D1%8C?utm_source=telegram&utm_medium=social&utm_campaign=weekly_digest',
    );
  });
});
