import { describe, expect, it } from 'vitest';
import {
  decodeEntities,
  extractMainText,
  extractOgImage,
  hnStoryIdFromUrl,
  isGenericOgImage,
  stripHtml,
} from './enrich';

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('Tom &amp; Jerry &lt;3 &#8212; &#x2014; &rsquo;')).toBe(
      'Tom & Jerry <3 — — ’',
    );
  });
  it('leaves unknown entities alone', () => {
    expect(decodeEntities('&unknown;')).toBe('&unknown;');
  });
});

describe('stripHtml', () => {
  it('drops tags, breaks on block closers and collapses whitespace', () => {
    const out = stripHtml('<p>First   paragraph</p><p>Second <b>bold</b> bit</p>');
    expect(out).toBe('First paragraph\nSecond bold bit');
  });
});

describe('extractMainText', () => {
  const longLine = (label: string) =>
    `${label}: this sentence is intentionally long enough to pass the prose-line threshold of the extractor.`;

  it('prefers the article block and filters short nav crumbs', () => {
    const html = `
      <html><body>
        <nav><a>Home</a><a>News</a></nav>
        <div>Menu</div>
        <article>
          <h1>${longLine('Headline')}</h1>
          <p>${longLine('Body one')}</p>
          <p>Short.</p>
          <p>${longLine('Body two')}</p>
        </article>
        <footer>${longLine('Footer junk that lives outside the article')}</footer>
      </body></html>`;
    const text = extractMainText(html)!;
    expect(text).toContain('Body one');
    expect(text).toContain('Body two');
    expect(text).not.toContain('Short.');
    expect(text).not.toContain('Footer junk');
  });

  it('removes scripts/styles and returns null for shell pages', () => {
    const shell = '<html><body><script>var a = "very long script content here";</script><div id="root"></div></body></html>';
    expect(extractMainText(shell)).toBeNull();
  });

  it('caps the extracted text length', () => {
    const para = `<p>${'long enough prose line for the extractor threshold. '.repeat(10)}</p>`;
    const html = `<article>${para.repeat(100)}</article>`;
    const text = extractMainText(html, 500)!;
    expect(text.length).toBeLessThanOrEqual(501); // cap + ellipsis
  });
});

describe('extractOgImage', () => {
  it('reads og:image in either attribute order and twitter fallback', () => {
    expect(
      extractOgImage('<meta property="og:image" content="https://ex.com/a.png">'),
    ).toBe('https://ex.com/a.png');
    expect(
      extractOgImage('<meta content="https://ex.com/b.png" property="og:image">'),
    ).toBe('https://ex.com/b.png');
    expect(
      extractOgImage('<meta name="twitter:image" content="https://ex.com/c.png">'),
    ).toBe('https://ex.com/c.png');
  });
  it('rejects non-http values and missing tags', () => {
    expect(extractOgImage('<meta property="og:image" content="/relative.png">')).toBeNull();
    expect(extractOgImage('<html></html>')).toBeNull();
  });
});

describe('isGenericOgImage', () => {
  it('flags platform logos and auto-generated cards', () => {
    expect(
      isGenericOgImage('https://static.arxiv.org/icons/twitter/arxiv-logo-twitter-square.png'),
    ).toBe(true);
    expect(isGenericOgImage('https://arxiv.org/static/browse/0.3.4/images/arxiv-logo-fb.png')).toBe(
      true,
    );
    expect(isGenericOgImage('https://opengraph.githubassets.com/abc123/owner/repo')).toBe(true);
    expect(isGenericOgImage('https://avatars.githubusercontent.com/u/1?v=4')).toBe(true);
    expect(isGenericOgImage('https://github.githubassets.com/images/modules/open_graph/github-logo.png')).toBe(true);
    expect(isGenericOgImage('https://news.ycombinator.com/y18.svg')).toBe(true);
    expect(isGenericOgImage('https://www.redditstatic.com/icon.png')).toBe(true);
  });

  it('flags default/placeholder filenames on any host', () => {
    expect(isGenericOgImage('https://example.com/img/og-default.png')).toBe(true);
    expect(isGenericOgImage('https://example.com/default_share.jpg')).toBe(true);
    expect(isGenericOgImage('https://example.com/assets/placeholder.webp')).toBe(true);
    expect(isGenericOgImage('https://example.com/favicon.ico')).toBe(true);
  });

  it('keeps real story art, including custom repo banners', () => {
    expect(
      isGenericOgImage('https://repository-images.githubusercontent.com/123/banner.png'),
    ).toBe(false);
    expect(isGenericOgImage('https://www.anthropic.com/images/claude-launch.png')).toBe(false);
    expect(isGenericOgImage('https://pbs.twimg.com/media/abc.jpg')).toBe(false);
    // "default"/"og" inside a path segment (not the filename) is fine
    expect(isGenericOgImage('https://example.com/og-images/2026/story-hero.png')).toBe(false);
  });
});

describe('hnStoryIdFromUrl', () => {
  it('extracts the story id from an HN discussion link', () => {
    expect(hnStoryIdFromUrl('https://news.ycombinator.com/item?id=4242')).toBe('4242');
    expect(hnStoryIdFromUrl('https://reddit.com/r/x/comments/1')).toBeNull();
    expect(hnStoryIdFromUrl(undefined)).toBeNull();
  });
});
