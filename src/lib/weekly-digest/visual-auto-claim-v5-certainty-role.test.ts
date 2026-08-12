import { describe, expect, it } from 'vitest';
import {
  parseAutoVisualClaimV5,
  validateAutoVisualClaimV5,
} from './visual-auto-claim-v5';
import type { HoldoutStoryInput } from './visual-auto-claim';

function story(overrides: Partial<HoldoutStoryInput> = {}): HoldoutStoryInput {
  return {
    week_start: '2026-06-29',
    week_end: '2026-07-05',
    rank: 1,
    revision_item_id: 'certainty-story',
    title: 'Prompt caching avoids repeated token billing',
    summary: 'Prompt caching reduces repeated processing when conversation history is structured correctly.',
    why: 'Teams reduce unnecessary cloud API costs.',
    practical: null,
    takeaway: null,
    ...overrides,
  };
}

function raw(overrides: Record<string, unknown> = {}) {
  return {
    story_id: 'certainty-story',
    explanatory_role: 'causal_mechanism',
    certainty: 'uncertain',
    mapping_mode: 'literal',
    identity: 'the structured prompt and cached context workload',
    change: 'reuse previously processed context instead of billing it again',
    visual_driver: 'a cache intercepts repeated context before duplicate cloud processing',
    visible_outcome: 'the repeated workload becomes smaller and costs less',
    core_claim: 'prompt caching prevents duplicate processing and reduces cost',
    metric: null,
    labels: ['PROMPT', 'CACHE', 'REUSE'],
    quantitative_facts: [],
    states: [],
    comparison: null,
    layers: [],
    routing: null,
    required_visible_delta: '',
    forbidden_contradictions: [],
    grammar: {
      context_glyph: 'context_stack',
      mechanism_glyph: 'database',
      outcome_glyph: 'coins',
      branch_glyphs: null,
      relation: 'flow',
      outcome_signal: 'lower_cost',
      human_behavior: false,
    },
    ...overrides,
  };
}

describe('VisualClaim v5 source certainty alignment', () => {
  it('aligns an unsupported uncertain default to reported source certainty', () => {
    const value = parseAutoVisualClaimV5(raw(), story());
    expect(value.semantics.certainty).toBe('reported');
    expect(value.claim.coreClaim).toMatch(/reported/i);
    expect(value.extractionWarnings).toContain(
      'certainty_aligned_uncertain_to_reported',
    );
    expect(validateAutoVisualClaimV5(value)).toEqual([]);
  });

  it('reclassifies a non-numeric compression story away from quantitative_result', () => {
    const source = story({
      revision_item_id: 'optical-compression',
      title: 'Cutting Claude Code Token Costs with Optical Context Compression',
      summary:
        'A local proxy intercepts requests and converts verbose text context into compact PNG images, squeezing it to a fraction of the original token cost.',
      why: 'Vision reads the compressed representation instead of repeatedly sending dense text.',
    });
    const value = parseAutoVisualClaimV5(
      raw({
        story_id: 'optical-compression',
        explanatory_role: 'quantitative_result',
        identity: 'the local proxy and verbose text context',
        visual_driver: 'the proxy converts dense text context into a compact optical representation',
        visible_outcome: 'the same context occupies a smaller token workload',
        core_claim: 'optical context compression reduces the token workload',
        metric: {
          direction: 'decrease',
          comparison_target: 'the original token cost',
          baseline_label: 'TEXT CONTEXT',
          result_label: 'OPTICAL CONTEXT',
        },
        labels: ['TEXT', 'PROXY', 'PNG'],
        quantitative_facts: [],
      }),
      source,
    );

    expect(value.semantics.explanatoryRole).toBe('causal_mechanism');
    expect(value.semantics.metric).toBeNull();
    expect(value.extractionWarnings).toContain(
      'role_aligned_quantitative_result_to_causal_mechanism_without_exact_metric',
    );
    expect(validateAutoVisualClaimV5(value)).toEqual([]);
  });
});
