import { describe, expect, it } from 'vitest';
import type { HoldoutStoryInput } from './visual-auto-claim';
import type { AutoVisualClaimV5 } from './visual-auto-claim-v5';
import { selectVisualTreatmentV72 } from './visual-treatment-v7-2';
import type { VisualRouterDecisionV7 } from './visual-role-router-v7';

function story(title: string, summary: string, why = ''): HoldoutStoryInput {
  return {
    week_start: '2026-06-22',
    week_end: '2026-06-28',
    rank: 1,
    revision_item_id: 'story-id',
    title,
    summary,
    why,
    practical: null,
    takeaway: null,
  };
}

function claim(input: {
  role: AutoVisualClaimV5['semantics']['explanatoryRole'];
  humanBehavior?: boolean;
}): AutoVisualClaimV5 {
  return {
    storyId: 'story-id',
    claim: {
      storyId: 'story-id',
      identity: 'source identity',
      change: 'source change',
      mechanism: 'visible source operation',
      primaryOutcome: 'visible source result',
      coreClaim: 'one source-grounded claim',
      primaryEvidence: 'physical_action',
      outcomeKind: 'tradeoff',
      approvedLabels: ['SOURCE', 'ACTION', 'RESULT'],
      forbiddenContradictions: [],
      overlayDirectives: [],
    },
    grammar: {
      contextGlyph: 'model_chip',
      mechanismGlyph: 'workflow',
      outcomeGlyph: 'checkmark',
      branchGlyphs: null,
      relation: 'flow',
      outcomeSignal: 'success',
      humanBehavior: input.humanBehavior ?? false,
    },
    extractionWarnings: [],
    semantics: {
      explanatoryRole: input.role,
      certainty: 'observed',
      mappingMode: 'literal',
      visualDriver: 'visible source operation',
      metric: null,
      requiredVisibleDelta: '',
      sourceGuardTerms: [],
    },
  };
}

function router(
  pipeline: VisualRouterDecisionV7['pipeline'],
  expectedImageCalls: 0 | 1,
): VisualRouterDecisionV7 {
  return {
    storyId: 'story-id',
    role: 'capability_access',
    pipeline,
    reason: 'test route',
    expectedImageCalls,
    requiredGuards: [],
  };
}

describe('Visual Compiler v7.2 specialized treatment selection', () => {
  it('uses a source-safe consistency signal for ineligible community reports', () => {
    const decision = selectVisualTreatmentV72({
      story: story(
        'Model faces community critique regarding performance consistency',
        'Users report inconsistent reliability in coding environments compared with alternatives.',
        'Test critical paths across multiple providers.',
      ),
      claim: claim({ role: 'uncertainty_announcement' }),
      eligible: false,
      router: router('source_led_fallback', 0),
    });
    expect(decision.treatment).toBe('reported_consistency_signal');
    expect(decision.safetyMode).toBe('reported_signal');
    expect(decision.expectedImageCalls).toBe(0);
  });

  it('uses an uncertain usage meter for anecdotal token signals', () => {
    const decision = selectVisualTreatmentV72({
      story: story(
        'Usage thresholds under high-volume token consumption',
        'Users pushing context-window and rate limits report anecdotal signals about usage patterns.',
        'Monitor token spend to avoid interruptions.',
      ),
      claim: claim({ role: 'uncertainty_announcement' }),
      eligible: false,
      router: router('source_led_fallback', 0),
    });
    expect(decision.treatment).toBe('reported_usage_signal');
    expect(decision.approvedLabels).toContain('REPORTED SIGNALS');
  });

  it('routes human causal behavior to a continuity-matched split', () => {
    const decision = selectVisualTreatmentV72({
      story: story(
        'Managing AI-driven distraction',
        'Constant reliance on an assistant can erode personal problem-solving skills.',
      ),
      claim: claim({ role: 'causal_mechanism', humanBehavior: true }),
      eligible: true,
      router: router('current_art_director', 1),
    });
    expect(decision.treatment).toBe('human_behavior_split');
    expect(decision.expectedImageCalls).toBe(3);
  });

  it('uses a domain-specific science flow for biological research', () => {
    const decision = selectVisualTreatmentV72({
      story: story(
        'AI aids immunologists in solving a T-cell mystery',
        'Researchers synthesized complex biological datasets into an actionable hypothesis.',
      ),
      claim: claim({ role: 'capability_access' }),
      eligible: true,
      router: router('deterministic_compiler', 0),
    });
    expect(decision.treatment).toBe('science_reasoning_flow');
    expect(decision.approvedLabels).toEqual([
      'GPT-5',
      'BIOLOGICAL DATA',
      'T-CELL HYPOTHESIS',
    ]);
  });

  it('reuses the existing route when no specialized treatment is supported', () => {
    const decision = selectVisualTreatmentV72({
      story: story(
        'Mount repositories on demand',
        'A new tool downloads files only when requested by coding agents.',
      ),
      claim: claim({ role: 'capability_access' }),
      eligible: true,
      router: router('deterministic_compiler', 0),
    });
    expect(decision.treatment).toBe('reuse_router_selection');
    expect(decision.selectedSource).toBe('compiler');
  });
});
