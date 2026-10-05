import { describe, expect, it } from 'vitest';
import {
  categoryArtColor,
  categoryColor,
  categoryMeta,
  findPrimerConcepts,
  getRelatedGuideSlug,
  isCategoryUpdatedDaily,
  TOP_CATEGORY_SLUGS,
} from '@/lib/category-meta';

describe('categoryMeta', () => {
  const mapping = {
    'tools-and-releases': 'tools', 'tutorials-and-guides': 'tutorials', optimization: 'cost',
    'agents-and-mcp': 'agents', 'vibe-coding': 'vibe', 'creative-ai': 'creative',
    'local-llms': 'local', 'career-and-money': 'career', 'models-and-research': 'models',
  };

  it.each(Object.entries(mapping))('maps %s to %s and ignores the DB colour', (slug, key) => {
    expect(categoryMeta(slug).tokenKey).toBe(key);
    expect(categoryColor(slug, '#47E4D3')).toBe(`var(--cat-${key})`);
    expect(categoryArtColor(slug, '#47E4D3')).toBe(`var(--art-${key})`);
    expect(categoryColor(slug, null)).toBe(`var(--cat-${key})`);
  });

  it.each(['future-category', 'constructor', '__proto__', '', null, undefined])(
    'uses neutral metadata and colour for unknown slug %s', (slug) => {
      expect(categoryMeta(slug).tokenKey).toBeNull();
      expect(categoryColor(slug)).toBe('var(--muted)');
      expect(categoryColor(slug, '')).toBe('var(--muted)');
      expect(categoryArtColor(slug)).toBe('var(--art-neutral)');
      expect(categoryColor(slug, '#123456')).toBe('#123456');
      expect(categoryArtColor(slug, '#123456')).toBe('#123456');
    },
  );
  it('returns known category metadata', () => {
    const meta = categoryMeta('tools-and-releases');
    expect(meta.icon).toBe('tools');
    expect(meta.tagline.en.length).toBeGreaterThan(0);
    expect(meta.subtopics).toContain('Claude Code');
  });

  it('falls back for unknown slugs', () => {
    expect(categoryMeta('unknown-slug').icon).toBe('tools');
    expect(categoryMeta(null).tagline.uk).toBe('');
  });
});

describe('TOP_CATEGORY_SLUGS', () => {
  it('lists six home categories', () => {
    expect(TOP_CATEGORY_SLUGS).toHaveLength(6);
  });
});

describe('category subtopics across all 9 categories', () => {
  const allNineSlugs = [
    'tools-and-releases',
    'tutorials-and-guides',
    'optimization',
    'agents-and-mcp',
    'vibe-coding',
    'creative-ai',
    'local-llms',
    'career-and-money',
    'models-and-research',
  ];

  it.each(allNineSlugs)('has at least 3 subtopics defined for %s', (slug) => {
    const meta = categoryMeta(slug);
    expect(meta.subtopics).toBeDefined();
    expect(meta.subtopics!.length).toBeGreaterThanOrEqual(3);
  });
});

describe('getRelatedGuideSlug', () => {
  it('returns related guide slug for connected categories', () => {
    expect(getRelatedGuideSlug('tools-and-releases')).toBe('claude-code-vs-cursor-vs-codex');
    expect(getRelatedGuideSlug('agents-and-mcp')).toBe('claude-code-vs-cursor-vs-codex');
    expect(getRelatedGuideSlug('vibe-coding')).toBe('claude-code-vs-cursor-vs-codex');
    expect(getRelatedGuideSlug('models-and-research')).toBe('atb-orchestration-bench');
  });

  it('returns null for categories without dedicated guide connection', () => {
    expect(getRelatedGuideSlug('creative-ai')).toBeNull();
    expect(getRelatedGuideSlug('unknown-slug')).toBeNull();
    expect(getRelatedGuideSlug(null)).toBeNull();
  });
});

describe('findPrimerConcepts', () => {
  const concepts = [
    { slug: 'ai-agent', name: 'AI Agent' },
    { slug: 'mcp', name: 'Model Context Protocol' },
    { slug: 'prompt-caching', name: 'Prompt Caching' },
    { slug: 'ollama', name: 'Ollama' },
  ];

  it('matches concepts by subtopics', () => {
    const matched = findPrimerConcepts(['MCP', 'Agents'], concepts);
    expect(matched.map((c) => c.slug)).toEqual(['ai-agent', 'mcp']);
  });

  it('falls back to first concepts when no direct match', () => {
    const fallback = findPrimerConcepts(['Unknown Subtopic'], concepts);
    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback[0].slug).toBe('ai-agent');
  });

  it('returns empty array when no concepts available', () => {
    expect(findPrimerConcepts(['MCP'], [])).toEqual([]);
  });
});

describe('isCategoryUpdatedDaily', () => {
  it('returns false for empty items or missing latest brief date', () => {
    expect(isCategoryUpdatedDaily([])).toBe(false);
    expect(isCategoryUpdatedDaily([{ date: '2026-10-04' }], null)).toBe(false);
  });

  it('returns false if category latest item is not from the latest brief date', () => {
    const items = [
      { date: '2026-10-03' },
      { date: '2026-10-02' },
      { date: '2026-10-01' },
      { date: '2026-09-30' },
    ];
    expect(isCategoryUpdatedDaily(items, '2026-10-04')).toBe(false);
  });

  it('returns false if category does not have at least 4 publishing dates in 7d', () => {
    const items = [
      { date: '2026-10-04' },
      { date: '2026-10-02' },
      { date: '2026-09-30' },
    ];
    expect(isCategoryUpdatedDaily(items, '2026-10-04')).toBe(false);
  });

  it('returns true when items match latest date and have >= 4 distinct days in last 7d', () => {
    const items = [
      { date: '2026-10-04' },
      { date: '2026-10-04' },
      { date: '2026-10-03' },
      { date: '2026-10-02' },
      { date: '2026-10-01' },
    ];
    expect(isCategoryUpdatedDaily(items, '2026-10-04')).toBe(true);
  });
});
