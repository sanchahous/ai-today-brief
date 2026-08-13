import { describe, expect, it } from 'vitest';
import type { HoldoutStoryInput } from './visual-auto-claim';
import type { AutoVisualClaimV5 } from './visual-auto-claim-v5';
import {
  affordanceImagePromptV10,
  renderAffordanceVisualSvgV10,
  selectAffordanceTreatmentV10,
} from './visual-affordance-treatment-v10';

function story(input: {
  title: string;
  summary: string;
  why?: string;
  practical?: string;
}): HoldoutStoryInput {
  return {
    week_start: '2026-06-22',
    week_end: '2026-06-28',
    rank: 1,
    revision_item_id: 'story-id',
    title: input.title,
    summary: input.summary,
    why: input.why ?? null,
    practical: input.practical ?? null,
    takeaway: null,
  };
}

function claim(role: AutoVisualClaimV5['semantics']['explanatoryRole']): AutoVisualClaimV5 {
  return {
    storyId: 'story-id',
    semantics: {
      explanatoryRole: role,
      certainty: 'observed',
      mappingMode: 'literal',
      visualDriver: 'one visible action',
      metric: null,
      requiredVisibleDelta: '',
      sourceGuardTerms: [],
    },
    claim: {
      identity: 'system',
      change: 'changes one workflow',
      mechanism: 'one visible process',
      primaryOutcome: 'one visible result',
      coreClaim: 'one bounded source-grounded claim',
      primaryEvidence: 'physical_action',
      outcomeKind: 'benefit',
      approvedLabels: [],
      quantitativeFacts: [],
      forbiddenContradictions: [],
    },
    grammar: { humanBehavior: false },
  } as unknown as AutoVisualClaimV5;
}

describe('visual affordance treatments v10', () => {
  it('uses one task and one system for repeated-run variability', () => {
    const value = selectAffordanceTreatmentV10({
      story: story({
        title: 'Model performance consistency debate',
        summary:
          'The same coding task is repeated through the same model and produces different outputs across runs.',
      }),
      autoClaim: claim('causal_mechanism'),
      eligible: true,
    });

    expect(value?.kind).toBe('same_system_output_variability');
    expect(value?.grammar).toBe('controlled_comparison');
    expect(value?.labels).toEqual(['SAME TASK', 'RUN A', 'RUN B']);
    expect(value?.forbiddenImplications.join(' ')).toContain('two different models');

    const pixels = renderAffordanceVisualSvgV10({
      treatment: value!,
      includeOverlays: false,
    }).toString('utf8');
    const final = renderAffordanceVisualSvgV10({
      treatment: value!,
      includeOverlays: true,
    }).toString('utf8');
    expect(pixels).toContain('data-affordance-v10="same_system_output_variability"');
    expect(pixels).not.toContain('SAME TASK');
    expect(final).toContain('SAME TASK');
    expect(final).toContain('RUN A');
    expect(final).toContain('RUN B');
  });

  it('shows cache split and monitor as one operational workflow', () => {
    const value = selectAffordanceTreatmentV10({
      story: story({
        title: 'Usage thresholds in high-volume sessions',
        summary:
          'Teams should cache stable context, split long sessions and monitor token burn before interruption.',
      }),
      autoClaim: claim('causal_mechanism'),
      eligible: true,
    });

    expect(value?.kind).toBe('controlled_session_workflow');
    expect(value?.grammar).toBe('causal_process_sequence');
    expect(value?.labels).toEqual(['CACHE', 'SPLIT', 'MONITOR']);
    const svg = renderAffordanceVisualSvgV10({
      treatment: value!,
      includeOverlays: true,
    }).toString('utf8');
    expect(svg).toContain('data-affordance-v10="controlled_session_workflow"');
    expect(svg).toContain('marker-end="url(#v10-arrow)"');
    expect(svg).toContain('CACHE');
    expect(svg).toContain('SPLIT');
    expect(svg).toContain('MONITOR');
  });

  it('requires one visible device and exactly two attached hands for bounded assistance', () => {
    const source = story({
      title: 'Managing AI-driven distraction and rediscovering deep work',
      summary:
        'A person keeps active problem-solving while an AI sparring partner offers one bounded hint.',
    });
    const value = selectAffordanceTreatmentV10({
      story: source,
      autoClaim: claim('causal_mechanism'),
      eligible: true,
    });

    expect(value?.kind).toBe('bounded_assistance');
    expect(value?.renderMode).toBe('generated_source_cinematic');
    const prompt = affordanceImagePromptV10(value!, source);
    expect(prompt).toContain('Exactly two human hands');
    expect(prompt).toContain('small physical AI assistance device');
    expect(prompt).toContain('unmistakable source of one narrow cyan cone');
    expect(prompt).toContain('No other person, arm, hand');
    expect(prompt).toContain('Passive automation is forbidden');
  });

  it('does not create a factual treatment for an ineligible claim', () => {
    const value = selectAffordanceTreatmentV10({
      story: story({
        title: 'Unverified claim',
        summary: 'The source does not support an explanatory visual.',
      }),
      autoClaim: claim('uncertainty_announcement'),
      eligible: false,
    });
    expect(value).toBeNull();
  });
});
