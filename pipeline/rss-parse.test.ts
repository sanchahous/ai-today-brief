import { describe, expect, it } from 'vitest';
import { feedHasEntries, parseRssFeedXml } from './rss-parse';

const NOW = Date.parse('2026-06-05T12:00:00Z');
const fresh = new Date(NOW - 3_600_000).toUTCString();
const stale = new Date(NOW - 48 * 3_600_000).toUTCString();

describe('feedHasEntries', () => {
  it('distinguishes quiet feeds (stale entries) from dead documents', () => {
    const quiet = `<rss><channel><item><title>Old</title><link>https://ex.com/1</link><pubDate>${stale}</pubDate></item></channel></rss>`;
    expect(feedHasEntries(quiet)).toBe(true);
    expect(feedHasEntries('<feed><entry><title>x</title></entry></feed>')).toBe(true);
    expect(feedHasEntries('<!DOCTYPE html><html><body>404</body></html>')).toBe(false);
    expect(feedHasEntries('')).toBe(false);
  });
});

describe('parseRssFeedXml', () => {
  it('parses RSS <item> blocks within the window', () => {
    const xml = `<rss><channel>
      <item><title>Fresh AI release</title><link>https://ex.com/1</link><pubDate>${fresh}</pubDate></item>
      <item><title>Old news</title><link>https://ex.com/2</link><pubDate>${stale}</pubDate></item>
    </channel></rss>`;
    const out = parseRssFeedXml(xml, 'Test Feed', 'https://ex.com/feed', NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      title: 'Fresh AI release',
      url: 'https://ex.com/1',
      source_name: 'Test Feed',
      inbrief_score: null,
    });
  });

  it('parses Atom <entry> blocks with href links and CDATA titles', () => {
    const freshIso = new Date(NOW - 3_600_000).toISOString();
    const xml = `<feed>
      <entry><title><![CDATA[Atom story]]></title><link href="https://ex.com/atom"/><updated>${freshIso}</updated></entry>
    </feed>`;
    const out = parseRssFeedXml(xml, 'Atom Feed', 'https://ex.com/atom.xml', NOW);
    expect(out).toHaveLength(1);
    expect(out[0]!.url).toBe('https://ex.com/atom');
    expect(out[0]!.title).toBe('Atom story');
  });

  it('skips blocks missing a title, link, or valid date', () => {
    const xml = `<rss><channel>
      <item><title>No link</title><pubDate>${fresh}</pubDate></item>
      <item><link>https://ex.com/3</link><pubDate>${fresh}</pubDate></item>
    </channel></rss>`;
    expect(parseRssFeedXml(xml, 'F', 'u', NOW)).toHaveLength(0);
  });
});
