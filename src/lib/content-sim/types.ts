/**
 * Shared contracts for content simulation / backtest: generate → critique →
 * repair (≤N) → pass or escalate to human review. Adapters (weekly image,
 * weekly master, daily brief, daily image) plug into the same loop shape.
 */

export const CONTENT_SIM_ADAPTERS = [
  'weekly-master',
  'weekly-image',
  'daily-brief',
  'daily-image',
] as const;

export type ContentSimAdapterId = (typeof CONTENT_SIM_ADAPTERS)[number];

export type ContentSimOutcome = 'passed' | 'needs_human_review' | 'budget_exhausted' | 'incomplete';

export interface ContentSimBlocker {
  code: string;
  message: string;
  /** Optional region / field the critic named. */
  region?: string;
  /** Whether this must clear before pass. */
  blocker: boolean;
}

export interface ContentSimScores {
  overall: number;
  [dimension: string]: number;
}

/** Critic (vision or text) structured verdict. */
export interface ContentSimCritique {
  passed: boolean;
  scores: ContentSimScores;
  blockers: ContentSimBlocker[];
  /** Free-form notes for the repair step / human package. */
  notes?: string;
  /** Machine-readable repair hints for the next generation attempt. */
  repairDirective?: ContentSimRepairDirective;
}

export interface ContentSimRepairDirective {
  /** Patches to fold into the next prompt / scene brief. */
  promptPatches?: string[];
  /** Reject the current metaphor and ask the art director for a new one. */
  rejectMetaphor?: boolean;
  /** Suggested scene override text (weekly image escape hatch). */
  sceneOverride?: string;
  /** Bump / change seed for a different FLUX sample. */
  changeSeed?: boolean;
  /** Human-facing short suggestions (also used in escalation). */
  suggestedActions?: string[];
}

export interface ContentSimIterationRecord {
  attempt: number;
  critique: ContentSimCritique;
  /** Prompt / scene used for this attempt (truncated for storage). */
  promptSummary?: string;
  /** Estimated spend for this attempt (image gen + critic). */
  costUsd?: number;
  /** Optional local preview path or storage path. */
  previewPath?: string;
}

export interface ContentSimQualityReport {
  adapter: ContentSimAdapterId;
  outcome: ContentSimOutcome;
  passed: boolean;
  attempts: number;
  maxAttempts: number;
  finalScores?: ContentSimScores;
  blockers: ContentSimBlocker[];
  iterations: ContentSimIterationRecord[];
  totalCostUsd: number;
  /** Set when outcome is needs_human_review or budget_exhausted. */
  escalation?: ContentSimEscalation;
}

export interface ContentSimEscalation {
  reason: 'attempts_exhausted' | 'budget_exhausted' | 'critic_unavailable';
  summary: string;
  blockers: ContentSimBlocker[];
  suggestedActions: string[];
  /** Truncated prompt history across attempts. */
  promptHistory: string[];
  previewPaths: string[];
  iterations: ContentSimIterationRecord[];
}

/** Metadata shape stored on weekly artifacts under `metadata.content_sim`. */
export interface ContentSimArtifactMeta {
  passed: boolean;
  outcome: ContentSimOutcome;
  attempts: number;
  max_attempts: number;
  scores?: ContentSimScores;
  blockers?: ContentSimBlocker[];
  escalation?: ContentSimEscalation;
  /** Owner cleared the gate after reviewing the escalation package. */
  human_override?: boolean;
  human_override_at?: string;
  human_override_note?: string;
  total_cost_usd?: number;
  /** Number of provider image renders made by this job, including alternates. */
  image_generations?: number;
  /** Number of paid vision critiques made by this job. */
  vision_critiques?: number;
  /** Provider-call cost split for owner-facing auditability. */
  cost_breakdown?: {
    render_usd: number;
    vision_usd: number;
  };
}

export interface ContentSimManifest {
  runId: string;
  adapter: ContentSimAdapterId;
  capturedAt?: string;
  fixturePath?: string;
  fixtureHash?: string;
  hypothesisId?: string;
  maxAttempts: number;
  maxSpendUsd: number;
  scoreThreshold: number;
}

/** Inputs the generic repair loop needs from an adapter. */
export interface ContentSimLoopHooks<TArtifact> {
  generate: (ctx: {
    attempt: number;
    previous?: ContentSimCritique;
    directive?: ContentSimRepairDirective;
  }) => Promise<{
    artifact: TArtifact;
    promptSummary?: string;
    costUsd?: number;
    previewPath?: string;
  }>;
  /**
   * Cheap deterministic checks first. Returning a failing critique skips the
   * paid critic for that attempt (same pattern as master-engine).
   */
  deterministicCritique?: (artifact: TArtifact) => ContentSimCritique | null;
  critique: (artifact: TArtifact) => Promise<ContentSimCritique>;
  maxAttempts: number;
  maxSpendUsd: number;
  adapter: ContentSimAdapterId;
  onIteration?: (record: ContentSimIterationRecord, artifact: TArtifact) => void | Promise<void>;
}
