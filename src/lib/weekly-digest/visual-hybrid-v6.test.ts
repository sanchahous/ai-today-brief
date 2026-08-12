import { describe, expect, it } from 'vitest';
import type { HoldoutStoryInput } from './visual-auto-claim';
import type { AutoVisualClaimV5 } from './visual-auto-claim-v5';
import {
  analogyImagePromptV6,
  buildHybridTreatmentV6,
  exactDeterministicLabelsV6,
  selectHybridTreatmentModeV6,
  validateAnalogyPlanV6,
  type AnalogyAuditV6,
  type AnalogyPlanV6,
} from './visual-hybrid-v6';

function story(overrides: Partial<HoldoutStoryInput> = {}): HoldoutStoryInput {
  return {
    week_start: '2026-06-29',
    week_end: '2026-07-05',
    rank: 1,
    revision_item_id: 'story-1',
    title: 'A causal developer-tool story',
    summary: 'A forgiving client repairs malformed calls, so stricter clients later receive invented keys.',
    why: 'Strict schemas expose the malformed output.',
    practical: null,
    takeaway: null,
    ...overrides,
  };
}

function claim(overrides: Partial<AutoVisualClaimV5> = {}): AutoVisualClaimV5 {
  return {
    storyId: 'story-1',
    claim: {
      storyId: 'story-1',
      identity: 'the forgiving tool-calling client and strict schema',
      change: 'the forgiving client silently repairs malformed calls',
      mechanism: 'silent repair removes pressure to emit strict nested arguments',
      primaryOutcome: 'later calls contain invented keys and fail strict validation',
      coreClaim:
        'silent repair by a forgiving client leads later model output to contain invented keys that fail strict schemas',
      primaryEvidence: 'physical_action',
      outcomeKind: 'harm',
      approvedLabels: ['FORGIVING CLIENT', 'STRICT SCHEMA', 'INVENTED KEYS'],
      forbiddenContradictions: ['do not imply the strict schema invents the keys'],
      overlayDirectives: [],
    },
    grammar: {
      contextGlyph: 'model_chip',
      mechanismGlyph: 'workflow',
      outcomeGlyph: 'code_file',
      branchGlyphs: null,
      relation: 'flow',
      outcomeSignal: 'failure',
      humanBehavior: false,
    },
    extractionWarnings: [],
    semantics: {
      explanatoryRole: 'causal_mechanism',
      certainty: 'observed',
      mappingMode: 'literal',
      visualDriver: 'a forgiving client silently repairs malformed calls',
      metric: null,
      requiredVisibleDelta: '',
      sourceGuardTerms: [],
    },
    ...overrides,
  };
}

function analogy(overrides: Partial<AnalogyPlanV6> = {}): AnalogyPlanV6 {
  return {
    storyId: 'story-1',
    title: 'The forgiving lock',
    subject: 'a precision key-cutting machine between two mechanical locks',
    action:
      'the first forgiving lock accepts a visibly malformed key while the machine keeps producing distorted copies',
    setting: 'a clean industrial locksmith workshop',
    props: ['one malformed brass key', 'one strict precision lock'],
    sourceAnchor: 'two visibly different mechanical locks connected to one key-cutting machine',
    visibleMechanism: 'the forgiving lock accepts the malformed key without forcing correction',
    visibleOutcome: 'the copied malformed key visibly jams inside the strict precision lock',
    mappings: [
      { sourceElement: 'forgiving client', physicalElement: 'forgiving mechanical lock' },
      { sourceElement: 'silent repair pressure', physicalElement: 'acceptance of a malformed brass key' },
      { sourceElement: 'invented keys fail strict schema', physicalElement: 'distorted copy jams in precision lock' },
    ],
    whyItFits:
      'The same malformed key passes through the forgiving boundary and then visibly fails at the strict boundary, preserving the causal sequence.',
    unsupportedAssertions: [],
    forbiddenVisuals: ['readable text', 'logos'],
    ...overrides,
  };
}

function audit(overrides: Partial<AnalogyAuditV6> = {}): AnalogyAuditV6 {
  return {
    storyId: 'story-1',
    passed: true,
    sourceAnchorPreserved: true,
    mechanismPreserved: true,
    outcomePreserved: true,
    certaintyPreserved: true,
    oneToOneMapping: true,
    visuallyTestable: true,
    unsupportedSpecifics: false,
    issues: [],
    rationale: 'The physical mapping preserves context, mechanism and outcome.',
    ...overrides,
  };
}

describe('Visual Compiler v6 hybrid treatment', () => {
  it('routes an audited causal analogy to generated pixels', () => {
    const value = claim();
    expect(selectHybridTreatmentModeV6(value, analogy(), audit())).toBe(
      'generated_audited_analogy',
    );
    expect(buildHybridTreatmentV6(value, story(), analogy(), audit()).eligible).toBe(true);
  });

  it('falls back to deterministic literal when analogy audit fails', () => {
    expect(
      selectHybridTreatmentModeV6(
        claim(),
        analogy(),
        audit({ passed: false, issues: ['mechanism_not_preserved'] }),
      ),
    ).toBe('deterministic_literal');
  });

  it('keeps guarded quantitative wording in deterministic overlays', () => {
    const source = story({
      title: 'Prompt caching cuts API costs',
      summary:
        'Developers can reduce API costs up to 90% by structuring prompts to maximize cache hits.',
    });
    const value = claim({
      claim: {
        ...claim().claim,
        approvedLabels: ['API COSTS', 'TOKEN CACHE', '90% REDUCTION'],
      },
      semantics: {
        ...claim().semantics,
        explanatoryRole: 'quantitative_result',
        metric: {
          direction: 'decrease',
          comparisonTarget: '',
          baselineLabel: 'Unoptimized API Costs',
          resultLabel: 'Optimized API Costs',
        },
      },
    });
    expect(exactDeterministicLabelsV6(value, source)).toEqual([
      'API COSTS',
      'TOKEN CACHE',
      'UP TO 90%',
    ]);
  });

  it('builds guarded current-versus-target labels for an on-track announcement', () => {
    const source = story({
      title: 'Mistral expands its platform',
      summary:
        'Mistral AI reported reaching over $400 million ARR and is on track to surpass $1 billion ARR this year.',
    });
    const value = claim({
      semantics: {
        ...claim().semantics,
        explanatoryRole: 'uncertainty_announcement',
        certainty: 'expected',
      },
    });
    expect(exactDeterministicLabelsV6(value, source)).toEqual([
      'OVER $400M ARR',
      '$1B ARR',
      'ON TRACK',
    ]);
  });

  it('rejects pseudo-infographic analogy plans and unsupported assertions', () => {
    const issues = validateAnalogyPlanV6(
      analogy({
        action: 'a dashboard screen displays labelled code panels',
        unsupportedAssertions: ['the strict schema improves model accuracy'],
      }),
      claim(),
    );
    expect(issues).toContain('banned_render_language');
    expect(issues).toContain('unsupported_assertions_present');
  });

  it('keeps generated analogy prompts text-free and causally explicit', () => {
    const prompt = analogyImagePromptV6(claim(), analogy());
    expect(prompt).toContain('visible causal action');
    expect(prompt).toContain('visible physical result');
    expect(prompt).toContain('Absolutely no readable text');
  });
});
