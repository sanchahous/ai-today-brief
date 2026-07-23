import { describe, expect, it } from 'vitest';
import { renderWeeklyVisualSet, validateWeeklyVisualInput } from './visuals';

const fixture = {
  digestId: 'digest-1',
  revisionId: 'revision-2',
  locale: 'uk' as const,
  issueLabel: 'Випуск 12',
  title: 'Український weekly AI-дайджест',
  altText: 'Композиція головних новин дванадцятого тижневого AI-дайджесту.',
  stories: Array.from({ length: 5 }, (_, index) => ({
    id: `story-${index + 1}`,
    title: `Новина ${index + 1}`,
  })),
};

describe('weekly visual pipeline', () => {
  it('renders all deterministic platform dimensions with Cyrillic overlays', async () => {
    const variants = await renderWeeklyVisualSet(fixture);

    expect(variants.map((variant) => [variant.slot, variant.width, variant.height])).toEqual([
      ['web_hero', 1600, 900],
      ['open_graph', 1200, 630],
      ['instagram_post', 1080, 1350],
      ['instagram_story', 1080, 1920],
    ]);
    expect(variants.every((variant) => variant.bytes.length > 20_000)).toBe(true);
    expect(variants.every((variant) => Object.values(variant.checks).every(Boolean))).toBe(true);
    expect(new Set(variants.map((variant) => variant.contentHash)).size).toBe(4);
    expect(variants[0].warnings).toContain('no_story_illustrations');
  });

  it('flags unsafe alt text and missing story motifs', () => {
    expect(validateWeeklyVisualInput({ ...fixture, altText: 'short' })).toEqual(
      expect.arrayContaining(['alt_text_too_short', 'no_story_illustrations']),
    );
  });

  it('rejects a cover that is not backed by 3-7 stories', async () => {
    await expect(
      renderWeeklyVisualSet({ ...fixture, stories: fixture.stories.slice(0, 2) }),
    ).rejects.toThrow('3 to 7');
  });
});
