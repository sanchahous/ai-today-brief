import { describe, expect, it } from 'vitest';
import {
  buildResearchPrompt,
  htmlToExcerpt,
  parseResearchResult,
  toFetchedArticle,
  toPoolItem,
} from './custom-research';

describe('buildResearchPrompt', () => {
  it('includes the topic and optional url', () => {
    const prompt = buildResearchPrompt('Nemotron 3 Ultra', 'https://nvidia.com/blog/x');
    expect(prompt).toContain('Nemotron 3 Ultra');
    expect(prompt).toContain('https://nvidia.com/blog/x');
    expect(prompt).toContain('USER-PROVIDED URL');
  });

  it('asks for primary source when no url', () => {
    const prompt = buildResearchPrompt('Some AI release');
    expect(prompt).toContain('No URL provided');
  });
});

describe('parseResearchResult', () => {
  it('parses valid research json', () => {
    const result = parseResearchResult(
      JSON.stringify({
        title: 'NVIDIA ships Nemotron 3 Ultra',
        url: 'https://developer.nvidia.com/blog/nemotron',
        source_name: 'NVIDIA Blog',
        source_url: 'https://developer.nvidia.com/blog',
        published_at: '2026-06-10T12:00:00Z',
        excerpt: 'Free coding benchmark model.',
      }),
      'fallback',
    );
    expect(result.title).toContain('Nemotron');
    expect(result.url).toContain('https://');
    expect(result.source_name).toBe('NVIDIA Blog');
  });

  it('rejects invalid url', () => {
    expect(() =>
      parseResearchResult(JSON.stringify({ title: 'x', url: 'not-a-url' }), 'fallback'),
    ).toThrow('invalid url');
  });
});

describe('htmlToExcerpt', () => {
  it('strips tags and collapses whitespace', () => {
    expect(htmlToExcerpt('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });
});

describe('toFetchedArticle / toPoolItem', () => {
  const research = {
    title: 'NVIDIA Nemotron 3 Ultra (free) Coding Benchmark',
    url: 'https://example.com/nemotron',
    source_name: 'NVIDIA Blog',
    source_url: 'https://developer.nvidia.com/blog',
    published_at: '2026-06-10T10:00:00.000Z',
    excerpt: 'Benchmark suite for code.',
  };

  it('maps to pipeline shapes', () => {
    const article = toFetchedArticle(research);
    expect(article.url).toBe(research.url);
    expect(article.raw).toEqual({ custom_research: true, excerpt: research.excerpt });

    const pool = toPoolItem(research);
    expect(pool.ref).toBe(1);
    expect(pool.topic).toBe('nvidia');
    expect(pool.category).toBe('models-and-research');
  });
});
