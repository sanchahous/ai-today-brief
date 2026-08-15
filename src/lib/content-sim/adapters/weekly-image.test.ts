import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../pipeline/providers/vision', () => ({
  generateWithVision: vi.fn(),
}));

import { generateWithVision } from '../../../../pipeline/providers/vision';
import {
  aggregateVariantRepairCritique,
  applyRepairToSceneInput,
  opaqueAbstractionCritique,
  pickBestVariantIndex,
  runWeeklyImageSimLoop,
  scoreAndPickVariants,
  type WeeklyImageSimCandidate,
} from './weekly-image';

const mockedVision = vi.mocked(generateWithVision);

function semanticDimensions(score: number) {
  return {
    metaphor_fit: score,
    no_text: score,
    craft: score,
    brand_safe: score,
    news_legibility: score,
    context_fidelity: score,
    mechanism_legibility: score,
    consequence_legibility: score,
    instant_comprehension: score,
  };
}

const pixelEvidence = {
  context: 'A visible tutoring or engineering anchor identifies the source situation.',
  mechanism: 'A physical cause acts on the anchor.',
  consequence: 'The resulting change is visibly connected to that cause.',
  headline_pairing: 'The combined anchor, cause, and result distinguish this headline.',
};

const estimatedUsage = {
  promptTokens: 1,
  outputTokens: 1,
  costUsd: null as number | null,
  costSource: 'estimated' as const,
};

function visionJson(payload: unknown) {
  return {
    text: JSON.stringify(payload),
    provider: 'gemini',
    model: 'vision',
    usage: estimatedUsage,
  };
}

function passingImageOnlyVision() {
  return visionJson({
    overall: 90,
    dimensions: { no_text: 90, craft: 90, brand_safe: 90, news_legibility: 90 },
    blockers: [],
  });
}

function isImageOnlyPrompt(prompt: string) {
  return prompt.includes('pixel defects only');
}

function baseCandidate(overrides?: Partial<WeeklyImageSimCandidate>): WeeklyImageSimCandidate {
  return {
    bytes: Buffer.alloc(1200, 1),
    width: 1600,
    height: 900,
    provider: 'cf',
    model: 'flux',
    estimatedCostUsd: 0.02,
    costSource: 'estimated',
    scene: 'tiny orb beside industrial furnace',
    positivePrompt: 'prompt',
    negativePrompt: 'neg',
    sceneSource: 'art_director',
    storyContext: 'An agentic workflow consumes more electricity than a chat request.',
    meaning: 'The convenient abstraction hides infrastructure cost.',
    essence: 'Invisible energy waste',
    mechanism: 'agentic coding loops repeatedly consume electricity',
    consequence: 'wasted electricity becomes visible heat',
    visualThesis: 'repeated agent loops feed a furnace of waste heat',
    metaphorTitle: 'Orb vs furnace',
    alternateBuffers: [Buffer.alloc(800, 2), Buffer.alloc(2000, 3)],
    ...overrides,
  };
}

afterEach(() => {
  mockedVision.mockReset();
  delete process.env.CONTENT_SIM_SCORE_THRESHOLD;
  delete process.env.CONTENT_SIM_IMAGE_LOOP;
});

describe('applyRepairToSceneInput', () => {
  it('bumps seed on changeSeed / later attempts', () => {
    const first = applyRepairToSceneInput({ seedBase: 'digest:item' }, 1, { changeSeed: true });
    expect(first.seedBase).toContain('attempt1');
    const second = applyRepairToSceneInput({ seedBase: 'digest:item' }, 2, {});
    expect(second.seedBase).toContain('attempt2');
  });

  it('keeps only the owner override when a metaphor is rejected', () => {
    const out = applyRepairToSceneInput({ seedBase: 'x', sceneOverride: 'old scene' }, 2, {
      rejectMetaphor: true,
    });
    expect(out.sceneOverride).toBe('old scene');
    expect(out.promptSuffix).toBe('');
  });

  it('uses a critic replacement as jury feedback, not a shared scene override', () => {
    const out = applyRepairToSceneInput({ seedBase: 'x' }, 2, {
      rejectMetaphor: true,
      sceneOverride: 'a rejected typewriter motif',
      promptPatches: ['make the typewriter tape restart visibly'],
    });
    expect(out.sceneOverride).toBeUndefined();
    expect(out.rejectedScene).toBe('a rejected typewriter motif');
    expect(out.planningFeedback).toContain(
      'Rejected critic direction: a rejected typewriter motif',
    );
    expect(out.planningFeedback).toContain('make the typewriter tape restart visibly');
    expect(out.promptSuffix).toBe('');
  });

  it('joins prompt patches into a suffix', () => {
    const out = applyRepairToSceneInput({ seedBase: 'x' }, 1, {
      promptPatches: ['no text', 'single subject'],
    });
    expect(out.promptSuffix).toContain('no text');
    expect(out.promptSuffix).toContain('single subject');
  });
});

describe('pickBestVariantIndex', () => {
  it('prefers highest overall among zero-blocker variants', () => {
    expect(
      pickBestVariantIndex([
        { index: 0, overall: 90, blockers: ['readable_text'] },
        { index: 1, overall: 82, blockers: [] },
        { index: 2, overall: 88, blockers: [] },
      ]),
    ).toBe(2);
  });

  it('falls back to highest overall when all have blockers', () => {
    expect(
      pickBestVariantIndex([
        { index: 0, overall: 40, blockers: ['off_metaphor'] },
        { index: 1, overall: 70, blockers: ['decorative_second_beat'] },
        { index: 2, overall: 55, blockers: ['sibling_echo'] },
      ]),
    ).toBe(1);
  });
});

describe('scoreAndPickVariants', () => {
  const usage = estimatedUsage;

  it('visions all variants and promotes the best pass as primary', async () => {
    const variantConcepts = [
      {
        conceptLens: 'literal_context',
        scene: 'a tutor deciding whether to interrupt a student solving a physical puzzle',
        sceneSource: 'art_director',
        positivePrompt: 'literal prompt',
        negativePrompt: 'neg',
        metaphorTitle: 'The tutoring moment',
      },
      {
        conceptLens: 'mechanism',
        scene: 'a balance gate opening only when a learner reaches a visible impasse',
        sceneSource: 'art_director',
        positivePrompt: 'mechanism prompt',
        negativePrompt: 'neg',
        metaphorTitle: 'When the gate opens',
      },
      {
        conceptLens: 'consequence',
        scene: 'two learning paths ending at visibly different completed structures',
        sceneSource: 'art_director',
        positivePrompt: 'consequence prompt',
        negativePrompt: 'neg',
        metaphorTitle: 'Changed outcome',
      },
    ];
    mockedVision.mockImplementation(async (_role, args) => {
      const prompt = String(args.prompt);
      if (isImageOnlyPrompt(prompt)) return passingImageOnlyVision();
      if (prompt.includes(variantConcepts[0]!.scene)) {
        return visionJson({
          overall: 70,
          dimensions: semanticDimensions(70),
          pixel_evidence: pixelEvidence,
          blockers: [{ code: 'decorative_second_beat', message: 'mood only', region: 'right' }],
        });
      }
      if (prompt.includes(variantConcepts[1]!.scene)) {
        return visionJson({
          overall: 91,
          dimensions: semanticDimensions(91),
          pixel_evidence: pixelEvidence,
          blockers: [],
        });
      }
      return visionJson({
        overall: 85,
        dimensions: semanticDimensions(85),
        pixel_evidence: pixelEvidence,
        blockers: [{ code: 'sibling_echo', message: 'rhymes', region: 'full' }],
      });
    });

    const picked = await scoreAndPickVariants(
      baseCandidate({ variantConcepts }),
      {
        headline: 'Energy story',
        policyId: 'weekly-editorial-concept-v2',
        siblingScenes: ['clay golem with journal'],
      },
      { remainingBudgetUsd: 5 },
    );

    expect(mockedVision).toHaveBeenCalledTimes(6);
    const prompts = mockedVision.mock.calls.map((call) => String(call[1].prompt));
    const imageOnlyPrompts = prompts.filter((prompt) => isImageOnlyPrompt(prompt));
    const storyPrompts = prompts.filter((prompt) => !isImageOnlyPrompt(prompt));
    expect(imageOnlyPrompts).toHaveLength(3);
    expect(storyPrompts).toHaveLength(3);
    expect(imageOnlyPrompts[0]).not.toMatch(/Headline:/);
    expect(storyPrompts.some((prompt) => prompt.includes(variantConcepts[0]!.scene))).toBe(true);
    expect(storyPrompts.some((prompt) => prompt.includes(variantConcepts[1]!.scene))).toBe(true);
    expect(storyPrompts.some((prompt) => prompt.includes(variantConcepts[2]!.scene))).toBe(true);
    expect(picked.bytes.equals(Buffer.alloc(800, 2))).toBe(true);
    expect(picked.conceptLens).toBe('mechanism');
    expect(picked.scene).toBe(variantConcepts[1]!.scene);
    expect(picked.variantConcepts?.map((concept) => concept.conceptLens)).toEqual([
      'mechanism',
      'literal_context',
      'consequence',
    ]);
    expect(picked.alternateBuffers).toHaveLength(2);
    expect(picked.pickSource).toBe('auto');
    expect(picked.preCritique?.passed).toBe(true);
    expect(picked.variantScores?.[0]?.passed).toBe(true);
    expect(picked.variantScores?.[0]?.overall).toBe(91);
  });

  it('runs the three paid vision reviews concurrently and records each provider call', async () => {
    let active = 0;
    let peak = 0;
    let release!: () => void;
    let allStarted!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const started = new Promise<void>((done) => {
      allStarted = done;
    });
    mockedVision.mockImplementation(async (_role, args) => {
      const prompt = String(args.prompt);
      if (isImageOnlyPrompt(prompt)) return passingImageOnlyVision();
      active += 1;
      peak = Math.max(peak, active);
      if (peak === 3) allStarted();
      await gate;
      active -= 1;
      return visionJson({
        overall: 86,
        dimensions: semanticDimensions(86),
        pixel_evidence: pixelEvidence,
        blockers: [],
      });
    });
    const costs: number[] = [];
    const pending = scoreAndPickVariants(
      baseCandidate(),
      { headline: 'Energy story', policyId: 'weekly-semantic-story-v5.1' },
      {
        remainingBudgetUsd: 1,
        onCostEvent: (event) => {
          costs.push(event.costUsd);
        },
      },
    );
    await started;
    expect(peak).toBe(3);
    release();
    await pending;
    expect(costs).toEqual([0.02, 0.02, 0.02]);
  });

  it('visions only the largest buffer when budget is tight', async () => {
    mockedVision.mockResolvedValue({
      text: JSON.stringify({
        overall: 88,
        dimensions: semanticDimensions(88),
        pixel_evidence: pixelEvidence,
        blockers: [],
      }),
      provider: 'gemini',
      model: 'vision',
      usage,
    });

    const picked = await scoreAndPickVariants(
      baseCandidate(),
      {
        headline: 'Energy story',
        policyId: 'weekly-editorial-concept-v2',
      },
      { remainingBudgetUsd: 0.01 },
    );

    expect(mockedVision).toHaveBeenCalledTimes(2);
    expect(picked.bytes.equals(Buffer.alloc(2000, 3))).toBe(true);
    expect(picked.variantScores?.some((s) => s.blockers.includes('budget_skip'))).toBe(true);
  });

  it('scores a single-buffer candidate without reordering', async () => {
    mockedVision.mockResolvedValue({
      text: JSON.stringify({
        overall: 86,
        dimensions: semanticDimensions(86),
        pixel_evidence: pixelEvidence,
        blockers: [],
      }),
      provider: 'gemini',
      model: 'vision',
      usage,
    });

    const picked = await scoreAndPickVariants(
      baseCandidate({ alternateBuffers: [] }),
      { headline: 'Solo', policyId: 'weekly-editorial-concept-v2' },
      { remainingBudgetUsd: 1 },
    );

    expect(mockedVision).toHaveBeenCalledTimes(2);
    expect(picked.variantScores).toEqual([
      {
        index: 0,
        overall: 86,
        blockers: [],
        passed: true,
        news_legibility: 86,
        craft: 86,
        context_fidelity: 86,
        mechanism_legibility: 86,
        consequence_legibility: 86,
        instant_comprehension: 86,
        semantic_min: 86,
      },
    ]);
  });

  it('skips story-aware vision when image-only already failed', async () => {
    mockedVision.mockResolvedValue(
      visionJson({
        overall: 20,
        dimensions: { no_text: 5, craft: 40, brand_safe: 40, news_legibility: 20 },
        blockers: [{ code: 'readable_text', message: 'Letters on a sign', region: 'left' }],
      }),
    );
    const picked = await scoreAndPickVariants(
      baseCandidate({ alternateBuffers: [] }),
      { headline: 'Energy story', policyId: 'weekly-semantic-story-v5.1' },
      { remainingBudgetUsd: 1 },
    );
    expect(mockedVision).toHaveBeenCalledTimes(1);
    expect(String(mockedVision.mock.calls[0]?.[1]?.prompt)).toContain('pixel defects only');
    expect(picked.preCritique?.passed).toBe(false);
    expect(
      picked.preCritique?.blockers.some((blocker) => blocker.code === 'readable_text'),
    ).toBe(true);
  });

  it('rejects generic tube machinery before spending on vision', async () => {
    const ctx = {
      headline: 'TutorMoments benchmarks when language models should help a student',
      summary: 'Seven models improve when told they are being tested.',
      policyId: 'weekly-semantic-story-v5.1',
    };
    const scene = 'a pneumatic tube network carries sealed canisters through generic pipework';
    expect(opaqueAbstractionCritique(scene, ctx)?.blockers[0]?.code).toBe('opaque_abstraction');

    const picked = await scoreAndPickVariants(baseCandidate({ scene }), ctx, {
      remainingBudgetUsd: 1,
    });
    expect(mockedVision).not.toHaveBeenCalled();
    expect(picked.preCritique?.repairDirective?.rejectMetaphor).toBe(true);
  });

  it('soft-fails a vision provider outage without losing the rendered batch', async () => {
    mockedVision.mockRejectedValue(new Error('provider timeout'));
    const picked = await scoreAndPickVariants(
      baseCandidate(),
      { headline: 'Energy story', policyId: 'weekly-semantic-story-v5.1' },
      { remainingBudgetUsd: 1 },
    );
    expect(picked.alternateBuffers).toHaveLength(2);
    expect(
      picked.preCritique?.blockers.some((blocker) => blocker.code === 'critic_unavailable'),
    ).toBe(true);
  });
});

describe('runWeeklyImageSimLoop history', () => {
  it('keeps failed first-round renders alongside the successful repair round', async () => {
    const critique = (overall: number, code?: string) => ({
      text: JSON.stringify({
        overall,
        dimensions: semanticDimensions(overall),
        pixel_evidence: pixelEvidence,
        blockers: code ? [{ code, message: 'missed context' }] : [],
      }),
      provider: 'gemini',
      model: 'vision',
      usage: {
        promptTokens: 1,
        outputTokens: 1,
        costUsd: 0.01,
        costSource: 'estimated' as const,
      },
    });
    let remainingStoryFails = 3;
    mockedVision.mockImplementation(async (_role, args) => {
      if (isImageOnlyPrompt(String(args.prompt))) return passingImageOnlyVision();
      if (remainingStoryFails > 0) {
        remainingStoryFails -= 1;
        return critique(40, 'off_news');
      }
      return critique(90);
    });

    let calls = 0;
    const result = await runWeeklyImageSimLoop({
      ctx: {
        headline: 'A durable checkpoint resumes an interrupted agent run',
        policyId: 'weekly-semantic-story-v5.1',
      },
      seedBase: 'digest:story',
      generate: async () => {
        calls += 1;
        return baseCandidate();
      },
    });

    expect(calls).toBe(2);
    expect(result.iterationPreviews).toHaveLength(6);
    expect(result.iterationPreviews.filter((preview) => preview.attempt === 1)).toHaveLength(3);
    expect(result.iterationPreviews.filter((preview) => preview.attempt === 2)).toHaveLength(3);
  });

  it('returns every rendered variant for admin review when vision is disabled', async () => {
    process.env.CONTENT_SIM_IMAGE_LOOP = 'off';
    const result = await runWeeklyImageSimLoop({
      ctx: {
        headline: 'A durable checkpoint resumes an interrupted agent run',
        policyId: 'weekly-semantic-story-v5.1',
      },
      seedBase: 'digest:story',
      generate: async () => ({
        ...baseCandidate(),
        variantConcepts: [
          {
            scene: 'a night workshop resumes a half-finished mold',
            sceneSource: 'jury',
            positivePrompt: 'night workshop',
            negativePrompt: 'neg',
            conceptLens: 'literal_context',
            metaphorTitle: 'Night workshop',
          },
          {
            scene: 'a loom rewinds to one intact knot',
            sceneSource: 'jury',
            positivePrompt: 'loom',
            negativePrompt: 'neg',
            conceptLens: 'mechanism',
            metaphorTitle: 'Rewinding loom',
          },
          {
            scene: 'a kiln relights around a preserved casting',
            sceneSource: 'jury',
            positivePrompt: 'kiln',
            negativePrompt: 'neg',
            conceptLens: 'consequence',
            metaphorTitle: 'Recovered kiln',
          },
        ],
      }),
    });

    expect(result.iterationPreviews).toHaveLength(3);
    expect(result.iterationPreviews.map((preview) => preview.concept.metaphorTitle)).toEqual([
      'Night workshop',
      'Rewinding loom',
      'Recovered kiln',
    ]);
  });
});

describe('aggregateVariantRepairCritique', () => {
  it('uses all failed variants to force one conceptual re-plan', () => {
    const critiques = ['show the tutor', 'show the help decision', 'show the changed outcome'].map(
      (patch, index) => ({
        passed: false,
        scores: { overall: 55 + index, news_legibility: 50, semantic_min: 45 },
        blockers: [
          { code: 'missing_context', message: 'The story is not identifiable.', blocker: true },
        ],
        repairDirective: { promptPatches: [patch], changeSeed: true },
      }),
    );

    const combined = aggregateVariantRepairCritique(critiques[2]!, critiques);
    expect(combined.repairDirective?.rejectMetaphor).toBe(true);
    expect(combined.repairDirective?.promptPatches).toEqual([
      'show the tutor',
      'show the help decision',
      'show the changed outcome',
    ]);
  });
});
