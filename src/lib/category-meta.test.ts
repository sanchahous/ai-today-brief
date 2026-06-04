import { describe, expect, it } from 'vitest';
import { categoryMeta, TOP_CATEGORY_SLUGS } from '@/lib/category-meta';

describe('categoryMeta', () => {
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
