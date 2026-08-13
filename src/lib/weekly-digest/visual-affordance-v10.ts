import type { HoldoutStoryInput } from './visual-auto-claim';
import type { AutoVisualClaimV5 } from './visual-auto-claim-v5';

export const VISUAL_AFFORDANCES_V10 = [
  'cinematic_domain_scene',
  'one_to_one_physical_analogy',
  'controlled_comparison',
  'causal_process_sequence',
  'deterministic_technical_hybrid',
  'source_led_fallback',
] as const;

export type VisualAffordanceV10 = (typeof VISUAL_AFFORDANCES_V10)[number];

export const VISUAL_RENDER_MODES_V10 = [
  'generated_cinematic',
  'generated_sequence',
  'deterministic_hybrid',
  'source_led',
] as const;

export type VisualRenderModeV10 = (typeof VISUAL_RENDER_MODES_V10)[number];

export type VisualEvidenceRoleV10 =
  | 'context'
  | 'action'
  | 'outcome'
  | 'constraint';

export type VisualEvidenceSourceV10 = 'pixels' | 'overlay';

export interface VisualMappingEntryV10 {
  sourceElement: string;
  visualElement: string;
  role: VisualEvidenceRoleV10;
  required: boolean;
  evidenceSource: VisualEvidenceSourceV10;
}

export interface PhysicalAnalogyMappingV10 {
  title: string;
  context: VisualMappingEntryV10;
  action: VisualMappingEntryV10;
  outcome: VisualMappingEntryV10;
  forbiddenDecorativeElements?: string[];
}

export type VisualIntegrityProfileV10 =
  | 'generated_scene'
  | 'generated_sequence'
  | 'diagram'
  | 'physical_analogy'
  | 'fallback';

export interface VisualIdentityInvariantV10 {
  subject: string;
  mustRemainIdenticalAcrossStates: string[];
}

export interface VisualGeometryContractV10 {
  arrowsMustHaveVisibleSourceAndTarget: boolean;
  directionMustBeUnambiguous: boolean;
  labelsMayNotCarryRequiredEvidence: boolean;
  sameInputMustRemainIdentical: boolean;
  sameSystemMustRemainIdentical: boolean;
  maxStates: number;
}

export interface VisualPropositionV10 {
  id: string;
  storyId: string;
  affordance: VisualAffordanceV10;
  renderMode: VisualRenderModeV10;
  integrityProfile: VisualIntegrityProfileV10;
  title: string;
  coreClaim: string;
  rationale: string;
  mapping: VisualMappingEntryV10[];
  approvedOverlays: string[];
  forbiddenImplications: string[];
  identityInvariant: VisualIdentityInvariantV10 | null;
  geometry: VisualGeometryContractV10 | null;
  priority: number;
  expectedImageCalls: 0 | 1 | 2;
  ownerReviewRequired: true;
}

export interface VisualAffordanceRouterInputV10 {
  story: HoldoutStoryInput;
  claim: AutoVisualClaimV5;
  eligible: boolean;
  physicalAnalogy?: PhysicalAnalogyMappingV10 | null;
}

export type VisualPropositionIssueV10 =
  | 'missing_core_claim'
  | 'missing_context_mapping'
  | 'missing_action_mapping'
  | 'missing_outcome_mapping'
  | 'required_evidence_delegated_to_overlay'
  | 'too_many_overlays'
  | 'generic_visual_language'
  | 'analogy_mapping_not_one_to_one'
  | 'comparison_missing_identity_invariant'
  | 'sequence_missing_identity_invariant'
  | 'diagram_missing_geometry_contract'
  | 'fallback_contains_explanatory_assertion';

export interface VisualPropositionValidationV10 {
  passed: boolean;
  issues: VisualPropositionIssueV10[];
}

export const VISUAL_INTEGRITY_FAILURES_V10 = [
  'extra_limb',
  'unowned_hand',
  'object_fusion',
  'impossible_interaction',
  'beam_without_visible_source',
  'beam_without_meaningful_target',
  'disconnected_prop',
  'broken_arrow',
  'ambiguous_direction',
  'same_input_not_preserved',
  'same_system_not_preserved',
  'uninterpretable_chart',
  'labels_carry_the_claim',
  'generated_text',
  'missing_context',
  'missing_action',
  'missing_outcome',
  'weak_visual_thesis',
  'mapping_not_one_to_one',
  'layout_collision',
  'label_collision',
] as const;

export type VisualIntegrityFailureV10 =
  (typeof VISUAL_INTEGRITY_FAILURES_V10)[number];

export type VisualRepairModeV10 =
  | 'none'
  | 'recompose_geometry'
  | 'edit_local_region'
  | 'regenerate_scene'
  | 'replan_proposition'
  | 'source_led_fallback';

export interface VisualCandidateDecisionV10 {
  eligibleForOwnerReview: boolean;
  ownerReviewRequired: true;
  automatedProductionPass: false;
  failures: VisualIntegrityFailureV10[];
  repairMode: VisualRepairModeV10;
}

const GENERIC_VISUAL_LANGUAGE =
  /\b(generic (?:ai|factory|diagram|chart|technology)|glowing (?:orb|brain|core)|abstract (?:blob|graph|network)|anonymous server aisle|interchangeable tech stock)\b/i;

const SAME_INPUT_SIGNAL =
  /\b(same (?:task|prompt|input|request)|repeat(?:ed|ing)? (?:run|task|prompt)|consisten(?:cy|t)|inconsisten(?:cy|t|cies)|divergent outputs?|different outputs?|run a|run b)\b/i;

const TEMPORAL_SIGNAL =
  /\b(before|after|resume|restart|crash|failure|failed|patch|repair|retry|checkpoint|fuzz(?:ing)?|property testing|test case|state transition)\b/i;

const TECHNICAL_FLOW_SIGNAL =
  /\b(cache|caching|gateway|routing|route|mount|compiler|lowering|layer|stack|schema|tool call|access path|compression|threshold|token consumption|rate limit|architecture|pipeline|benchmark|cost reduction)\b/i;

const DOMAIN_SIGNAL =
  /\b(immunolog|t-cell|biolog|medical|clinical|scientific|research(?:er|ers)?|laborator|cryptograph|hardware|semiconductor|robotics|security evaluation|penetration testing)\b/i;

const HUMAN_SIGNAL =
  /\b(deep work|distraction|cognitive|thinking|learning|tutor|student|human behavior|attention|focus)\b/i;

const EXACT_METRIC_SIGNAL =
  /(?:[$€£]\s*\d|\b\d+(?:\.\d+)?\s*(?:%|x|×|tokens?|ms|seconds?|minutes?|hours?|million|billion|trillion)\b)/i;

function clean(value: string | null | undefined, maxLength: number): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function unique(values: readonly string[], maxItems = 3): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = clean(raw, 52);
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (output.length >= maxItems) break;
  }
  return output;
}

function sourceText(story: HoldoutStoryInput): string {
  return [
    story.title,
    story.summary,
    story.why ?? '',
    story.practical ?? '',
    story.takeaway ?? '',
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function coreClaim(input: VisualAffordanceRouterInputV10): string {
  return clean(
    input.claim.claim.coreClaim ||
      input.claim.claim.primaryOutcome ||
      input.story.summary ||
      input.story.title,
    240,
  );
}

function mapping(
  sourceElement: string,
  visualElement: string,
  role: VisualEvidenceRoleV10,
  required = true,
): VisualMappingEntryV10 {
  return {
    sourceElement: clean(sourceElement, 180),
    visualElement: clean(visualElement, 180),
    role,
    required,
    evidenceSource: 'pixels',
  };
}

function baseGeometry(input: Partial<VisualGeometryContractV10> = {}): VisualGeometryContractV10 {
  return {
    arrowsMustHaveVisibleSourceAndTarget: true,
    directionMustBeUnambiguous: true,
    labelsMayNotCarryRequiredEvidence: true,
    sameInputMustRemainIdentical: false,
    sameSystemMustRemainIdentical: false,
    maxStates: 3,
    ...input,
  };
}

function propositionId(
  storyId: string,
  affordance: VisualAffordanceV10,
): string {
  return `${storyId}:${affordance}`;
}

function controlledComparison(
  input: VisualAffordanceRouterInputV10,
  priority = 100,
): VisualPropositionV10 {
  const identity = clean(input.claim.claim.identity || input.story.title, 160);
  const action = clean(
    input.claim.semantics.visualDriver || input.claim.claim.change,
    180,
  );
  const outcome = clean(input.claim.claim.primaryOutcome, 180);
  return {
    id: propositionId(input.story.revision_item_id, 'controlled_comparison'),
    storyId: input.story.revision_item_id,
    affordance: 'controlled_comparison',
    renderMode: 'deterministic_hybrid',
    integrityProfile: 'diagram',
    title: 'Controlled same-input comparison',
    coreClaim: coreClaim(input),
    rationale:
      'The claim depends on holding the input and system constant while making the output difference visually undeniable.',
    mapping: [
      mapping('the same approved input or task', 'one shared input artifact duplicated without visual changes', 'context'),
      mapping(action || 'the same system is run more than once', 'one visibly identical system chamber used for both runs', 'action'),
      mapping(outcome || 'the outputs diverge', 'two concrete output artifacts with an unmistakable structural difference', 'outcome'),
    ],
    approvedOverlays: unique(['SAME TASK', 'RUN A', 'RUN B']),
    forbiddenImplications: [
      'two different input tasks',
      'two different models or systems',
      'a generic line chart with no interpretable output object',
      'labels are the only evidence of divergence',
    ],
    identityInvariant: {
      subject: identity,
      mustRemainIdenticalAcrossStates: [
        'input artifact',
        'system or model chamber',
        'camera and scale',
      ],
    },
    geometry: baseGeometry({
      sameInputMustRemainIdentical: true,
      sameSystemMustRemainIdentical: true,
      maxStates: 2,
    }),
    priority,
    expectedImageCalls: 0,
    ownerReviewRequired: true,
  };
}

function processSequence(
  input: VisualAffordanceRouterInputV10,
  priority = 100,
): VisualPropositionV10 {
  const identity = clean(input.claim.claim.identity || input.story.title, 160);
  const action = clean(
    input.claim.semantics.visualDriver || input.claim.claim.change,
    180,
  );
  const outcome = clean(input.claim.claim.primaryOutcome, 180);
  return {
    id: propositionId(input.story.revision_item_id, 'causal_process_sequence'),
    storyId: input.story.revision_item_id,
    affordance: 'causal_process_sequence',
    renderMode: 'generated_sequence',
    integrityProfile: 'generated_sequence',
    title: 'Three-state causal process',
    coreClaim: coreClaim(input),
    rationale:
      'The claim is a state transition or test-repair loop that cannot be communicated honestly in one frozen moment.',
    mapping: [
      mapping(identity, 'the same concrete subject and environment in every state', 'context'),
      mapping(action || 'the source-grounded transition', 'a visible middle-state action or failure', 'action'),
      mapping(outcome || 'the resulting state', 'a final state with concrete changed evidence', 'outcome'),
    ],
    approvedOverlays: unique(input.claim.claim.states ?? ['START', 'CHANGE', 'RESULT']),
    forbiddenImplications: [
      'three unrelated scenes',
      'different subjects between states',
      'labels are the only indication that anything changed',
    ],
    identityInvariant: {
      subject: identity,
      mustRemainIdenticalAcrossStates: [
        'main subject',
        'environment',
        'camera angle',
        'scale',
      ],
    },
    geometry: baseGeometry({
      sameInputMustRemainIdentical: true,
      sameSystemMustRemainIdentical: true,
      maxStates: 3,
    }),
    priority,
    expectedImageCalls: 2,
    ownerReviewRequired: true,
  };
}

function technicalHybrid(
  input: VisualAffordanceRouterInputV10,
  priority = 100,
): VisualPropositionV10 {
  const identity = clean(input.claim.claim.identity || input.story.title, 160);
  const action = clean(
    input.claim.semantics.visualDriver || input.claim.claim.change,
    180,
  );
  const outcome = clean(input.claim.claim.primaryOutcome, 180);
  const overlays = unique([
    ...(input.claim.claim.approvedLabels ?? []),
    ...(input.claim.claim.quantitativeFacts ?? []).map(
      (fact) => `${fact.label} ${fact.value}`,
    ),
  ]);
  return {
    id: propositionId(
      input.story.revision_item_id,
      'deterministic_technical_hybrid',
    ),
    storyId: input.story.revision_item_id,
    affordance: 'deterministic_technical_hybrid',
    renderMode: 'deterministic_hybrid',
    integrityProfile: 'diagram',
    title: 'Cinematic technical hybrid',
    coreClaim: coreClaim(input),
    rationale:
      'The claim depends on exact flow, architecture, limits, routing or quantitative direction, so geometry must be deterministic while the surrounding visual language remains editorial.',
    mapping: [
      mapping(identity, 'a concrete domain or system anchor rather than anonymous boxes', 'context'),
      mapping(action || 'the source-grounded flow or transformation', 'connected components with visible source and target', 'action'),
      mapping(outcome || 'the source-grounded result', 'a concrete changed artifact, meter or bounded result state', 'outcome'),
    ],
    approvedOverlays: overlays,
    forbiddenImplications: [
      'decorative charts without an interpretable metric',
      'broken or floating arrows',
      'a generic SaaS dashboard',
      'labels carry the full claim while the geometry says nothing',
    ],
    identityInvariant: null,
    geometry: baseGeometry({ maxStates: 3 }),
    priority,
    expectedImageCalls: 0,
    ownerReviewRequired: true,
  };
}

function domainScene(
  input: VisualAffordanceRouterInputV10,
  priority = 100,
): VisualPropositionV10 {
  const identity = clean(input.claim.claim.identity || input.story.title, 160);
  const action = clean(
    input.claim.semantics.visualDriver || input.claim.claim.change,
    180,
  );
  const outcome = clean(input.claim.claim.primaryOutcome, 180);
  return {
    id: propositionId(input.story.revision_item_id, 'cinematic_domain_scene'),
    storyId: input.story.revision_item_id,
    affordance: 'cinematic_domain_scene',
    renderMode: 'generated_cinematic',
    integrityProfile: 'generated_scene',
    title: 'Domain-grounded cinematic scene',
    coreClaim: coreClaim(input),
    rationale:
      'A recognizable real domain, actor and visible result can communicate the claim more intuitively than a diagram or generic industrial metaphor.',
    mapping: [
      mapping(identity, 'a recognizable story-specific environment and subject', 'context'),
      mapping(action || 'the approved action', 'one physically plausible focal action', 'action'),
      mapping(outcome || 'the approved outcome', 'a visible result in the same continuous scene', 'outcome'),
    ],
    approvedOverlays: unique(input.claim.claim.approvedLabels ?? []),
    forbiddenImplications: [
      'generic technology stock',
      'an unexplained beam or magical interface',
      'anatomically impossible hands or limbs',
      'decorative props with no role in the causal chain',
      'the system acts autonomously when the source describes human collaboration',
    ],
    identityInvariant: null,
    geometry: null,
    priority,
    expectedImageCalls: 1,
    ownerReviewRequired: true,
  };
}

function physicalAnalogy(
  input: VisualAffordanceRouterInputV10,
  analogy: PhysicalAnalogyMappingV10,
  priority = 95,
): VisualPropositionV10 {
  return {
    id: propositionId(
      input.story.revision_item_id,
      'one_to_one_physical_analogy',
    ),
    storyId: input.story.revision_item_id,
    affordance: 'one_to_one_physical_analogy',
    renderMode: 'generated_cinematic',
    integrityProfile: 'physical_analogy',
    title: clean(analogy.title, 100),
    coreClaim: coreClaim(input),
    rationale:
      'Every required source element has one concrete physical counterpart, so the metaphor can be understood without inventing a second story.',
    mapping: [analogy.context, analogy.action, analogy.outcome],
    approvedOverlays: unique(input.claim.claim.approvedLabels ?? []),
    forbiddenImplications: [
      ...(analogy.forbiddenDecorativeElements ?? []),
      'an unmapped decorative object',
      'the physical action does not mirror the source action',
      'the visible outcome does not mirror the source outcome',
    ],
    identityInvariant: null,
    geometry: null,
    priority,
    expectedImageCalls: 1,
    ownerReviewRequired: true,
  };
}

function fallback(
  input: VisualAffordanceRouterInputV10,
): VisualPropositionV10 {
  return {
    id: propositionId(input.story.revision_item_id, 'source_led_fallback'),
    storyId: input.story.revision_item_id,
    affordance: 'source_led_fallback',
    renderMode: 'source_led',
    integrityProfile: 'fallback',
    title: 'Neutral source-led fallback',
    coreClaim: '',
    rationale:
      'The source claim did not pass the explanatory gate, so the visual must remain neutral and add no factual assertion.',
    mapping: [
      {
        sourceElement: clean(input.story.title, 180),
        visualElement: 'neutral branded visual atmosphere only',
        role: 'context',
        required: true,
        evidenceSource: 'pixels',
      },
    ],
    approvedOverlays: [],
    forbiddenImplications: [
      'a mechanism claim',
      'a metric claim',
      'a comparison claim',
      'a certainty upgrade',
    ],
    identityInvariant: null,
    geometry: null,
    priority: 100,
    expectedImageCalls: 0,
    ownerReviewRequired: true,
  };
}

export function validatePhysicalAnalogyMappingV10(
  analogy: PhysicalAnalogyMappingV10,
): boolean {
  const rows = [analogy.context, analogy.action, analogy.outcome];
  const roles = new Set(rows.map((row) => row.role));
  const visuals = rows.map((row) => clean(row.visualElement, 180).toLowerCase());
  return (
    roles.has('context') &&
    roles.has('action') &&
    roles.has('outcome') &&
    rows.every(
      (row) =>
        row.required &&
        row.evidenceSource === 'pixels' &&
        clean(row.sourceElement, 180).length >= 5 &&
        clean(row.visualElement, 180).length >= 5,
    ) &&
    new Set(visuals).size === visuals.length
  );
}

export function proposeVisualAffordancesV10(
  input: VisualAffordanceRouterInputV10,
): VisualPropositionV10[] {
  if (!input.eligible) return [fallback(input)];

  const source = sourceText(input.story);
  const sameInput = SAME_INPUT_SIGNAL.test(source);
  const temporal = TEMPORAL_SIGNAL.test(source);
  const technical =
    TECHNICAL_FLOW_SIGNAL.test(source) || EXACT_METRIC_SIGNAL.test(source);
  const domain = DOMAIN_SIGNAL.test(source);
  const human = HUMAN_SIGNAL.test(source);
  const propositions: VisualPropositionV10[] = [];

  if (sameInput) {
    propositions.push(controlledComparison(input, 100));
  } else if (temporal) {
    propositions.push(processSequence(input, 100));
  } else if (technical) {
    propositions.push(technicalHybrid(input, 100));
  } else {
    propositions.push(domainScene(input, 100));
  }

  if ((domain || human) && propositions[0]?.affordance !== 'cinematic_domain_scene') {
    propositions.push(domainScene(input, 88));
  }

  if (
    technical &&
    propositions[0]?.affordance !== 'deterministic_technical_hybrid'
  ) {
    propositions.push(technicalHybrid(input, 84));
  }

  if (
    input.physicalAnalogy &&
    validatePhysicalAnalogyMappingV10(input.physicalAnalogy)
  ) {
    propositions.push(physicalAnalogy(input, input.physicalAnalogy, 92));
  }

  return propositions
    .sort((left, right) => right.priority - left.priority)
    .filter(
      (candidate, index, rows) =>
        rows.findIndex((row) => row.affordance === candidate.affordance) ===
        index,
    )
    .slice(0, 3);
}

export function validateVisualPropositionV10(
  proposition: VisualPropositionV10,
): VisualPropositionValidationV10 {
  const issues: VisualPropositionIssueV10[] = [];
  if (
    proposition.affordance !== 'source_led_fallback' &&
    clean(proposition.coreClaim, 240).length < 8
  ) {
    issues.push('missing_core_claim');
  }
  if (
    proposition.affordance === 'source_led_fallback' &&
    clean(proposition.coreClaim, 240).length > 0
  ) {
    issues.push('fallback_contains_explanatory_assertion');
  }
  const required = proposition.mapping.filter((row) => row.required);
  if (!required.some((row) => row.role === 'context')) {
    issues.push('missing_context_mapping');
  }
  if (
    proposition.affordance !== 'source_led_fallback' &&
    !required.some((row) => row.role === 'action')
  ) {
    issues.push('missing_action_mapping');
  }
  if (
    proposition.affordance !== 'source_led_fallback' &&
    !required.some((row) => row.role === 'outcome')
  ) {
    issues.push('missing_outcome_mapping');
  }
  if (required.some((row) => row.evidenceSource === 'overlay')) {
    issues.push('required_evidence_delegated_to_overlay');
  }
  if (proposition.approvedOverlays.length > 3) {
    issues.push('too_many_overlays');
  }
  if (
    GENERIC_VISUAL_LANGUAGE.test(
      [
        proposition.title,
        proposition.rationale,
        ...proposition.mapping.map((row) => row.visualElement),
      ].join(' '),
    )
  ) {
    issues.push('generic_visual_language');
  }
  if (
    proposition.affordance === 'one_to_one_physical_analogy' &&
    new Set(
      proposition.mapping.map((row) =>
        clean(row.visualElement, 180).toLowerCase(),
      ),
    ).size !== proposition.mapping.length
  ) {
    issues.push('analogy_mapping_not_one_to_one');
  }
  if (
    proposition.affordance === 'controlled_comparison' &&
    !proposition.identityInvariant
  ) {
    issues.push('comparison_missing_identity_invariant');
  }
  if (
    proposition.affordance === 'causal_process_sequence' &&
    !proposition.identityInvariant
  ) {
    issues.push('sequence_missing_identity_invariant');
  }
  if (
    proposition.integrityProfile === 'diagram' &&
    !proposition.geometry
  ) {
    issues.push('diagram_missing_geometry_contract');
  }
  return { passed: issues.length === 0, issues };
}

export function chooseVisualRepairModeV10(
  failures: readonly VisualIntegrityFailureV10[],
  remainingImageCalls = 1,
): VisualRepairModeV10 {
  if (failures.length === 0) return 'none';
  if (
    failures.every(
      (failure) =>
        failure === 'broken_arrow' ||
        failure === 'layout_collision' ||
        failure === 'label_collision',
    )
  ) {
    return 'recompose_geometry';
  }
  if (
    failures.every(
      (failure) =>
        failure === 'disconnected_prop' ||
        failure === 'beam_without_visible_source' ||
        failure === 'beam_without_meaningful_target' ||
        failure === 'generated_text',
    )
  ) {
    return 'edit_local_region';
  }
  if (
    failures.some(
      (failure) =>
        failure === 'extra_limb' ||
        failure === 'unowned_hand' ||
        failure === 'object_fusion' ||
        failure === 'impossible_interaction',
    )
  ) {
    return remainingImageCalls > 0
      ? 'regenerate_scene'
      : 'source_led_fallback';
  }
  if (
    failures.some(
      (failure) =>
        failure === 'missing_context' ||
        failure === 'missing_action' ||
        failure === 'missing_outcome' ||
        failure === 'weak_visual_thesis' ||
        failure === 'mapping_not_one_to_one' ||
        failure === 'ambiguous_direction' ||
        failure === 'same_input_not_preserved' ||
        failure === 'same_system_not_preserved' ||
        failure === 'uninterpretable_chart' ||
        failure === 'labels_carry_the_claim',
    )
  ) {
    return 'replan_proposition';
  }
  return remainingImageCalls > 0
    ? 'regenerate_scene'
    : 'source_led_fallback';
}

export function evaluateVisualCandidateV10(
  failures: readonly VisualIntegrityFailureV10[],
  remainingImageCalls = 1,
): VisualCandidateDecisionV10 {
  const uniqueFailures = Array.from(new Set(failures));
  return {
    eligibleForOwnerReview: uniqueFailures.length === 0,
    ownerReviewRequired: true,
    automatedProductionPass: false,
    failures: uniqueFailures,
    repairMode: chooseVisualRepairModeV10(
      uniqueFailures,
      remainingImageCalls,
    ),
  };
}
