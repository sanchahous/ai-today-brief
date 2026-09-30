import { describe, expect, it } from 'vitest';
import { categoryArtColor, categoryColor, categoryMeta, TOP_CATEGORY_SLUGS } from '@/lib/category-meta';

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
