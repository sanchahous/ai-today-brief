import { describe, expect, it } from 'vitest';
import {
  WEEKLY_VISUAL_POLICY,
  chooseVisualRepair,
  compileVisualPlan,
  evaluateFinalGate,
  evaluatePixelGate,
  formatSupportsEvidence,
  normalizeApprovedLabels,
  rankVisualCandidate,
  selectVisualFormat,
  validateVisualPlan,
  weightedVisualScore,
  type FinalGateEvidence,
  type VisualClaim,
} from './visual-compiler';

function energyClaim(): VisualClaim {
  return {
    storyId: 'energy-600x',
    identity: 'a single chat request and a long-running coding-agent loop',
    change: 'the agent loop repeatedly rereads the same large context',
    mechanism: 'completed context blocks cycle back through the compute path on every agent step',
    primaryOutcome: 'the repeated loop creates a dramatically larger heat and power footprint',
    coreClaim:
      'context rereading makes an agentic coding session far more energy intensive than one chat exchange',
    primaryEvidence: 'quantitative_difference',
    outcomeKind: 'harm',
    comparison: {
      left: 'one small chat request passes through compute once',
      right: 'one coding-agent session loops the same context blocks through compute many times',
    },
    quantitativeFacts: [
      { label: 'CHAT', value: '1×' },
      { label: 'AGENT LOOP', value: '600×' },
      { label: 'CONTEXT RE-READS', value: '96%' },
    ],
    forbiddenContradictions: ['the chat path consumes more power than the agent loop'],
  };
}

function museClaim(): VisualClaim {
  return {
    storyId: 'muse-resume',
    identity: 'the same autonomous tool arm working on one GPU-kernel groove',
    change: 'an interruption stops the arm before the groove is complete',
    mechanism:
      'a persistent event marker returns the same arm to the exact interrupted coordinate',
    primaryOutcome:
      'the arm resumes the unfinished groove without restarting the completed work',
    coreClaim:
      'a replayable event log lets a long autonomous coding run resume from the exact interruption point',
    primaryEvidence: 'temporal_change',
    outcomeKind: 'benefit',
    states: ['RUN', 'CRASH', 'RESUME'],
    approvedLabels: ['RUN', 'CRASH', 'RESUME'],
    forbiddenContradictions: [
      'the resumed arm starts a different groove',
      'a human manually restarts the arm',
    ],
  };
}

function kitesurfClaim(): VisualClaim {
  return {
    storyId: 'kitesurf-browser',
    identity: 'a full browser stack beside a compact agent-facing browser core',
    change: 'human-facing tabs and high-fidelity rendering layers are removed',
    mechanism:
      'the removable outer browser layers separate while the web-execution core stays active',
    primaryOutcome: 'the remaining core fits a smaller compute footprint for agent automation',
    coreClaim:
      'removing human-facing browser layers leaves a smaller browser core optimized for agents',
    primaryEvidence: 'architecture_change',
    outcomeKind: 'tradeoff',
    layers: ['FULL BROWSER', 'HUMAN-FACING LAYERS', 'AGENT CORE'],
    approvedLabels: ['FULL BROWSER', 'AGENT CORE', 'LESS CPU + MEMORY'],
    forbiddenContradictions: [
      'the compact core is inactive',
      'the removed layers remain attached',
    ],
  };
}

function qwenRoutingClaim(): VisualClaim {
  return {
    storyId: 'qwen-local-routing',
    identity: 'one local coding-agent router connected to two distinct local model engines',
    change: 'each task is sent to the local model specialized for that kind of work',
    mechanism:
      'code review branches to the dense model while shell and git tasks branch to the MoE model',
    primaryOutcome:
      'accurate code work and fast system actions complete without sending either route to the cloud',
    coreClaim:
      'pairing two specialized local models can replace one cloud model for a coding-agent workflow',
    primaryEvidence: 'task_routing',
    outcomeKind: 'benefit',
    routing: {
      source: 'a local task classifier at the center of the coding-agent workflow',
      branches: [
        {
          label: 'DENSE • CODE',
          destination: 'a dense local model engine',
          visibleOutcome: 'precise code review and code edits',
        },
        {
          label: 'MOE • SHELL',
          destination: 'a sparse MoE local model engine',
          visibleOutcome: 'fast git, shell and system actions',
        },
      ],
    },
    approvedLabels: ['LOCAL ROUTER', 'DENSE • CODE', 'MOE • SHELL'],
    forbiddenContradictions: [
      'both task types go to the same model',
      'either route visibly exits to a cloud service',
    ],
  };
}

function tutorClaim(): VisualClaim {
  return {
    storyId: 'tutor-restraint',
    identity: 'the same student and tutoring assistant in two matched learning situations',
    change:
      'evaluation awareness changes the assistant from constant intervention to deliberate restraint',
    mechanism:
      'the default assistant repeatedly moves the student’s blocks while the evaluated assistant keeps its hands back unless collapse is imminent',
    primaryOutcome:
      'the evaluated student performs the task independently with only minimal safety intervention',
    coreClaim:
      'telling a tutoring model it is being evaluated makes it help less and preserve the learner’s agency',
    primaryEvidence: 'counterfactual_comparison',
    outcomeKind: 'benefit',
    comparison: {
      left: 'default assistant constantly rearranges blocks while the student becomes passive',
      right:
        'evaluation-aware assistant keeps both hands back while the student builds independently',
    },
    quantitativeFacts: [
      { label: 'DEFAULT', value: '0.182' },
      { label: 'EVALUATION', value: '0.458' },
    ],
    approvedLabels: ['HELP LESS'],
    forbiddenContradictions: [
      'the evaluated assistant actively builds the tower',
      'both sides show the same level of intervention',
    ],
  };
}

function sampleClaims(): VisualClaim[] {
  return [energyClaim(), museClaim(), kitesurfClaim(), qwenRoutingClaim(), tutorClaim()];
}

function passingEvidence(overrides: Partial<FinalGateEvidence> = {}): FinalGateEvidence {
  return {
    identityVisible: true,
    mechanismVisible: true,
    outcomeVisible: true,
    causalRelationVisible: true,
    contradictoryAction: false,
    generatedTextPresent: false,
    subjectConsistent: true,
    labelsApprovedAndExact: true,
    overlaysSupportedByPixels: true,
    headlineImagePairUnderstood: true,
    thumbnailReadable: true,
    ...overrides,
  };
}

describe('weekly visual compiler routing', () => {
  it.each([
    [energyClaim(), 'cinematic_data_contrast'],
    [museClaim(), 'cinematic_sequence'],
    [kitesurfClaim(), 'cinematic_cutaway'],
    [qwenRoutingClaim(), 'cinematic_routing'],
    [tutorClaim(), 'cinematic_split'],
  ] as const)('routes %s to %s', (claim, expectedFormat) => {
    expect(selectVisualFormat(claim)).toBe(expectedFormat);
    expect(compileVisualPlan(claim).format).toBe(expectedFormat);
  });

  it('ignores an owner preference that cannot show the required evidence', () => {
    const claim = { ...museClaim(), preferredFormat: 'cinematic_single' as const };
    expect(formatSupportsEvidence('cinematic_single', claim.primaryEvidence)).toBe(false);
    expect(selectVisualFormat(claim)).toBe('cinematic_sequence');
  });

  it('accepts a compatible owner preference', () => {
    const claim = { ...tutorClaim(), preferredFormat: 'cinematic_split' as const };
    expect(selectVisualFormat(claim)).toBe('cinematic_split');
  });
});

describe('compiled plans', () => {
  it('builds a three-state, continuity-matched sequence for crash recovery', () => {
    const plan = compileVisualPlan(museClaim());

    expect(plan.regions.map((region) => region.id)).toEqual([
      'state-1',
      'state-2',
      'state-3',
    ]);
    expect(plan.transitions).toEqual([
      { from: 'state-1', to: 'state-2', type: 'state_change' },
      { from: 'state-2', to: 'state-3', type: 'state_change' },
    ]);
    expect(plan.renderUnits).toHaveLength(3);
    expect(plan.renderUnits[1]?.referenceFrom).toBe('asset-1');
    expect(plan.renderUnits[2]?.referenceFrom).toBe('asset-1');
    expect(new Set(plan.renderUnits.map((unit) => unit.continuityKey)).size).toBe(1);
  });

  it('uses generated assets only for the full system and remaining core in a cutaway', () => {
    const plan = compileVisualPlan(kitesurfClaim());

    expect(plan.regions.map((region) => region.id)).toEqual([
      'full-system',
      'removed-layers',
      'remaining-core',
    ]);
    expect(plan.renderUnits.map((unit) => unit.regionId)).toEqual([
      'full-system',
      'remaining-core',
    ]);
    expect(plan.renderStrategy).toBe('one_asset_plus_vector');
  });

  it('builds a central source with two deterministic branches for task routing', () => {
    const plan = compileVisualPlan(qwenRoutingClaim());

    expect(plan.regions.map((region) => region.id)).toEqual([
      'route-source',
      'route-a',
      'route-b',
    ]);
    expect(plan.transitions).toEqual([
      { from: 'route-source', to: 'route-a', type: 'branch' },
      { from: 'route-source', to: 'route-b', type: 'branch' },
    ]);
    expect(plan.renderUnits.map((unit) => unit.regionId)).toEqual(['route-a', 'route-b']);
    expect(plan.renderUnits[1]?.referenceFrom).toBe('asset-1');
    expect(plan.renderStrategy).toBe('reference_split');
  });

  it('never asks the image model to create labels, arrows, or a finished infographic', () => {
    for (const claim of sampleClaims()) {
      const plan = compileVisualPlan(claim);
      for (const unit of plan.renderUnits) {
        expect(unit.generatedTextAllowed).toBe(false);
        expect(unit.infographicLayoutAllowed).toBe(false);
        expect(unit.prompt).toContain('Asset only');
        expect(unit.prompt).toContain('Absolutely no text');
        expect(unit.prompt).toContain('Do not create an infographic');
      }
    }
  });

  it('caps deterministic overlay groups at three', () => {
    const labels = normalizeApprovedLabels({
      ...energyClaim(),
      approvedLabels: ['ONE', 'TWO', 'THREE', 'FOUR'],
    });

    expect(labels).toHaveLength(3);
    expect(labels).toEqual(['ONE', 'TWO', 'THREE']);
  });

  it('keeps every planned format within the configured cost and time policy', () => {
    for (const claim of sampleClaims()) {
      const execution = compileVisualPlan(claim).execution;
      expect(execution.withinPolicy).toBe(true);
      expect(execution.estimatedUsd).toBeLessThanOrEqual(
        WEEKLY_VISUAL_POLICY.budget.maxUsd,
      );
      expect(execution.estimatedDurationMs).toBeLessThanOrEqual(
        WEEKLY_VISUAL_POLICY.budget.maxDurationMs,
      );
      expect(execution.visionCalls).toBeLessThanOrEqual(
        WEEKLY_VISUAL_POLICY.budget.maxVisionCalls,
      );
    }
  });

  it('emits plans that pass deterministic plan validation', () => {
    for (const claim of sampleClaims()) {
      expect(validateVisualPlan(compileVisualPlan(claim))).toEqual([]);
    }
  });
});

describe('semantic hard gates', () => {
  it('rejects a beautiful candidate when the core mechanism is missing', () => {
    const candidate = rankVisualCandidate(
      {
        instantMeaning: 50,
        visualBeauty: 100,
        brandConsistency: 100,
        originality: 100,
      },
      passingEvidence({ mechanismVisible: false }),
    );

    expect(candidate.weightedScore).toBe(77.5);
    expect(candidate.eligible).toBe(false);
    expect(candidate.finalGate.failures).toContain('mechanism_missing');
  });

  it('rejects overlays that claim restraint when the pixels show active intervention', () => {
    const gate = evaluateFinalGate(
      passingEvidence({
        contradictoryAction: true,
        overlaysSupportedByPixels: false,
      }),
    );

    expect(gate.passed).toBe(false);
    expect(gate.failures).toEqual(
      expect.arrayContaining(['contradictory_action', 'overlay_contradicts_pixels']),
    );
    expect(chooseVisualRepair(gate.failures)).toBe('replan_visual_claim');
  });

  it('keeps pixel-only validation independent from headline and overlay validation', () => {
    const pixel = evaluatePixelGate({
      identityVisible: true,
      mechanismVisible: true,
      outcomeVisible: true,
      causalRelationVisible: true,
      contradictoryAction: false,
      generatedTextPresent: false,
      subjectConsistent: true,
    });
    const final = evaluateFinalGate(
      passingEvidence({ headlineImagePairUnderstood: false, thumbnailReadable: false }),
    );

    expect(pixel.passed).toBe(true);
    expect(final.passed).toBe(false);
    expect(final.failures).toEqual(
      expect.arrayContaining(['headline_pair_unclear', 'thumbnail_unreadable']),
    );
  });
});

describe('repair routing', () => {
  it('edits only the image when generated text is the sole failure', () => {
    expect(chooseVisualRepair(['generated_text'])).toBe('edit_generated_text');
  });

  it('recomposes deterministic overlays without regenerating pixels', () => {
    expect(chooseVisualRepair(['labels_not_approved'])).toBe('recompose_overlays');
    expect(chooseVisualRepair(['thumbnail_unreadable'])).toBe('recompose_overlays');
  });

  it('regenerates a failed asset when the physical cause is missing', () => {
    expect(chooseVisualRepair(['mechanism_missing'])).toBe('regenerate_failed_asset');
  });

  it('prioritizes a semantic contradiction over an overlay-only failure', () => {
    expect(chooseVisualRepair(['labels_not_approved', 'contradictory_action'])).toBe(
      'replan_visual_claim',
    );
  });

  it('falls back deterministically when a contradiction remains and regeneration is exhausted', () => {
    expect(chooseVisualRepair(['contradictory_action'], 0)).toBe(
      'deterministic_fallback',
    );
  });
});

describe('weighted editorial score', () => {
  it('uses meaning 45, beauty 30, brand 15, and originality 10', () => {
    expect(
      weightedVisualScore({
        instantMeaning: 100,
        visualBeauty: 80,
        brandConsistency: 60,
        originality: 40,
      }),
    ).toBe(82);
  });

  it('clamps invalid score values before weighting', () => {
    expect(
      weightedVisualScore({
        instantMeaning: 120,
        visualBeauty: -20,
        brandConsistency: Number.NaN,
        originality: 200,
      }),
    ).toBe(55);
  });
});
