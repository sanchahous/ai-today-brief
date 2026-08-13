import { describe, expect, it } from 'vitest';
import type { HoldoutStoryInput } from './visual-auto-claim';
import type { AutoVisualClaimV5 } from './visual-auto-claim-v5';
import { compileAutoVisualClaimV5 } from './visual-auto-claim-v5';
import { buildHybridTreatmentV6 } from './visual-hybrid-v6';
import { renderGenericVisualSvgV6 } from './visual-generic-svg-v6';

function announcementStory(): HoldoutStoryInput {
  return {
    week_start: '2026-06-29',
    week_end: '2026-07-05',
    rank: 2,
    revision_item_id: 'mistral-v6',
    title: 'Mistral expands its enterprise platform',
    summary:
      'Mistral AI reported reaching over $400 million ARR and is on track to surpass $1 billion ARR this year.',
    why: 'The current result and future target must remain visibly distinct.',
    practical: null,
    takeaway: null,
  };
}

function announcementClaim(): AutoVisualClaimV5 {
  return {
    storyId: 'mistral-v6',
    claim: {
      storyId: 'mistral-v6',
      identity: 'Mistral AI enterprise platform business',
      change: 'is on track to surpass $1 billion ARR this year',
      mechanism: 'the reported current ARR is compared with the future target',
      primaryOutcome: 'the $1 billion ARR target remains future and unconfirmed',
      coreClaim:
        'Mistral AI reported over $400 million ARR and is on track to surpass $1 billion ARR this year',
      primaryEvidence: 'counterfactual_comparison',
      outcomeKind: 'uncertainty',
      approvedLabels: ['Current ARR', 'Projected ARR', 'ON TRACK'],
      quantitativeFacts: [
        { label: 'Current ARR', value: 'Over $400M' },
        { label: 'Projected ARR', value: 'Over $1B' },
      ],
      comparison: {
        left: 'reported current ARR over $400 million',
        right: 'future target over $1 billion ARR',
      },
      forbiddenContradictions: ['do not imply the future ARR target was already achieved'],
      overlayDirectives: [],
    },
    grammar: {
      contextGlyph: 'model_chip',
      mechanismGlyph: 'gauge',
      outcomeGlyph: 'coins',
      branchGlyphs: null,
      relation: 'compare',
      outcomeSignal: 'uncertain',
      humanBehavior: false,
    },
    extractionWarnings: [],
    semantics: {
      explanatoryRole: 'uncertainty_announcement',
      certainty: 'expected',
      mappingMode: 'literal',
      visualDriver:
        'the current ARR baseline is placed beside a visibly unconfirmed future ARR target',
      metric: {
        direction: 'increase',
        comparisonTarget: '$400 million ARR',
        baselineLabel: 'Current ARR',
        resultLabel: 'Projected ARR',
      },
      requiredVisibleDelta: '',
      sourceGuardTerms: ['on track'],
    },
  };
}

describe('renderGenericVisualSvgV6', () => {
  it('renders a future target as dashed and visibly unachieved', () => {
    const story = announcementStory();
    const autoClaim = announcementClaim();
    const plan = compileAutoVisualClaimV5(autoClaim);
    const treatment = buildHybridTreatmentV6(autoClaim, story, null, null);
    const svg = renderGenericVisualSvgV6({
      story,
      autoClaim,
      plan,
      treatment,
      includeOverlays: true,
    }).toString('utf8');

    expect(svg).toContain('data-v6-future-unconfirmed="true"');
    expect(svg).toContain('stroke-dasharray="16 13"');
    expect(svg).toContain('OVER $400M ARR');
    expect(svg).toContain('$1B ARR');
    expect(svg).toContain('ON TRACK');
    expect(svg).not.toContain('M25 18h50v22');
  });

  it('preserves the three-overlay cap', () => {
    const story = announcementStory();
    const autoClaim = announcementClaim();
    const plan = compileAutoVisualClaimV5(autoClaim);
    const treatment = buildHybridTreatmentV6(autoClaim, story, null, null);
    const svg = renderGenericVisualSvgV6({
      story,
      autoClaim,
      plan,
      treatment,
      includeOverlays: true,
    }).toString('utf8');

    expect((svg.match(/<text/g) ?? []).length).toBe(3);
  });
});
