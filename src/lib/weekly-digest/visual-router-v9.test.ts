import { describe, expect, it } from 'vitest';
import type { HoldoutStoryInput } from './visual-auto-claim';
import type { AutoVisualClaimV5 } from './visual-auto-claim-v5';
import {
  assertVisualRouteDecisionV9,
  routeVisualStoryV9,
  type VisualRouterInputV9,
} from './visual-router-v9';

function story(input: Partial<HoldoutStoryInput> & Pick<HoldoutStoryInput, 'title' | 'summary'>): HoldoutStoryInput {
  return {
    week_start: '2026-07-27',
    week_end: '2026-08-02',
    rank: input.rank ?? 1,
    revision_item_id: input.revision_item_id ?? `story-${input.rank ?? 1}`,
    title: input.title,
    summary: input.summary,
    why: input.why ?? null,
    practical: input.practical ?? null,
    takeaway: input.takeaway ?? null,
  };
}

function claim(role: AutoVisualClaimV5['semantics']['explanatoryRole']): AutoVisualClaimV5 {
  return {
    storyId: 'story',
    semantics: {
      explanatoryRole: role,
      certainty: 'observed',
      mappingMode: 'literal',
      visualDriver: 'one source-grounded visible action',
      metric: null,
      requiredVisibleDelta: '',
      sourceGuardTerms: [],
    },
  } as unknown as AutoVisualClaimV5;
}

function route(input: {
  story: HoldoutStoryInput;
  role: AutoVisualClaimV5['semantics']['explanatoryRole'];
  eligible?: boolean;
}) {
  const value: VisualRouterInputV9 = {
    story: input.story,
    autoClaim: claim(input.role),
    eligible: input.eligible ?? true,
  };
  const decision = routeVisualStoryV9(value);
  assertVisualRouteDecisionV9(value, decision);
  return decision;
}

describe('visual router v9', () => {
  it('gives a pre-registered deterministic treatment priority over an ineligible generic claim', () => {
    const decision = route({
      story: story({
        title: 'Gemini model performance consistency debate',
        summary: 'Developers report inconsistent coding outputs for the same task.',
      }),
      role: 'uncertainty_announcement',
      eligible: false,
    });

    expect(decision.pipeline).toBe('specialized_deterministic');
    expect(decision.specializedTreatment?.kind).toBe('observed_variability');
    expect(decision.sourceClaimEligible).toBe(false);
    expect(decision.expectedImageCalls).toBe(0);
  });

  it('routes scientific discovery to one source-cinematic image call', () => {
    const decision = route({
      story: story({
        title: 'GPT-5 aids immunologists in solving a T-cell mystery',
        summary: 'Researchers synthesize biological datasets into an actionable hypothesis.',
      }),
      role: 'capability_access',
    });

    expect(decision.pipeline).toBe('specialized_source_cinematic');
    expect(decision.specializedTreatment?.kind).toBe('scientific_discovery');
    expect(decision.expectedImageCalls).toBe(1);
  });

  it('uses the deterministic compiler for audited benchmark comparisons', () => {
    const decision = route({
      story: story({
        title: 'A model reports a lower benchmark cost',
        summary: 'The benchmark preserves an exact comparison target and measured result.',
      }),
      role: 'benchmark_comparison',
    });

    expect(decision.pipeline).toBe('deterministic_compiler');
    expect(decision.specializedTreatment).toBeNull();
    expect(decision.expectedImageCalls).toBe(0);
  });

  it('uses the current art director for audited policy-control stories', () => {
    const decision = route({
      story: story({
        title: 'Infrastructure blocks unauthorized agent access',
        summary: 'A policy boundary prevents destructive execution.',
      }),
      role: 'policy_control',
    });

    expect(decision.pipeline).toBe('current_art_director');
    expect(decision.expectedImageCalls).toBe(1);
  });

  it('routes an unknown ineligible story to a zero-call fallback', () => {
    const decision = route({
      story: story({
        title: 'Unresolved AI announcement',
        summary: 'The approved source does not support an explanatory visual claim.',
      }),
      role: 'uncertainty_announcement',
      eligible: false,
    });

    expect(decision.pipeline).toBe('source_led_fallback');
    expect(decision.expectedImageCalls).toBe(0);
  });
});
