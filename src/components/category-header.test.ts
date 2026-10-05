import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CategoryHeader, CategoryPrimer } from './category-header';
import type { CategoryHubView } from '@/lib/categories';

const sampleHub: CategoryHubView = {
  slug: 'agents-and-mcp',
  name: 'Agents & MCP',
  description: 'Autonomous agents, protocols, and orchestration harnesses.',
  color: null,
  icon: 'agents',
  tagline: 'Autonomous workflows, tools & harnesses',
  subtopics: ['MCP', 'Tool use', 'Memory'],
  items: [
    {
      id: 'item-1',
      rank: 1,
      categorySlug: 'agents-and-mcp',
      categoryName: 'Agents & MCP',
      categoryColor: null,
      href: '/en/news/agents-and-mcp/item-1',
      title: 'Story 1',
      summary: 'Summary 1',
      why: 'Why 1',
      date: '2026-10-04',
      hasVideo: false,
      tools: ['claude'],
      topics: ['agents'],
      sourceName: 'Anthropic',
      readMinutes: 3,
      imageUrl: null,
    },
  ],
  updatedDaily: true,
  primerConcepts: [
    { slug: 'ai-agent', name: 'AI Agent' },
    { slug: 'mcp', name: 'Model Context Protocol' },
  ],
  relatedGuide: {
    slug: 'claude-code-vs-cursor-vs-codex',
    title: 'Claude Code vs Cursor vs Codex',
  },
};

describe('CategoryHeader', () => {
  it('renders category eyebrow, title, description, real count, and verified updated daily', () => {
    const markup = renderToStaticMarkup(
      createElement(CategoryHeader, { lang: 'en', hub: sampleHub }),
    );
    expect(markup).toContain('Category');
    expect(markup).toContain('Agents &amp; MCP');
    expect(markup).toContain('Autonomous agents, protocols, and orchestration harnesses.');
    expect(markup).toContain('1 story');
    expect(markup).toContain('updated daily');
  });

  it('omits updated daily badge when updatedDaily is false', () => {
    const markup = renderToStaticMarkup(
      createElement(CategoryHeader, {
        lang: 'en',
        hub: { ...sampleHub, updatedDaily: false },
      }),
    );
    expect(markup).not.toContain('updated daily');
  });

  it('renders Ukrainian translations correctly', () => {
    const markup = renderToStaticMarkup(
      createElement(CategoryHeader, {
        lang: 'uk',
        hub: { ...sampleHub, updatedDaily: true },
      }),
    );
    expect(markup).toContain('Категорія');
    expect(markup).toContain('оновлюється щодня');
    expect(markup).toContain('Почніть з основ');
    expect(markup).toContain('Пов&#x27;язаний гайд');
  });

  it('renders subtopics pointing to news search with coarse pointer min-height', () => {
    const markup = renderToStaticMarkup(
      createElement(CategoryHeader, { lang: 'en', hub: sampleHub }),
    );
    expect(markup).toContain('/en/news/search?q=MCP');
    expect(markup).toContain('/en/news/search?q=Tool%20use');
    expect(markup).toContain('cat-chip');
    expect(markup).toContain('min-h-[44px]');
  });

  it('renders CategoryPrimer with concepts and related guide', () => {
    const markup = renderToStaticMarkup(
      createElement(CategoryHeader, { lang: 'en', hub: sampleHub }),
    );
    expect(markup).toContain('Start with the basics');
    expect(markup).toContain('/en/concepts/ai-agent');
    expect(markup).toContain('/en/concepts/mcp');
    expect(markup).toContain('/en/guides/claude-code-vs-cursor-vs-codex');
    expect(markup).toContain('Related guide: Claude Code vs Cursor vs Codex');
  });

  it('omits guide link when relatedGuide is null', () => {
    const markup = renderToStaticMarkup(
      createElement(CategoryPrimer, {
        lang: 'en',
        hub: { ...sampleHub, relatedGuide: null },
      }),
    );
    expect(markup).not.toContain('/en/guides/');
    expect(markup).not.toContain('Related guide');
  });
});
