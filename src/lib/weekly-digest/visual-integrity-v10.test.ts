import { describe, expect, it } from 'vitest';
import {
  decidePublicationV10,
  evaluateVisualIntegrityV10,
  type VisualIntegrityObservationV10,
} from './visual-integrity-v10';

function cleanObservation(
  overrides: Partial<VisualIntegrityObservationV10> = {},
): VisualIntegrityObservationV10 {
  return {
    generatedTextPresent: false,
    extraLimbVisible: false,
    unownedHandVisible: false,
    objectFusionVisible: false,
    impossibleInteractionVisible: false,
    beamPresent: false,
    beamSourceVisible: true,
    beamTargetVisible: true,
    beamPurposeClear: true,
    disconnectedPropVisible: false,
    brokenArrowVisible: false,
    directionUnambiguous: true,
    inputInvariantPreserved: true,
    systemInvariantPreserved: true,
    chartMetricDefined: true,
    labelsCarryClaim: false,
    mappingComplete: true,
    coreActionVisible: true,
    outcomeVisible: true,
    causalRelationVisible: true,
    domainContextVisible: true,
    unsupportedSpecificVisible: false,
    certaintyPreserved: true,
    ...overrides,
  };
}

describe('visual integrity gate v10', () => {
  it('blocks an extra hand and an off-screen unexplained beam in a cinematic scene', () => {
    const gate = evaluateVisualIntegrityV10(
      'cinematic_domain_scene',
      cleanObservation({
        unownedHandVisible: true,
        beamPresent: true,
        beamSourceVisible: false,
        beamPurposeClear: false,
      }),
    );

    expect(gate.passed).toBe(false);
    expect(gate.blockers).toEqual(
      expect.arrayContaining([
        'unowned_hand',
        'beam_source_missing',
        'beam_purpose_unclear',
      ]),
    );
    expect(gate.pairwiseRankingEligible).toBe(false);
  });

  it('blocks a deterministic card with a broken arrow even when all semantics are present', () => {
    const gate = evaluateVisualIntegrityV10(
      'deterministic_technical_hybrid',
      cleanObservation({ brokenArrowVisible: true }),
    );

    expect(gate.passed).toBe(false);
    expect(gate.blockers).toContain('broken_arrow');
  });

  it('blocks a comparison whose labels claim sameness while pixels show different systems', () => {
    const gate = evaluateVisualIntegrityV10(
      'controlled_comparison',
      cleanObservation({
        systemInvariantPreserved: false,
        labelsCarryClaim: true,
      }),
    );

    expect(gate.passed).toBe(false);
    expect(gate.blockers).toContain('system_invariant_broken');
    expect(gate.blockers).toContain('labels_carry_claim');
  });

  it('blocks a physical analogy when a key prop is disconnected from the causal chain', () => {
    const gate = evaluateVisualIntegrityV10(
      'one_to_one_physical_analogy',
      cleanObservation({ disconnectedPropVisible: true }),
    );

    expect(gate.passed).toBe(false);
    expect(gate.blockers).toContain('disconnected_prop');
  });

  it('allows a neutral fallback to omit mechanism and outcome but not unsupported claims', () => {
    const gate = evaluateVisualIntegrityV10(
      'source_led_fallback',
      cleanObservation({
        coreActionVisible: false,
        outcomeVisible: false,
        causalRelationVisible: false,
        domainContextVisible: false,
      }),
    );

    expect(gate.passed).toBe(true);
    expect(gate.blockers).toEqual([]);
  });
});

describe('owner-grounded publication decision v10', () => {
  it('never publishes automatically even when every machine gate passes', () => {
    const integrity = evaluateVisualIntegrityV10(
      'cinematic_domain_scene',
      cleanObservation(),
    );
    const decision = decidePublicationV10({
      integrity,
      headlinePair: {
        headlinePairUnderstood: true,
        imageAddsMechanismOrOutcome: true,
        labelsSupportedByPixels: true,
        thumbnailReadable: true,
        misleading: false,
      },
      ownerApproved: false,
    });

    expect(decision.integrityPassed).toBe(true);
    expect(decision.headlinePairPassed).toBe(true);
    expect(decision.automatedPublicationAllowed).toBe(false);
    expect(decision.ownerApprovalRequired).toBe(true);
    expect(decision.publishable).toBe(false);
    expect(decision.reason).toContain('owner approval');
  });

  it('publishes only after hard gates and explicit owner approval', () => {
    const integrity = evaluateVisualIntegrityV10(
      'cinematic_domain_scene',
      cleanObservation(),
    );
    const decision = decidePublicationV10({
      integrity,
      headlinePair: {
        headlinePairUnderstood: true,
        imageAddsMechanismOrOutcome: true,
        labelsSupportedByPixels: true,
        thumbnailReadable: true,
        misleading: false,
      },
      ownerApproved: true,
    });

    expect(decision.publishable).toBe(true);
    expect(decision.reason).toContain('Owner approved');
  });
});
