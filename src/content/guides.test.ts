import { describe, expect, it } from 'vitest';
import { getGuide, GUIDES } from './guides';

describe('GUIDES', () => {
  it('contains valid guides with unique slugs and required metadata', () => {
    expect(GUIDES.length).toBeGreaterThanOrEqual(2);
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(GUIDES.length);

    for (const guide of GUIDES) {
      expect(['comparison', 'benchmark']).toContain(guide.format);
      expect(guide.read).toBeGreaterThan(0);
      expect(guide.sections).toBeGreaterThan(0);
      expect(guide.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Bilingual fields
      expect(guide.title.en).toBeTruthy();
      expect(guide.title.uk).toBeTruthy();
      expect(guide.description.en).toBeTruthy();
      expect(guide.description.uk).toBeTruthy();
      expect(guide.level.en).toBeTruthy();
      expect(guide.level.uk).toBeTruthy();
      expect(guide.outcome.en).toBeTruthy();
      expect(guide.outcome.uk).toBeTruthy();
      expect(guide.body.en).toBeTruthy();
      expect(guide.body.uk).toBeTruthy();
    }
  });

  it('retrieves guides by slug via getGuide', () => {
    const comparison = getGuide('claude-code-vs-cursor-vs-codex');
    expect(comparison).toBeDefined();
    expect(comparison?.format).toBe('comparison');
    expect(comparison?.read).toBe(12);
    expect(comparison?.sections).toBe(6);

    const benchmark = getGuide('atb-orchestration-bench');
    expect(benchmark).toBeDefined();
    expect(benchmark?.format).toBe('benchmark');
    expect(benchmark?.read).toBe(15);
    expect(benchmark?.sections).toBe(8);

    expect(getGuide('non-existent-guide')).toBeNull();
  });
});
