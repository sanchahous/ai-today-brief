import { describe, expect, it } from 'vitest';
import {
  compileAutoVisualClaimV5,
  parseAutoVisualClaimV5,
  selectVisualRenderModeV5,
  validateAutoVisualClaimV5,
  visualClaimV5ExtractionPrompt,
} from './visual-auto-claim-v5';
import type { HoldoutStoryInput } from './visual-auto-claim';

function story(overrides: Partial<HoldoutStoryInput> = {}): HoldoutStoryInput {
  return {
    week_start: '2026-06-29',
    week_end: '2026-07-05',
    rank: 1,
    revision_item_id: 'story-1',
    title: 'A measured AI result',
    summary: 'The evaluation reports a measurable result.',
    why: 'Teams can compare the result with their current baseline.',
    practical: null,
    takeaway: null,
    ...overrides,
  };
}

function grammar(overrides: Record<string, unknown> = {}) {
  return {
    context_glyph: 'model_chip',
    mechanism_glyph: 'benchmark',
    outcome_glyph: 'gauge',
    branch_glyphs: null,
    relation: 'compare',
    outcome_signal: 'success',
    human_behavior: false,
    ...overrides,
  };
}

function baseRaw(overrides: Record<string, unknown> = {}) {
  return {
    story_id: 'story-1',
    explanatory_role: 'quantitative_result',
    certainty: 'observed',
    mapping_mode: 'literal',
    identity: 'the evaluated model and its reported workload',
    change: 'the measured workload becomes smaller',
    visual_driver: 'the reported baseline is placed beside the measured result',
    visible_outcome: 'the result uses fewer tokens than the baseline',
    core_claim: 'the measured result uses fewer tokens than the baseline',
    metric: {
      direction: 'decrease',
      comparison_target: 'the previous model',
      baseline_label: 'PREVIOUS MODEL',
      result_label: 'NEW MODEL',
    },
    labels: ['PREVIOUS MODEL', 'NEW MODEL', '17% FEWER TOKENS'],
    quantitative_facts: [{ label: 'OUTPUT TOKENS', value: '17% LOWER' }],
    states: [],
    comparison: {
      left: 'the previous model output workload',
      right: 'the new model output workload',
    },
    layers: [],
    routing: null,
    required_visible_delta: '',
    forbidden_contradictions: ['the new model uses more output tokens'],
    grammar: grammar({ outcome_signal: 'lower_tokens' }),
    ...overrides,
  };
}

describe('VisualClaim v5 certainty guard', () => {
  it('downgrades an overconfident Kimi announcement and guards the core claim', () => {
    const source = story({
      revision_item_id: 'kimi',
      title: 'Moonshot AI Prepares a 2–3 Trillion Parameter Open-Weight Kimi K3',
      summary:
        'Moonshot AI is set to launch Kimi K3, an open-weight model expected at 2 to 3 trillion parameters, aiming to close the gap with proprietary models.',
      why: 'A future self-hostable option could change vendor negotiations.',
    });
    const value = parseAutoVisualClaimV5(
      baseRaw({
        story_id: 'kimi',
        explanatory_role: 'uncertainty_announcement',
        certainty: 'released',
        identity: 'Kimi K3 open-weight model',
        change: 'provide a 2–3 trillion parameter open-weight alternative',
        visual_driver: 'an open vault reveals an available frontier-scale model',
        visible_outcome: 'teams can self-host the model now',
        core_claim: 'Kimi K3 provides an available self-hosted alternative',
        metric: {
          direction: 'increase',
          comparison_target: 'proprietary frontier models',
          baseline_label: 'CLOSED MODELS',
          result_label: 'KIMI K3',
        },
        labels: ['EXPECTED', '2–3T', 'OPEN-WEIGHT'],
        quantitative_facts: [{ label: 'PARAMETERS', value: '2–3T EXPECTED' }],
        comparison: null,
        grammar: grammar({
          context_glyph: 'cloud',
          mechanism_glyph: 'model_chip',
          outcome_glyph: 'warning',
          outcome_signal: 'success',
        }),
      }),
      source,
    );

    expect(value.semantics.certainty).toBe('expected');
    expect(value.semantics.mappingMode).toBe('literal');
    expect(value.claim.coreClaim).toMatch(/planned|expected|set to|prepares/i);
    expect(value.claim.coreClaim).not.toMatch(/available self-hosted/i);
    expect(value.grammar.outcomeSignal).toBe('uncertain');
    expect(value.extractionWarnings).toEqual(
      expect.arrayContaining([
        'certainty_downgraded_released_to_expected',
        'core_claim_guarded_for_expected',
      ]),
    );
    expect(validateAutoVisualClaimV5(value)).toEqual([]);
  });

  it('preserves reported vendor claims instead of upgrading them to observed facts', () => {
    const source = story({
      title: 'NVIDIA Reports a 97.1% RTL Pass Rate',
      summary: 'NVIDIA says its model reached a self-reported 97.1% pass rate.',
    });
    const value = parseAutoVisualClaimV5(
      baseRaw({
        certainty: 'observed',
        core_claim: 'the model proves a 97.1% pass rate',
        quantitative_facts: [{ label: 'PASS RATE', value: '97.1%' }],
      }),
      source,
    );

    expect(value.semantics.certainty).toBe('reported');
    expect(value.claim.coreClaim).toMatch(/reported/i);
    expect(value.claim.coreClaim).not.toMatch(/proves/i);
  });
});

describe('role-aware visual drivers', () => {
  it('treats a token reduction as a result, not an invented architecture mechanism', () => {
    const source = story({
      title: 'Gemini Flash Reduces Output Tokens by 17%',
      summary: 'Google says the model reduces output tokens by 17% in agentic workflows.',
    });
    const value = parseAutoVisualClaimV5(baseRaw(), source);

    expect(value.semantics.explanatoryRole).toBe('quantitative_result');
    expect(value.semantics.metric?.direction).toBe('decrease');
    expect(value.claim.primaryEvidence).toBe('quantitative_difference');
    expect(value.semantics.visualDriver).toContain('baseline');
    expect(selectVisualRenderModeV5(value)).toBe('deterministic_literal');
    expect(compileAutoVisualClaimV5(value).format).toBe('cinematic_data_contrast');
  });

  it('requires a named comparison target for benchmark stories', () => {
    const source = story({
      title: 'Grok Tops WANDR at Half the Cost of Opus',
      summary: 'Grok completed WANDR tasks at $4.76 per trial, roughly half the cost of Opus.',
    });
    const value = parseAutoVisualClaimV5(
      baseRaw({
        explanatory_role: 'benchmark_comparison',
        visual_driver: 'the WANDR evaluation places Grok beside Opus on task cost',
        visible_outcome: 'Grok reaches the top result at roughly half the cost of Opus',
        core_claim: 'Grok tops WANDR at roughly half the cost of Opus',
        metric: {
          direction: 'lower_is_better',
          comparison_target: 'Opus',
          baseline_label: 'OPUS',
          result_label: 'GROK 4.5',
        },
        labels: ['WANDR #1', '$4.76/TRIAL', '≈½ OPUS COST'],
        quantitative_facts: [
          { label: 'GROK COST', value: '$4.76/TRIAL' },
          { label: 'VS OPUS', value: '≈½ COST' },
        ],
      }),
      source,
    );

    expect(value.semantics.explanatoryRole).toBe('benchmark_comparison');
    expect(value.semantics.metric?.comparisonTarget).toBe('Opus');
    expect(validateAutoVisualClaimV5(value)).toEqual([]);
  });

  it('rejects benchmark claims that discard the comparison target', () => {
    const source = story({
      title: 'Grok Tops WANDR at Half the Cost of Opus',
      summary: 'Grok completed WANDR tasks at $4.76 per trial, roughly half the cost of Opus.',
    });
    const value = parseAutoVisualClaimV5(
      baseRaw({
        explanatory_role: 'benchmark_comparison',
        metric: {
          direction: 'lower_is_better',
          comparison_target: '',
          baseline_label: 'BASELINE',
          result_label: 'GROK',
        },
      }),
      source,
    );
    value.semantics.metric = { ...value.semantics.metric!, comparisonTarget: '' };

    expect(validateAutoVisualClaimV5(value)).toContain(
      'benchmark_comparison_target_required',
    );
  });

  it('does not allow analogy mode for quantitative or announcement stories', () => {
    const value = parseAutoVisualClaimV5(
      baseRaw({ mapping_mode: 'editorial_analogy' }),
      story(),
    );
    expect(value.semantics.mappingMode).toBe('literal');
    expect(value.extractionWarnings).toContain('analogy_disabled_for_quantitative_result');
  });

  it('allows a one-to-one policy analogy and routes it to the generated renderer', () => {
    const source = story({
      title: 'Policy Enforcement Arrives for MCP Tool Calls',
      summary: 'An Open Policy Agent check blocks unauthorized tool execution before the tool runs.',
    });
    const value = parseAutoVisualClaimV5(
      baseRaw({
        explanatory_role: 'policy_control',
        certainty: 'released',
        mapping_mode: 'editorial_analogy',
        identity: 'an MCP tool action approaching an external policy gate',
        change: 'an unauthorized call reaches the policy boundary',
        visual_driver: 'a guard outside the tool physically stops the unauthorized action before contact',
        visible_outcome: 'the destructive tool remains untouched and inactive',
        core_claim: 'an external policy gate blocks unauthorized MCP tool execution before the tool runs',
        metric: null,
        labels: ['MCP CALL', 'POLICY GATE', 'BLOCKED'],
        quantitative_facts: [],
        comparison: null,
        grammar: grammar({
          context_glyph: 'agent',
          mechanism_glyph: 'policy_gate',
          outcome_glyph: 'shield',
          relation: 'block',
          outcome_signal: 'blocked',
        }),
      }),
      source,
    );

    expect(value.semantics.mappingMode).toBe('editorial_analogy');
    expect(selectVisualRenderModeV5(value)).toBe('generated_editorial_analogy');
  });

  it('requires a physical delta for state-transition stories', () => {
    const source = story({
      title: 'A model access decision reverses',
      summary: 'Access changes from scheduled withdrawal to permanent availability.',
    });
    const value = parseAutoVisualClaimV5(
      baseRaw({
        explanatory_role: 'state_transition',
        states: ['WITHDRAWAL PLANNED', 'DECISION REVERSED', 'PERMANENT ACCESS'],
        required_visible_delta: '',
        metric: null,
        quantitative_facts: [],
        comparison: null,
      }),
      source,
    );

    expect(validateAutoVisualClaimV5(value)).toContain('state_delta_required');
  });
});

describe('v5 extraction prompt', () => {
  it('explicitly separates result, benchmark, mechanism and uncertainty roles', () => {
    const prompt = visualClaimV5ExtractionPrompt([story()]);
    expect(prompt).toContain('Do not invent a causal mechanism');
    expect(prompt).toContain('CERTAINTY IS A HARD CONTRACT');
    expect(prompt).toContain('benchmark_comparison');
    expect(prompt).toContain('comparison target');
    expect(prompt).toContain('required_visible_delta');
  });
});
