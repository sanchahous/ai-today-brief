import {
  WEEKLY_VISUAL_POLICY,
  type VisualPlan,
} from './visual-compiler';

export const VISUAL_RENDER_MODES = [
  'deterministic_vector',
  'generated_single',
  'generated_reference_sequence',
  'generated_action_pair',
  'generated_identity_action_pair',
] as const;

export type VisualRenderMode = (typeof VISUAL_RENDER_MODES)[number];

export interface VisualRenderPolicyDecision {
  mode: VisualRenderMode;
  imageCalls: number;
  visionCalls: number;
  estimatedCostUsd: number;
  withinBudget: boolean;
  reason: string;
}

export interface VisualRenderCostAssumptions {
  imageCallUsd: number;
  visionCallUsd: number;
}

export const DEFAULT_VISUAL_RENDER_COSTS: VisualRenderCostAssumptions = {
  imageCallUsd: 0.015,
  visionCallUsd: 0.01,
};

function isHumanBehaviorClaim(plan: VisualPlan): boolean {
  const text = [
    plan.claim.identity,
    plan.claim.change,
    plan.claim.mechanism,
    plan.claim.primaryOutcome,
  ]
    .join(' ')
    .toLowerCase();
  return /\b(student|learner|tutor|teacher|person|people|human|child|developer|researcher|hands?|assistan(?:t|ce))\b/.test(
    text,
  );
}

export function selectVisualRenderMode(plan: VisualPlan): VisualRenderMode {
  switch (plan.format) {
    case 'cinematic_data_contrast':
    case 'cinematic_cutaway':
    case 'cinematic_routing':
      return 'deterministic_vector';
    case 'cinematic_sequence':
      return 'generated_reference_sequence';
    case 'cinematic_split':
      return isHumanBehaviorClaim(plan)
        ? 'generated_identity_action_pair'
        : 'generated_action_pair';
    case 'cinematic_single':
      return 'generated_single';
  }
}

function imageCallsFor(mode: VisualRenderMode, plan: VisualPlan): number {
  switch (mode) {
    case 'deterministic_vector':
      return 0;
    case 'generated_single':
      return 2;
    case 'generated_reference_sequence':
      return Math.max(1, plan.regions.length);
    case 'generated_action_pair':
      return 2;
    case 'generated_identity_action_pair':
      return 3;
  }
}

function reasonFor(mode: VisualRenderMode): string {
  switch (mode) {
    case 'deterministic_vector':
      return 'Exact architecture, routing, quantities and typography are safer as deterministic cinematic geometry than generated UI.';
    case 'generated_single':
      return 'A single physical cause-and-effect scene benefits from generative editorial craft.';
    case 'generated_reference_sequence':
      return 'Temporal meaning requires continuity-matched states of the same subject.';
    case 'generated_action_pair':
      return 'The comparison needs two physically different actions with shared visual language.';
    case 'generated_identity_action_pair':
      return 'Human behavior needs a neutral identity reference before generating opposite actions; otherwise reference conditioning copies the same behavior to both sides.';
  }
}

export function decideVisualRenderPolicy(
  plan: VisualPlan,
  costs: VisualRenderCostAssumptions = DEFAULT_VISUAL_RENDER_COSTS,
): VisualRenderPolicyDecision {
  const mode = selectVisualRenderMode(plan);
  const imageCalls = imageCallsFor(mode, plan);
  const visionCalls = WEEKLY_VISUAL_POLICY.budget.maxVisionCalls;
  const estimatedCostUsd = imageCalls * costs.imageCallUsd + visionCalls * costs.visionCallUsd;
  return {
    mode,
    imageCalls,
    visionCalls,
    estimatedCostUsd,
    withinBudget: estimatedCostUsd <= WEEKLY_VISUAL_POLICY.budget.maxUsd,
    reason: reasonFor(mode),
  };
}
