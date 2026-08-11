/**
 * Env-backed knobs for content simulation. Defaults match the plan:
 * ≤5 image repair attempts, overall vision score ≥80, spend cap per image.
 */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function floatEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const CONTENT_SIM_DEFAULTS = {
  maxImageRepairAttempts: 5,
  scoreThreshold: 80,
  maxImageSpendUsd: 0.5,
  /** Soft estimate charged per vision critic call when provider omits cost. */
  visionCriticEstimatedUsd: 0.01,
} as const;

export function contentSimMaxImageRepairAttempts(): number {
  return intEnv('CONTENT_SIM_MAX_IMAGE_REPAIR', CONTENT_SIM_DEFAULTS.maxImageRepairAttempts);
}

export function contentSimScoreThreshold(): number {
  return intEnv('CONTENT_SIM_SCORE_THRESHOLD', CONTENT_SIM_DEFAULTS.scoreThreshold);
}

export function contentSimMaxImageSpendUsd(): number {
  return floatEnv('CONTENT_SIM_MAX_IMAGE_SPEND_USD', CONTENT_SIM_DEFAULTS.maxImageSpendUsd);
}

export function contentSimVisionCriticEstimatedUsd(): number {
  return floatEnv(
    'CONTENT_SIM_VISION_CRITIC_USD',
    CONTENT_SIM_DEFAULTS.visionCriticEstimatedUsd,
  );
}

/** Kill-switch: when off, generation skips vision loop (deterministic only optional). */
export function contentSimImageLoopEnabled(): boolean {
  const raw = process.env.CONTENT_SIM_IMAGE_LOOP?.trim().toLowerCase();
  if (!raw) return true;
  return raw !== '0' && raw !== 'off' && raw !== 'false';
}
