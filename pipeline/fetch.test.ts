import { describe, expect, it } from 'vitest';
import { filterToRollingWindow, prepareArticles, sourceHealthOf, toCandidate } from './fetch';
import type { FetchedArticle } from './sources/http';

const NOW = Date.parse('2026-06-05T12:00:00Z');

function article(over: Partial<FetchedArticle> = {}): FetchedArticle {
  return {
    source_name: 'Hacker News',
    source_url: 'https://news.ycombinator.com/item?id=1',
    title: 'A story',
    url: 'https://example.com/a',
    published_at: new Date(NOW - 3_600_000).toISOString(),
    raw: {},
    hn_score: 10,
    hn_comments: 2,
    reddit_score: null,
    reddit_comments: null,
    inbrief_score: null,
    ...over,
  };
}

describe('prepareArticles', () => {
  it('drops rows without a valid http url or title and de-duplicates by url', () => {
    const out = prepareArticles([
      article({ url: 'https://example.com/a', title: 'Keep' }),
      article({ url: 'https://example.com/a', title: 'Dup url' }),
      article({ url: 'ftp://nope', title: 'Bad scheme' }),
      article({ url: 'https://example.com/b', title: '' }),
      article({ url: 'https://example.com/c', title: 'Keep too' }),
    ]);
    expect(out.map((a) => a.url)).toEqual(['https://example.com/a', 'https://example.com/c']);
  });

  it('treats a trailing slash and www as the same page', () => {
    const out = prepareArticles([
      article({
        url: 'https://openai.com/index/previewing-ultrafast/',
        title: 'HN slash',
      }),
      article({
        url: 'https://www.openai.com/index/previewing-ultrafast?utm_source=rss',
        title: 'RSS no slash',
      }),
    ]);
    expect(out.map((a) => a.url)).toEqual(['https://openai.com/index/previewing-ultrafast']);
  });

  it('normalizes source names onto their canonical labels', () => {
    const out = prepareArticles([
      article({ url: 'https://example.com/a', source_name: 'HackerNews' }),
      article({ url: 'https://example.com/b', source_name: 'x.com' }),
      article({ url: 'https://example.com/c', source_name: 'Reddit · r/LocalLLaMA' }),
    ]);
    expect(out.map((a) => a.source_name)).toEqual([
      'Hacker News',
      'X (Twitter)',
      'Reddit · r/LocalLLaMA',
    ]);
  });
});

describe('sourceHealthOf', () => {
  it('reports ok / empty / failed per settled branch', () => {
    expect(sourceHealthOf('inbrief', { status: 'fulfilled', value: [article()] })).toEqual({
      source: 'inbrief',
      status: 'ok',
      count: 1,
    });
    expect(sourceHealthOf('rss', { status: 'fulfilled', value: [] })).toEqual({
      source: 'rss',
      status: 'empty',
      count: 0,
    });
    expect(sourceHealthOf('reddit', { status: 'rejected', reason: new Error('boom') })).toEqual({
      source: 'reddit',
      status: 'failed',
      count: 0,
    });
  });
});

describe('filterToRollingWindow', () => {
  it('keeps only items inside the 24h window', () => {
    const out = filterToRollingWindow(
      [
        article({ url: 'fresh', published_at: new Date(NOW - 2 * 3_600_000).toISOString() }),
        article({ url: 'stale', published_at: new Date(NOW - 30 * 3_600_000).toISOString() }),
        article({ url: 'bad', published_at: 'not-a-date' }),
      ],
      NOW,
    );
    expect(out.map((a) => a.url)).toEqual(['fresh']);
  });
});

describe('toCandidate', () => {
  it('projects a fetched article onto the ranking model with one mention', () => {
    const c = toCandidate(article({ url: 'https://example.com/x', inbrief_score: 70 }));
    expect(c.id).toBe('https://example.com/x');
    expect(c.url).toBe('https://example.com/x');
    expect(c.mentions_count).toBe(1);
    expect(c.inbrief_score).toBe(70);
  });
});
