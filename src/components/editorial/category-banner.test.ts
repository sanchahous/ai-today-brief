import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CategoryBanner } from './category-banner';
import { hashSeed } from '@/lib/hash-seed';

describe('CategoryBanner & deterministic seed', () => {
  it('hashSeed produces deterministic 32-bit unsigned integers', () => {
    const seed1 = hashSeed('story-alpha-123');
    const seed2 = hashSeed('story-alpha-123');
    expect(seed1).toBe(seed2);
    expect(typeof seed1).toBe('number');
    expect(seed1).toBeGreaterThanOrEqual(0);

    const seedDifferent = hashSeed('story-beta-456');
    expect(seed1).not.toBe(seedDifferent);
  });

  it('renders the exact same banner markup for the same id (deterministic seed)', () => {
    const id = 'claude-code-subagent-memory';
    const slug = 'agents-and-mcp';

    const markupA = renderToStaticMarkup(
      createElement(CategoryBanner, { id, slug, name: 'Agents & MCP' })
    );
    const markupB = renderToStaticMarkup(
      createElement(CategoryBanner, { id, slug, name: 'Agents & MCP' })
    );

    expect(markupA).toBe(markupB);
    expect(markupA).toContain('cat-banner');
    expect(markupA).toContain('var(--art-agents)');

    // Verify deterministic tilt, shift, and dot attributes
    const seed = hashSeed(id);
    const tilt = (seed % 24) - 12;
    const dotCx = 230 + (seed % 50);
    const dotCy = 40 + (seed % 30);

    expect(markupA).toContain(`rotate(${tilt} 160 110)`);
    expect(markupA).toContain(`cx="${dotCx}"`);
    expect(markupA).toContain(`cy="${dotCy}"`);
  });

  it('renders different groove tilts and dot coordinates for different ids', () => {
    const markup1 = renderToStaticMarkup(
      createElement(CategoryBanner, { id: 'story-first-1', slug: 'tools-and-releases' })
    );
    const markup2 = renderToStaticMarkup(
      createElement(CategoryBanner, { id: 'story-second-2', slug: 'tools-and-releases' })
    );

    expect(markup1).not.toBe(markup2);
  });

  it('renders video badge when hasVideo or videoBadge is enabled', () => {
    const withVideo = renderToStaticMarkup(
      createElement(CategoryBanner, {
        id: 'video-story',
        slug: 'vibe-coding',
        hasVideo: true,
        videoLabel: 'Відео',
      })
    );
    expect(withVideo).toContain('Відео');
    expect(withVideo).toContain('cat-banner-badge');

    const withoutVideo = renderToStaticMarkup(
      createElement(CategoryBanner, {
        id: 'video-story',
        slug: 'vibe-coding',
        hasVideo: false,
      })
    );
    expect(withoutVideo).not.toContain('cat-banner-badge');
  });

  it('supports hero and thumb variants with appropriate classes', () => {
    const hero = renderToStaticMarkup(
      createElement(CategoryBanner, { id: 'hero-1', slug: 'models-and-research', variant: 'hero' })
    );
    expect(hero).toContain('banner-hero');

    const thumb = renderToStaticMarkup(
      createElement(CategoryBanner, { id: 'thumb-1', slug: 'models-and-research', variant: 'thumb' })
    );
    expect(thumb).toContain('banner-thumb');
  });
});
