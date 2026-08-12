import { describe, expect, it } from 'vitest';
import { compileVisualPlan, type PrimaryVisualEvidence, type VisualClaim } from './visual-compiler';
import { parseAutoVisualClaim, type AutoVisualClaim, type HoldoutStoryInput } from './visual-auto-claim';
import { approvedSvgText, renderGenericVisualSvg } from './visual-generic-svg';

const story: HoldoutStoryInput = {
  week_start: '2026-07-20',
  week_end: '2026-07-26',
  rank: 1,
  revision_item_id: 'generic-story',
  title: 'Generic unseen story',
  summary: 'A visible mechanism produces a visible result.',
  why: 'The result changes cost and safety.',
  practical: null,
  takeaway: null,
};

function baseClaim(evidence: PrimaryVisualEvidence): VisualClaim {
  return {
    storyId: `story-${evidence}`,
    identity: 'a visible technical system',
    change: 'one factual change alters the system',
    mechanism: 'a visible causal mechanism transforms the input',
    primaryOutcome: 'a visible completed output appears',
    coreClaim: 'the visible mechanism transforms the input into a completed output',
    primaryEvidence: evidence,
    outcomeKind: 'benefit',
    approvedLabels: ['INPUT', 'MECHANISM', 'OUTPUT'],
    forbiddenContradictions: ['the output appears before the mechanism'],
  };
}

function autoClaim(evidence: PrimaryVisualEvidence): AutoVisualClaim {
  const claim = baseClaim(evidence);
  if (evidence === 'temporal_change') claim.states = ['START', 'CHANGE', 'RESULT'];
  if (evidence === 'architecture_change') claim.layers = ['FULL', 'REMOVED', 'CORE'];
  if (evidence === 'counterfactual_comparison') {
    claim.comparison = { left: 'before action', right: 'after action' };
  }
  if (evidence === 'quantitative_difference') {
    claim.comparison = { left: 'large baseline workload', right: 'small filtered workload' };
    claim.quantitativeFacts = [{ label: 'REDUCTION', value: '82×' }];
  }
  if (evidence === 'task_routing') {
    claim.routing = {
      source: 'one local router',
      branches: [
        { label: 'A', destination: 'code engine', visibleOutcome: 'completed code' },
        { label: 'B', destination: 'tool engine', visibleOutcome: 'completed command' },
      ],
    };
  }
  const plan = compileVisualPlan(claim);
  return {
    storyId: claim.storyId,
    claim: { ...claim, overlayDirectives: plan.overlays },
    grammar: {
      contextGlyph: 'local_device',
      mechanismGlyph: evidence === 'architecture_change' ? 'compiler_stack' : 'workflow',
      outcomeGlyph: 'checkmark',
      branchGlyphs: evidence === 'task_routing' ? ['code_file', 'terminal'] : null,
      relation: evidence === 'quantitative_difference' ? 'lower' : 'flow',
      outcomeSignal: evidence === 'quantitative_difference' ? 'lower_tokens' : 'completed',
      humanBehavior: evidence === 'counterfactual_comparison',
    },
    extractionWarnings: [],
  };
}

describe('renderGenericVisualSvg', () => {
  it.each([
    'physical_action',
    'temporal_change',
    'architecture_change',
    'counterfactual_comparison',
    'quantitative_difference',
    'task_routing',
  ] as const)('renders %s without story-specific branching', (evidence) => {
    const value = autoClaim(evidence);
    const plan = compileVisualPlan(value.claim);
    const svg = renderGenericVisualSvg({ autoClaim: value, plan }).toString('utf8');

    expect(svg).toContain('<svg');
    expect(svg).toContain('generic-bg');
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain(value.storyId);
  });

  it('adds only approved deterministic overlay text', () => {
    const value = parseAutoVisualClaim(
      {
        story_id: story.revision_item_id,
        identity: 'a local agent router',
        change: 'tasks split into two specialist paths',
        mechanism: 'one router sends code and shell work to different engines',
        primary_outcome: 'both branches produce completed local outputs',
        core_claim: 'specialist local routes finish code and command work',
        primary_evidence: 'task_routing',
        outcome_kind: 'benefit',
        labels: ['LOCAL ROUTER', 'CODE PATH', 'SHELL PATH'],
        quantitative_facts: [],
        states: [],
        comparison: null,
        layers: [],
        routing: {
          source: 'one local router',
          branches: [
            { label: 'CODE', destination: 'dense engine', visibleOutcome: 'completed code' },
            { label: 'SHELL', destination: 'MoE engine', visibleOutcome: 'completed command' },
          ],
        },
        forbidden_contradictions: [],
        grammar: {
          context_glyph: 'local_device',
          mechanism_glyph: 'workflow',
          outcome_glyph: 'checkmark',
          branch_glyphs: ['code_file', 'terminal'],
          relation: 'branch',
          outcome_signal: 'completed',
          human_behavior: false,
        },
      },
      story,
    );
    const plan = compileVisualPlan(value.claim);
    const svg = renderGenericVisualSvg({
      autoClaim: value,
      plan,
      includeOverlays: true,
    }).toString('utf8');

    expect(approvedSvgText({ autoClaim: value, plan, includeOverlays: true })).toEqual([
      'LOCAL ROUTER',
      'CODE PATH',
      'SHELL PATH',
    ]);
    for (const label of approvedSvgText({ autoClaim: value, plan, includeOverlays: true })) {
      expect(svg).toContain(label);
    }
    expect((svg.match(/<text/g) ?? []).length).toBe(3);
  });
});
