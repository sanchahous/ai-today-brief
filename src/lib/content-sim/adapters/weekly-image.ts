/**
 * Weekly story-image adapter for content-sim: FLUX generate → deterministic →
 * vision critic → repair directive (≤5) → pass or escalate.
 */

import {
  buildImageCriticPrompt,
  contentSimImageLoopEnabled,
  contentSimMaxImageRepairAttempts,
  contentSimMaxImageSpendUsd,
  contentSimScoreThreshold,
  contentSimVisionCriticEstimatedUsd,
  deterministicImageCritique,
  parseImageCriticResponse,
  runRepairLoop,
  toContentSimArtifactMeta,
  type ContentSimArtifactMeta,
  type ContentSimCritique,
  type ContentSimQualityReport,
  type ContentSimRepairDirective,
} from '@/lib/content-sim';
import { generateWithVision } from '../../../../pipeline/providers/vision';

export interface WeeklyImageSimCandidate {
  bytes: Buffer;
  width: number;
  height: number;
  provider: string;
  model: string;
  estimatedCostUsd: number;
  costSource: 'reported' | 'estimated' | 'subscription';
  scene: string;
  positivePrompt: string;
  negativePrompt: string;
  sceneSource: string;
  essence?: string;
  metaphorTitle?: string;
  alternateBuffers: Buffer[];
}

export interface WeeklyImageSimContext {
  headline: string;
  summary?: string;
  policyId: string;
}

export async function critiqueWeeklyImageCandidate(
  candidate: WeeklyImageSimCandidate,
  ctx: WeeklyImageSimContext,
): Promise<ContentSimCritique> {
  const deterministic = deterministicImageCritique({
    width: candidate.width,
    height: candidate.height,
    byteSize: candidate.bytes.length,
  });
  if (deterministic && !deterministic.passed) return deterministic;

  const prompt = buildImageCriticPrompt({
    headline: ctx.headline,
    essence: candidate.essence,
    metaphorTitle: candidate.metaphorTitle,
    scene: candidate.scene,
    policyId: ctx.policyId,
    scoreThreshold: contentSimScoreThreshold(),
  });
  const result = await generateWithVision('weekly.image_critic', {
    prompt,
    imageBytes: candidate.bytes,
    mimeType: 'image/jpeg',
  });
  return parseImageCriticResponse(result.text, contentSimScoreThreshold());
}

export function applyRepairToSceneInput(
  base: {
    sceneOverride?: string;
    seedBase: string;
  },
  attempt: number,
  directive?: ContentSimRepairDirective,
): { sceneOverride?: string; seedBase: string; promptSuffix: string } {
  const patches = directive?.promptPatches?.filter(Boolean) ?? [];
  const promptSuffix = patches.length ? ` ${patches.join(' ')}` : '';
  let sceneOverride = directive?.sceneOverride?.trim() || base.sceneOverride;
  if (directive?.rejectMetaphor) {
    // Force a fresh art-director pass (no owner override) unless critic
    // supplied an explicit replacement scene.
    if (!directive.sceneOverride?.trim()) sceneOverride = undefined;
  }
  const seedBase =
    directive?.changeSeed || attempt > 1 ? `${base.seedBase}:attempt${attempt}` : base.seedBase;
  return { sceneOverride, seedBase, promptSuffix };
}

/**
 * Runs the quality loop around a generate() callback that produces one
 * candidate (primary + optional alternates). When the loop is disabled via
 * env, generate once and mark passed without vision.
 */
export async function runWeeklyImageSimLoop(input: {
  ctx: WeeklyImageSimContext;
  seedBase: string;
  sceneOverride?: string;
  generate: (args: {
    attempt: number;
    sceneOverride?: string;
    seedBase: string;
    promptSuffix: string;
    directive?: ContentSimRepairDirective;
  }) => Promise<WeeklyImageSimCandidate | null>;
}): Promise<{
  candidate: WeeklyImageSimCandidate | null;
  report: ContentSimQualityReport;
  meta: ContentSimArtifactMeta;
}> {
  if (!contentSimImageLoopEnabled()) {
    const candidate = await input.generate({
      attempt: 1,
      sceneOverride: input.sceneOverride,
      seedBase: input.seedBase,
      promptSuffix: '',
    });
    const report: ContentSimQualityReport = {
      adapter: 'weekly-image',
      outcome: candidate ? 'passed' : 'needs_human_review',
      passed: Boolean(candidate),
      attempts: 1,
      maxAttempts: 1,
      blockers: candidate
        ? []
        : [
            {
              code: 'generation_failed',
              message: 'Illustration generation returned no variants.',
              blocker: true,
            },
          ],
      iterations: [],
      totalCostUsd: candidate?.estimatedCostUsd ?? 0,
      finalScores: candidate ? { overall: 100 } : undefined,
    };
    return {
      candidate,
      report,
      meta: toContentSimArtifactMeta(report),
    };
  }

  const { report, artifact } = await runRepairLoop<WeeklyImageSimCandidate>({
    adapter: 'weekly-image',
    maxAttempts: contentSimMaxImageRepairAttempts(),
    maxSpendUsd: contentSimMaxImageSpendUsd(),
    generate: async ({ attempt, directive }) => {
      const repaired = applyRepairToSceneInput(
        { sceneOverride: input.sceneOverride, seedBase: input.seedBase },
        attempt,
        directive,
      );
      const candidate = await input.generate({
        attempt,
        sceneOverride: repaired.sceneOverride,
        seedBase: repaired.seedBase,
        promptSuffix: repaired.promptSuffix,
        directive,
      });
      if (!candidate) {
        // Deterministic critique will fail dimensions/bytes; loop continues or escalates.
        return {
          artifact: {
            bytes: Buffer.alloc(0),
            width: 0,
            height: 0,
            provider: 'none',
            model: 'none',
            estimatedCostUsd: 0,
            costSource: 'estimated' as const,
            scene: '',
            positivePrompt: '',
            negativePrompt: '',
            sceneSource: 'none',
            alternateBuffers: [],
          },
          promptSummary: 'generation_failed',
          costUsd: 0,
        };
      }
      if (repaired.promptSuffix) {
        candidate.positivePrompt = `${candidate.positivePrompt}${repaired.promptSuffix}`;
        candidate.scene = `${candidate.scene}${repaired.promptSuffix}`;
      }
      return {
        artifact: candidate,
        promptSummary: candidate.scene.slice(0, 400),
        costUsd: candidate.estimatedCostUsd + contentSimVisionCriticEstimatedUsd(),
      };
    },
    deterministicCritique: (candidate) =>
      deterministicImageCritique({
        width: candidate.width,
        height: candidate.height,
        byteSize: candidate.bytes.length,
      }),
    critique: (candidate) => critiqueWeeklyImageCandidate(candidate, input.ctx),
  });

  return {
    candidate: artifact,
    report,
    meta: toContentSimArtifactMeta(report),
  };
}
