import { describe, expect, it } from 'vitest';
import {
  compileAutoVisualClaimV5,
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

describe('VisualClaim v5 focal certainty', () => {
  it('uses observed for a direct approved causal proposition', () => {
    const value = parseAutoVisualClaimV5(raw(), story());
    expect(value.semantics.certainty).toBe('observed');
    expect(value.claim.coreClaim).not.toMatch(/reported|expected|planned/i);
    expect(value.extractionWarnings).toContain(
      'certainty_aligned_uncertain_to_observed',
    );
    expect(validateAutoVisualClaimV5(value)).toEqual([]);
  });

  it('maps a current open-source capability to released certainty', () => {
    const source = story({
      revision_item_id: 'review-flow',
      title: 'Review-flow automates code review pipelines',
      summary:
        'Review-flow is an open-source server that automates code review pipelines using Claude Code background sessions and MCP.',
    });
    const value = parseAutoVisualClaimV5(
      raw({
        story_id: 'review-flow',
        explanatory_role: 'capability_access',
        certainty: 'available',
        identity: 'Review-flow server',
        change: 'automates code review pipelines',
        visual_driver: 'Claude Code background sessions and MCP execute structured multi-agent audits',
        visible_outcome: 'GitHub and GitLab review pipelines are automated',
        core_claim: 'Review-flow is an open-source server that automates code review pipelines',
      }),
      source,
    );
    expect(value.semantics.certainty).toBe('released');
    expect(validateAutoVisualClaimV5(value)).toEqual([]);
  });

  it('keeps an on-track numeric announcement future-facing and visually comparable', () => {
    const source = story({
      revision_item_id: 'mistral',
      title: 'Mistral platform expansion',
      summary:
        'Mistral AI reported reaching over $400 million ARR and is on track to surpass $1 billion ARR this year.',
    });
    const value = parseAutoVisualClaimV5(
      raw({
        story_id: 'mistral',
        explanatory_role: 'uncertainty_announcement',
        certainty: 'on_track',
        identity: 'Mistral AI',
        change: 'is on track to surpass $1 billion ARR this year',
        visual_driver: 'unrelated platform scaling activity',
        visible_outcome: 'reaching over $400 million ARR',
        core_claim:
          'Mistral AI reported reaching over $400 million ARR and is on track to surpass $1 billion ARR this year.',
        metric: {
          direction: 'increase',
          comparison_target: '',
          baseline_label: '$400M ARR',
          result_label: '$1B ARR',
        },
        quantitative_facts: [
          { label: 'CURRENT ARR', value: 'OVER $400M' },
          { label: 'TARGET ARR', value: 'OVER $1B' },
        ],
      }),
      source,
    );
    expect(value.semantics.certainty).toBe('expected');
    expect(value.semantics.metric?.direction).toBe('increase');
    expect(value.semantics.visualDriver).toMatch(/\$400M ARR.*\$1B ARR/i);
    expect(value.claim.primaryOutcome).toMatch(/future/i);
    expect(value.claim.approvedLabels).toEqual([
      '$400M ARR',
      '$1B ARR',
      'ON TRACK',
    ]);
    expect(compileAutoVisualClaimV5(value).format).toBe('cinematic_split');
    expect(validateAutoVisualClaimV5(value)).toEqual([]);
  });

  it('reclassifies non-numeric optical compression as a causal mechanism', () => {
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
    expect(value.semantics.certainty).toBe('observed');
    expect(validateAutoVisualClaimV5(value)).toEqual([]);
  });
});
