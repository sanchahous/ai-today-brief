import { describe, expect, it } from 'vitest';
import {
  parseAutoVisualClaimV5,
  validateAutoVisualClaimV5,
} from './visual-auto-claim-v5';
import type { HoldoutStoryInput } from './visual-auto-claim';

describe('VisualClaim v5 short identity normalization', () => {
  it('expands a product-only identity from the source title before legacy compilation', () => {
    const story: HoldoutStoryInput = {
      week_start: '2026-06-29',
      week_end: '2026-07-05',
      rank: 3,
      revision_item_id: 'strix-story',
      title: 'Strix: Open-source AI penetration testing tool finds and patches vulnerabilities',
      summary:
        'Strix is an open-source autonomous AI penetration testing agent that validates vulnerabilities and generates patches.',
      why: 'Dynamic exploit validation reduces false positives.',
      practical: null,
      takeaway: null,
    };

    const value = parseAutoVisualClaimV5(
      {
        story_id: story.revision_item_id,
        explanatory_role: 'capability_access',
        certainty: 'released',
        mapping_mode: 'literal',
        identity: 'Strix',
        change: 'adds autonomous exploit validation and patch generation',
        visual_driver: 'the testing agent executes an exploit against code and passes a verified flaw to a patch step',
        visible_outcome: 'a validated vulnerability is followed by a repaired code artifact',
        core_claim: 'Strix validates exploitable vulnerabilities and generates patches',
        metric: null,
        labels: ['STRIX', 'EXPLOIT', 'PATCH'],
        quantitative_facts: [],
        states: [],
        comparison: null,
        layers: [],
        routing: null,
        required_visible_delta: '',
        forbidden_contradictions: [],
        grammar: {
          context_glyph: 'agent',
          mechanism_glyph: 'code_file',
          outcome_glyph: 'shield',
          branch_glyphs: null,
          relation: 'inspect',
          outcome_signal: 'safer',
          human_behavior: false,
        },
      },
      story,
    );

    expect(value.claim.identity.length).toBeGreaterThanOrEqual(8);
    expect(value.claim.identity).toContain('Strix');
    expect(value.extractionWarnings).toContain('identity_expanded_from_story_title');
    expect(validateAutoVisualClaimV5(value)).toEqual([]);
  });
});
