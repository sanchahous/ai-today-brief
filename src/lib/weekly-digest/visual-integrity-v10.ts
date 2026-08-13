import type { VisualGrammarV10 } from './visual-owner-calibration-v10';

export const VISUAL_INTEGRITY_BLOCKERS_V10 = [
  'generated_text',
  'extra_limb',
  'unowned_hand',
  'object_fusion',
  'impossible_interaction',
  'beam_source_missing',
  'beam_target_missing',
  'beam_purpose_unclear',
  'disconnected_prop',
  'broken_arrow',
  'ambiguous_direction',
  'input_invariant_broken',
  'system_invariant_broken',
  'undefined_chart_metric',
  'labels_carry_claim',
  'mapping_incomplete',
  'core_action_missing',
  'outcome_missing',
  'causal_relation_missing',
  'domain_context_missing',
  'unsupported_specific',
  'certainty_upgrade',
] as const;

export type VisualIntegrityBlockerV10 =
  (typeof VISUAL_INTEGRITY_BLOCKERS_V10)[number];

export interface VisualIntegrityObservationV10 {
  generatedTextPresent: boolean;

  extraLimbVisible: boolean;
  unownedHandVisible: boolean;
  objectFusionVisible: boolean;
  impossibleInteractionVisible: boolean;

  beamPresent: boolean;
  beamSourceVisible: boolean;
  beamTargetVisible: boolean;
  beamPurposeClear: boolean;

  disconnectedPropVisible: boolean;

  brokenArrowVisible: boolean;
  directionUnambiguous: boolean;
  inputInvariantPreserved: boolean;
  systemInvariantPreserved: boolean;
  chartMetricDefined: boolean;
  labelsCarryClaim: boolean;

  mappingComplete: boolean;
  coreActionVisible: boolean;
  outcomeVisible: boolean;
  causalRelationVisible: boolean;
  domainContextVisible: boolean;

  unsupportedSpecificVisible: boolean;
  certaintyPreserved: boolean;
}

export interface VisualIntegrityGateV10 {
  passed: boolean;
  blockers: VisualIntegrityBlockerV10[];
  pairwiseRankingEligible: boolean;
  automatedPublicationAllowed: false;
  ownerApprovalRequired: true;
}

function baseBlockers(
  observation: VisualIntegrityObservationV10,
): VisualIntegrityBlockerV10[] {
  const blockers: VisualIntegrityBlockerV10[] = [];
  if (observation.generatedTextPresent) blockers.push('generated_text');
  if (observation.extraLimbVisible) blockers.push('extra_limb');
  if (observation.unownedHandVisible) blockers.push('unowned_hand');
  if (observation.objectFusionVisible) blockers.push('object_fusion');
  if (observation.impossibleInteractionVisible) {
    blockers.push('impossible_interaction');
  }
  if (observation.beamPresent && !observation.beamSourceVisible) {
    blockers.push('beam_source_missing');
  }
  if (observation.beamPresent && !observation.beamTargetVisible) {
    blockers.push('beam_target_missing');
  }
  if (observation.beamPresent && !observation.beamPurposeClear) {
    blockers.push('beam_purpose_unclear');
  }
  if (observation.disconnectedPropVisible) blockers.push('disconnected_prop');
  if (!observation.coreActionVisible) blockers.push('core_action_missing');
  if (!observation.outcomeVisible) blockers.push('outcome_missing');
  if (!observation.causalRelationVisible) blockers.push('causal_relation_missing');
  if (observation.unsupportedSpecificVisible) blockers.push('unsupported_specific');
  if (!observation.certaintyPreserved) blockers.push('certainty_upgrade');
  return blockers;
}

export function evaluateVisualIntegrityV10(
  grammar: VisualGrammarV10,
  observation: VisualIntegrityObservationV10,
): VisualIntegrityGateV10 {
  const blockers = baseBlockers(observation);

  if (
    grammar === 'cinematic_domain_scene' &&
    !observation.domainContextVisible
  ) {
    blockers.push('domain_context_missing');
  }

  if (grammar === 'one_to_one_physical_analogy') {
    if (!observation.mappingComplete) blockers.push('mapping_incomplete');
  }

  if (
    grammar === 'controlled_comparison' ||
    grammar === 'causal_process_sequence' ||
    grammar === 'deterministic_technical_hybrid'
  ) {
    if (observation.brokenArrowVisible) blockers.push('broken_arrow');
    if (!observation.directionUnambiguous) blockers.push('ambiguous_direction');
    if (observation.labelsCarryClaim) blockers.push('labels_carry_claim');
  }

  if (grammar === 'controlled_comparison') {
    if (!observation.inputInvariantPreserved) {
      blockers.push('input_invariant_broken');
    }
    if (!observation.systemInvariantPreserved) {
      blockers.push('system_invariant_broken');
    }
  }

  if (
    grammar === 'deterministic_technical_hybrid' &&
    !observation.chartMetricDefined
  ) {
    blockers.push('undefined_chart_metric');
  }

  if (grammar === 'source_led_fallback') {
    const allowed = new Set<VisualIntegrityBlockerV10>([
      'generated_text',
      'unsupported_specific',
      'certainty_upgrade',
      'extra_limb',
      'unowned_hand',
      'object_fusion',
      'impossible_interaction',
    ]);
    const fallbackBlockers = blockers.filter((blocker) => allowed.has(blocker));
    return {
      passed: fallbackBlockers.length === 0,
      blockers: [...new Set(fallbackBlockers)],
      pairwiseRankingEligible: fallbackBlockers.length === 0,
      automatedPublicationAllowed: false,
      ownerApprovalRequired: true,
    };
  }

  const unique = [...new Set(blockers)];
  return {
    passed: unique.length === 0,
    blockers: unique,
    // A critic may rank two imperfect candidates, but a candidate with factual,
    // anatomy, generated-text or certainty failures is excluded even from ranking.
    pairwiseRankingEligible: !unique.some((blocker) =>
      [
        'generated_text',
        'extra_limb',
        'unowned_hand',
        'object_fusion',
        'unsupported_specific',
        'certainty_upgrade',
      ].includes(blocker),
    ),
    automatedPublicationAllowed: false,
    ownerApprovalRequired: true,
  };
}

export interface HeadlinePairObservationV10 {
  headlinePairUnderstood: boolean;
  imageAddsMechanismOrOutcome: boolean;
  labelsSupportedByPixels: boolean;
  thumbnailReadable: boolean;
  misleading: boolean;
}

export interface OwnerGroundedPublicationDecisionV10 {
  integrityPassed: boolean;
  headlinePairPassed: boolean;
  automatedPublicationAllowed: false;
  ownerApprovalRequired: true;
  publishable: boolean;
  reason: string;
}

export function decidePublicationV10(input: {
  integrity: VisualIntegrityGateV10;
  headlinePair: HeadlinePairObservationV10;
  ownerApproved: boolean;
}): OwnerGroundedPublicationDecisionV10 {
  const headlinePairPassed =
    input.headlinePair.headlinePairUnderstood &&
    input.headlinePair.imageAddsMechanismOrOutcome &&
    input.headlinePair.labelsSupportedByPixels &&
    input.headlinePair.thumbnailReadable &&
    !input.headlinePair.misleading;
  const publishable =
    input.integrity.passed && headlinePairPassed && input.ownerApproved;

  return {
    integrityPassed: input.integrity.passed,
    headlinePairPassed,
    automatedPublicationAllowed: false,
    ownerApprovalRequired: true,
    publishable,
    reason: !input.integrity.passed
      ? `Blocked by visual integrity: ${input.integrity.blockers.join(', ')}.`
      : !headlinePairPassed
        ? 'The headline-image pair does not communicate one grounded core claim.'
        : !input.ownerApproved
          ? 'Automated checks passed, but owner approval is still required.'
          : 'Owner approved after all hard gates passed.',
  };
}
