import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StoryCard, type StoryCardItem } from './story-card';
import { StoryRow } from './story-row';

const sampleItem: StoryCardItem = {
  id: 'claude-code-subagents-orchestration',
  href: '/en/news/agents-and-mcp/claude-code-subagents-orchestration',
  title: 'Claude Code sub-agents: orchestration patterns and memory isolation in agentic CLI systems',
  summary:
    'Anthropic introduced sub-agents for Claude Code with isolated working context and reactive IPC wakeups.',
  date: '2026-10-03',
  categorySlug: 'agents-and-mcp',
  categoryName: 'Agents & MCP',
  categoryColor: '#B58CF7',
  readMinutes: 6,
  hasVideo: true,
  why: 'Sub-agents prevent memory pollution in long-running terminal coding sessions, dramatically reducing token churn.',
  takeaways: [
    'Sub-agents run in separate conversations with inherited or clean workspaces.',
    'Reactive wakeups eliminate busy polling loops.',
    'Tool delegation preserves parent agent context.',
  ],
};

describe('StoryCard', () => {
  it('renders all 4 layout variants (standard, lead, row, withoutImage)', () => {
    const standard = renderToStaticMarkup(createElement(StoryCard, { item: sampleItem, layout: 'standard' }));
    expect(standard).toContain('data-layout="standard"');
    expect(standard).toContain('cat-banner');

    const lead = renderToStaticMarkup(createElement(StoryCard, { item: sampleItem, layout: 'lead' }));
    expect(lead).toContain('data-layout="lead"');
    expect(lead).toContain('banner-hero');

    const row = renderToStaticMarkup(createElement(StoryCard, { item: sampleItem, layout: 'row', rank: 1 }));
    expect(row).toContain('data-layout="row"');
    expect(row).toContain('01');

    const withoutImage = renderToStaticMarkup(
      createElement(StoryCard, { item: sampleItem, layout: 'withoutImage' })
    );
    expect(withoutImage).toContain('data-layout="withoutImage"');
    expect(withoutImage).not.toContain('cat-banner');
    expect(withoutImage).not.toContain('story-card-media');
  });

  it('provides a single block-link with accessible name and separate tab-stops for actions', () => {
    const markup = renderToStaticMarkup(createElement(StoryCard, { item: sampleItem }));

    // Title link has accessible name matching the article title
    expect(markup).toContain(sampleItem.title);
    expect(markup).toContain('story-card-link');
    expect(markup).toContain(`href="${sampleItem.href}"`);

    // Media slot is hidden from tab order so there is exactly ONE tab-stop for navigation
    expect(markup).toContain('story-card-media');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('tabindex="-1"');

    // Action buttons are distinct interactive controls
    expect(markup).toContain('aria-controls=');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('story-card-actions');
  });

  it('renders CategoryBadge, date, reading time, and video badge', () => {
    const markup = renderToStaticMarkup(createElement(StoryCard, { item: sampleItem, lang: 'uk' }));

    expect(markup).toContain('Agents &amp; MCP');
    expect(markup).toContain('var(--cat-agents)');
    expect(markup).toContain('6 хв читання');
    expect(markup).toContain('Відео');
    expect(markup.toLowerCase()).toContain('datetime="2026-10-03"');
  });

  it('renders next/image with explicit dimensions when imageUrl is provided (no CLS)', () => {
    const itemWithImage: StoryCardItem = {
      ...sampleItem,
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
    };

    const markup = renderToStaticMarkup(createElement(StoryCard, { item: itemWithImage, layout: 'standard' }));

    expect(markup).toContain('<img');
    expect(markup).toContain('width="440"');
    expect(markup).toContain('height="330"');
    expect(markup).not.toContain('cat-banner');
  });

  it('renders deterministic CategoryBanner fallback when imageUrl is null', () => {
    const markup = renderToStaticMarkup(createElement(StoryCard, { item: sampleItem }));
    expect(markup).toContain('cat-banner');
    expect(markup).toContain('var(--art-agents)');
  });

  it('supports contract StoryCard({ item, layout })', () => {
    const markup = renderToStaticMarkup(createElement(StoryCard, { item: sampleItem, layout: 'lead' }));
    expect(markup).toContain('data-layout="lead"');
    expect(markup).toContain(sampleItem.title);
  });
});

describe('StoryRow', () => {
  it('delegates to StoryCard with row layout and optional rank', () => {
    const markup = renderToStaticMarkup(
      createElement(StoryRow, { item: sampleItem, rank: 4, lang: 'en' })
    );

    expect(markup).toContain('data-layout="row"');
    expect(markup).toContain('04');
    expect(markup).toContain(sampleItem.title);
    expect(markup).toContain('min read');
  });
});
