import type {
  AutoVisualClaimV5,
  VisualExplanatoryRole,
} from './visual-auto-claim-v5';

export const VISUAL_PIPELINES_V7 = [
  'current_art_director',
  'deterministic_compiler',
  'source_led_fallback',
] as const;

export type VisualPipelineV7 = (typeof VISUAL_PIPELINES_V7)[number];

export interface VisualRouterDecisionV7 {
  storyId: string;
  role: VisualExplanatoryRole;
  pipeline: VisualPipelineV7;
  reason: string;
  expectedImageCalls: 0 | 1;
  requiredGuards: string[];
}

export interface SourceVisualRouterInputV7 {
  claim: AutoVisualClaimV5;
  eligible: boolean;
  ineligibilityReasons?: readonly string[];
}

const CURRENT_PIPELINE_ROLES = new Set<VisualExplanatoryRole>([
  'causal_mechanism',
  'state_transition',
  'policy_control',
  'uncertainty_announcement',
]);

const DETERMINISTIC_PIPELINE_ROLES = new Set<VisualExplanatoryRole>([
  'architecture_transformation',
  'quantitative_result',
  'benchmark_comparison',
  'capability_access',
]);

export function selectVisualPipelineV7(
  value: AutoVisualClaimV5,
): VisualRouterDecisionV7 {
  const role = value.semantics.explanatoryRole;
  if (DETERMINISTIC_PIPELINE_ROLES.has(role)) {
    return {
      storyId: value.storyId,
      role,
      pipeline: 'deterministic_compiler',
      reason:
        'This role depends on exact labels, comparison direction, architecture or access geometry that deterministic rendering preserves more reliably than generated pixels.',
      expectedImageCalls: 0,
      requiredGuards: [
        'source_claim_gate',
        'exact_overlay_gate',
        'certainty_gate',
        'thumbnail_gate',
      ],
    };
  }
  if (CURRENT_PIPELINE_ROLES.has(role)) {
    return {
      storyId: value.storyId,
      role,
      pipeline: 'current_art_director',
      reason:
        'This role requires a concrete physical situation, causal action, human state or future-facing editorial metaphor that the current art director communicates more naturally.',
      expectedImageCalls: 1,
      requiredGuards: [
        'source_claim_gate',
        'generated_text_gate',
        'certainty_gate',
        'headline_pair_gate',
      ],
    };
  }
  return {
    storyId: value.storyId,
    role,
    pipeline: value.grammar.humanBehavior
      ? 'current_art_director'
      : 'deterministic_compiler',
    reason: value.grammar.humanBehavior
      ? 'Unknown human-behavior role defaults to the current art director.'
      : 'Unknown non-human role defaults to deterministic rendering.',
    expectedImageCalls: value.grammar.humanBehavior ? 1 : 0,
    requiredGuards: [
      'source_claim_gate',
      'certainty_gate',
      'manual_shadow_review',
    ],
  };
}

export function selectSourceVisualPipelineV7(
  input: SourceVisualRouterInputV7,
): VisualRouterDecisionV7 {
  if (input.eligible) return selectVisualPipelineV7(input.claim);

  const reasons = (input.ineligibilityReasons ?? [])
    .map((reason) => reason.trim())
    .filter(Boolean)
    .slice(0, 3);
  return {
    storyId: input.claim.storyId,
    role: input.claim.semantics.explanatoryRole,
    pipeline: 'source_led_fallback',
    reason:
      reasons.length > 0
        ? `The explanatory claim failed the source gate (${reasons.join('; ')}), so the card must preserve only approved source identity and headline context.`
        : 'The explanatory claim failed the source gate, so the card must preserve only approved source identity and headline context.',
    expectedImageCalls: 0,
    requiredGuards: [
      'approved_headline_only',
      'no_explanatory_assertion',
      'no_unapproved_metric',
      'no_certainty_upgrade',
      'no_generated_text',
    ],
  };
}

export function summarizeVisualRouterV7(
  values: readonly AutoVisualClaimV5[],
): {
  decisions: VisualRouterDecisionV7[];
  currentStories: number;
  deterministicStories: number;
  expectedImageCalls: number;
} {
  const decisions = values.map(selectVisualPipelineV7);
  return {
    decisions,
    currentStories: decisions.filter(
      (decision) => decision.pipeline === 'current_art_director',
    ).length,
    deterministicStories: decisions.filter(
      (decision) => decision.pipeline === 'deterministic_compiler',
    ).length,
    expectedImageCalls: decisions.reduce(
      (sum, decision) => sum + decision.expectedImageCalls,
      0,
    ),
  };
}

export function summarizeSourceVisualRouterV7(
  values: readonly SourceVisualRouterInputV7[],
): {
  decisions: VisualRouterDecisionV7[];
  currentStories: number;
  deterministicStories: number;
  fallbackStories: number;
  expectedImageCalls: number;
} {
  const decisions = values.map(selectSourceVisualPipelineV7);
  return {
    decisions,
    currentStories: decisions.filter(
      (decision) => decision.pipeline === 'current_art_director',
    ).length,
    deterministicStories: decisions.filter(
      (decision) => decision.pipeline === 'deterministic_compiler',
    ).length,
    fallbackStories: decisions.filter(
      (decision) => decision.pipeline === 'source_led_fallback',
    ).length,
    expectedImageCalls: decisions.reduce(
      (sum, decision) => sum + decision.expectedImageCalls,
      0,
    ),
  };
}
