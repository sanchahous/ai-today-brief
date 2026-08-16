import { describe, expect, it } from 'vitest';
import {
  buildResearchPrompt,
  dedupeSourcesByUrl,
  htmlToExcerpt,
  parseResearchResult,
  rehomeStalePrimary,
  toFetchedArticle,
  toPoolItem,
  withResearchSchema,
} from './custom-research';
import type { ResolvedProvider } from './providers/registry';

const MULTI_SOURCE_JSON = {
  title: 'NVIDIA ships Nemotron 3 Ultra',
  url: 'https://developer.nvidia.com/blog/nemotron',
  source_name: 'NVIDIA Blog',
  source_url: 'https://developer.nvidia.com/blog',
  published_at: '2026-06-10T12:00:00Z',
  synthesis_notes: 'Free coding benchmark model. Apache license. Beats prior gen on SWE-bench.',
  sources: [
    {
      title: 'Nemotron 3 Ultra launch',
      url: 'https://developer.nvidia.com/blog/nemotron',
      source_name: 'NVIDIA Blog',
      key_facts: 'Official release post.',
    },
    {
      title: 'NVIDIA open weights coding model',
      url: 'https://www.theverge.com/nemotron',
      source_name: 'The Verge',
      key_facts: 'Coverage of benchmark scores.',
    },
    {
      title: 'HN discussion',
      url: 'https://news.ycombinator.com/item?id=123',
      source_name: 'Hacker News',
      key_facts: 'Community notes on license.',
    },
  ],
};

describe('buildResearchPrompt', () => {
  it('includes the topic and optional url', () => {
    const prompt = buildResearchPrompt('Nemotron 3 Ultra', 'https://nvidia.com/blog/x');
    expect(prompt).toContain('Nemotron 3 Ultra');
    expect(prompt).toContain('https://nvidia.com/blog/x');
    expect(prompt).toContain('USER-PROVIDED URL');
    expect(prompt).toContain('at least 3 independent sources');
    expect(prompt).toContain('more than one calendar year old');
  });

  it('asks for primary source when no url', () => {
    const prompt = buildResearchPrompt('Some AI release');
    expect(prompt).toContain('No URL provided');
  });
});

describe('parseResearchResult', () => {
  it('parses multi-source research json', () => {
    const result = parseResearchResult(JSON.stringify(MULTI_SOURCE_JSON), 'fallback');
    expect(result.title).toContain('Nemotron');
    expect(result.url).toContain('https://');
    expect(result.source_name).toBe('NVIDIA Blog');
    expect(result.sources).toHaveLength(3);
    expect(result.synthesis_notes).toContain('benchmark');
    expect(result.excerpt).toBe(result.synthesis_notes);
  });

  it('rejects invalid primary url', () => {
    expect(() =>
      parseResearchResult(JSON.stringify({ title: 'x', url: 'not-a-url' }), 'fallback'),
    ).toThrow('invalid url');
  });

  it('requires at least two sources', () => {
    expect(() =>
      parseResearchResult(
        JSON.stringify({
          ...MULTI_SOURCE_JSON,
          sources: [MULTI_SOURCE_JSON.sources[0]],
        }),
        'fallback',
      ),
    ).toThrow('at least 2 sources');
  });

  it('rehomes a 2024 TechCrunch primary onto a fresh source', () => {
    const stale =
      'https://techcrunch.com/2024/08/23/cursor-the-ai-powered-code-editor-raises-60m-series-a-at-400m-valuation/';
    const fresh = 'https://cursor.com/blog/joining-spacex';
    const result = parseResearchResult(
      JSON.stringify({
        ...MULTI_SOURCE_JSON,
        title: 'Anysphere clarifies acquisition rumors',
        url: stale,
        source_name: 'TechCrunch',
        sources: [
          {
            title: '2024 Series A',
            url: stale,
            source_name: 'TechCrunch',
            key_facts: 'Old round.',
          },
          {
            title: 'Cursor is now a part of SpaceX',
            url: fresh,
            source_name: 'Cursor',
            key_facts: 'Deal closed.',
          },
        ],
      }),
      'fallback',
      new Date('2026-08-16T00:00:00Z'),
    );
    expect(result.url).toBe(fresh);
    expect(result.source_name).toBe('Cursor');
  });
});

describe('rehomeStalePrimary', () => {
  it('throws when every source URL is stale', () => {
    expect(() =>
      rehomeStalePrimary(
        {
          title: 'Old',
          url: 'https://techcrunch.com/2024/01/01/old/',
          source_name: 'TechCrunch',
          source_url: 'https://techcrunch.com',
          published_at: '2024-01-01T00:00:00Z',
          synthesis_notes: 'x',
          excerpt: 'x',
          sources: [
            {
              title: 'a',
              url: 'https://example.com/2023/old-a',
              source_name: 'A',
              excerpt: 'a',
            },
            {
              title: 'b',
              url: 'https://example.com/2024/old-b',
              source_name: 'B',
              excerpt: 'b',
            },
          ],
        },
        new Date('2026-08-16T00:00:00Z'),
      ),
    ).toThrow('stale');
  });
});

describe('dedupeSourcesByUrl', () => {
  it('removes duplicate urls', () => {
    const out = dedupeSourcesByUrl([
      { title: 'a', url: 'https://x.com/a/', source_name: 'A', key_facts: '1' },
      { title: 'b', url: 'https://x.com/a', source_name: 'B', key_facts: '2' },
    ]);
    expect(out).toHaveLength(1);
  });
});

describe('htmlToExcerpt', () => {
  it('strips tags and collapses whitespace', () => {
    expect(htmlToExcerpt('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });
});

describe('withResearchSchema (Phase 3: registry migration)', () => {
  const httpEntry: ResolvedProvider = {
    entry: { kind: 'http', id: 'openrouter' },
    http: { id: 'openrouter', apiKey: 'k', baseUrl: 'https://openrouter.ai/api/v1', modelQueue: ['m'] },
  };
  const geminiEntry: ResolvedProvider = {
    entry: { kind: 'gemini', id: 'gemini' },
    gemini: { apiKey: 'g-key' },
  };

  it('attaches RESEARCH_SCHEMA to a gemini entry only for the custom_research role', () => {
    const registry = { chainForRole: () => [geminiEntry, httpEntry] };
    const patched = withResearchSchema(registry);

    const chain = patched.chainForRole('custom_research');
    expect(chain[0]?.gemini?.schema).toBeDefined();
    expect(chain[0]?.gemini?.apiKey).toBe('g-key'); // unrelated fields untouched
    expect(chain[1]).toBe(httpEntry); // non-gemini entries pass through unchanged (same reference)
  });

  it('leaves other roles untouched (no schema leaks into e.g. daily.summarize)', () => {
    const registry = { chainForRole: () => [geminiEntry] };
    const patched = withResearchSchema(registry);

    const chain = patched.chainForRole('daily.summarize');
    expect(chain[0]).toBe(geminiEntry);
    expect(chain[0]?.gemini?.schema).toBeUndefined();
  });
});

describe('toFetchedArticle / toPoolItem', () => {
  const research = parseResearchResult(JSON.stringify(MULTI_SOURCE_JSON), 'fallback');

  it('maps to pipeline shapes', () => {
    const article = toFetchedArticle(research);
    expect(article.url).toBe(research.url);
    expect(article.raw).toMatchObject({
      custom_research: true,
      source_count: 3,
    });

    const pool = toPoolItem(research);
    expect(pool.ref).toBe(1);
    expect(pool.topic).toBe('nvidia');
    expect(pool.category).toBe('tools-and-releases');
  });
});
