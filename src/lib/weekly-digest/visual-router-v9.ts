import type { HoldoutStoryInput } from './visual-auto-claim';
import type { AutoVisualClaimV5 } from './visual-auto-claim-v5';
import {
  selectSourceVisualPipelineV7,
  type VisualPipelineV7,
  type VisualRouterDecisionV7,
} from './visual-role-router-v7';
import {
  selectSpecializedVisualTreatmentV8,
  type SpecializedVisualTreatmentV8,
} from './visual-specialized-v8';

export const VISUAL_PIPELINES_V9 = [
  'source_led_fallback',
  'current_art_director',
  'deterministic_compiler',
  'specialized_deterministic',
  'specialized_source_cinematic',
] as const;

export type VisualPipelineV9 = (typeof VISUAL_PIPELINES_V9)[number];

export interface VisualRouterInputV9 {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  eligible: boolean;
}

export interface VisualRouteDecisionV9 {
  storyId: string;
  pipeline: VisualPipelineV9;
  reason: string;
  expectedImageCalls: 0 | 1;
  sourceClaimEligible: boolean;
  specializedTreatment: SpecializedVisualTreatmentV8 | null;
  v7Decision: VisualRouterDecisionV7 | null;
  requiredGuards: string[];
}

function mapV7Pipeline(value: VisualPipelineV7): VisualPipelineV9 {
  switch (value) {
    case 'current_art_director':
      return 'current_art_director';
    case 'deterministic_compiler':
      return 'deterministic_compiler';
    case 'source_led_fallback':
      return 'source_led_fallback';
  }
}

export function routeVisualStoryV9(
  input: VisualRouterInputV9,
): VisualRouteDecisionV9 {
  const specializedTreatment = selectSpecializedVisualTreatmentV8(input);
  if (specializedTreatment) {
    const generated =
      specializedTreatment.renderMode === 'generated_source_cinematic';
    return {
      storyId: input.story.revision_item_id,
      pipeline: generated
        ? 'specialized_source_cinematic'
        : 'specialized_deterministic',
      reason: `A pre-registered source-grounded ${specializedTreatment.kind} treatment matches the approved story.`,
      expectedImageCalls: generated ? 1 : 0,
      sourceClaimEligible: input.eligible,
      specializedTreatment,
      v7Decision: null,
      requiredGuards: [
        'specialized treatment is selected from approved story text only',
        'all treatment forbidden implications remain hard blockers',
        'generated typography is forbidden',
        'only approved deterministic labels may be composited',
      ],
    };
  }

  const v7Decision = selectSourceVisualPipelineV7({
    claim: input.autoClaim,
    eligible: input.eligible,
  });
  return {
    storyId: input.story.revision_item_id,
    pipeline: mapV7Pipeline(v7Decision.pipeline),
    reason: v7Decision.reason,
    expectedImageCalls: v7Decision.expectedImageCalls,
    sourceClaimEligible: input.eligible,
    specializedTreatment: null,
    v7Decision,
    requiredGuards: [...v7Decision.requiredGuards],
  };
}

export function assertVisualRouteDecisionV9(
  input: VisualRouterInputV9,
  decision: VisualRouteDecisionV9,
): void {
  if (decision.storyId !== input.story.revision_item_id) {
    throw new Error('V9 visual route story ID does not match the approved story.');
  }
  if (
    decision.pipeline.startsWith('specialized_') &&
    !decision.specializedTreatment
  ) {
    throw new Error('Specialized v9 route is missing its treatment contract.');
  }
  if (
    !decision.pipeline.startsWith('specialized_') &&
    decision.specializedTreatment
  ) {
    throw new Error('Non-specialized v9 route unexpectedly contains a treatment.');
  }
  if (
    decision.pipeline === 'source_led_fallback' &&
    decision.expectedImageCalls !== 0
  ) {
    throw new Error('Source-led fallback must not invoke an image model.');
  }
  if (
    decision.pipeline === 'deterministic_compiler' &&
    decision.expectedImageCalls !== 0
  ) {
    throw new Error('Deterministic compiler route must not invoke an image model.');
  }
  if (
    decision.pipeline === 'specialized_deterministic' &&
    decision.expectedImageCalls !== 0
  ) {
    throw new Error('Specialized deterministic route must not invoke an image model.');
  }
  if (
    (decision.pipeline === 'current_art_director' ||
      decision.pipeline === 'specialized_source_cinematic') &&
    decision.expectedImageCalls !== 1
  ) {
    throw new Error('Generated visual route must reserve exactly one final image call.');
  }
  if (
    !input.eligible &&
    !decision.pipeline.startsWith('specialized_') &&
    decision.pipeline !== 'source_led_fallback'
  ) {
    throw new Error('An ineligible source claim escaped the safe fallback.');
  }
}
