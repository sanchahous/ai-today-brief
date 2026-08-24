import { describe, expect, it } from 'vitest';
import {
  assembleArticle,
  frameFromArticle,
  masterSegmentKey,
  masterSegmentLabel,
  masterSegmentPlan,
  projectedArticleWords,
  storyBodyWordTarget,
  storySupportWordCap,
  type MasterFrame,
} from './master-segments';
import type { WeeklyMasterStory } from './content-studio';

const ORDER = [
  { revisionItemId: 'item-1', placement: 'feature' as const, rank: 1 },
  { revisionItemId: 'item-2', placement: 'feature' as const, rank: 2 },
  { revisionItemId: 'item-3', placement: 'feature' as const, rank: 3 },
  { revisionItemId: 'item-4', placement: 'radar' as const, rank: 4 },
  { revisionItemId: 'item-5', placement: 'radar' as const, rank: 5 },
  { revisionItemId: 'item-6', placement: 'radar' as const, rank: 6 },
];

function frame(): MasterFrame {
  return {
    title: 'Title',
    seoTitle: 'SEO',
    metaDescription: 'Meta',
    ogTitle: 'OG',
    ogDescription: 'OG description',
    standfirst: 'Standfirst',
    theme: 'Theme',
    intro: 'Intro',
    editorNote: 'Note',
    keyTakeaways: ['one'],
    topics: ['topic'],
    entities: ['entity'],
    internalLinks: [{ anchor: 'a', query: 'q' }],
    conclusion: 'Conclusion',
  };
}

function story(revisionItemId: string): WeeklyMasterStory {
  return {
    revisionItemId,
    placement: 'radar',
    headline: 'Headline',
    summary: 'Summary',
    hook: 'Hook',
    body: 'Body',
    why: 'Why',
    practical: 'Practical',
    limitation: 'Limitation',
    takeaway: 'Takeaway',
    editorsView: '',
    discussionQuestion: '',
    claimIds: ['claim-1'],
  };
}

describe('masterSegmentPlan', () => {
  it('writes every English story, then the English frame, then the same for Ukrainian', () => {
    const plan = masterSegmentPlan(ORDER);
    expect(plan).toHaveLength(14);
    expect(plan.map(masterSegmentKey).slice(0, 7)).toEqual([
      'en:story:item-1',
      'en:story:item-2',
      'en:story:item-3',
      'en:story:item-4',
      'en:story:item-5',
      'en:story:item-6',
      'en:frame',
    ]);
    expect(masterSegmentKey(plan[13]!)).toBe('uk:frame');
  });

  // The frame carries the edition throughline, and a throughline invented
  // before the stories exist is how an abstract umbrella title gets stapled
  // onto three unrelated developments (2026-08-09 audit).
  it('always places a locale frame after that locale’s last story', () => {
    const plan = masterSegmentPlan(ORDER);
    for (const locale of ['en', 'uk'] as const) {
      const keys = plan.filter((segment) => segment.locale === locale).map(masterSegmentKey);
      expect(keys[keys.length - 1]).toBe(`${locale}:frame`);
    }
  });

  it('orders stories by rank regardless of input order', () => {
    const shuffled = [ORDER[3]!, ORDER[0]!, ORDER[2]!, ORDER[1]!];
    expect(
      masterSegmentPlan(shuffled)
        .filter((segment) => segment.locale === 'en' && segment.kind === 'story')
        .map(masterSegmentKey),
    ).toEqual(['en:story:item-1', 'en:story:item-2', 'en:story:item-3', 'en:story:item-4']);
  });

  it('labels segments readably for the job timeline', () => {
    const [first] = masterSegmentPlan(ORDER);
    expect(masterSegmentLabel(first!)).toBe('EN feature story #1');
    expect(masterSegmentLabel({ kind: 'frame', locale: 'uk' })).toBe('UK edition frame');
  });
});

describe('assembleArticle', () => {
  it('takes story identity and placement from the approved order, not from the model', () => {
    const stories = new Map(
      ORDER.map((entry) => [
        entry.revisionItemId,
        // Deliberately wrong id and placement, as a confused writer would echo.
        { ...story('wrong-id'), placement: 'feature' as const },
      ]),
    );
    const article = assembleArticle('en', frame(), stories, ORDER);
    expect(article.stories.map((entry) => entry.revisionItemId)).toEqual(
      ORDER.map((entry) => entry.revisionItemId),
    );
    expect(article.stories.map((entry) => entry.placement)).toEqual(
      ORDER.map((entry) => entry.placement),
    );
    expect(article.locale).toBe('en');
  });

  it('throws when a story segment is missing rather than emitting a short edition', () => {
    const stories = new Map([['item-1', story('item-1')]]);
    expect(() => assembleArticle('en', frame(), stories, ORDER)).toThrow(/item-2/);
  });

  it('round-trips through frameFromArticle', () => {
    const stories = new Map(
      ORDER.map((entry) => [entry.revisionItemId, story(entry.revisionItemId)]),
    );
    expect(frameFromArticle(assembleArticle('uk', frame(), stories, ORDER))).toEqual(frame());
  });

  it('preserves optional localized visual direction through resume-safe frame assembly', () => {
    const stories = new Map(
      ORDER.map((entry) => [entry.revisionItemId, story(entry.revisionItemId)]),
    );
    const direction = {
      ...frame(),
      displayTitle: 'Efficiency and openness, not brute scale',
      visualThesis: 'Sparse activation makes a huge open model useful beyond hyperscaler clusters.',
    };
    expect(frameFromArticle(assembleArticle('en', direction, stories, ORDER))).toEqual(direction);
  });
});

describe('word budget', () => {
  it('keeps each body inside the deterministic story_length range', () => {
    expect(storyBodyWordTarget('feature').min).toBeGreaterThanOrEqual(400);
    expect(storyBodyWordTarget('feature').max).toBeLessThanOrEqual(650);
    expect(storyBodyWordTarget('radar').min).toBeGreaterThanOrEqual(80);
    expect(storyBodyWordTarget('radar').max).toBeLessThanOrEqual(140);
  });

  // The per-segment budgets are three independent numbers; this is the check
  // that they actually add up to a legal edition, for both story mixes the
  // structure gate allows (three features plus three or four radar items).
  it('projects an edition inside the 2,000-3,000 article_length window for either story mix', () => {
    for (const radarCount of [3, 4]) {
      const stories = [
        ...ORDER.slice(0, 3),
        ...Array.from({ length: radarCount }, (_, index) => ({
          revisionItemId: `radar-${index}`,
          placement: 'radar' as const,
          rank: 4 + index,
        })),
      ];
      const projected = projectedArticleWords(stories);
      expect(projected).toBeGreaterThan(2_000);
      expect(projected).toBeLessThan(3_000);
    }
  });

  it('gives features a larger support allowance than radar items', () => {
    expect(storySupportWordCap('feature')).toBeGreaterThan(storySupportWordCap('radar'));
  });
});
