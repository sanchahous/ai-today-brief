/**
 * Builds the human-review package when the repair loop cannot converge.
 */

import type {
  ContentSimBlocker,
  ContentSimEscalation,
  ContentSimIterationRecord,
} from './types';

const DEFAULT_ACTIONS = [
  'Review the last render and approve with human override if editorial intent is clear.',
  'Set a scene_override that names one concrete subject and metaphor, then regenerate.',
  'Try a different image model / seed if the metaphor is right but the render is muddy.',
] as const;

function uniqueActions(fromIterations: ContentSimIterationRecord[]): string[] {
  const collected: string[] = [];
  for (const iteration of fromIterations) {
    for (const action of iteration.critique.repairDirective?.suggestedActions ?? []) {
      const trimmed = action.trim();
      if (trimmed && !collected.includes(trimmed)) collected.push(trimmed);
    }
  }
  for (const fallback of DEFAULT_ACTIONS) {
    if (collected.length >= 3) break;
    if (!collected.includes(fallback)) collected.push(fallback);
  }
  return collected.slice(0, 3);
}

function flattenBlockers(iterations: ContentSimIterationRecord[]): ContentSimBlocker[] {
  const byCode = new Map<string, ContentSimBlocker>();
  for (const iteration of iterations) {
    for (const blocker of iteration.critique.blockers) {
      if (!blocker.blocker) continue;
      const prev = byCode.get(blocker.code);
      if (!prev) {
        byCode.set(blocker.code, blocker);
        continue;
      }
      // Keep the latest message for the same code.
      byCode.set(blocker.code, blocker);
    }
  }
  return [...byCode.values()];
}

export function buildEscalationPackage(input: {
  reason: ContentSimEscalation['reason'];
  iterations: ContentSimIterationRecord[];
  summary?: string;
}): ContentSimEscalation {
  const blockers = flattenBlockers(input.iterations);
  const promptHistory = input.iterations
    .map((row) => row.promptSummary?.trim())
    .filter((value): value is string => Boolean(value));
  const previewPaths = input.iterations
    .map((row) => row.previewPath?.trim())
    .filter((value): value is string => Boolean(value));

  const summary =
    input.summary?.trim() ||
    (input.reason === 'budget_exhausted'
      ? `Image quality loop stopped early: spend cap reached after ${input.iterations.length} attempt(s).`
      : input.reason === 'critic_unavailable'
        ? 'Vision critic was unavailable; escalate for human review of the last render.'
        : `Image quality did not converge after ${input.iterations.length} repair attempt(s).`);

  return {
    reason: input.reason,
    summary,
    blockers,
    suggestedActions: uniqueActions(input.iterations),
    promptHistory,
    previewPaths,
    iterations: input.iterations,
  };
}

/** Maps a quality report into the JSONB shape stored on artifact.metadata.content_sim. */
export function toContentSimArtifactMeta(
  report: {
    adapter: string;
    outcome: import('./types').ContentSimOutcome;
    passed: boolean;
    attempts: number;
    maxAttempts: number;
    finalScores?: import('./types').ContentSimScores;
    blockers: ContentSimBlocker[];
    escalation?: ContentSimEscalation;
    totalCostUsd: number;
  },
  override?: { note?: string; at?: string },
): import('./types').ContentSimArtifactMeta {
  return {
    passed: report.passed || Boolean(override),
    outcome: override ? 'passed' : report.outcome,
    attempts: report.attempts,
    max_attempts: report.maxAttempts,
    scores: report.finalScores,
    blockers: report.blockers,
    escalation: report.escalation,
    human_override: Boolean(override),
    ...(override
      ? {
          human_override_at: override.at ?? new Date().toISOString(),
          ...(override.note ? { human_override_note: override.note } : {}),
        }
      : {}),
    total_cost_usd: report.totalCostUsd,
  };
}

/** Release-gate helper: sim passed, or owner overrode after escalation. */
export function contentSimGateCleared(
  meta: import('./types').ContentSimArtifactMeta | null | undefined,
): boolean {
  if (!meta) return false;
  if (meta.human_override) return true;
  return meta.passed === true && (meta.outcome === 'passed' || meta.outcome === 'incomplete');
}
