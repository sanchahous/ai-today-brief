/**
 * Weekly story-image adapter for content-sim: FLUX generate → per-variant
 * deterministic + vision → pick best → repair directive (≤5) → pass or escalate.
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

export interface VariantScoreMeta {
  index: number;
  overall: number;
  blockers: string[];
  passed: boolean;
  news_legibility?: number;
  craft?: number;
}

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
  mechanism?: string;
  readerTest?: string;
  metaphorTitle?: string;
  whyItFits?: string;
  motifClass?: string;
  subjectKind?: string;
  composition?: string;
  alternateBuffers: Buffer[];
  /** Per-variant QA scores (aligned with bytes + alternateBuffers order before pick). */
  variantScores?: VariantScoreMeta[];
  /** When set, skip a second vision call in the repair-loop critique. */
  preCritique?: ContentSimCritique;
  /** How primary was chosen for this candidate. */
  pickSource?: 'auto' | 'owner';
}

function variantScoreFromCritique(index: number, critique: ContentSimCritique): VariantScoreMeta {
  return {
    index,
    overall: critique.scores.overall,
    blockers: critique.blockers.map((b) => b.code),
    passed: critique.passed,
    news_legibility:
      typeof critique.scores.news_legibility === 'number'
        ? critique.scores.news_legibility
        : undefined,
    craft: typeof critique.scores.craft === 'number' ? critique.scores.craft : undefined,
  };
}

export interface WeeklyImageSimContext {
  headline: string;
  summary?: string;
  policyId: string;
  siblingScenes?: string[];
}

/** Cheap ranking when vision budget is nearly exhausted. */
function heuristicVariantRank(bytes: Buffer): number {
  return bytes.length;
}

/**
 * Prefer highest overall among variants with zero blockers; if none pass,
 * still return the highest overall index (caller escalates via critique).
 */
export function pickBestVariantIndex(
  scores: Array<{ index: number; overall: number; blockers: string[] }>,
): number {
  if (scores.length === 0) return 0;
  const passing = scores.filter((s) => s.blockers.length === 0);
  const pool = passing.length > 0 ? passing : scores;
  let best = pool[0]!;
  for (let i = 1; i < pool.length; i += 1) {
    const cur = pool[i]!;
    if (cur.overall > best.overall) best = cur;
  }
  return best.index;
}

export async function critiqueWeeklyImageBytes(
  input: {
    bytes: Buffer;
    width: number;
    height: number;
    scene: string;
    essence?: string;
    mechanism?: string;
    readerTest?: string;
    metaphorTitle?: string;
    whyItFits?: string;
  },
  ctx: WeeklyImageSimContext,
): Promise<ContentSimCritique> {
  const deterministic = deterministicImageCritique({
    width: input.width,
    height: input.height,
    byteSize: input.bytes.length,
  });
  if (deterministic && !deterministic.passed) return deterministic;

  const prompt = buildImageCriticPrompt({
    headline: ctx.headline,
    essence: input.essence,
    mechanism: input.mechanism,
    readerTest: input.readerTest,
    metaphorTitle: input.metaphorTitle,
    whyItFits: input.whyItFits,
    scene: input.scene,
    policyId: ctx.policyId,
    scoreThreshold: contentSimScoreThreshold(),
    siblingScenes: ctx.siblingScenes,
  });
  const result = await generateWithVision('weekly.image_critic', {
    prompt,
    imageBytes: input.bytes,
    mimeType: 'image/jpeg',
  });
  return parseImageCriticResponse(result.text, contentSimScoreThreshold());
}

export async function critiqueWeeklyImageCandidate(
  candidate: WeeklyImageSimCandidate,
  ctx: WeeklyImageSimContext,
): Promise<ContentSimCritique> {
  if (candidate.preCritique) return candidate.preCritique;
  return critiqueWeeklyImageBytes(
    {
      bytes: candidate.bytes,
      width: candidate.width,
      height: candidate.height,
      scene: candidate.scene,
      essence: candidate.essence,
      mechanism: candidate.mechanism,
      readerTest: candidate.readerTest,
      metaphorTitle: candidate.metaphorTitle,
      whyItFits: candidate.whyItFits,
    },
    ctx,
  );
}

/**
 * Vision-score each buffer; pick best as primary. When remaining budget is
 * tight, vision only the top heuristic variant and mark others unscored.
 */
export async function scoreAndPickVariants(
  candidate: WeeklyImageSimCandidate,
  ctx: WeeklyImageSimContext,
  options: { remainingBudgetUsd: number },
): Promise<WeeklyImageSimCandidate> {
  const buffers = [candidate.bytes, ...candidate.alternateBuffers];
  if (buffers.length <= 1) {
    const critique = await critiqueWeeklyImageCandidate(candidate, ctx);
    return {
      ...candidate,
      preCritique: critique,
      pickSource: 'auto',
      variantScores: [variantScoreFromCritique(0, critique)],
    };
  }

  const visionCost = contentSimVisionCriticEstimatedUsd();
  const canScoreAll = options.remainingBudgetUsd >= visionCost * buffers.length;
  const scores: VariantScoreMeta[] = [];
  const critiques: ContentSimCritique[] = [];

  if (canScoreAll) {
    for (let index = 0; index < buffers.length; index += 1) {
      const bytes = buffers[index]!;
      const critique = await critiqueWeeklyImageBytes(
        {
          bytes,
          width: candidate.width,
          height: candidate.height,
          scene: candidate.scene,
          essence: candidate.essence,
          mechanism: candidate.mechanism,
          readerTest: candidate.readerTest,
          metaphorTitle: candidate.metaphorTitle,
          whyItFits: candidate.whyItFits,
        },
        ctx,
      );
      critiques[index] = critique;
      scores.push(variantScoreFromCritique(index, critique));
    }
  } else {
    let bestIdx = 0;
    let bestRank = heuristicVariantRank(buffers[0]!);
    for (let i = 1; i < buffers.length; i += 1) {
      const rank = heuristicVariantRank(buffers[i]!);
      if (rank > bestRank) {
        bestRank = rank;
        bestIdx = i;
      }
    }
    for (let index = 0; index < buffers.length; index += 1) {
      if (index !== bestIdx) {
        scores.push({
          index,
          overall: 0,
          blockers: ['budget_skip'],
          passed: false,
        });
        critiques[index] = {
          passed: false,
          scores: { overall: 0 },
          blockers: [
            {
              code: 'budget_skip',
              message: 'Vision skipped due to spend budget; heuristic rank only.',
              blocker: true,
            },
          ],
        };
        continue;
      }
      const critique = await critiqueWeeklyImageBytes(
        {
          bytes: buffers[index]!,
          width: candidate.width,
          height: candidate.height,
          scene: candidate.scene,
          essence: candidate.essence,
          mechanism: candidate.mechanism,
          readerTest: candidate.readerTest,
          metaphorTitle: candidate.metaphorTitle,
          whyItFits: candidate.whyItFits,
        },
        ctx,
      );
      critiques[index] = critique;
      scores.push(variantScoreFromCritique(index, critique));
    }
  }

  const bestIndex = pickBestVariantIndex(scores);
  const primaryBytes = buffers[bestIndex]!;
  const alternates = buffers.filter((_, i) => i !== bestIndex);
  const reorderedScores = [
    scores.find((s) => s.index === bestIndex)!,
    ...scores.filter((s) => s.index !== bestIndex),
  ].map((s, orderIndex) => ({ ...s, index: orderIndex }));

  return {
    ...candidate,
    bytes: primaryBytes,
    alternateBuffers: alternates,
    variantScores: reorderedScores,
    preCritique: critiques[bestIndex],
    pickSource: 'auto',
  };
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
      candidate: candidate
        ? { ...candidate, pickSource: candidate.pickSource ?? 'auto' }
        : null,
      report,
      meta: toContentSimArtifactMeta(report),
    };
  }

  let spentUsd = 0;
  const maxSpend = contentSimMaxImageSpendUsd();

  const { report, artifact } = await runRepairLoop<WeeklyImageSimCandidate>({
    adapter: 'weekly-image',
    maxAttempts: contentSimMaxImageRepairAttempts(),
    maxSpendUsd: maxSpend,
    generate: async ({ attempt, directive }) => {
      const repaired = applyRepairToSceneInput(
        { sceneOverride: input.sceneOverride, seedBase: input.seedBase },
        attempt,
        directive,
      );
      const raw = await input.generate({
        attempt,
        sceneOverride: repaired.sceneOverride,
        seedBase: repaired.seedBase,
        promptSuffix: repaired.promptSuffix,
        directive,
      });
      if (!raw) {
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
        raw.positivePrompt = `${raw.positivePrompt}${repaired.promptSuffix}`;
        raw.scene = `${raw.scene}${repaired.promptSuffix}`;
      }
      const remaining = Math.max(0, maxSpend - spentUsd - raw.estimatedCostUsd);
      const picked = await scoreAndPickVariants(raw, input.ctx, {
        remainingBudgetUsd: remaining,
      });
      const visionCalls = picked.variantScores?.filter((s) => !s.blockers.includes('budget_skip'))
        .length ?? 1;
      const costUsd =
        picked.estimatedCostUsd + visionCalls * contentSimVisionCriticEstimatedUsd();
      spentUsd += costUsd;
      return {
        artifact: picked,
        promptSummary: picked.scene.slice(0, 400),
        costUsd,
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
