import type { HoldoutStoryInput } from './visual-auto-claim';
import type { AutoVisualClaimV5 } from './visual-auto-claim-v5';
import type { VisualRouterDecisionV7 } from './visual-role-router-v7';

export const VISUAL_TREATMENTS_V7_2 = [
  'reuse_router_selection',
  'reported_consistency_signal',
  'reported_usage_signal',
  'human_behavior_split',
  'science_reasoning_flow',
  'source_led_fallback',
] as const;

export type VisualTreatmentV72 = (typeof VISUAL_TREATMENTS_V7_2)[number];

export interface VisualTreatmentDecisionV72 {
  treatment: VisualTreatmentV72;
  reason: string;
  selectedSource: 'current' | 'compiler';
  expectedImageCalls: 0 | 1 | 3;
  approvedLabels: string[];
  safetyMode: 'factual_visual' | 'reported_signal' | 'headline_only';
}

export interface VisualTreatmentInputV72 {
  story: HoldoutStoryInput;
  claim: AutoVisualClaimV5;
  eligible: boolean;
  router: VisualRouterDecisionV7;
}

function sourceText(input: VisualTreatmentInputV72): string {
  return [
    input.story.title,
    input.story.summary,
    input.story.why ?? '',
    input.story.practical ?? '',
    input.story.takeaway ?? '',
  ]
    .join(' ')
    .toLocaleLowerCase();
}

function containsAny(value: string, terms: readonly string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function reportedSignalTreatment(
  input: VisualTreatmentInputV72,
  source: string,
): VisualTreatmentDecisionV72 | null {
  const reported = containsAny(source, [
    'community',
    'users ',
    'reporting',
    'reported',
    'anecdotal',
    'critique',
    'debating',
    'discussion',
    'signals',
  ]);
  if (!reported) return null;

  const usageSignal =
    containsAny(source, ['token', 'context window', 'rate limit', 'usage']) &&
    containsAny(source, ['spend', 'consumption', 'threshold', 'limit', 'burn']);
  if (usageSignal) {
    return {
      treatment: 'reported_usage_signal',
      reason:
        'The source describes anecdotal usage signals rather than a confirmed threshold. A deterministic meter can show token burn approaching an explicitly uncertain boundary without inventing a cutoff.',
      selectedSource: 'compiler',
      expectedImageCalls: 0,
      approvedLabels: ['HIGH TOKEN BURN', 'REPORTED SIGNALS', 'MONITOR SPEND'],
      safetyMode: 'reported_signal',
    };
  }

  const consistencySignal = containsAny(source, [
    'consistency',
    'inconsisten',
    'reliability',
    'regression',
    'alternatives',
    'providers',
  ]);
  if (consistencySignal) {
    return {
      treatment: 'reported_consistency_signal',
      reason:
        'The source describes community observations about inconsistent results. Repeated-run variability and a cross-provider check communicate the report without asserting definitive model failure.',
      selectedSource: 'compiler',
      expectedImageCalls: 0,
      approvedLabels: [
        'COMMUNITY REPORTS',
        'INCONSISTENT RESULTS',
        'CROSS-PROVIDER TEST',
      ],
      safetyMode: 'reported_signal',
    };
  }
  return null;
}

export function selectVisualTreatmentV72(
  input: VisualTreatmentInputV72,
): VisualTreatmentDecisionV72 {
  const source = sourceText(input);

  if (!input.eligible) {
    const signal = reportedSignalTreatment(input, source);
    if (signal) return signal;
    return {
      treatment: 'source_led_fallback',
      reason:
        'The claim is not source-eligible and no bounded reported-signal treatment is supported. Preserve headline context without adding an explanatory assertion.',
      selectedSource: 'compiler',
      expectedImageCalls: 0,
      approvedLabels: [],
      safetyMode: 'headline_only',
    };
  }

  if (
    input.claim.semantics.explanatoryRole === 'causal_mechanism' &&
    input.claim.grammar.humanBehavior
  ) {
    return {
      treatment: 'human_behavior_split',
      reason:
        'The causal claim is about human behavior. Two continuity-matched actions must show passive cognitive offloading versus active problem solving with bounded AI assistance.',
      selectedSource: 'compiler',
      expectedImageCalls: 3,
      approvedLabels: ['OFFLOAD', 'SPARRING PARTNER', 'KEEP THINKING'],
      safetyMode: 'factual_visual',
    };
  }

  const scienceDomain = containsAny(source, [
    'immunolog',
    't-cell',
    'biological',
    'biology',
    'clinical',
    'protein',
    'genomic',
    'scientific research',
    'researchers leveraged',
  ]);
  if (
    input.claim.semantics.explanatoryRole === 'capability_access' &&
    scienceDomain
  ) {
    return {
      treatment: 'science_reasoning_flow',
      reason:
        'The capability is domain-specific scientific reasoning. The visual must show an AI model synthesizing biological datasets into an actionable T-cell hypothesis rather than generic technology icons.',
      selectedSource: 'compiler',
      expectedImageCalls: 0,
      approvedLabels: ['GPT-5', 'BIOLOGICAL DATA', 'T-CELL HYPOTHESIS'],
      safetyMode: 'factual_visual',
    };
  }

  return {
    treatment: 'reuse_router_selection',
    reason: 'The existing router-selected treatment already matches the source role.',
    selectedSource:
      input.router.pipeline === 'current_art_director' ? 'current' : 'compiler',
    expectedImageCalls: input.router.expectedImageCalls,
    approvedLabels: input.claim.claim.approvedLabels ?? [],
    safetyMode:
      input.router.pipeline === 'source_led_fallback'
        ? 'headline_only'
        : 'factual_visual',
  };
}
