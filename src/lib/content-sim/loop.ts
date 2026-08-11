/**
 * Generic generate → (deterministic) → critique → repair loop.
 * Quality never throws: exhaustion becomes needs_human_review / budget_exhausted.
 */

import { buildEscalationPackage } from './escalation';
import type {
  ContentSimCritique,
  ContentSimIterationRecord,
  ContentSimLoopHooks,
  ContentSimQualityReport,
  ContentSimRepairDirective,
} from './types';

function failingFromDirective(
  critique: ContentSimCritique,
): ContentSimRepairDirective | undefined {
  if (critique.passed) return undefined;
  return (
    critique.repairDirective ?? {
      suggestedActions: critique.blockers
        .filter((b) => b.blocker)
        .map((b) => b.message)
        .slice(0, 3),
      changeSeed: true,
    }
  );
}

export async function runRepairLoop<TArtifact>(
  hooks: ContentSimLoopHooks<TArtifact>,
): Promise<{ report: ContentSimQualityReport; artifact: TArtifact | null }> {
  const iterations: ContentSimIterationRecord[] = [];
  let totalCostUsd = 0;
  let lastArtifact: TArtifact | null = null;
  let directive: ContentSimRepairDirective | undefined;
  let previous: ContentSimCritique | undefined;

  const maxAttempts = Math.max(1, hooks.maxAttempts);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (totalCostUsd >= hooks.maxSpendUsd && attempt > 1) {
      const escalation = buildEscalationPackage({
        reason: 'budget_exhausted',
        iterations,
      });
      return {
        artifact: lastArtifact,
        report: {
          adapter: hooks.adapter,
          outcome: 'budget_exhausted',
          passed: false,
          attempts: attempt - 1,
          maxAttempts,
          blockers: escalation.blockers,
          iterations,
          totalCostUsd,
          escalation,
          finalScores: previous?.scores,
        },
      };
    }

    const generated = await hooks.generate({ attempt, previous, directive });
    lastArtifact = generated.artifact;
    totalCostUsd += generated.costUsd ?? 0;

    let critique =
      hooks.deterministicCritique?.(generated.artifact) ??
      null;
    if (!critique || critique.passed) {
      // Deterministic pass (or no deterministic step) → paid critic.
      try {
        critique = await hooks.critique(generated.artifact);
      } catch {
        const record: ContentSimIterationRecord = {
          attempt,
          critique: {
            passed: false,
            scores: { overall: 0 },
            blockers: [
              {
                code: 'critic_unavailable',
                message: 'Vision/text critic threw; escalate for human review.',
                blocker: true,
              },
            ],
            notes: 'critic_unavailable',
          },
          promptSummary: generated.promptSummary,
          costUsd: generated.costUsd,
          previewPath: generated.previewPath,
        };
        iterations.push(record);
        await hooks.onIteration?.(record, generated.artifact);
        const escalation = buildEscalationPackage({
          reason: 'critic_unavailable',
          iterations,
        });
        return {
          artifact: lastArtifact,
          report: {
            adapter: hooks.adapter,
            outcome: 'needs_human_review',
            passed: false,
            attempts: attempt,
            maxAttempts,
            blockers: escalation.blockers,
            iterations,
            totalCostUsd,
            escalation,
          },
        };
      }
    }

    const record: ContentSimIterationRecord = {
      attempt,
      critique,
      promptSummary: generated.promptSummary,
      costUsd: generated.costUsd,
      previewPath: generated.previewPath,
    };
    iterations.push(record);
    await hooks.onIteration?.(record, generated.artifact);
    previous = critique;

    if (critique.passed) {
      return {
        artifact: lastArtifact,
        report: {
          adapter: hooks.adapter,
          outcome: 'passed',
          passed: true,
          attempts: attempt,
          maxAttempts,
          finalScores: critique.scores,
          blockers: critique.blockers.filter((b) => b.blocker),
          iterations,
          totalCostUsd,
        },
      };
    }

    directive = failingFromDirective(critique);
  }

  const escalation = buildEscalationPackage({
    reason: 'attempts_exhausted',
    iterations,
  });
  return {
    artifact: lastArtifact,
    report: {
      adapter: hooks.adapter,
      outcome: 'needs_human_review',
      passed: false,
      attempts: maxAttempts,
      maxAttempts,
      finalScores: previous?.scores,
      blockers: escalation.blockers,
      iterations,
      totalCostUsd,
      escalation,
    },
  };
}
