import { describe, expect, it } from 'vitest';
import { parseAutoVisualClaimV5 } from './visual-auto-claim-v5';
import type { HoldoutStoryInput } from './visual-auto-claim';

describe('VisualClaim v5 existing certainty language', () => {
  it('does not prepend expected language when the claim already says on track', () => {
    const story: HoldoutStoryInput = {
      week_start: '2026-06-29',
      week_end: '2026-07-05',
      rank: 2,
      revision_item_id: 'mistral-on-track',
      title: 'Mistral platform expansion',
      summary:
        'Mistral AI reported reaching over $400 million ARR and is on track to surpass $1 billion ARR this year.',
      why: 'The company is expanding its enterprise platform.',
      practical: null,
      takeaway: null,
    };
    const raw = {
      story_id: story.revision_item_id,
      explanatory_role: 'uncertainty_announcement',
      certainty: 'on_track',
      mapping_mode: 'literal',
      identity: 'Mistral AI',
      change: 'is on track to surpass $1 billion ARR this year',
      visual_driver: 'the current ARR baseline is placed beside the future ARR target',
      visible_outcome: 'the target remains visibly future',
      core_claim:
        'Mistral AI is on track to surpass $1 billion ARR this year.',
      metric: {
        direction: 'increase',
        comparison_target: '$400 million ARR',
        baseline_label: 'Current ARR',
        result_label: 'Projected ARR',
      },
      labels: ['Current ARR', 'Projected ARR', 'ON TRACK'],
      quantitative_facts: [
        { label: 'CURRENT ARR', value: 'OVER $400M' },
        { label: 'TARGET ARR', value: 'OVER $1B' },
      ],
      states: [],
      comparison: null,
      layers: [],
      routing: null,
      required_visible_delta: '',
      forbidden_contradictions: [],
      grammar: {
        context_glyph: 'model_chip',
        mechanism_glyph: 'gauge',
        outcome_glyph: 'coins',
        branch_glyphs: null,
        relation: 'compare',
        outcome_signal: 'higher_tokens',
        human_behavior: false,
      },
    };

    const value = parseAutoVisualClaimV5(raw, story);
    expect(value.semantics.certainty).toBe('expected');
    expect(value.claim.coreClaim).toBe(
      'Mistral AI is on track to surpass $1 billion ARR this year.',
    );
    expect(value.claim.coreClaim).not.toContain('expected to is on track');
  });
});
