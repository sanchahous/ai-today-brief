import { describe, expect, it } from 'vitest';
import { critiqueDailyVisualCandidate } from './daily-visual-qa';
import type { DailyVisualDirection, DailyVisualSnapshot } from './daily-visual-contract';

const direction: DailyVisualDirection = {
  displayTitleEn: 'Efficient systems take the lead',
  displayTitleUk: 'Ефективні системи виходять вперед',
  visualThesisEn: 'A smaller active path makes large AI systems practical.',
  visualThesisUk: 'Менший активний шлях робить великі AI-системи практичними.',
  overlayStatEn: null,
  overlayStatUk: null,
  subject: 'a modular compute rack',
  action: 'one lit module sends a result onward',
  setting: 'a quiet engineering lab',
  mechanism: 'one active module is visibly routed while neighboring modules stay inactive',
  consequence: 'a finished result reaches a practical user workstation',
  scene:
    'A modular compute rack centers a single bright active module that routes one finished result to a nearby workstation while the inactive modules remain calm and visibly separate.',
};

const snapshot: DailyVisualSnapshot = {
  editorialDate: '2026-08-24',
  leadBriefId: '00000000-0000-0000-0000-000000000001',
  canonicalSlug: 'ai-daily-2026-08-24',
  titleEn: 'Daily AI brief',
  titleUk: 'Щоденний AI-дайджест',
  introEn: 'Today, efficient AI systems became more practical.',
  introUk: 'Сьогодні ефективні AI-системи стали практичнішими.',
  stories: [
    {
      id: 'story-1',
      rank: 1,
      titleEn: 'A modular model becomes easier to run',
      titleUk: 'Модульну модель стало простіше запускати',
      summaryEn: 'Only a small part of the model activates per token.',
      summaryUk: 'На токен активується лише мала частина моделі.',
      whyEn: 'The architecture can serve more developers.',
      whyUk: 'Архітектура стає доступнішою для розробників.',
    },
  ],
};

const passingImageOnly = JSON.stringify({
  overall: 92,
  dimensions: { no_text: 95, craft: 90, brand_safe: 92, news_legibility: 90 },
  blockers: [],
  notes: 'Clean single scene.',
});

const passingSemantic = JSON.stringify({
  overall: 91,
  dimensions: {
    no_text: 95,
    craft: 90,
    brand_safe: 92,
    news_legibility: 90,
    context_fidelity: 89,
    mechanism_legibility: 88,
    consequence_legibility: 87,
    instant_comprehension: 89,
  },
  blockers: [],
  pixel_evidence: {
    context: 'A modular compute rack is visible.',
    mechanism: 'One bright module visibly sends the route onward.',
    consequence: 'The route reaches a practical workstation.',
    headline_pairing: 'The active module makes the efficiency thesis visible.',
  },
  notes: 'Causal path is readable.',
});

describe('critiqueDailyVisualCandidate', () => {
  it('requires both pixel-only and story-semantic QA before a daily visual can pass', async () => {
    const responses = [passingImageOnly, passingSemantic];
    const result = await critiqueDailyVisualCandidate(
      {
        bytes: Buffer.alloc(80_000, 1),
        mimeType: 'image/webp',
        width: 1600,
        height: 900,
        direction,
        snapshot,
      },
      {
        generateVision: async () => ({
          text: responses.shift() ?? '',
          provider: 'gemini',
          model: 'gemini-test',
          usage: { promptTokens: 1, outputTokens: 1, costUsd: null, costSource: 'estimated' },
        }),
      },
    );
    expect(result.passed).toBe(true);
    expect(result.stages.map((stage) => stage.stage)).toEqual(['image_only', 'story_semantic']);
  });

  it('treats an unavailable critic as a hard failure rather than silently activating the image', async () => {
    const result = await critiqueDailyVisualCandidate(
      {
        bytes: Buffer.alloc(80_000, 1),
        mimeType: 'image/webp',
        width: 1600,
        height: 900,
        direction,
        snapshot,
      },
      { generateVision: async () => Promise.reject(new Error('no configured vision provider')) },
    );
    expect(result.passed).toBe(false);
    expect(result.stages[0]).toMatchObject({ stage: 'image_only', outcome: 'error' });
    expect(result.critique.blockers[0]?.code).toBe('critic_unavailable');
  });

  it('bounds semantic QA source context before the metered vision request', async () => {
    const oversized = 'y'.repeat(100_000);
    const prompts: string[] = [];
    const responses = [passingImageOnly, passingSemantic];
    const result = await critiqueDailyVisualCandidate(
      {
        bytes: Buffer.alloc(80_000, 1),
        mimeType: 'image/webp',
        width: 1600,
        height: 900,
        direction,
        snapshot: {
          ...snapshot,
          titleEn: oversized,
          introEn: oversized,
          stories: Array.from({ length: 3 }, (_, index) => ({
            ...snapshot.stories[0]!,
            id: `oversized-${index}`,
            titleEn: oversized,
            summaryEn: oversized,
            whyEn: oversized,
          })),
        },
      },
      {
        generateVisionStage: async (_stage, input) => {
          prompts.push(input.prompt);
          return {
            text: responses.shift() ?? '',
            provider: 'gemini',
            model: 'gemini-test',
            usage: { promptTokens: 1, outputTokens: 1, costUsd: null, costSource: 'estimated' },
          };
        },
      },
    );
    expect(result.passed).toBe(true);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]!.length).toBeLessThan(20_000);
    expect(prompts[1]).toContain('…');
  });

  it('lets a Likert image-only verdict reach story-aware QA', async () => {
    const responses = [
      JSON.stringify({
        overall: 1,
        dimensions: { no_text: 1, craft: 1, brand_safe: 1, news_legibility: 1 },
        blockers: [],
        notes: 'No pixel defects found. The image is clear and well-composed.',
      }),
      passingSemantic,
    ];
    const result = await critiqueDailyVisualCandidate(
      {
        bytes: Buffer.alloc(80_000, 1),
        mimeType: 'image/webp',
        width: 1600,
        height: 900,
        direction,
        snapshot,
      },
      {
        generateVision: async () => ({
          text: responses.shift() ?? '',
          provider: 'openrouter',
          model: 'google/gemini-2.5-flash',
          usage: { promptTokens: 1, outputTokens: 1, costUsd: null, costSource: 'estimated' },
        }),
      },
    );
    expect(result.passed).toBe(true);
    expect(result.stages.map((stage) => stage.stage)).toEqual(['image_only', 'story_semantic']);
    expect(result.stages[0]?.outcome).toBe('passed');
  });
});
