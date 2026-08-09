export type GenerationBackend = 'vercel' | 'github_actions';

export type GenerationFailureKind =
  | 'timeout'
  | 'rate_limit'
  | 'quota'
  | 'network'
  | 'validation'
  | 'quality_gate'
  | 'cancelled'
  | 'unknown';

export interface GenerationFailure {
  code: GenerationFailureKind;
  retryable: boolean;
  nextAction: string;
}

export interface GenerationStage {
  key: string;
  label: string;
  weight: number;
}

export interface GenerationDurationSample {
  durationMs: number;
  completedAt?: string;
}

export interface GenerationEta {
  p50Ms: number;
  p95Ms: number;
  historicalSamples: number;
  source: 'history' | 'configured_budget';
}

export const LONG_RUNNING_GENERATION_JOB_TYPES = [
  'editorial_master',
  'social_copy',
  'video_script',
] as const;

export const SHORT_RUNNING_GENERATION_JOB_TYPES = [
  'research_pack',
  'story_image',
  'cover',
  'pdf',
  'social_asset',
  'video_manifest',
] as const;

const STAGES: Record<string, readonly GenerationStage[]> = {
  editorial_master: [
    { key: 'prepare', label: 'Preparing approved research', weight: 2 },
    { key: 'english', label: 'Writing English edition', weight: 28 },
    { key: 'ukrainian', label: 'Adapting Ukrainian edition', weight: 28 },
    { key: 'critic', label: 'Running editorial critic', weight: 17 },
    { key: 'revisions', label: 'Applying optional revisions', weight: 20 },
    { key: 'persist', label: 'Saving revision', weight: 5 },
  ],
  social_copy: [
    { key: 'prepare', label: 'Preparing social source', weight: 5 },
    { key: 'channels', label: 'Writing channel variants', weight: 85 },
    { key: 'persist', label: 'Saving social package', weight: 10 },
  ],
  video_script: [
    { key: 'prepare', label: 'Preparing article source', weight: 10 },
    { key: 'script', label: 'Writing video script', weight: 80 },
    { key: 'persist', label: 'Saving script', weight: 10 },
  ],
};

export function backendForGenerationJob(jobType: string): GenerationBackend {
  return (LONG_RUNNING_GENERATION_JOB_TYPES as readonly string[]).includes(jobType)
    ? 'github_actions'
    : 'vercel';
}

export function stageManifest(jobType: string): readonly GenerationStage[] {
  return (
    STAGES[jobType] ?? [
      { key: 'prepare', label: 'Preparing generation', weight: 10 },
      { key: 'generate', label: 'Generating artifact', weight: 80 },
      { key: 'persist', label: 'Saving artifact', weight: 10 },
    ]
  );
}

export function stageProgress(
  jobType: string,
  completedSteps: readonly string[],
  activeStep?: string,
): number {
  const completed = new Set(completedSteps);
  const stages = stageManifest(jobType);
  let progress = 0;
  for (const stage of stages) {
    if (completed.has(stage.key)) progress += stage.weight;
  }
  if (activeStep && completed.has(activeStep)) return Math.min(100, progress);
  return Math.min(100, progress);
}

export function clampMonotonicProgress(previous: number, next: number): number {
  if (!Number.isFinite(next)) return Math.max(0, previous);
  return Math.min(100, Math.max(0, previous, Math.round(next)));
}

export function classifyGenerationFailure(message: string): GenerationFailure {
  const normalized = message.toLowerCase();
  if (/quality gate|quality.*(?:failed|block)|dimension.*score/.test(normalized)) {
    return {
      code: 'quality_gate',
      retryable: false,
      nextAction: 'Review the quality report and create a manual retry.',
    };
  }
  if (/validation|invalid|schema|must be|required|approve all/.test(normalized)) {
    return {
      code: 'validation',
      retryable: false,
      nextAction: 'Fix the reported input or approval gate, then retry manually.',
    };
  }
  if (/quota|insufficient credits|billing|payment required/.test(normalized)) {
    return {
      code: 'quota',
      retryable: false,
      nextAction: 'Restore provider quota or billing, then retry manually.',
    };
  }
  if (/rate limit|\b429\b/.test(normalized)) {
    return { code: 'rate_limit', retryable: true, nextAction: 'The job will retry with backoff.' };
  }
  if (/timed? out|timeout|deadline exceeded|aborted/.test(normalized)) {
    return { code: 'timeout', retryable: true, nextAction: 'The job will retry with backoff.' };
  }
  if (
    /\b5\d\d\b|fetch failed|network|econnreset|eai_again|connection reset|dns|temporar/.test(
      normalized,
    )
  ) {
    return { code: 'network', retryable: true, nextAction: 'The job will retry with backoff.' };
  }
  if (/cancelled|canceled/.test(normalized)) {
    return {
      code: 'cancelled',
      retryable: false,
      nextAction: 'Create a manual retry if work should continue.',
    };
  }
  return {
    code: 'unknown',
    retryable: false,
    nextAction: 'Review the error and create a manual retry if appropriate.',
  };
}

export function redactGenerationMessage(value: string, limit = 1800): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(?:api[_-]?key|token|secret)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]')
    .slice(0, limit);
}

function percentile(values: readonly number[], ratio: number): number {
  const position = Math.max(0, Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1));
  return values[position] ?? 0;
}

export function estimateGenerationEta(
  samples: readonly GenerationDurationSample[],
  configuredBudgetMs: number,
): GenerationEta {
  const durations = samples
    .filter((sample) => Number.isFinite(sample.durationMs) && sample.durationMs > 0)
    .sort((left, right) => (left.completedAt ?? '').localeCompare(right.completedAt ?? ''))
    .slice(-30)
    .map((sample) => sample.durationMs)
    .sort((left, right) => left - right);
  if (durations.length < 5) {
    return {
      p50Ms: configuredBudgetMs,
      p95Ms: configuredBudgetMs,
      historicalSamples: durations.length,
      source: 'configured_budget',
    };
  }
  return {
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    historicalSamples: durations.length,
    source: 'history',
  };
}
