export type GenerationBackend = 'vercel' | 'github_actions';

export type GenerationFailureKind =
  | 'timeout'
  | 'rate_limit'
  | 'quota'
  | 'network'
  | 'validation'
  /**
   * Legacy only. The editorial master no longer fails on quality: an edition
   * the repair loop cannot fully fix is saved as an inactive draft revision
   * and the job finishes as `succeeded` with `needs_owner_review`. Kept so
   * historical rows still classify.
   */
  | 'quality_gate'
  /** Every social provider/model failed transiently; retry from saved channel checkpoints. */
  | 'provider_exhausted'
  /** Ran out of run budget with durable segments saved; a retry continues. */
  | 'resumable'
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
  'story_image',
] as const;

export const SHORT_RUNNING_GENERATION_JOB_TYPES = [
  'research_pack',
  'cover',
  'pdf',
  'social_asset',
  'video_manifest',
] as const;

const STAGES: Record<string, readonly GenerationStage[]> = {
  // Mirrors the engine's own steps (master-engine.ts): the writes are now a
  // sequence of per-story/per-frame segments, and `validate` is the free
  // deterministic repair pass that runs before any paid critic call.
  editorial_master: [
    { key: 'prepare', label: 'Preparing approved research', weight: 4 },
    { key: 'english', label: 'Writing English stories and frame', weight: 34 },
    { key: 'ukrainian', label: 'Adapting Ukrainian stories and frame', weight: 28 },
    { key: 'validate', label: 'Repairing deterministic checks', weight: 6 },
    { key: 'critic', label: 'Running editorial critic', weight: 12 },
    { key: 'revisions', label: 'Repairing flagged fields', weight: 12 },
    { key: 'persist', label: 'Saving revision', weight: 4 },
  ],
  social_copy: [
    { key: 'prepare', label: 'Preparing social source', weight: 5 },
    { key: 'channels', label: 'Writing channel variants', weight: 60 },
    { key: 'instagram', label: 'Building Instagram carousel', weight: 12 },
    { key: 'linkedin', label: 'Building LinkedIn document', weight: 8 },
    { key: 'package', label: 'Saving social package', weight: 5 },
    { key: 'posts', label: 'Saving channel posts', weight: 10 },
  ],
  video_script: [
    { key: 'prepare', label: 'Preparing article source', weight: 10 },
    { key: 'script', label: 'Writing video script', weight: 80 },
    { key: 'persist', label: 'Saving script', weight: 10 },
  ],
  story_image: [
    { key: 'prepare', label: 'Preparing story evidence', weight: 5 },
    { key: 'generate', label: 'Directing, rendering and reviewing illustration', weight: 85 },
    { key: 'persist', label: 'Saving illustration variants', weight: 10 },
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

/**
 * Runs independent work with a fixed upper bound while preserving input order.
 * It waits for every started task before propagating a failure, so callers can
 * safely clean up or persist the work that did complete.
 */
export async function mapWithConcurrency<TValue, TResult>(
  values: readonly TValue[],
  maxConcurrency: number,
  mapper: (value: TValue, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (values.length === 0) return [];
  const concurrency = Number.isFinite(maxConcurrency)
    ? Math.max(1, Math.min(values.length, Math.trunc(maxConcurrency)))
    : 1;
  const results: TResult[] = new Array(values.length);
  const failures: unknown[] = [];
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await mapper(values[index]!, index);
      } catch (error) {
        failures.push(error);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runNext()));
  if (failures.length > 0) throw failures[0];
  return results;
}

export function classifyGenerationFailure(message: string): GenerationFailure {
  const normalized = message.toLowerCase();
  // Checked before everything else: this message names its own remedy and
  // must not be mistaken for a timeout or a quality failure. Nothing is lost
  // when it fires -- every finished segment is already on the job row.
  if (/segments saved|a retry resumes from the saved state/.test(normalized)) {
    return {
      code: 'resumable',
      retryable: true,
      nextAction: 'A retry continues from the saved segments instead of starting over.',
    };
  }
  if (/all configured social llm providers failed/.test(normalized)) {
    return {
      code: 'provider_exhausted',
      retryable: true,
      nextAction: 'The social job will retry with backoff and reuse every saved channel.',
    };
  }
  if (
    /quality gate|quality.*(?:failed|block)|dimension.*score|did not pass.*approval boundary/.test(
      normalized,
    )
  ) {
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
  if (
    /cancelled|canceled/.test(normalized)
  ) {
    return {
      code: 'cancelled',
      retryable: false,
      nextAction: 'Create a manual retry if work should continue.',
    };
  }
  if (
    /reading ['"]map['"]/.test(normalized) ||
    /cannot read propert/.test(normalized) ||
    /github.?dispatch/.test(normalized)
  ) {
    return {
      code: 'unknown',
      retryable: true,
      nextAction: 'The job will retry from the last checkpoint.',
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
