import { describe, expect, it } from 'vitest';
import type { HoldoutStoryInput } from './visual-auto-claim';
import type { AutoVisualClaimV5 } from './visual-auto-claim-v5';
import {
  renderSpecializedVisualSvgV8,
  selectSpecializedVisualTreatmentV8,
  specializedImagePromptV8,
} from './visual-specialized-v8';

function story(input: Partial<HoldoutStoryInput> & Pick<HoldoutStoryInput, 'title' | 'summary'>): HoldoutStoryInput {
  return {
    week_start: '2026-06-22',
    week_end: '2026-06-28',
    rank: input.rank ?? 1,
    revision_item_id: input.revision_item_id ?? `story-${input.rank ?? 1}`,
    title: input.title,
    summary: input.summary,
    why: input.why ?? null,
    practical: input.practical ?? null,
    takeaway: input.takeaway ?? null,
  };
}

const placeholderClaim = {
  storyId: 'story',
  semantics: {
    explanatoryRole: 'capability_access',
    certainty: 'observed',
    mappingMode: 'literal',
    visualDriver: 'source-grounded visible action',
    metric: null,
    requiredVisibleDelta: '',
    sourceGuardTerms: [],
  },
} as unknown as AutoVisualClaimV5;

describe('specialized visual treatments v8', () => {
  it('routes observed model inconsistency to a deterministic variability scene', () => {
    const value = selectSpecializedVisualTreatmentV8({
      story: story({
        title: 'Gemini faces community critique regarding model performance consistency',
        summary:
          'Developers debate reliability in coding environments and report inconsistencies affecting production tasks.',
      }),
      autoClaim: placeholderClaim,
      eligible: false,
    });

    expect(value?.kind).toBe('observed_variability');
    expect(value?.renderMode).toBe('deterministic');
    expect(value?.expectedImageCalls).toBe(0);
    expect(value?.labels).toHaveLength(3);
    expect(value?.forbiddenImplications.join(' ')).toContain('superior');
  });

  it('routes anecdotal high-volume token limits to a threshold scene without exact values', () => {
    const value = selectSpecializedVisualTreatmentV8({
      story: story({
        title: 'Claude Usage Thresholds: Insights from High-Volume Token Consumption',
        summary:
          'Users pushing context windows and rate limits report anecdotal signals and should monitor token burn rate to avoid interruptions.',
      }),
      autoClaim: placeholderClaim,
      eligible: false,
    });

    expect(value?.kind).toBe('operational_threshold');
    expect(value?.renderMode).toBe('deterministic');
    expect(value?.labels).toContain('ANECDOTAL SIGNALS');
    expect(value?.forbiddenImplications.join(' ')).toContain('exact token limit');
  });

  it('routes scientific collaboration to one source-cinematic image call', () => {
    const source = story({
      title: 'GPT-5 Aids Immunologists in Solving T-Cell Mystery',
      summary:
        'Researchers used GPT-5 to synthesize biological datasets and provide an actionable hypothesis for T-cell behavior.',
    });
    const value = selectSpecializedVisualTreatmentV8({
      story: source,
      autoClaim: placeholderClaim,
      eligible: true,
    });

    expect(value?.kind).toBe('scientific_discovery');
    expect(value?.renderMode).toBe('generated_source_cinematic');
    expect(value?.expectedImageCalls).toBe(1);
    const prompt = specializedImagePromptV8(value!, source);
    expect(prompt).toContain('immunology laboratory');
    expect(prompt).toContain('humans remain the researchers');
    expect(prompt).toContain('Absolutely no readable text');
  });

  it('routes deep-work stories to bounded AI assistance rather than passive automation', () => {
    const source = story({
      title: 'Managing AI-Driven Distraction and Rediscovering Deep Work',
      summary:
        'Use LLMs as sparring partners while retaining active problem-solving instead of offloading all cognitive work.',
    });
    const value = selectSpecializedVisualTreatmentV8({
      story: source,
      autoClaim: placeholderClaim,
      eligible: true,
    });

    expect(value?.kind).toBe('focused_cognition');
    const prompt = specializedImagePromptV8(value!, source);
    expect(prompt).toContain('exactly one bounded hint');
    expect(prompt).toContain('passive automation is forbidden');
  });

  it('renders deterministic scenes without generated typography in pixel-only mode', () => {
    const source = story({
      title: 'Gemini model consistency',
      summary: 'Developers report inconsistent model outputs for the same coding task.',
    });
    const value = selectSpecializedVisualTreatmentV8({
      story: source,
      autoClaim: placeholderClaim,
      eligible: false,
    });
    const pixels = renderSpecializedVisualSvgV8({
      treatment: value!,
      includeOverlays: false,
    }).toString('utf8');
    const final = renderSpecializedVisualSvgV8({
      treatment: value!,
      includeOverlays: true,
    }).toString('utf8');

    expect(pixels).toContain('data-specialized-v8="observed_variability"');
    expect(pixels).not.toContain('SAME TASK');
    expect(final).toContain('SAME TASK');
    expect(final).toContain('DIVERGENT OUTPUTS');
  });
});
