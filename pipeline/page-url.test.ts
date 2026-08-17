import { describe, expect, it } from 'vitest';
import { canonicalPageUrl, pageIdentityKey } from './page-url';

describe('canonicalPageUrl', () => {
  it('strips www, tracking params, hash and trailing slashes', () => {
    expect(
      canonicalPageUrl(
        'https://WWW.OpenAI.com/index/previewing-ultrafast/?utm_source=hn&fbclid=1#section',
      ),
    ).toBe('https://openai.com/index/previewing-ultrafast');
  });

  it('keeps a meaningful query string', () => {
    expect(canonicalPageUrl('https://example.com/search?q=qwen')).toBe(
      'https://example.com/search?q=qwen',
    );
  });

  it('rejects credentials, non-http schemes and unparseable values', () => {
    expect(canonicalPageUrl('https://user:secret@example.com/private')).toBeNull();
    expect(canonicalPageUrl('ftp://example.com/a')).toBeNull();
    expect(canonicalPageUrl('not a url')).toBeNull();
  });
});

describe('pageIdentityKey', () => {
  it('treats trailing slash and http vs https as the same page', () => {
    expect(pageIdentityKey('https://openai.com/index/previewing-ultrafast/')).toBe(
      'https://openai.com/index/previewing-ultrafast',
    );
    expect(pageIdentityKey('http://openai.com/index/previewing-ultrafast')).toBe(
      'https://openai.com/index/previewing-ultrafast',
    );
  });
});
