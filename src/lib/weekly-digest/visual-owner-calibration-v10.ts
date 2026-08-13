export const OWNER_VISUAL_REASON_TAGS_V10 = [
  'production_ready',
  'domain_context_success',
  'strong_intuitive_analogy',
  'weak_context',
  'generic_diagram',
  'ambiguous_diagram',
  'weak_visual_thesis',
  'labels_help_but_do_not_rescue',
  'labels_carry_claim',
  'broken_arrow',
  'disconnected_prop',
  'anatomy_error',
  'unclear_causal_source',
  'good_concept_bad_execution',
  'local_repair',
  'major_rework',
] as const;

export type OwnerVisualReasonTagV10 =
  (typeof OWNER_VISUAL_REASON_TAGS_V10)[number];

export const VISUAL_GRAMMARS_V10 = [
  'cinematic_domain_scene',
  'one_to_one_physical_analogy',
  'controlled_comparison',
  'causal_process_sequence',
  'deterministic_technical_hybrid',
  'source_led_fallback',
] as const;

export type VisualGrammarV10 = (typeof VISUAL_GRAMMARS_V10)[number];

export type OwnerVisualPreferenceV10 =
  | 'current'
  | 'compiler'
  | 'v8'
  | 'none';

export type OwnerVisualReadinessV10 =
  | 'strong_approve'
  | 'acceptable'
  | 'local_repair'
  | 'major_rework'
  | 'reject';

export interface OwnerVisualCalibrationCaseV10 {
  id: string;
  headline: string;
  expectedGrammar: VisualGrammarV10;
  preferred: OwnerVisualPreferenceV10;
  readiness: OwnerVisualReadinessV10;
  positiveReference: boolean;
  reasonTags: OwnerVisualReasonTagV10[];
  ownerNote: string;
}

/**
 * Human ground truth from the first nine owner-reviewed current/V7/V8 pairs.
 * These records are calibration fixtures, not story-ID routing exceptions.
 */
export const OWNER_VISUAL_CALIBRATION_V10: readonly OwnerVisualCalibrationCaseV10[] = [
  {
    id: 'anthropic-strict-tool-schemas',
    headline: 'Why frontier Anthropic models are performing worse on strict tool calling schemas',
    expectedGrammar: 'one_to_one_physical_analogy',
    preferred: 'current',
    readiness: 'acceptable',
    positiveReference: true,
    reasonTags: ['strong_intuitive_analogy'],
    ownerNote:
      'The key and lock analogy is not perfect, but it communicates strict fit and rejection much more intuitively than the sewing-machine treatment.',
  },
  {
    id: 'mistral-platform-vision',
    headline: 'Leveraging the Mistral AI Platform Beyond Standard Chatbot Integrations',
    expectedGrammar: 'cinematic_domain_scene',
    preferred: 'current',
    readiness: 'strong_approve',
    positiveReference: true,
    reasonTags: ['production_ready', 'domain_context_success'],
    ownerNote:
      'The cinematic scene communicates scale, transformation and vision; the deterministic chart is sterile and unsuccessful.',
  },
  {
    id: 'agentic-fuzzing-property-testing',
    headline: 'Agentic testing playbook: How fuzzing and property testing empower autonomous coding',
    expectedGrammar: 'causal_process_sequence',
    preferred: 'none',
    readiness: 'reject',
    positiveReference: false,
    reasonTags: [
      'weak_visual_thesis',
      'labels_help_but_do_not_rescue',
      'weak_context',
    ],
    ownerNote:
      'Both factory metaphors are weak and generic. Tags help interpretation slightly, but the pixels do not show test generation, failure discovery, repair and retest.',
  },
  {
    id: 'token-caching-cost-reduction',
    headline: 'Optimizing Token Caching to Avoid Unexpected Large Language Model Costs',
    expectedGrammar: 'deterministic_technical_hybrid',
    preferred: 'compiler',
    readiness: 'local_repair',
    positiveReference: false,
    reasonTags: ['good_concept_bad_execution', 'broken_arrow', 'local_repair'],
    ownerNote:
      'The technical comparison is the right format, but the broken arrow is a hard production defect that should be repaired without changing the concept.',
  },
  {
    id: 'optical-context-compression',
    headline: 'Cutting Claude Code Token Costs with Optical Context Compression',
    expectedGrammar: 'one_to_one_physical_analogy',
    preferred: 'current',
    readiness: 'local_repair',
    positiveReference: false,
    reasonTags: ['good_concept_bad_execution', 'disconnected_prop', 'local_repair'],
    ownerNote:
      'The press and magnifier idea has potential, but the magnifier is disconnected and reveals nothing, so the visual sentence is incomplete.',
  },
  {
    id: 'gpt5-tcell-discovery',
    headline: 'GPT-5 Aids Immunologists in Solving T-Cell Mystery',
    expectedGrammar: 'cinematic_domain_scene',
    preferred: 'v8',
    readiness: 'strong_approve',
    positiveReference: true,
    reasonTags: ['production_ready', 'domain_context_success'],
    ownerNote:
      'The laboratory, researchers, biological data and visible convergence into an insight communicate the context and vision successfully.',
  },
  {
    id: 'claude-usage-thresholds',
    headline: 'Claude Usage Thresholds: Insights from High-Volume Token Consumption',
    expectedGrammar: 'causal_process_sequence',
    preferred: 'none',
    readiness: 'reject',
    positiveReference: false,
    reasonTags: [
      'generic_diagram',
      'ambiguous_diagram',
      'weak_visual_thesis',
      'labels_carry_claim',
    ],
    ownerNote:
      'Neither the blacksmith nor the abstract threshold chart communicates the operational value. Show an uncontrolled session becoming cached, split and monitored bounded continuations.',
  },
  {
    id: 'deep-work-bounded-assistance',
    headline: 'Managing AI-Driven Distraction and Rediscovering Deep Work',
    expectedGrammar: 'cinematic_domain_scene',
    preferred: 'v8',
    readiness: 'major_rework',
    positiveReference: false,
    reasonTags: [
      'good_concept_bad_execution',
      'anatomy_error',
      'unclear_causal_source',
      'major_rework',
    ],
    ownerNote:
      'Bounded assistance is the right idea, but the extra hand, off-screen laser source and unclear mechanical meaning make the scene unusable.',
  },
  {
    id: 'gemini-output-consistency',
    headline: 'Gemini faces community critique regarding model performance consistency',
    expectedGrammar: 'controlled_comparison',
    preferred: 'none',
    readiness: 'reject',
    positiveReference: false,
    reasonTags: [
      'ambiguous_diagram',
      'weak_visual_thesis',
      'labels_carry_claim',
    ],
    ownerNote:
      'The comparison must preserve one identical task and one identical model, then show two visibly different code artifacts. Two line charts do not prove inconsistency.',
  },
] as const;

export function ownerCalibrationCaseV10(
  id: string,
): OwnerVisualCalibrationCaseV10 | undefined {
  return OWNER_VISUAL_CALIBRATION_V10.find((entry) => entry.id === id);
}

export function summarizeOwnerCalibrationV10(): {
  total: number;
  strongApprove: number;
  acceptable: number;
  localRepair: number;
  majorRework: number;
  rejected: number;
  positiveReferences: number;
} {
  return {
    total: OWNER_VISUAL_CALIBRATION_V10.length,
    strongApprove: OWNER_VISUAL_CALIBRATION_V10.filter(
      (entry) => entry.readiness === 'strong_approve',
    ).length,
    acceptable: OWNER_VISUAL_CALIBRATION_V10.filter(
      (entry) => entry.readiness === 'acceptable',
    ).length,
    localRepair: OWNER_VISUAL_CALIBRATION_V10.filter(
      (entry) => entry.readiness === 'local_repair',
    ).length,
    majorRework: OWNER_VISUAL_CALIBRATION_V10.filter(
      (entry) => entry.readiness === 'major_rework',
    ).length,
    rejected: OWNER_VISUAL_CALIBRATION_V10.filter(
      (entry) => entry.readiness === 'reject',
    ).length,
    positiveReferences: OWNER_VISUAL_CALIBRATION_V10.filter(
      (entry) => entry.positiveReference,
    ).length,
  };
}
