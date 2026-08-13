import type {
  VisualAffordanceV10,
  VisualCandidateDecisionV10,
  VisualIntegrityFailureV10,
  VisualIntegrityProfileV10,
  VisualPropositionV10,
} from './visual-affordance-v10';
import { evaluateVisualCandidateV10 } from './visual-affordance-v10';
import type { HoldoutStoryInput } from './visual-auto-claim';
import { weightedVisualScore } from './visual-compiler';

export interface BlindPixelObservationV10 {
  visibleObjects: string[];
  visiblePeopleAndHands: string[];
  visibleActions: string[];
  visibleSourceTargetRelations: string[];
  visibleOutcomes: string[];
  visibleText: string[];
  ambiguousElements: string[];
}

export interface VisualIntegrityEvidenceV10 {
  contextVisible: boolean;
  actionVisible: boolean;
  outcomeVisible: boolean;
  visualThesisCoherent: boolean;
  generatedTextPresent: boolean;

  anatomyValid: boolean;
  allHandsOwnedByVisiblePeople: boolean;
  objectsRemainSeparated: boolean;
  interactionsPhysicallyPlausible: boolean;
  allDirectedEffectsHaveVisibleSource: boolean;
  allDirectedEffectsHaveMeaningfulTarget: boolean;
  allPropsParticipateInTheClaim: boolean;

  allArrowsConnected: boolean;
  directionUnambiguous: boolean;
  sameInputPreserved: boolean;
  sameSystemPreserved: boolean;
  chartOrMetricInterpretable: boolean;
  meaningVisibleWithoutLabels: boolean;

  analogyMappingOneToOne: boolean;
}

export interface HeadlinePairEvidenceV10 {
  headlineImagePairUnderstood: boolean;
  oneCoreClaimVisible: boolean;
  certaintyPreserved: boolean;
  approvedLabelsExact: boolean;
  labelsSupportedByPixels: boolean;
  thumbnailReadable: boolean;
  misleading: boolean;
  instantMeaning: number;
  visualBeauty: number;
  brandConsistency: number;
  originality: number;
  summary: string;
}

export interface PairwiseVisualRankV10 {
  preferred: 'left' | 'right' | 'tie';
  confidence: number;
  reason: string;
}

export interface VisualCriticResultV10 {
  failures: VisualIntegrityFailureV10[];
  candidateDecision: VisualCandidateDecisionV10;
  headlinePair: HeadlinePairEvidenceV10;
  weightedScore: number;
  pairwiseRankOnly: true;
  ownerAcceptanceRequired: true;
}

const PROFILE_RULES: Record<VisualIntegrityProfileV10, string[]> = {
  generated_scene: [
    'Every visible hand and limb must belong unambiguously to a visible person.',
    'No object fusion, duplicate anatomy or physically impossible interaction is allowed.',
    'Every beam, ray, stream or directed effect must have a visible source, meaningful target and visible function.',
    'Every prominent prop must participate in the visible action or outcome.',
  ],
  generated_sequence: [
    'The same subject, environment, camera and scale must remain stable across states.',
    'The changed evidence must be visible in the pixels; state labels cannot create the transition.',
    'Every arrow or state connector must have a clear source and target.',
  ],
  diagram: [
    'Every arrow must touch a visible source and target and must not be broken, reversed or floating.',
    'The direction of flow or comparison must be unambiguous.',
    'When the claim holds the input or system constant, those objects must look identical in every branch.',
    'A chart is valid only when its visual metric is interpretable from the geometry.',
    'Removing all labels must still leave the central action and outcome visible.',
  ],
  physical_analogy: [
    'Every prominent object must map to one source element.',
    'The physical action must mirror the source action one-to-one.',
    'The physical outcome must mirror the source outcome one-to-one.',
    'Unmapped decorative machinery, fabric, pipes or props are blockers.',
  ],
  fallback: [
    'The image must remain neutral and professional.',
    'It must not imply a mechanism, metric, comparison, success state or certainty upgrade.',
    'It must contain no generated text or accidental factual symbol.',
  ],
};

export function buildBlindPixelObservationInstructionV10(): string {
  return [
    'Observe the supplied image using pixels only.',
    'You are not given a headline, story, prompt, expected answer, labels specification or semantic contract.',
    'Do not infer hidden product names, companies or intended metaphors.',
    'Report only literal visible evidence.',
    'Return JSON with: visible_objects, visible_people_and_hands, visible_actions, visible_source_target_relations, visible_outcomes, visible_text, ambiguous_elements.',
    'For hands and limbs, state which visible person each one belongs to; mark ownership as ambiguous when it cannot be established.',
    'For every arrow, beam, ray, stream or connector, state its visible source, target and observable effect.',
    'For every prominent prop, state whether it participates in an action or appears disconnected.',
  ].join('\n');
}

export function buildFormatIntegrityInstructionV10(input: {
  profile: VisualIntegrityProfileV10;
  observation: BlindPixelObservationV10;
}): string {
  return [
    'Judge visual integrity from the literal observation below. Do not score story relevance yet.',
    `INTEGRITY PROFILE: ${input.profile}`,
    ...PROFILE_RULES[input.profile].map((rule) => `- ${rule}`),
    'Return JSON booleans for: context_visible, action_visible, outcome_visible, visual_thesis_coherent, generated_text_present, anatomy_valid, all_hands_owned_by_visible_people, objects_remain_separated, interactions_physically_plausible, all_directed_effects_have_visible_source, all_directed_effects_have_meaningful_target, all_props_participate_in_the_claim, all_arrows_connected, direction_unambiguous, same_input_preserved, same_system_preserved, chart_or_metric_interpretable, meaning_visible_without_labels, analogy_mapping_one_to_one.',
    `LITERAL OBSERVATION: ${JSON.stringify(input.observation)}`,
  ].join('\n');
}

export function buildHeadlinePairInstructionV10(input: {
  story: HoldoutStoryInput;
  proposition: VisualPropositionV10;
  observation: BlindPixelObservationV10;
}): string {
  const story = [
    `HEADLINE: ${input.story.title}`,
    `SUMMARY: ${input.story.summary}`,
    input.story.why ? `WHY: ${input.story.why}` : '',
    input.story.practical ? `PRACTICAL: ${input.story.practical}` : '',
    input.story.takeaway ? `TAKEAWAY: ${input.story.takeaway}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    'Now judge the real feed card: the approved headline is always shown next to the image.',
    story,
    `ONE APPROVED CORE CLAIM: ${input.proposition.coreClaim || 'No explanatory claim; neutral fallback only.'}`,
    `AFFORDANCE: ${input.proposition.affordance}`,
    `APPROVED OVERLAY LABELS: ${JSON.stringify(input.proposition.approvedOverlays)}`,
    `FORBIDDEN IMPLICATIONS: ${input.proposition.forbiddenImplications.join('; ')}`,
    `BLIND PIXEL OBSERVATION: ${JSON.stringify(input.observation)}`,
    'The headline may provide identity, but it may not invent an action or outcome absent from the pixels.',
    'Labels may clarify identity, a state name or an exact number, but they may not carry required evidence that the pixels fail to show.',
    'Return JSON with: headline_image_pair_understood, one_core_claim_visible, certainty_preserved, approved_labels_exact, labels_supported_by_pixels, thumbnail_readable, misleading, instant_meaning, visual_beauty, brand_consistency, originality, summary.',
    'All four numeric quality scores use a 0-to-100 scale.',
  ].join('\n');
}

export function buildPairwiseRankInstructionV10(): string {
  return [
    'Choose the stronger of two cards only after each card has been independently checked for visual integrity and factual grounding.',
    'A card with any hard integrity blocker cannot win because of beauty.',
    'Weights among blocker-free cards: instant meaning 45%, visual beauty 30%, brand consistency 15%, originality 10%.',
    'Return preferred = left, right or tie, confidence 0-100 and a concise reason.',
    'This comparison is ranking support only. It must never publish or mark a card production-ready.',
  ].join('\n');
}

function push(
  failures: VisualIntegrityFailureV10[],
  condition: boolean,
  failure: VisualIntegrityFailureV10,
) {
  if (condition && !failures.includes(failure)) failures.push(failure);
}

export function deriveVisualIntegrityFailuresV10(input: {
  affordance: VisualAffordanceV10;
  profile: VisualIntegrityProfileV10;
  evidence: VisualIntegrityEvidenceV10;
  headlinePair: HeadlinePairEvidenceV10;
}): VisualIntegrityFailureV10[] {
  const { evidence, headlinePair, profile, affordance } = input;
  const failures: VisualIntegrityFailureV10[] = [];

  push(failures, evidence.generatedTextPresent, 'generated_text');
  push(failures, !evidence.contextVisible, 'missing_context');

  if (affordance !== 'source_led_fallback') {
    push(failures, !evidence.actionVisible, 'missing_action');
    push(failures, !evidence.outcomeVisible, 'missing_outcome');
    push(failures, !evidence.visualThesisCoherent, 'weak_visual_thesis');
    push(failures, !headlinePair.labelsSupportedByPixels, 'labels_carry_the_claim');
  }

  if (profile === 'generated_scene' || profile === 'generated_sequence') {
    push(failures, !evidence.anatomyValid, 'extra_limb');
    push(
      failures,
      !evidence.allHandsOwnedByVisiblePeople,
      'unowned_hand',
    );
    push(failures, !evidence.objectsRemainSeparated, 'object_fusion');
    push(
      failures,
      !evidence.interactionsPhysicallyPlausible,
      'impossible_interaction',
    );
    push(
      failures,
      !evidence.allDirectedEffectsHaveVisibleSource,
      'beam_without_visible_source',
    );
    push(
      failures,
      !evidence.allDirectedEffectsHaveMeaningfulTarget,
      'beam_without_meaningful_target',
    );
    push(
      failures,
      !evidence.allPropsParticipateInTheClaim,
      'disconnected_prop',
    );
  }

  if (profile === 'diagram' || profile === 'generated_sequence') {
    push(failures, !evidence.allArrowsConnected, 'broken_arrow');
    push(failures, !evidence.directionUnambiguous, 'ambiguous_direction');
  }

  if (affordance === 'controlled_comparison') {
    push(failures, !evidence.sameInputPreserved, 'same_input_not_preserved');
    push(failures, !evidence.sameSystemPreserved, 'same_system_not_preserved');
  }

  if (profile === 'diagram') {
    push(
      failures,
      !evidence.chartOrMetricInterpretable,
      'uninterpretable_chart',
    );
    push(
      failures,
      !evidence.meaningVisibleWithoutLabels,
      'labels_carry_the_claim',
    );
  }

  if (profile === 'physical_analogy') {
    push(
      failures,
      !evidence.analogyMappingOneToOne,
      'mapping_not_one_to_one',
    );
  }

  if (headlinePair.misleading) {
    push(failures, true, 'weak_visual_thesis');
  }

  return failures;
}

export function buildVisualCriticResultV10(input: {
  proposition: VisualPropositionV10;
  integrity: VisualIntegrityEvidenceV10;
  headlinePair: HeadlinePairEvidenceV10;
  remainingImageCalls?: number;
}): VisualCriticResultV10 {
  const failures = deriveVisualIntegrityFailuresV10({
    affordance: input.proposition.affordance,
    profile: input.proposition.integrityProfile,
    evidence: input.integrity,
    headlinePair: input.headlinePair,
  });
  return {
    failures,
    candidateDecision: evaluateVisualCandidateV10(
      failures,
      input.remainingImageCalls ?? 1,
    ),
    headlinePair: input.headlinePair,
    weightedScore: weightedVisualScore({
      instantMeaning: input.headlinePair.instantMeaning,
      visualBeauty: input.headlinePair.visualBeauty,
      brandConsistency: input.headlinePair.brandConsistency,
      originality: input.headlinePair.originality,
    }),
    pairwiseRankOnly: true,
    ownerAcceptanceRequired: true,
  };
}
