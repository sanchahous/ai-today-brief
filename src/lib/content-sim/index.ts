export type {
  ContentSimAdapterId,
  ContentSimArtifactMeta,
  ContentSimBlocker,
  ContentSimCritique,
  ContentSimEscalation,
  ContentSimIterationRecord,
  ContentSimLoopHooks,
  ContentSimManifest,
  ContentSimOutcome,
  ContentSimQualityReport,
  ContentSimRepairDirective,
  ContentSimScores,
} from './types';
export { CONTENT_SIM_ADAPTERS } from './types';
export {
  CONTENT_SIM_DEFAULTS,
  contentSimImageLoopEnabled,
  contentSimMaxImageRepairAttempts,
  contentSimMaxImageSpendUsd,
  contentSimScoreThreshold,
  contentSimVisionCriticEstimatedUsd,
} from './config';
export { runRepairLoop } from './loop';
export {
  buildEscalationPackage,
  contentSimGateCleared,
  toContentSimArtifactMeta,
} from './escalation';
export { deterministicImageCritique, type DeterministicImageInput } from './deterministic-image';
export {
  buildImageCriticPrompt,
  buildImageOnlyCriticPrompt,
  extractJsonObject,
  parseImageCriticResponse,
  clampOverallByNewsLegibility,
  newsLegibilityThreshold,
  IMAGE_CRITIC_BLOCKER_CODES,
  NEWS_LEGIBILITY_MIN,
} from './vision-critic';
