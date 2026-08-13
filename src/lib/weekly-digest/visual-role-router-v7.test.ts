import { describe, expect, it } from 'vitest';
import type { AutoVisualClaimV5, VisualExplanatoryRole } from './visual-auto-claim-v5';
import {
  selectSourceVisualPipelineV7,
  selectVisualPipelineV7,
  summarizeSourceVisualRouterV7,
  summarizeVisualRouterV7,
} from './visual-role-router-v7';

function claim(
  role: VisualExplanatoryRole,
  overrides: Partial<AutoVisualClaimV5> = {},
): AutoVisualClaimV5 {
  return {
    storyId: `story-${role}`,
    claim: {
      storyId: `story-${role}`,
      identity: 'a visible source-grounded system anchor',
      change: 'one approved source change',
      mechanism: 'one visible approved operation',
      primaryOutcome: 'one approved visible result',
      coreClaim: 'the approved operation leads to the approved result',
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
      humanBehavior: false,
    },
    extractionWarnings: [],
    semantics: {
      explanatoryRole: role,
      certainty: 'observed',
      mappingMode: 'literal',
      visualDriver: 'one approved visible driver',
      metric: null,
      requiredVisibleDelta: '',
      sourceGuardTerms: [],
    },
    ...overrides,
  };
}

describe('Visual Compiler v7 role router', () => {
  it.each([
    'causal_mechanism',
    'state_transition',
    'policy_control',
    'uncertainty_announcement',
  ] as const)('routes %s through the current art director', (role) => {
    const decision = selectVisualPipelineV7(claim(role));
    expect(decision.pipeline).toBe('current_art_director');
    expect(decision.expectedImageCalls).toBe(1);
    expect(decision.requiredGuards).toContain('generated_text_gate');
  });

  it.each([
    'architecture_transformation',
    'quantitative_result',
    'benchmark_comparison',
    'capability_access',
  ] as const)('routes %s through deterministic rendering', (role) => {
    const decision = selectVisualPipelineV7(claim(role));
    expect(decision.pipeline).toBe('deterministic_compiler');
    expect(decision.expectedImageCalls).toBe(0);
    expect(decision.requiredGuards).toContain('exact_overlay_gate');
  });

  it('routes an ineligible claim to a zero-call source-led fallback', () => {
    const decision = selectSourceVisualPipelineV7({
      claim: claim('uncertainty_announcement'),
      eligible: false,
      ineligibilityReasons: [
        'certainty_preserved',
        'announcement_certainty_not_guarded',
      ],
    });
    expect(decision.pipeline).toBe('source_led_fallback');
    expect(decision.expectedImageCalls).toBe(0);
    expect(decision.requiredGuards).toContain('no_explanatory_assertion');
    expect(decision.requiredGuards).toContain('no_certainty_upgrade');
    expect(decision.reason).toContain('announcement_certainty_not_guarded');
  });

  it('preserves the normal role route when the source claim is eligible', () => {
    const value = claim('capability_access');
    expect(
      selectSourceVisualPipelineV7({ claim: value, eligible: true }),
    ).toEqual(selectVisualPipelineV7(value));
  });

  it('summarizes cost-bearing routes before any image calls', () => {
    const summary = summarizeVisualRouterV7([
      claim('causal_mechanism'),
      claim('uncertainty_announcement'),
      claim('capability_access'),
      claim('quantitative_result'),
    ]);
    expect(summary.currentStories).toBe(2);
    expect(summary.deterministicStories).toBe(2);
    expect(summary.expectedImageCalls).toBe(2);
  });

  it('summarizes a mixed eligible and ineligible batch without throwing', () => {
    const values = [
      { claim: claim('causal_mechanism'), eligible: true },
      { claim: claim('capability_access'), eligible: true },
      {
        claim: claim('uncertainty_announcement'),
        eligible: false,
        ineligibilityReasons: ['certainty_preserved'],
      },
      {
        claim: claim('benchmark_comparison'),
        eligible: false,
        ineligibilityReasons: ['comparison_target_preserved'],
      },
    ];
    const summary = summarizeSourceVisualRouterV7(values);
    expect(summary.currentStories).toBe(1);
    expect(summary.deterministicStories).toBe(1);
    expect(summary.fallbackStories).toBe(2);
    expect(summary.expectedImageCalls).toBe(1);
    expect(summary.decisions).toHaveLength(4);
  });
});
