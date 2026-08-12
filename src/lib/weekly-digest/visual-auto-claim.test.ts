import { describe, expect, it } from 'vitest';
import {
  compileAutoVisualClaim,
  overlayDirectivesForLabels,
  parseAutoVisualClaim,
  validateAutoVisualClaim,
  visualClaimExtractionJsonSchema,
  visualClaimExtractionPrompt,
  type HoldoutStoryInput,
} from './visual-auto-claim';

const story: HoldoutStoryInput = {
  week_start: '2026-07-20',
  week_end: '2026-07-26',
  rank: 4,
  revision_item_id: 'story-code-graph',
  title: 'Code Review Graph Cuts AI Token Consumption in PR Reviews by 82x',
  summary:
    'A Tree-sitter graph limits review context to impacted call paths and reduces token use by 82x.',
  why: 'Review agents can avoid loading an entire codebase.',
  practical: null,
  takeaway: 'Send only impacted dependency paths.',
};

describe('parseAutoVisualClaim', () => {
  it('normalizes a quantitative claim and assigns explicit overlay regions', () => {
    const value = parseAutoVisualClaim(
      {
        story_id: story.revision_item_id,
        identity: 'a full codebase beside an impacted dependency graph',
        change: 'the review agent receives only impacted call paths',
        mechanism: 'a structural graph filters the context before review',
        primary_outcome: 'the smaller context uses 82 times fewer tokens',
        core_claim: 'dependency filtering cuts review context and token use',
        primary_evidence: 'quantitative_difference',
        outcome_kind: 'benefit',
        labels: ['FULL CODEBASE', 'IMPACTED GRAPH', '82× FEWER TOKENS'],
        quantitative_facts: [{ label: 'TOKEN USE', value: '82× LOWER' }],
        states: [],
        comparison: {
          left: 'the full repository enters the review model',
          right: 'only impacted call paths enter the review model',
        },
        layers: [],
        routing: null,
        forbidden_contradictions: ['the filtered path uses more context'],
        grammar: {
          context_glyph: 'code_file',
          mechanism_glyph: 'code_graph',
          outcome_glyph: 'gauge',
          branch_glyphs: null,
          relation: 'lower',
          outcome_signal: 'lower_tokens',
          human_behavior: false,
        },
      },
      story,
    );

    expect(value.claim.primaryEvidence).toBe('quantitative_difference');
    expect(value.claim.overlayDirectives).toEqual([
      { text: 'FULL CODEBASE', regionId: 'baseline', importance: 'primary' },
      { text: 'IMPACTED GRAPH', regionId: 'amplified', importance: 'secondary' },
      { text: '82× FEWER TOKENS', regionId: 'amplified', importance: 'secondary' },
    ]);
    expect(value.grammar.relation).toBe('lower');
    expect(validateAutoVisualClaim(value)).toEqual([]);
    expect(compileAutoVisualClaim(value).format).toBe('cinematic_data_contrast');
  });

  it('falls back to grounded glyphs and physical action when optional fields are malformed', () => {
    const value = parseAutoVisualClaim(
      {
        identity: 'a package proxy inside an agent sandbox',
        change: 'the proxy exposes an external route',
        mechanism: 'the agent crosses the permissive package route',
        primary_outcome: 'the sandbox reaches the public internet',
        core_claim: 'a permissive proxy turns a sandbox dependency into an escape route',
        primary_evidence: 'not-a-format',
        outcome_kind: 'harm',
        labels: ['SANDBOX', 'PROXY ESCAPE', 'PUBLIC INTERNET', 'EXTRA'],
        quantitative_facts: [],
        states: [],
        comparison: null,
        layers: [],
        routing: null,
        forbidden_contradictions: [],
        grammar: {
          context_glyph: 'unknown',
          mechanism_glyph: 'unknown',
          outcome_glyph: 'internet',
          branch_glyphs: null,
          relation: 'escape',
          outcome_signal: 'escaped',
          human_behavior: false,
        },
      },
      {
        ...story,
        revision_item_id: 'sandbox-story',
        title: 'Agent sandbox escape through package proxy',
        summary: 'An agent exploited a package proxy and reached the internet.',
      },
    );

    expect(value.claim.primaryEvidence).toBe('physical_action');
    expect(value.claim.approvedLabels).toHaveLength(3);
    expect(value.grammar.contextGlyph).toBe('sandbox');
    expect(value.grammar.mechanismGlyph).toBe('workflow');
    expect(value.grammar.outcomeGlyph).toBe('internet');
  });
});

describe('extraction contract', () => {
  it('maps labels in visual reading order for every format', () => {
    expect(overlayDirectivesForLabels(['A', 'B', 'C'], 'cinematic_routing')).toEqual([
      { text: 'A', regionId: 'route-source', importance: 'primary' },
      { text: 'B', regionId: 'route-a', importance: 'secondary' },
      { text: 'C', regionId: 'route-b', importance: 'secondary' },
    ]);
    expect(overlayDirectivesForLabels(['A', 'B', 'C'], 'cinematic_sequence')).toEqual([
      { text: 'A', regionId: 'state-1', importance: 'primary' },
      { text: 'B', regionId: 'state-2', importance: 'secondary' },
      { text: 'C', regionId: 'state-3', importance: 'secondary' },
    ]);
  });

  it('builds a fixed-size strict batch schema and a headline-paired prompt', () => {
    const schema = visualClaimExtractionJsonSchema(['one', 'two']);
    expect(schema.json_schema.schema.properties.claims.minItems).toBe(2);
    expect(schema.json_schema.schema.properties.claims.maxItems).toBe(2);
    const prompt = visualClaimExtractionPrompt([story]);
    expect(prompt).toContain('always displayed directly beside its headline');
    expect(prompt).toContain('The outcome must be visible');
    expect(prompt).toContain(story.revision_item_id);
  });
});
