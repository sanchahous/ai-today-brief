import { describe, expect, it } from 'vitest';
import { parseAutoVisualClaimV5, compileAutoVisualClaimV5 } from './visual-auto-claim-v5';
import { renderGenericVisualSvgV5 } from './visual-generic-svg-v5';
import type { HoldoutStoryInput } from './visual-auto-claim';

function story(overrides: Partial<HoldoutStoryInput> = {}): HoldoutStoryInput {
  return {
    week_start: '2026-06-29',
    week_end: '2026-07-05',
    rank: 1,
    revision_item_id: 'metric-story',
    title: 'A metric changes',
    summary: 'The measured result changes against a baseline.',
    why: 'The direction changes cost or performance.',
    practical: null,
    takeaway: null,
    ...overrides,
  };
}

function raw(direction: string, role = 'quantitative_result') {
  return {
    story_id: 'metric-story',
    explanatory_role: role,
    certainty: role === 'uncertainty_announcement' ? 'expected' : 'observed',
    mapping_mode: 'literal',
    identity: 'the compared model workload',
    change: role === 'uncertainty_announcement' ? 'provide a future open-weight model' : 'the metric changes',
    visual_driver:
      role === 'uncertainty_announcement'
        ? 'the confirmed current state is separated from the expected future state'
        : 'the reported baseline is placed beside the measured result',
    visible_outcome:
      role === 'uncertainty_announcement'
        ? 'the future state remains explicitly unconfirmed'
        : 'the result visibly differs from the baseline',
    core_claim:
      role === 'uncertainty_announcement'
        ? 'the model is expected to provide a future open-weight option'
        : 'the measured result differs from the baseline',
    metric:
      role === 'uncertainty_announcement'
        ? null
        : {
            direction,
            comparison_target: role === 'benchmark_comparison' ? 'Opus' : 'baseline',
            baseline_label: 'BASELINE',
            result_label: 'RESULT',
          },
    labels:
      role === 'uncertainty_announcement'
        ? ['EXPECTED', '2–3T', 'OPEN-WEIGHT']
        : ['BASELINE', 'RESULT', direction.includes('lower') || direction === 'decrease' ? 'LOWER' : 'HIGHER'],
    quantitative_facts:
      role === 'uncertainty_announcement'
        ? []
        : [{ label: 'METRIC', value: direction.includes('lower') || direction === 'decrease' ? '17% LOWER' : '2× HIGHER' }],
    states: [],
    comparison:
      role === 'uncertainty_announcement'
        ? null
        : { left: 'baseline state', right: 'reported result' },
    layers: [],
    routing: null,
    required_visible_delta: '',
    forbidden_contradictions: [],
    grammar: {
      context_glyph: 'model_chip',
      mechanism_glyph: role === 'benchmark_comparison' ? 'coins' : 'context_stack',
      outcome_glyph: 'gauge',
      branch_glyphs: null,
      relation: 'compare',
      outcome_signal:
        role === 'uncertainty_announcement'
          ? 'uncertain'
          : direction.includes('lower') || direction === 'decrease'
            ? 'lower_tokens'
            : 'higher_tokens',
      human_behavior: false,
    },
  };
}

function render(direction: string, role = 'quantitative_result') {
  const source = story({
    title:
      role === 'uncertainty_announcement'
        ? 'A company prepares an expected open-weight model'
        : direction.includes('lower') || direction === 'decrease'
          ? 'A model reduces output tokens by 17%'
          : 'A model doubles measured capacity',
    summary:
      role === 'uncertainty_announcement'
        ? 'The company is set to launch a model expected at 2 to 3 trillion parameters.'
        : direction.includes('lower') || direction === 'decrease'
          ? 'The measured result is 17% lower than the baseline.'
          : 'The measured result is 2 times higher than the baseline.',
  });
  const claim = parseAutoVisualClaimV5(raw(direction, role), source);
  const plan = compileAutoVisualClaimV5(claim);
  return renderGenericVisualSvgV5({
    autoClaim: claim,
    plan,
    includeOverlays: true,
  }).toString('utf8');
}

describe('renderGenericVisualSvgV5', () => {
  it('renders reduction and increase directions as different vector geometries', () => {
    const decrease = render('decrease');
    const increase = render('increase');

    expect(decrease).toContain('17% LOWER');
    expect(increase).toContain('2× HIGHER');
    expect(decrease).not.toBe(increase);
    expect(decrease).toContain('v5-warm-glow');
    expect(increase).toContain('v5-cyan-glow');
  });

  it('preserves benchmark comparison labels and a visible winner cue', () => {
    const svg = render('lower_is_better', 'benchmark_comparison');

    expect(svg).toContain('<ellipse');
    expect(svg).toContain('BASELINE');
    expect(svg).toContain('RESULT');
    expect(svg).toContain('M25 18h50v22');
  });

  it('renders expected announcements with a dashed uncertainty boundary, not a success check', () => {
    const svg = render('neutral', 'uncertainty_announcement');

    expect(svg).toContain('stroke-dasharray="13 11"');
    expect(svg).toContain('EXPECTED');
    expect(svg).toContain('OPEN-WEIGHT');
    expect(svg).not.toContain('M25 18h50v22');
  });

  it('keeps explanatory text limited to approved overlays', () => {
    const svg = render('decrease');
    expect((svg.match(/<text/g) ?? []).length).toBe(3);
    expect(svg).not.toContain('metric-story');
    expect(svg).not.toContain('reported baseline is placed');
  });
});
