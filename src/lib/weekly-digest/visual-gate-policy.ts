import {
  evaluateFinalGate,
  evaluatePixelGate,
  type FinalGateEvidence,
  type FinalGateFailureCode,
  type GateResult,
  type PixelGateEvidence,
  type PixelGateFailureCode,
} from './visual-compiler';

/**
 * AI Today Brief always displays a story image beside its headline.
 * The headline supplies named identity/context; pixels must independently show
 * the physical mechanism, outcome, causal relation, consistency and no
 * contradiction or generated text. Identity visibility remains diagnostic but
 * is not a hard rejection reason for this product surface.
 */
export function evaluateHeadlinePairedPixelGate(
  evidence: PixelGateEvidence,
): GateResult<PixelGateFailureCode> {
  const strict = evaluatePixelGate(evidence);
  const failures = strict.failures.filter((failure) => failure !== 'identity_missing');
  return { passed: failures.length === 0, failures };
}

/**
 * Final headline-paired validation: pixel semantics first, then deterministic
 * overlay correctness and comprehension of the real headline + image card.
 */
export function evaluateHeadlinePairedFinalGate(
  evidence: FinalGateEvidence,
): GateResult<FinalGateFailureCode> {
  const strictFinal = evaluateFinalGate(evidence);
  const pixel = evaluateHeadlinePairedPixelGate(evidence);
  const nonPixelFailures = strictFinal.failures.filter(
    (failure) =>
      failure === 'labels_not_approved' ||
      failure === 'overlay_contradicts_pixels' ||
      failure === 'headline_pair_unclear' ||
      failure === 'thumbnail_unreadable',
  );
  const failures: FinalGateFailureCode[] = [...pixel.failures, ...nonPixelFailures];
  return { passed: failures.length === 0, failures };
}
