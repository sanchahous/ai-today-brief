import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConceptArticle } from './concept-article';
import type { ConceptDetail } from '@/lib/concepts';
import type { HomeItem } from '@/lib/home';

function concept(overrides: Partial<ConceptDetail> = {}): ConceptDetail {
  return {
    slug: 'mcp',
    name: 'Model Context Protocol',
    description: 'An open protocol that connects applications to tools.',
    type: 'concept',
    category: 'protocol',
    officialUrl: 'https://modelcontextprotocol.io/',
    aliases: ['MCP'],
    body: 'The host opens one client per server.\n\nUse it when the same tools must cross applications.',
    faq: [{ q: 'Is a protocol an agent?', a: 'No.' }],
    verification: 'verified',
    verifiedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

const story: HomeItem = {
  id: 'story-1',
  rank: 1,
  categorySlug: 'agents',
  categoryName: 'Agents',
  categoryColor: null,
  href: '/en/news/agents/story-1',
  title: 'A story about MCP',
  summary: 'Summary',
  why: '',
  date: '2026-09-01',
  hasVideo: false,
  tools: [],
  topics: [],
  sourceName: null,
  readMinutes: 3,
  imageUrl: null,
};

function sectionIds(html: string): string[] {
  return [...html.matchAll(/id="(overview|how|fit|faq|verification)"/g)].map((match) => match[1] ?? '');
}

describe('ConceptArticle', () => {
  it('renders mockup sections in order from real fields', () => {
    const html = renderToStaticMarkup(
      createElement(ConceptArticle, {
        lang: 'en',
        concept: concept({
          body: 'The host opens one client per server.\n\nUse it when tools are shared.\n\n- Host: The application — Claude\n- Client: One connection — JSON-RPC',
        }),
        stories: [story, { ...story, id: 'story-2', title: 'Second' }],
        others: [
          {
            slug: 'rag',
            name: 'RAG',
            description: '',
            type: 'concept',
            category: 'pattern',
            verification: null,
            verifiedAt: null,
          },
        ],
      }),
    );
    expect(sectionIds(html)).toEqual(['overview', 'how', 'fit', 'faq', 'verification']);
    expect(html).toContain('data-diagram="process"');
    expect(html).toContain('data-kind="protocol"');
    expect(html).toContain('Protocol');
    expect(html).toContain('Official site');
    expect(html).toContain('2 stories');
    expect(html).toContain('23 September 2026');
    expect(html).toContain('Oleksandr Kuzmenko');
    expect(html).toContain('Put it to work');
    expect(html).toContain('Stories on this topic');
    expect(html.indexOf('id="how"')).toBeLessThan(html.indexOf('id="fit"'));
    expect(html.indexOf('id="fit"')).toBeLessThan(html.indexOf('id="faq"'));
  });

  it('omits the diagram, date, author and story block when those fields are absent', () => {
    const html = renderToStaticMarkup(
      createElement(ConceptArticle, {
        lang: 'en',
        concept: concept({
          description: 'A definition.',
          body: 'Only the explainer.',
          officialUrl: null,
          faq: [],
          verification: null,
          verifiedAt: null,
          aliases: [],
        }),
        stories: [],
        others: [],
      }),
    );
    expect(html).not.toContain('data-diagram="process"');
    expect(html).not.toContain('<time');
    expect(html).not.toContain('Oleksandr Kuzmenko');
    expect(html).not.toContain('Official site');
    expect(html).not.toContain('Stories on this topic');
    expect(html).not.toContain('id="faq"');
    expect(html).not.toContain('id="verification"');
    expect(html).toContain('id="overview"');
    expect(html).toContain('id="how"');
  });
});