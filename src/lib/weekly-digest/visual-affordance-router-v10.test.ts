import { describe, expect, it } from 'vitest';
import type { HoldoutStoryInput } from './visual-auto-claim';
import type {
  AutoVisualClaimV5,
  VisualCertainty,
  VisualExplanatoryRole,
  VisualMappingMode,
} from './visual-auto-claim-v5';
import {
  planVisualAffordancesV10,
  validateVisualPropositionV10,
  type VisualPropositionV10,
} from './visual-affordance-router-v10';
import {
  OWNER_VISUAL_CALIBRATION_V10,
  summarizeOwnerCalibrationV10,
} from './visual-owner-calibration-v10';

function story(input: {
  title: string;
  summary: string;
  why?: string;
  practical?: string;
  takeaway?: string;
  id?: string;
}): HoldoutStoryInput {
  return {
    week_start: '2026-06-22',
    week_end: '2026-06-28',
    rank: 1,
    revision_item_id: input.id ?? 'story-id',
    title: input.title,
    summary: input.summary,
    why: input.why ?? null,
    practical: input.practical ?? null,
    takeaway: input.takeaway ?? null,
  };
}

function claim(input: {
  role: VisualExplanatoryRole;
  certainty?: VisualCertainty;
  mapping?: VisualMappingMode;
  metric?: boolean;
  humanBehavior?: boolean;
}): AutoVisualClaimV5 {
  return {
    storyId: 'story-id',
    semantics: {
      explanatoryRole: input.role,
      certainty: input.certainty ?? 'observed',
      mappingMode: input.mapping ?? 'literal',
      visualDriver: 'one source-grounded visible action',
      metric: input.metric
        ? {
            direction: 'decrease',
            comparisonTarget: 'uncached baseline',
            baselineLabel: 'repeated input',
            resultLabel: 'cached input',
          }
        : null,
      requiredVisibleDelta: '',
      sourceGuardTerms: [],
    },
    claim: {
      identity: 'approved system',
      change: 'changes one bounded workflow',
      mechanism: 'a visible process acts on the input',
      primaryOutcome: 'one visible result follows',
      coreClaim: 'one bounded source-grounded core claim',
      primaryEvidence: 'physical_action',
      outcomeKind: 'benefit',
      approvedLabels: [],
      quantitativeFacts: input.metric
        ? [{ label: 'reduction', value: '90%' }]
        : [],
      forbiddenContradictions: [],
    },
    grammar: {
      humanBehavior: input.humanBehavior ?? false,
    },
  } as unknown as AutoVisualClaimV5;
}

function primary(input: {
  source: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  eligible?: boolean;
}) {
  return planVisualAffordancesV10({
    story: input.source,
    autoClaim: input.autoClaim,
    eligible: input.eligible ?? true,
  }).candidates[0]?.grammar;
}

describe('owner visual calibration v10', () => {
  it('records all nine owner-reviewed cases with bounded references', () => {
    const summary = summarizeOwnerCalibrationV10();
    expect(summary).toEqual({
      total: 9,
      strongApprove: 2,
      acceptable: 1,
      localRepair: 2,
      majorRework: 1,
      rejected: 3,
      positiveReferences: 3,
    });
    expect(new Set(OWNER_VISUAL_CALIBRATION_V10.map((entry) => entry.id)).size).toBe(9);
  });
});

describe('visual affordance router v10', () => {
  it('routes a scientific collaboration to a cinematic domain scene', () => {
    expect(
      primary({
        source: story({
          title: 'GPT-5 aids immunologists in solving a T-cell mystery',
          summary:
            'Researchers in an immunology laboratory synthesize biological datasets into an actionable hypothesis.',
        }),
        autoClaim: claim({ role: 'capability_access', humanBehavior: true }),
      }),
    ).toBe('cinematic_domain_scene');
  });

  it('routes a future platform vision to a cinematic editorial scene instead of a sterile chart', () => {
    expect(
      primary({
        source: story({
          title: 'Leveraging an AI platform beyond standard chatbot integrations',
          summary:
            'The company presents a broader platform vision and future expansion beyond a single chatbot.',
        }),
        autoClaim: claim({
          role: 'uncertainty_announcement',
          certainty: 'expected',
        }),
      }),
    ).toBe('cinematic_domain_scene');
  });

  it('routes strict fit and blocking to a mapping-gated physical analogy', () => {
    expect(
      primary({
        source: story({
          title: 'Strict tool calling schemas reject malformed calls',
          summary:
            'A strict schema allows only precisely fitting calls and blocks malformed requests before execution.',
        }),
        autoClaim: claim({
          role: 'policy_control',
          mapping: 'editorial_analogy',
        }),
      }),
    ).toBe('one_to_one_physical_analogy');
  });

  it('routes fuzzing and repair loops to a causal process sequence', () => {
    expect(
      primary({
        source: story({
          title: 'Agentic fuzzing and property testing',
          summary:
            'The workflow generates adversarial tests, finds a failure, repairs the code and retests it.',
        }),
        autoClaim: claim({ role: 'causal_mechanism' }),
      }),
    ).toBe('causal_process_sequence');
  });

  it('routes exact caching savings to a deterministic technical hybrid', () => {
    expect(
      primary({
        source: story({
          title: 'Token caching reduces repeated model costs',
          summary:
            'Caching recurring prompt context reduces repeated processing by up to 90%.',
        }),
        autoClaim: claim({ role: 'quantitative_result', metric: true }),
      }),
    ).toBe('deterministic_technical_hybrid');
  });

  it('routes optical compression to a mapping-gated analogy when no exact metric dominates', () => {
    expect(
      primary({
        source: story({
          title: 'Optical context compression',
          summary:
            'An optical compression process makes a large context compact while preserving visible information.',
        }),
        autoClaim: claim({
          role: 'causal_mechanism',
          mapping: 'editorial_analogy',
        }),
      }),
    ).toBe('one_to_one_physical_analogy');
  });

  it('routes high-volume sessions with checkpoints and monitoring to a process sequence', () => {
    expect(
      primary({
        source: story({
          title: 'Claude usage thresholds in high-volume sessions',
          summary:
            'Teams should cache stable context, split long sessions and monitor token burn before interruption.',
        }),
        autoClaim: claim({ role: 'causal_mechanism' }),
      }),
    ).toBe('causal_process_sequence');
  });

  it('routes active deep work and bounded assistance to a cinematic domain scene', () => {
    expect(
      primary({
        source: story({
          title: 'Managing AI-driven distraction and rediscovering deep work',
          summary:
            'A person keeps active problem-solving while an AI sparring partner offers one bounded hint.',
        }),
        autoClaim: claim({ role: 'causal_mechanism', humanBehavior: true }),
      }),
    ).toBe('cinematic_domain_scene');
  });

  it('routes one repeated task and divergent outputs to a controlled comparison', () => {
    expect(
      primary({
        source: story({
          title: 'Model performance consistency debate',
          summary:
            'The same coding task is repeated through the same model but produces different outputs across runs.',
        }),
        autoClaim: claim({ role: 'causal_mechanism' }),
      }),
    ).toBe('controlled_comparison');
  });

  it('fails closed when the source claim is ineligible', () => {
    const plan = planVisualAffordancesV10({
      story: story({
        title: 'Unsupported announcement',
        summary: 'The source does not support a factual explanatory visual.',
      }),
      autoClaim: claim({ role: 'uncertainty_announcement' }),
      eligible: false,
      ineligibilityReasons: ['certainty not supported'],
    });
    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0]?.grammar).toBe('source_led_fallback');
    expect(plan.automatedPublicationAllowed).toBe(false);
    expect(plan.ownerApprovalRequired).toBe(true);
  });
});

describe('visual proposition mapping gate v10', () => {
  it('accepts a complete key-and-lock analogy', () => {
    const proposition: VisualPropositionV10 = {
      id: 'key-lock',
      grammar: 'one_to_one_physical_analogy',
      coreClaim: 'A strict schema rejects malformed tool calls before execution.',
      contextAnchor: 'A precision lock represents the strict schema boundary.',
      visibleAction: 'A malformed key visibly fails to enter the lock.',
      visibleOutcome: 'The blocked mechanism remains stopped before execution.',
      labels: [],
      mappings: [
        {
          sourceElement: 'strict schema',
          visibleElement: 'precision-lock',
          visibleRole: 'context',
        },
        {
          sourceElement: 'malformed call',
          visibleElement: 'wrong-key',
          visibleRole: 'action',
        },
        {
          sourceElement: 'pre-execution rejection',
          visibleElement: 'stopped-bolt',
          visibleRole: 'outcome',
        },
      ],
      semanticProps: [
        { id: 'precision-lock', role: 'schema' },
        { id: 'wrong-key', role: 'tool call' },
        { id: 'stopped-bolt', role: 'rejection' },
      ],
    };
    expect(validateVisualPropositionV10(proposition)).toEqual({
      passed: true,
      issues: [],
    });
  });

  it('rejects a sewing-machine analogy with unmapped fabric and no visible outcome', () => {
    const proposition: VisualPropositionV10 = {
      id: 'sewing',
      grammar: 'one_to_one_physical_analogy',
      coreClaim: 'Strict schemas constrain tool calls.',
      contextAnchor: 'A sewing machine stands in a room.',
      visibleAction: 'A person pushes fabric under a needle.',
      visibleOutcome: '',
      labels: ['STRICT TOOL CALLING'],
      mappings: [
        {
          sourceElement: 'tool call',
          visibleElement: 'needle',
          visibleRole: 'action',
        },
      ],
      semanticProps: [
        { id: 'needle', role: 'tool call' },
        { id: 'fabric', role: 'unmapped decoration' },
      ],
    };
    const result = validateVisualPropositionV10(proposition);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('missing_visible_outcome');
    expect(result.issues).toContain('incomplete_mapping');
    expect(result.issues).toContain('unmapped_semantic_prop');
  });

  it('rejects a comparison that does not preserve one input and one system', () => {
    const proposition: VisualPropositionV10 = {
      id: 'ambiguous-comparison',
      grammar: 'controlled_comparison',
      coreClaim: 'The same task produces different outputs across repeated runs.',
      contextAnchor: 'A coding task enters a model.',
      visibleAction: 'Two runs produce output traces.',
      visibleOutcome: 'The outputs visibly differ.',
      labels: ['SAME TASK', 'RUN A', 'RUN B'],
      mappings: [],
      semanticProps: [],
      invariants: ['same task'],
      visibleDifferences: ['different output artifacts'],
    };
    const result = validateVisualPropositionV10(proposition);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('comparison_invariants_missing');
  });
});
