import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../pipeline/providers/vision', () => ({
  generateWithVision: vi.fn(),
}));

import { generateWithVision } from '../../../../pipeline/providers/vision';
import {
  applyRepairToSceneInput,
  pickBestVariantIndex,
  scoreAndPickVariants,
  type WeeklyImageSimCandidate,
} from './weekly-image';

const mockedVision = vi.mocked(generateWithVision);

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
    essence: 'Invisible energy waste',
    metaphorTitle: 'Orb vs furnace',
    alternateBuffers: [Buffer.alloc(800, 2), Buffer.alloc(2000, 3)],
    ...overrides,
  };
}

afterEach(() => {
  mockedVision.mockReset();
  delete process.env.CONTENT_SIM_SCORE_THRESHOLD;
});

describe('applyRepairToSceneInput', () => {
  it('bumps seed on changeSeed / later attempts', () => {
    const first = applyRepairToSceneInput({ seedBase: 'digest:item' }, 1, { changeSeed: true });
    expect(first.seedBase).toContain('attempt1');
    const second = applyRepairToSceneInput({ seedBase: 'digest:item' }, 2, {});
    expect(second.seedBase).toContain('attempt2');
  });

  it('clears override when metaphor is rejected without replacement', () => {
    const out = applyRepairToSceneInput(
      { seedBase: 'x', sceneOverride: 'old scene' },
      2,
      { rejectMetaphor: true },
    );
    expect(out.sceneOverride).toBeUndefined();
  });

  it('keeps critic-supplied scene_override', () => {
    const out = applyRepairToSceneInput(
      { seedBase: 'x', sceneOverride: 'old' },
      2,
      { rejectMetaphor: true, sceneOverride: 'new concrete metaphor' },
    );
    expect(out.sceneOverride).toBe('new concrete metaphor');
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
  const usage = {
    promptTokens: 1,
    outputTokens: 1,
    costUsd: null as number | null,
    costSource: 'estimated' as const,
  };

  it('visions all variants and promotes the best pass as primary', async () => {
    mockedVision
      .mockResolvedValueOnce({
        text: JSON.stringify({
          overall: 70,
          blockers: [{ code: 'decorative_second_beat', message: 'mood only', region: 'right' }],
        }),
        provider: 'gemini',
        model: 'vision',
        usage,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ overall: 91, blockers: [] }),
        provider: 'gemini',
        model: 'vision',
        usage,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          overall: 85,
          blockers: [{ code: 'sibling_echo', message: 'rhymes', region: 'full' }],
        }),
        provider: 'gemini',
        model: 'vision',
        usage,
      });

    const picked = await scoreAndPickVariants(baseCandidate(), {
      headline: 'Energy story',
      policyId: 'weekly-editorial-concept-v2',
      siblingScenes: ['clay golem with journal'],
    }, { remainingBudgetUsd: 5 });

    expect(mockedVision).toHaveBeenCalledTimes(3);
    expect(picked.bytes.equals(Buffer.alloc(800, 2))).toBe(true);
    expect(picked.alternateBuffers).toHaveLength(2);
    expect(picked.pickSource).toBe('auto');
    expect(picked.preCritique?.passed).toBe(true);
    expect(picked.variantScores?.[0]?.passed).toBe(true);
    expect(picked.variantScores?.[0]?.overall).toBe(91);
  });

  it('visions only the largest buffer when budget is tight', async () => {
    mockedVision.mockResolvedValue({
      text: JSON.stringify({ overall: 88, blockers: [] }),
      provider: 'gemini',
      model: 'vision',
      usage,
    });

    const picked = await scoreAndPickVariants(baseCandidate(), {
      headline: 'Energy story',
      policyId: 'weekly-editorial-concept-v2',
    }, { remainingBudgetUsd: 0.01 });

    expect(mockedVision).toHaveBeenCalledTimes(1);
    expect(picked.bytes.equals(Buffer.alloc(2000, 3))).toBe(true);
    expect(picked.variantScores?.some((s) => s.blockers.includes('budget_skip'))).toBe(true);
  });

  it('scores a single-buffer candidate without reordering', async () => {
    mockedVision.mockResolvedValue({
      text: JSON.stringify({ overall: 86, blockers: [] }),
      provider: 'gemini',
      model: 'vision',
      usage,
    });

    const picked = await scoreAndPickVariants(
      baseCandidate({ alternateBuffers: [] }),
      { headline: 'Solo', policyId: 'weekly-editorial-concept-v2' },
      { remainingBudgetUsd: 1 },
    );

    expect(mockedVision).toHaveBeenCalledTimes(1);
    expect(picked.variantScores).toEqual([
      {
        index: 0,
        overall: 86,
        blockers: [],
        passed: true,
        news_legibility: 86,
        craft: 86,
      },
    ]);
  });
});
