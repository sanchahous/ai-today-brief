import type { HoldoutStoryInput } from './visual-auto-claim';
import type {
  AutoVisualClaimV5,
  VisualExplanatoryRole,
} from './visual-auto-claim-v5';
import type { VisualGrammarV10 } from './visual-owner-calibration-v10';

export interface VisualAffordanceRouterInputV10 {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  eligible: boolean;
  ineligibilityReasons?: readonly string[];
}

export interface VisualAffordanceSignalsV10 {
  sourceEligible: boolean;
  explanatoryRole: VisualExplanatoryRole;
  hasExactMetric: boolean;
  sameInputComparison: boolean;
  requiresTemporalSequence: boolean;
  technicalStructureNatural: boolean;
  domainSceneNatural: boolean;
  humanAgencyCentral: boolean;
  physicalAnalogyNatural: boolean;
  uncertaintyMustRemainVisible: boolean;
  maxOverlayGroups: 3;
}

export interface VisualGrammarCandidateV10 {
  grammar: VisualGrammarV10;
  priority: number;
  reason: string;
  expectedImageCalls: 0 | 1;
  requiresMappingGate: boolean;
  requiresContinuityGate: boolean;
  requiresGeometryGate: boolean;
  labelsHiddenDuringSemanticTest: true;
  hardBlockers: string[];
}

export interface VisualAffordancePlanV10 {
  storyId: string;
  signals: VisualAffordanceSignalsV10;
  candidates: VisualGrammarCandidateV10[];
  ownerApprovalRequired: true;
  automatedPublicationAllowed: false;
  maxRenderedSurvivors: 2;
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

function hasExactMetric(input: VisualAffordanceRouterInputV10): boolean {
  if (input.autoClaim.semantics.metric) return true;
  if ((input.autoClaim.claim.quantitativeFacts ?? []).length > 0) return true;
  return /(?:[$€£]\s*\d|\b\d+(?:\.\d+)?\s*(?:%|x|×|tokens?|milliseconds?|ms|seconds?|minutes?|hours?|million|billion|trillion)\b)/i.test(
    sourceText(input.story),
  );
}

function sameInputComparison(source: string): boolean {
  return /\b(same (?:task|prompt|input|request)|identical (?:task|prompt|input)|repeat(?:ed|ing)? runs?|divergent outputs?|different outputs?|output variability|inconsisten(?:t|cy|cies)|consistency debate|same model)\b/i.test(
    source,
  );
}

function requiresTemporalSequence(
  role: VisualExplanatoryRole,
  source: string,
  exactMetric: boolean,
): boolean {
  if (role === 'state_transition') return true;
  if (exactMetric && role === 'quantitative_result') return false;
  return /\b(crash|resume|restart|checkpoint|cache|caching|split|bounded sessions?|monitor|fuzz(?:ing)?|property testing|failure|repair|retest|retry|before|after|interruption|continuation|pipeline stages?)\b/i.test(
    source,
  );
}

function technicalStructureNatural(
  role: VisualExplanatoryRole,
  source: string,
  exactMetric: boolean,
): boolean {
  if (exactMetric) return true;
  if (
    role === 'architecture_transformation' ||
    role === 'benchmark_comparison' ||
    role === 'quantitative_result'
  ) {
    return true;
  }
  return /\b(architecture|gateway|routing|router|layers?|stack|browser core|compiler|cache|caching|microvm|mount|schema|tool calling|provider|workflow|dependency|token stream|threshold)\b/i.test(
    source,
  );
}

function domainSceneNatural(
  role: VisualExplanatoryRole,
  source: string,
): boolean {
  if (role === 'uncertainty_announcement') return true;
  return /\b(researchers?|scientists?|laborator(?:y|ies)|immunolog|t-cell|medical|clinical|biological|biology|chemistry|physics|engineers?|developers?|students?|tutors?|deep work|cognitive|problem-solving|workshop|factory floor|hardware|robotics?)\b/i.test(
    source,
  );
}

function humanAgencyCentral(source: string): boolean {
  return /\b(person|people|human|researchers?|scientists?|engineers?|developers?|students?|tutors?|learners?|maintainers?|deep work|active thinking|problem-solving|sparring partner)\b/i.test(
    source,
  );
}

function physicalAnalogyNatural(
  input: VisualAffordanceRouterInputV10,
  source: string,
  exactMetric: boolean,
): boolean {
  if (exactMetric) return false;
  if (input.autoClaim.semantics.mappingMode === 'editorial_analogy') {
    return true;
  }
  if (
    input.autoClaim.semantics.explanatoryRole !== 'causal_mechanism' &&
    input.autoClaim.semantics.explanatoryRole !== 'policy_control'
  ) {
    return false;
  }
  return /\b(strict|fit|block|allow|reject|compression|compress|optical|boundary|gate|lock|key|filter|contain|isolate)\b/i.test(
    source,
  );
}

export function extractVisualAffordanceSignalsV10(
  input: VisualAffordanceRouterInputV10,
): VisualAffordanceSignalsV10 {
  const source = sourceText(input.story);
  const exactMetric = hasExactMetric(input);
  return {
    sourceEligible: input.eligible,
    explanatoryRole: input.autoClaim.semantics.explanatoryRole,
    hasExactMetric: exactMetric,
    sameInputComparison: sameInputComparison(source),
    requiresTemporalSequence: requiresTemporalSequence(
      input.autoClaim.semantics.explanatoryRole,
      source,
      exactMetric,
    ),
    technicalStructureNatural: technicalStructureNatural(
      input.autoClaim.semantics.explanatoryRole,
      source,
      exactMetric,
    ),
    domainSceneNatural: domainSceneNatural(
      input.autoClaim.semantics.explanatoryRole,
      source,
    ),
    humanAgencyCentral: humanAgencyCentral(source),
    physicalAnalogyNatural: physicalAnalogyNatural(input, source, exactMetric),
    uncertaintyMustRemainVisible: ![
      'observed',
      'released',
    ].includes(input.autoClaim.semantics.certainty),
    maxOverlayGroups: 3,
  };
}

const GRAMMAR_DEFAULTS: Record<
  VisualGrammarV10,
  Omit<VisualGrammarCandidateV10, 'grammar' | 'priority' | 'reason'>
> = {
  cinematic_domain_scene: {
    expectedImageCalls: 1,
    requiresMappingGate: false,
    requiresContinuityGate: false,
    requiresGeometryGate: false,
    labelsHiddenDuringSemanticTest: true,
    hardBlockers: [
      'weak domain context',
      'extra limb or unowned hand',
      'object fusion',
      'beam without a visible source and meaningful target',
      'generic stock scene',
      'labels carrying the entire claim',
    ],
  },
  one_to_one_physical_analogy: {
    expectedImageCalls: 1,
    requiresMappingGate: true,
    requiresContinuityGate: false,
    requiresGeometryGate: false,
    labelsHiddenDuringSemanticTest: true,
    hardBlockers: [
      'incomplete one-to-one mapping',
      'unmapped decorative prop',
      'physical action does not map to source action',
      'visible outcome absent',
      'disconnected semantic prop',
    ],
  },
  controlled_comparison: {
    expectedImageCalls: 0,
    requiresMappingGate: true,
    requiresContinuityGate: true,
    requiresGeometryGate: true,
    labelsHiddenDuringSemanticTest: true,
    hardBlockers: [
      'input invariant not preserved',
      'system invariant not preserved',
      'difference exists only in labels',
      'ambiguous comparison direction',
      'broken connector',
    ],
  },
  causal_process_sequence: {
    expectedImageCalls: 0,
    requiresMappingGate: true,
    requiresContinuityGate: true,
    requiresGeometryGate: true,
    labelsHiddenDuringSemanticTest: true,
    hardBlockers: [
      'missing process state',
      'transition has no visible cause',
      'outcome state absent',
      'subject changes between states',
      'broken arrow or flow',
    ],
  },
  deterministic_technical_hybrid: {
    expectedImageCalls: 0,
    requiresMappingGate: true,
    requiresContinuityGate: false,
    requiresGeometryGate: true,
    labelsHiddenDuringSemanticTest: true,
    hardBlockers: [
      'broken arrow',
      'undefined chart metric',
      'ambiguous flow direction',
      'labels carrying the entire claim',
      'comparison target missing',
    ],
  },
  source_led_fallback: {
    expectedImageCalls: 0,
    requiresMappingGate: false,
    requiresContinuityGate: false,
    requiresGeometryGate: false,
    labelsHiddenDuringSemanticTest: true,
    hardBlockers: [
      'unsupported explanatory assertion',
      'unapproved metric',
      'certainty upgrade',
      'generated text',
    ],
  },
};

function candidate(
  grammar: VisualGrammarV10,
  priority: number,
  reason: string,
): VisualGrammarCandidateV10 {
  return {
    grammar,
    priority,
    reason,
    ...GRAMMAR_DEFAULTS[grammar],
  };
}

export function planVisualAffordancesV10(
  input: VisualAffordanceRouterInputV10,
): VisualAffordancePlanV10 {
  const signals = extractVisualAffordanceSignalsV10(input);
  if (!signals.sourceEligible) {
    const reasons = (input.ineligibilityReasons ?? [])
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 3);
    return {
      storyId: input.story.revision_item_id,
      signals,
      candidates: [
        candidate(
          'source_led_fallback',
          100,
          reasons.length > 0
            ? `The factual visual claim failed source audit: ${reasons.join('; ')}.`
            : 'The factual visual claim failed source audit.',
        ),
      ],
      ownerApprovalRequired: true,
      automatedPublicationAllowed: false,
      maxRenderedSurvivors: 2,
    };
  }

  const candidates: VisualGrammarCandidateV10[] = [];
  const seen = new Set<VisualGrammarV10>();
  const add = (
    grammar: VisualGrammarV10,
    priority: number,
    reason: string,
  ) => {
    if (seen.has(grammar)) return;
    seen.add(grammar);
    candidates.push(candidate(grammar, priority, reason));
  };

  if (signals.sameInputComparison) {
    add(
      'controlled_comparison',
      100,
      'The claim depends on preserving the same input and system while making the output difference visible.',
    );
  }

  if (signals.hasExactMetric) {
    add(
      'deterministic_technical_hybrid',
      96,
      'Exact metrics and comparison direction require deterministic geometry and approved labels.',
    );
  }

  if (signals.requiresTemporalSequence && !signals.hasExactMetric) {
    add(
      'causal_process_sequence',
      94,
      'The core claim is a bounded multi-state process whose cause and result must be visible in sequence.',
    );
  }

  if (signals.domainSceneNatural && signals.humanAgencyCentral) {
    add(
      'cinematic_domain_scene',
      92,
      'The story has a recognizable real-world domain and human agency that can carry context and consequence in one cinematic scene.',
    );
  } else if (
    signals.domainSceneNatural &&
    signals.explanatoryRole === 'uncertainty_announcement'
  ) {
    add(
      'cinematic_domain_scene',
      91,
      'A future-facing announcement is better expressed as a grounded editorial vision than as an unsupported technical diagram.',
    );
  }

  if (signals.physicalAnalogyNatural) {
    add(
      'one_to_one_physical_analogy',
      89,
      'A physical analogy is plausible, but it must pass an explicit source-to-object mapping gate before rendering.',
    );
  }

  if (signals.technicalStructureNatural) {
    add(
      'deterministic_technical_hybrid',
      86,
      'The claim includes architecture, access, routing or bounded system structure that benefits from deterministic composition.',
    );
  }

  if (signals.domainSceneNatural) {
    add(
      'cinematic_domain_scene',
      82,
      'The source contains concrete domain anchors that can prevent generic AI imagery.',
    );
  }

  if (candidates.length === 0) {
    add(
      'one_to_one_physical_analogy',
      70,
      'No stronger affordance is available; propose a physical analogy only if its mapping table passes.',
    );
    add(
      'cinematic_domain_scene',
      60,
      'Use a source-grounded domain scene as the safer alternative to an opaque abstract metaphor.',
    );
  }

  return {
    storyId: input.story.revision_item_id,
    signals,
    candidates: candidates
      .sort((left, right) => right.priority - left.priority)
      .slice(0, 3),
    ownerApprovalRequired: true,
    automatedPublicationAllowed: false,
    maxRenderedSurvivors: 2,
  };
}

export interface VisualMappingEntryV10 {
  sourceElement: string;
  visibleElement: string;
  visibleRole: 'context' | 'action' | 'outcome' | 'constraint';
}

export interface VisualDiagramNodeV10 {
  id: string;
  role: 'input' | 'system' | 'state' | 'output' | 'constraint';
}

export interface VisualDiagramEdgeV10 {
  from: string;
  to: string;
  relation: string;
}

export interface VisualPropositionV10 {
  id: string;
  grammar: VisualGrammarV10;
  coreClaim: string;
  contextAnchor: string;
  visibleAction: string;
  visibleOutcome: string;
  labels: string[];
  mappings: VisualMappingEntryV10[];
  semanticProps: Array<{ id: string; role: string }>;
  domainAnchors?: string[];
  invariants?: string[];
  visibleDifferences?: string[];
  states?: string[];
  diagramNodes?: VisualDiagramNodeV10[];
  diagramEdges?: VisualDiagramEdgeV10[];
  makesFactualAssertion?: boolean;
}

export type VisualPropositionIssueV10 =
  | 'missing_core_claim'
  | 'missing_context_anchor'
  | 'missing_visible_action'
  | 'missing_visible_outcome'
  | 'too_many_labels'
  | 'duplicate_labels'
  | 'incomplete_mapping'
  | 'unmapped_semantic_prop'
  | 'insufficient_domain_anchors'
  | 'comparison_invariants_missing'
  | 'comparison_difference_missing'
  | 'sequence_state_count_invalid'
  | 'diagram_nodes_missing'
  | 'diagram_edge_missing'
  | 'diagram_edge_endpoint_invalid'
  | 'fallback_contains_assertion';

export interface VisualPropositionGateV10 {
  passed: boolean;
  issues: VisualPropositionIssueV10[];
}

export function validateVisualPropositionV10(
  proposition: VisualPropositionV10,
): VisualPropositionGateV10 {
  const issues: VisualPropositionIssueV10[] = [];
  if (proposition.coreClaim.trim().length < 12) {
    issues.push('missing_core_claim');
  }
  if (
    proposition.grammar !== 'source_led_fallback' &&
    proposition.contextAnchor.trim().length < 8
  ) {
    issues.push('missing_context_anchor');
  }
  if (
    proposition.grammar !== 'source_led_fallback' &&
    proposition.visibleAction.trim().length < 8
  ) {
    issues.push('missing_visible_action');
  }
  if (
    proposition.grammar !== 'source_led_fallback' &&
    proposition.visibleOutcome.trim().length < 8
  ) {
    issues.push('missing_visible_outcome');
  }
  if (proposition.labels.length > 3) issues.push('too_many_labels');
  if (
    new Set(proposition.labels.map((value) => value.trim().toLowerCase())).size !==
    proposition.labels.length
  ) {
    issues.push('duplicate_labels');
  }

  if (proposition.grammar === 'one_to_one_physical_analogy') {
    const roles = new Set(proposition.mappings.map((entry) => entry.visibleRole));
    if (
      proposition.mappings.length < 3 ||
      !roles.has('context') ||
      !roles.has('action') ||
      !roles.has('outcome')
    ) {
      issues.push('incomplete_mapping');
    }
    const mappedIds = new Set(
      proposition.mappings.map((entry) => entry.visibleElement.trim().toLowerCase()),
    );
    if (
      proposition.semanticProps.some(
        (prop) => !mappedIds.has(prop.id.trim().toLowerCase()),
      )
    ) {
      issues.push('unmapped_semantic_prop');
    }
  }

  if (proposition.grammar === 'cinematic_domain_scene') {
    if ((proposition.domainAnchors ?? []).filter(Boolean).length < 2) {
      issues.push('insufficient_domain_anchors');
    }
  }

  if (proposition.grammar === 'controlled_comparison') {
    const invariants = proposition.invariants ?? [];
    if (
      !invariants.some((value) => /input|task|prompt/i.test(value)) ||
      !invariants.some((value) => /system|model|actor|environment/i.test(value))
    ) {
      issues.push('comparison_invariants_missing');
    }
    if ((proposition.visibleDifferences ?? []).length < 1) {
      issues.push('comparison_difference_missing');
    }
  }

  if (proposition.grammar === 'causal_process_sequence') {
    const count = proposition.states?.length ?? 0;
    if (count < 2 || count > 3) {
      issues.push('sequence_state_count_invalid');
    }
  }

  if (proposition.grammar === 'deterministic_technical_hybrid') {
    const nodes = proposition.diagramNodes ?? [];
    const edges = proposition.diagramEdges ?? [];
    if (nodes.length < 2) issues.push('diagram_nodes_missing');
    if (edges.length < 1) issues.push('diagram_edge_missing');
    const ids = new Set(nodes.map((node) => node.id));
    if (
      edges.some((edge) => !ids.has(edge.from) || !ids.has(edge.to))
    ) {
      issues.push('diagram_edge_endpoint_invalid');
    }
  }

  if (
    proposition.grammar === 'source_led_fallback' &&
    proposition.makesFactualAssertion
  ) {
    issues.push('fallback_contains_assertion');
  }

  return { passed: issues.length === 0, issues };
}
