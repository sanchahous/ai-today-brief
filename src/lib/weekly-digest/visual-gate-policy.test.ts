import { describe, expect, it } from 'vitest';
import type { FinalGateEvidence } from './visual-compiler';
import {
  evaluateHeadlinePairedFinalGate,
  evaluateHeadlinePairedPixelGate,
} from './visual-gate-policy';

function evidence(overrides: Partial<FinalGateEvidence> = {}): FinalGateEvidence {
  return {
    identityVisible: true,
    mechanismVisible: true,
    outcomeVisible: true,
    causalRelationVisible: true,
    contradictoryAction: false,
    generatedTextPresent: false,
    subjectConsistent: true,
    labelsApprovedAndExact: true,
    overlaysSupportedByPixels: true,
    headlineImagePairUnderstood: true,
    thumbnailReadable: true,
    ...overrides,
  };
}

describe('always-headline-paired visual gates', () => {
  it('keeps identity visibility diagnostic instead of a hard pixel blocker', () => {
    expect(
      evaluateHeadlinePairedPixelGate(evidence({ identityVisible: false })),
    ).toEqual({ passed: true, failures: [] });
  });

  it('still rejects a missing mechanism, outcome or causal relation', () => {
    const gate = evaluateHeadlinePairedPixelGate(
      evidence({
        identityVisible: false,
        mechanismVisible: false,
        outcomeVisible: false,
        causalRelationVisible: false,
      }),
    );
    expect(gate.passed).toBe(false);
    expect(gate.failures).toEqual(
      expect.arrayContaining([
        'mechanism_missing',
        'outcome_missing',
        'causal_relation_missing',
      ]),
    );
    expect(gate.failures).not.toContain('identity_missing');
  });

  it('rejects generated text and contradictory action before overlays', () => {
    const gate = evaluateHeadlinePairedPixelGate(
      evidence({ generatedTextPresent: true, contradictoryAction: true }),
    );
    expect(gate.failures).toEqual(
      expect.arrayContaining(['generated_text', 'contradictory_action']),
    );
  });

  it('passes a final card when the headline supplies identity and the image supplies semantics', () => {
    const gate = evaluateHeadlinePairedFinalGate(
      evidence({ identityVisible: false, headlineImagePairUnderstood: true }),
    );
    expect(gate).toEqual({ passed: true, failures: [] });
  });

  it('does not let the headline or labels rescue missing pixel evidence', () => {
    const gate = evaluateHeadlinePairedFinalGate(
      evidence({
        identityVisible: false,
        outcomeVisible: false,
        overlaysSupportedByPixels: false,
        headlineImagePairUnderstood: true,
      }),
    );
    expect(gate.passed).toBe(false);
    expect(gate.failures).toEqual(
      expect.arrayContaining(['outcome_missing', 'overlay_contradicts_pixels']),
    );
  });

  it('still requires exact labels and a readable real card', () => {
    const gate = evaluateHeadlinePairedFinalGate(
      evidence({
        labelsApprovedAndExact: false,
        headlineImagePairUnderstood: false,
        thumbnailReadable: false,
      }),
    );
    expect(gate.failures).toEqual(
      expect.arrayContaining([
        'labels_not_approved',
        'headline_pair_unclear',
        'thumbnail_unreadable',
      ]),
    );
  });
});
