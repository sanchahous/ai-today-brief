import { describe, expect, it } from 'vitest';
import {
  buildBlindPixelObservationInstructionV10,
  buildFormatIntegrityInstructionV10,
  buildHeadlinePairInstructionV10,
  buildPairwiseRankInstructionV10,
  buildVisualCriticResultV10,
  deriveVisualIntegrityFailuresV10,
  type BlindPixelObservationV10,
  type HeadlinePairEvidenceV10,
  type VisualIntegrityEvidenceV10,
} from './visual-critic-v10';
import type { VisualPropositionV10 } from './visual-affordance-v10';
import type { HoldoutStoryInput } from './visual-auto-claim';

const observation: BlindPixelObservationV10 = {
  visibleObjects: ['one workbench', 'one small projector', 'one gear assembly'],
  visiblePeopleAndHands: ['one person with two clearly owned hands'],
  visibleActions: ['the person adjusts one gear'],
  visibleSourceTargetRelations: [
    'a narrow beam starts at the projector and illuminates one gear tooth',
  ],
  visibleOutcomes: ['the person continues adjusting the mechanism'],
  visibleText: [],
  ambiguousElements: [],
};

const story: HoldoutStoryInput = {
  week_start: '2026-08-03',
  week_end: '2026-08-09',
  rank: 1,
  revision_item_id: 'deep-work',
  title: 'Managing AI-Driven Distraction and Rediscovering Deep Work',
  summary:
    'A person remains actively engaged while AI provides one bounded hint rather than doing the work.',
  why: null,
  practical: null,
  takeaway: null,
};

const proposition: VisualPropositionV10 = {
  id: 'deep-work:cinematic_domain_scene',
  storyId: 'deep-work',
  affordance: 'cinematic_domain_scene',
  renderMode: 'generated_cinematic',
  integrityProfile: 'generated_scene',
  title: 'Bounded hint',
  coreClaim:
    'AI offers one bounded hint while the person keeps thinking and doing the work.',
  rationale: 'The human action remains primary.',
  mapping: [
    {
      sourceElement: 'person solving a difficult task',
      visualElement: 'one visible person at a workbench',
      role: 'context',
      required: true,
      evidenceSource: 'pixels',
    },
    {
      sourceElement: 'one bounded AI hint',
      visualElement: 'one projector beam illuminating one detail',
      role: 'action',
      required: true,
      evidenceSource: 'pixels',
    },
    {
      sourceElement: 'person continues the work',
      visualElement: 'the person remains physically engaged',
      role: 'outcome',
      required: true,
      evidenceSource: 'pixels',
    },
  ],
  approvedOverlays: ['ACTIVE THINKING', 'BOUNDED HINT'],
  forbiddenImplications: ['AI completes the task'],
  identityInvariant: null,
  geometry: null,
  priority: 100,
  expectedImageCalls: 1,
  ownerReviewRequired: true,
};

function integrity(
  overrides: Partial<VisualIntegrityEvidenceV10> = {},
): VisualIntegrityEvidenceV10 {
  return {
    contextVisible: true,
    actionVisible: true,
    outcomeVisible: true,
    visualThesisCoherent: true,
    generatedTextPresent: false,
    anatomyValid: true,
    allHandsOwnedByVisiblePeople: true,
    objectsRemainSeparated: true,
    interactionsPhysicallyPlausible: true,
    allDirectedEffectsHaveVisibleSource: true,
    allDirectedEffectsHaveMeaningfulTarget: true,
    allPropsParticipateInTheClaim: true,
    allArrowsConnected: true,
    directionUnambiguous: true,
    sameInputPreserved: true,
    sameSystemPreserved: true,
    chartOrMetricInterpretable: true,
    meaningVisibleWithoutLabels: true,
    analogyMappingOneToOne: true,
    ...overrides,
  };
}

function headlinePair(
  overrides: Partial<HeadlinePairEvidenceV10> = {},
): HeadlinePairEvidenceV10 {
  return {
    headlineImagePairUnderstood: true,
    oneCoreClaimVisible: true,
    certaintyPreserved: true,
    approvedLabelsExact: true,
    labelsSupportedByPixels: true,
    thumbnailReadable: true,
    misleading: false,
    instantMeaning: 88,
    visualBeauty: 82,
    brandConsistency: 84,
    originality: 75,
    summary: 'The person remains primary and the hint is bounded.',
    ...overrides,
  };
}

describe('blind visual critic v10', () => {
  it('keeps the first observation call free of story and answer context', () => {
    const instruction = buildBlindPixelObservationInstructionV10();
    expect(instruction).not.toContain(story.title);
    expect(instruction).not.toContain(proposition.coreClaim);
    expect(instruction).toContain('pixels only');
    expect(instruction).toContain('visible source, target');
  });

  it('checks anatomy and source-target closure before story relevance', () => {
    const instruction = buildFormatIntegrityInstructionV10({
      profile: 'generated_scene',
      observation,
    });
    expect(instruction).toContain('Every visible hand and limb');
    expect(instruction).toContain('visible source');
    expect(instruction).not.toContain(story.title);
  });

  it('allows the headline to supply identity but not absent action or outcome', () => {
    const instruction = buildHeadlinePairInstructionV10({
      story,
      proposition,
      observation,
    });
    expect(instruction).toContain(story.title);
    expect(instruction).toContain('may provide identity');
    expect(instruction).toContain('may not invent an action or outcome');
  });

  it('marks pairwise comparison as ranking support only', () => {
    const instruction = buildPairwiseRankInstructionV10();
    expect(instruction).toContain('ranking support only');
    expect(instruction).toContain('must never publish');
  });

  it('blocks unowned hands even when semantic and beauty scores are high', () => {
    const result = buildVisualCriticResultV10({
      proposition,
      integrity: integrity({ allHandsOwnedByVisiblePeople: false }),
      headlinePair: headlinePair({
        instantMeaning: 96,
        visualBeauty: 98,
      }),
    });

    expect(result.failures).toContain('unowned_hand');
    expect(result.candidateDecision.eligibleForOwnerReview).toBe(false);
    expect(result.candidateDecision.repairMode).toBe('regenerate_scene');
    expect(result.candidateDecision.automatedProductionPass).toBe(false);
  });

  it('blocks beams without a visible source or meaningful target', () => {
    const failures = deriveVisualIntegrityFailuresV10({
      affordance: 'cinematic_domain_scene',
      profile: 'generated_scene',
      evidence: integrity({
        allDirectedEffectsHaveVisibleSource: false,
        allDirectedEffectsHaveMeaningfulTarget: false,
      }),
      headlinePair: headlinePair(),
    });

    expect(failures).toContain('beam_without_visible_source');
    expect(failures).toContain('beam_without_meaningful_target');
  });

  it('treats broken diagram arrows as a geometry repair, not a concept replan', () => {
    const diagramProposition: VisualPropositionV10 = {
      ...proposition,
      affordance: 'deterministic_technical_hybrid',
      renderMode: 'deterministic_hybrid',
      integrityProfile: 'diagram',
      geometry: {
        arrowsMustHaveVisibleSourceAndTarget: true,
        directionMustBeUnambiguous: true,
        labelsMayNotCarryRequiredEvidence: true,
        sameInputMustRemainIdentical: false,
        sameSystemMustRemainIdentical: false,
        maxStates: 3,
      },
    };
    const result = buildVisualCriticResultV10({
      proposition: diagramProposition,
      integrity: integrity({ allArrowsConnected: false }),
      headlinePair: headlinePair(),
    });

    expect(result.failures).toEqual(['broken_arrow']);
    expect(result.candidateDecision.repairMode).toBe('recompose_geometry');
  });

  it('blocks diagrams whose labels carry the meaning', () => {
    const failures = deriveVisualIntegrityFailuresV10({
      affordance: 'controlled_comparison',
      profile: 'diagram',
      evidence: integrity({ meaningVisibleWithoutLabels: false }),
      headlinePair: headlinePair({ labelsSupportedByPixels: false }),
    });

    expect(failures).toContain('labels_carry_the_claim');
  });

  it('never converts a clean automated result into production acceptance', () => {
    const result = buildVisualCriticResultV10({
      proposition,
      integrity: integrity(),
      headlinePair: headlinePair(),
    });

    expect(result.failures).toEqual([]);
    expect(result.candidateDecision.eligibleForOwnerReview).toBe(true);
    expect(result.ownerAcceptanceRequired).toBe(true);
    expect(result.candidateDecision.automatedProductionPass).toBe(false);
  });
});
