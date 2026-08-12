/**
 * Weekly story-image adapter for content-sim: FLUX generate → per-variant
 * deterministic + vision → pick best → one decisive re-plan → pass or escalate.
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
  context_fidelity?: number;
  mechanism_legibility?: number;
  consequence_legibility?: number;
  instant_comprehension?: number;
  semantic_min?: number;
}

export interface WeeklyImageCostEvent {
  attempt: number;
  variantIndex: number;
  kind: 'llm';
  provider: string;
  model: string;
  costUsd: number;
  costSource: 'reported' | 'estimated' | 'subscription';
  promptTokens: number | null;
  outputTokens: number | null;
}

export interface WeeklyImageVariantConcept {
  conceptLens?: string;
  scene: string;
  sceneSource: string;
  positivePrompt: string;
  negativePrompt: string;
  storyContext?: string;
  meaning?: string;
  essence?: string;
  mechanism?: string;
  consequence?: string;
  visualThesis?: string;
  readerTest?: string;
  metaphorTitle?: string;
  whyItFits?: string;
  storyAnchor?: string;
  visibleMechanism?: string;
  visibleConsequence?: string;
  motifClass?: string;
  subjectKind?: string;
  composition?: string;
}

/**
 * Every rendered buffer from every repair round, kept until the owner
 * approves the selected artifact. This is intentionally separate from the
 * final candidate so failed concepts are still reviewable in admin.
 */
export interface WeeklyImageIterationPreview {
  attempt: number;
  variantIndex: number;
  bytes: Buffer;
  concept: WeeklyImageVariantConcept;
  score?: VariantScoreMeta;
  attemptCostUsd?: number;
  critiquePassed?: boolean;
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
  conceptLens?: string;
  storyContext?: string;
  meaning?: string;
  essence?: string;
  mechanism?: string;
  consequence?: string;
  visualThesis?: string;
  readerTest?: string;
  metaphorTitle?: string;
  whyItFits?: string;
  storyAnchor?: string;
  visibleMechanism?: string;
  visibleConsequence?: string;
  motifClass?: string;
  subjectKind?: string;
  composition?: string;
  alternateBuffers: Buffer[];
  /** Per-buffer concept metadata, aligned with bytes + alternateBuffers. */
  variantConcepts?: WeeklyImageVariantConcept[];
  /** Per-variant QA scores (aligned with bytes + alternateBuffers order before pick). */
  variantScores?: VariantScoreMeta[];
  /** When set, skip a second vision call in the repair-loop critique. */
  preCritique?: ContentSimCritique;
  /** How primary was chosen for this candidate. */
  pickSource?: 'auto' | 'owner';
  /** Actual/fallback vision spend attached after per-variant scoring. */
  visionCostUsd?: number;
  visionCallCount?: number;
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
    context_fidelity:
      typeof critique.scores.context_fidelity === 'number'
        ? critique.scores.context_fidelity
        : undefined,
    mechanism_legibility:
      typeof critique.scores.mechanism_legibility === 'number'
        ? critique.scores.mechanism_legibility
        : undefined,
    consequence_legibility:
      typeof critique.scores.consequence_legibility === 'number'
        ? critique.scores.consequence_legibility
        : undefined,
    instant_comprehension:
      typeof critique.scores.instant_comprehension === 'number'
        ? critique.scores.instant_comprehension
        : undefined,
    semantic_min:
      typeof critique.scores.semantic_min === 'number' ? critique.scores.semantic_min : undefined,
  };
}

export interface WeeklyImageSimContext {
  headline: string;
  summary?: string;
  why?: string;
  practical?: string;
  limitation?: string;
  takeaway?: string;
  claimsExcerpt?: string;
  editorialAngle?: string;
  policyId: string;
  siblingScenes?: string[];
}

function baseVariantConcept(candidate: WeeklyImageSimCandidate): WeeklyImageVariantConcept {
  return {
    conceptLens: candidate.conceptLens,
    scene: candidate.scene,
    sceneSource: candidate.sceneSource,
    positivePrompt: candidate.positivePrompt,
    negativePrompt: candidate.negativePrompt,
    storyContext: candidate.storyContext,
    meaning: candidate.meaning,
    essence: candidate.essence,
    mechanism: candidate.mechanism,
    consequence: candidate.consequence,
    visualThesis: candidate.visualThesis,
    readerTest: candidate.readerTest,
    metaphorTitle: candidate.metaphorTitle,
    whyItFits: candidate.whyItFits,
    storyAnchor: candidate.storyAnchor,
    visibleMechanism: candidate.visibleMechanism,
    visibleConsequence: candidate.visibleConsequence,
    motifClass: candidate.motifClass,
    subjectKind: candidate.subjectKind,
    composition: candidate.composition,
  };
}

function variantConceptsFor(
  candidate: WeeklyImageSimCandidate,
  count: number,
): WeeklyImageVariantConcept[] {
  const fallback = baseVariantConcept(candidate);
  return Array.from(
    { length: count },
    (_, index) => candidate.variantConcepts?.[index] ?? fallback,
  );
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

const OPAQUE_SOFTWARE_METAPHOR =
  /\b(pneumatic tubes?|tube network|canisters?|telephone switchboards?|patch cables?|glowing (?:data )?(?:streams?|capsules?)|generic pipework|generic conduits?)\b/i;

/**
 * Generic data-flow machinery usually communicates no news context to a
 * reader. It is allowed only when the source story is literally about it.
 */
export function opaqueAbstractionCritique(
  scene: string,
  ctx: WeeklyImageSimContext,
): ContentSimCritique | null {
  if (!OPAQUE_SOFTWARE_METAPHOR.test(scene)) return null;
  const source = [ctx.headline, ctx.summary, ctx.why, ctx.practical, ctx.editorialAngle]
    .filter(Boolean)
    .join(' ');
  if (OPAQUE_SOFTWARE_METAPHOR.test(source)) return null;
  return {
    passed: false,
    scores: {
      overall: 35,
      news_legibility: 30,
      context_fidelity: 25,
      mechanism_legibility: 45,
      consequence_legibility: 25,
      instant_comprehension: 25,
      semantic_min: 25,
      craft: 80,
    },
    blockers: [
      {
        code: 'opaque_abstraction',
        message:
          'Generic tubes, canisters, switchboards, or data-flow machinery do not identify this news story to a reader.',
        blocker: true,
      },
    ],
    notes: 'Reject this metaphor before paying to compare more seeds of the same opaque scene.',
    repairDirective: {
      rejectMetaphor: true,
      changeSeed: true,
      promptPatches: [
        'Replace generic data-flow machinery with a literal story anchor and a visibly human-readable cause and result.',
      ],
      suggestedActions: ['Choose a new metaphor that pairs with this headline unaided.'],
    },
  };
}

interface CritiqueWithUsage {
  critique: ContentSimCritique;
  usage: Omit<WeeklyImageCostEvent, 'attempt' | 'variantIndex' | 'kind'> | null;
}

async function critiqueWeeklyImageBytesWithUsage(
  input: {
    bytes: Buffer;
    width: number;
    height: number;
    scene: string;
    storyContext?: string;
    meaning?: string;
    essence?: string;
    mechanism?: string;
    consequence?: string;
    visualThesis?: string;
    readerTest?: string;
    metaphorTitle?: string;
    whyItFits?: string;
  },
  ctx: WeeklyImageSimContext,
): Promise<CritiqueWithUsage> {
  const deterministic = deterministicImageCritique({
    width: input.width,
    height: input.height,
    byteSize: input.bytes.length,
  });
  if (deterministic && !deterministic.passed) return { critique: deterministic, usage: null };

  const opaque = opaqueAbstractionCritique(input.scene, ctx);
  if (opaque) return { critique: opaque, usage: null };

  const prompt = buildImageCriticPrompt({
    headline: ctx.headline,
    summary: ctx.summary,
    why: ctx.why,
    practical: ctx.practical,
    limitation: ctx.limitation,
    takeaway: ctx.takeaway,
    claimsExcerpt: ctx.claimsExcerpt,
    editorialAngle: ctx.editorialAngle,
    storyContext: input.storyContext,
    meaning: input.meaning,
    essence: input.essence,
    mechanism: input.mechanism,
    consequence: input.consequence,
    visualThesis: input.visualThesis,
    readerTest: input.readerTest,
    metaphorTitle: input.metaphorTitle,
    whyItFits: input.whyItFits,
    scene: input.scene,
    policyId: ctx.policyId,
    scoreThreshold: contentSimScoreThreshold(),
    siblingScenes: ctx.siblingScenes,
  });
  let result: Awaited<ReturnType<typeof generateWithVision>>;
  try {
    result = await generateWithVision('weekly.image_critic', {
      prompt,
      imageBytes: input.bytes,
      mimeType: 'image/jpeg',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      critique: {
        passed: false,
        scores: { overall: 0 },
        blockers: [
          {
            code: 'critic_unavailable',
            message: `Vision provider unavailable: ${message.slice(0, 240)}`,
            blocker: true,
          },
        ],
        notes: 'A provider failure is a soft quality failure, not a failed story-image job.',
        repairDirective: {
          changeSeed: true,
          suggestedActions: [
            'Retry vision review or inspect the three rendered variants manually.',
          ],
        },
      },
      usage: null,
    };
  }
  return {
    critique: parseImageCriticResponse(result.text, contentSimScoreThreshold(), {
      requireStorySemantics: true,
      requirePixelEvidence: true,
    }),
    usage: {
      provider: result.provider,
      model: result.model,
      costUsd: result.usage.costUsd ?? contentSimVisionCriticEstimatedUsd(),
      costSource: result.usage.costUsd === null ? 'estimated' : result.usage.costSource,
      promptTokens: result.usage.promptTokens,
      outputTokens: result.usage.outputTokens,
    },
  };
}

export async function critiqueWeeklyImageBytes(
  input: {
    bytes: Buffer;
    width: number;
    height: number;
    scene: string;
    storyContext?: string;
    meaning?: string;
    essence?: string;
    mechanism?: string;
    consequence?: string;
    visualThesis?: string;
    readerTest?: string;
    metaphorTitle?: string;
    whyItFits?: string;
  },
  ctx: WeeklyImageSimContext,
): Promise<ContentSimCritique> {
  return (await critiqueWeeklyImageBytesWithUsage(input, ctx)).critique;
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
      storyContext: candidate.storyContext,
      meaning: candidate.meaning,
      essence: candidate.essence,
      mechanism: candidate.mechanism,
      consequence: candidate.consequence,
      visualThesis: candidate.visualThesis,
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
  options: {
    remainingBudgetUsd: number;
    attempt?: number;
    onCostEvent?: (event: WeeklyImageCostEvent) => void | Promise<void>;
  },
): Promise<WeeklyImageSimCandidate> {
  const buffers = [candidate.bytes, ...candidate.alternateBuffers];
  const concepts = variantConceptsFor(candidate, buffers.length);
  if (buffers.length <= 1) {
    const scored = candidate.preCritique
      ? { critique: candidate.preCritique, usage: null }
      : await critiqueWeeklyImageBytesWithUsage(candidate, ctx);
    if (scored.usage) {
      await options.onCostEvent?.({
        attempt: options.attempt ?? 1,
        variantIndex: 0,
        kind: 'llm',
        ...scored.usage,
      });
    }
    const concept = concepts[0]!;
    return {
      ...candidate,
      ...concept,
      preCritique: scored.critique,
      pickSource: 'auto',
      variantScores: [variantScoreFromCritique(0, scored.critique)],
      variantConcepts: [concept],
      visionCostUsd: scored.usage?.costUsd ?? 0,
      visionCallCount: scored.usage ? 1 : 0,
    };
  }

  const visionCost = contentSimVisionCriticEstimatedUsd();
  const canScoreAll = options.remainingBudgetUsd >= visionCost * buffers.length;
  const scores: VariantScoreMeta[] = [];
  const critiques: ContentSimCritique[] = [];
  let visionCostUsd = 0;
  let visionCallCount = 0;

  if (canScoreAll) {
    const scored = await Promise.all(
      buffers.map((bytes, index) => {
        const concept = concepts[index]!;
        return critiqueWeeklyImageBytesWithUsage(
          {
            bytes,
            width: candidate.width,
            height: candidate.height,
            scene: concept.scene,
            storyContext: concept.storyContext,
            meaning: concept.meaning,
            essence: concept.essence,
            mechanism: concept.mechanism,
            consequence: concept.consequence,
            visualThesis: concept.visualThesis,
            readerTest: concept.readerTest,
            metaphorTitle: concept.metaphorTitle,
            whyItFits: concept.whyItFits,
          },
          ctx,
        );
      }),
    );
    await Promise.all(
      scored.map(async (result, index) => {
        critiques[index] = result.critique;
        scores[index] = variantScoreFromCritique(index, result.critique);
        if (!result.usage) return;
        visionCostUsd += result.usage.costUsd;
        visionCallCount += 1;
        await options.onCostEvent?.({
          attempt: options.attempt ?? 1,
          variantIndex: index,
          kind: 'llm',
          ...result.usage,
        });
      }),
    );
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
      const concept = concepts[index]!;
      const result = await critiqueWeeklyImageBytesWithUsage(
        {
          bytes: buffers[index]!,
          width: candidate.width,
          height: candidate.height,
          scene: concept.scene,
          storyContext: concept.storyContext,
          meaning: concept.meaning,
          essence: concept.essence,
          mechanism: concept.mechanism,
          consequence: concept.consequence,
          visualThesis: concept.visualThesis,
          readerTest: concept.readerTest,
          metaphorTitle: concept.metaphorTitle,
          whyItFits: concept.whyItFits,
        },
        ctx,
      );
      critiques[index] = result.critique;
      scores.push(variantScoreFromCritique(index, result.critique));
      if (result.usage) {
        visionCostUsd += result.usage.costUsd;
        visionCallCount += 1;
        await options.onCostEvent?.({
          attempt: options.attempt ?? 1,
          variantIndex: index,
          kind: 'llm',
          ...result.usage,
        });
      }
    }
  }

  const bestIndex = pickBestVariantIndex(scores);
  const primaryBytes = buffers[bestIndex]!;
  const alternates = buffers.filter((_, i) => i !== bestIndex);
  const selectedConcept = concepts[bestIndex]!;
  const reorderedConcepts = [
    selectedConcept,
    ...concepts.filter((_, index) => index !== bestIndex),
  ];
  const reorderedScores = [
    scores.find((s) => s.index === bestIndex)!,
    ...scores.filter((s) => s.index !== bestIndex),
  ].map((s, orderIndex) => ({ ...s, index: orderIndex }));

  return {
    ...candidate,
    ...selectedConcept,
    bytes: primaryBytes,
    alternateBuffers: alternates,
    variantConcepts: reorderedConcepts,
    variantScores: reorderedScores,
    preCritique: aggregateVariantRepairCritique(critiques[bestIndex]!, critiques),
    pickSource: 'auto',
    visionCostUsd,
    visionCallCount,
  };
}

const SEMANTIC_FAILURE_CODES = new Set([
  'off_metaphor',
  'off_news',
  'missing_context',
  'missing_mechanism',
  'missing_consequence',
  'ambiguous_visual_story',
  'wrong_subject',
  'opaque_abstraction',
  'semantic_evidence_missing',
]);

function semanticFailure(critique: ContentSimCritique): boolean {
  const floor = contentSimScoreThreshold();
  return (
    (typeof critique.scores.semantic_min === 'number' && critique.scores.semantic_min < floor) ||
    (typeof critique.scores.news_legibility === 'number' &&
      critique.scores.news_legibility < floor) ||
    critique.blockers.some((blocker) => SEMANTIC_FAILURE_CODES.has(blocker.code))
  );
}

/**
 * Combine the three independent concept verdicts into one batch decision.
 * Preserve the winning score for the UI and force a fresh concept jury when
 * every evaluated concept misses the news semantics.
 */
export function aggregateVariantRepairCritique(
  best: ContentSimCritique,
  critiques: ContentSimCritique[],
): ContentSimCritique {
  if (best.passed) return best;
  const evaluated = critiques.filter(
    (critique) =>
      !critique.blockers.some(
        (blocker) => blocker.code === 'budget_skip' || blocker.code === 'critic_unavailable',
      ),
  );
  const rejectMetaphor = evaluated.length > 0 && evaluated.every(semanticFailure);
  const unique = (values: Array<string | undefined>) =>
    [
      ...new Set(
        values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)),
      ),
    ].slice(0, 6);
  const promptPatches = unique(
    critiques.flatMap((critique) => critique.repairDirective?.promptPatches ?? []),
  );
  const suggestedActions = unique(
    critiques.flatMap((critique) => critique.repairDirective?.suggestedActions ?? []),
  );
  const sceneOverride = critiques
    .map((critique) => critique.repairDirective?.sceneOverride?.trim())
    .find(Boolean);
  return {
    ...best,
    repairDirective: {
      ...best.repairDirective,
      rejectMetaphor: rejectMetaphor || best.repairDirective?.rejectMetaphor === true,
      changeSeed: true,
      sceneOverride: sceneOverride || best.repairDirective?.sceneOverride,
      promptPatches: promptPatches.length ? promptPatches : best.repairDirective?.promptPatches,
      suggestedActions: suggestedActions.length
        ? suggestedActions
        : best.repairDirective?.suggestedActions,
    },
  };
}

export function applyRepairToSceneInput(
  base: {
    sceneOverride?: string;
    seedBase: string;
  },
  attempt: number,
  directive?: ContentSimRepairDirective,
): {
  sceneOverride?: string;
  seedBase: string;
  promptSuffix: string;
  rejectedScene?: string;
  planningFeedback: string[];
} {
  const patches = directive?.promptPatches?.filter(Boolean) ?? [];
  const rejectedScene = directive?.sceneOverride?.trim() || undefined;
  const planningFeedback = directive?.rejectMetaphor
    ? [
        ...(rejectedScene ? [`Rejected critic direction: ${rejectedScene}`] : []),
        ...patches,
        ...(directive.suggestedActions ?? []),
      ].slice(0, 10)
    : [];
  // A critic-authored replacement is planning evidence, not an owner
  // override. Applying its named motif to all three FLUX prompts collapses
  // concept diversity (e.g. three typewriters/cars/hands).
  const sceneOverride = base.sceneOverride;
  const promptSuffix = !directive?.rejectMetaphor && patches.length ? ` ${patches.join(' ')}` : '';
  const seedBase =
    directive?.changeSeed || attempt > 1 ? `${base.seedBase}:attempt${attempt}` : base.seedBase;
  return { sceneOverride, seedBase, promptSuffix, rejectedScene, planningFeedback };
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
    rejectedScene?: string;
    planningFeedback: string[];
    directive?: ContentSimRepairDirective;
  }) => Promise<WeeklyImageSimCandidate | null>;
  onCostEvent?: (event: WeeklyImageCostEvent) => void | Promise<void>;
}): Promise<{
  candidate: WeeklyImageSimCandidate | null;
  report: ContentSimQualityReport;
  meta: ContentSimArtifactMeta;
  iterationPreviews: WeeklyImageIterationPreview[];
}> {
  const iterationPreviews: WeeklyImageIterationPreview[] = [];
  const captureIteration = (
    attempt: number,
    candidate: WeeklyImageSimCandidate,
    record?: { critique?: ContentSimCritique; costUsd?: number },
  ) => {
    const buffers = [candidate.bytes, ...candidate.alternateBuffers];
    const concepts = variantConceptsFor(candidate, buffers.length);
    const scores = candidate.variantScores ?? [];
    buffers.forEach((bytes, variantIndex) => {
      iterationPreviews.push({
        attempt,
        variantIndex,
        bytes,
        concept: concepts[variantIndex]!,
        score: scores[variantIndex],
        attemptCostUsd: record?.costUsd,
        critiquePassed: scores[variantIndex]?.passed ?? record?.critique?.passed,
      });
    });
  };
  if (!contentSimImageLoopEnabled()) {
    const candidate = await input.generate({
      attempt: 1,
      sceneOverride: input.sceneOverride,
      seedBase: input.seedBase,
      promptSuffix: '',
      planningFeedback: [],
    });
    if (candidate) captureIteration(1, candidate);
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
      candidate: candidate ? { ...candidate, pickSource: candidate.pickSource ?? 'auto' } : null,
      report,
      meta: toContentSimArtifactMeta(report),
      iterationPreviews,
    };
  }

  let spentUsd = 0;
  let imageGenerations = 0;
  let visionCritiques = 0;
  let renderCostUsd = 0;
  let visionCostUsd = 0;
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
        rejectedScene: repaired.rejectedScene,
        planningFeedback: repaired.planningFeedback,
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
      imageGenerations += 1 + raw.alternateBuffers.length;
      renderCostUsd += raw.estimatedCostUsd;
      const remaining = Math.max(0, maxSpend - spentUsd - raw.estimatedCostUsd);
      const picked = await scoreAndPickVariants(raw, input.ctx, {
        remainingBudgetUsd: remaining,
        attempt,
        onCostEvent: async (event) => {
          visionCritiques += 1;
          visionCostUsd += event.costUsd;
          await input.onCostEvent?.(event);
        },
      });
      const costUsd = picked.estimatedCostUsd + (picked.visionCostUsd ?? 0);
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
    onIteration: async (record, candidate) => {
      if (candidate.bytes.length > 0) captureIteration(record.attempt, candidate, record);
    },
  });

  return {
    candidate: artifact,
    report,
    meta: {
      ...toContentSimArtifactMeta(report),
      image_generations: imageGenerations,
      vision_critiques: visionCritiques,
      cost_breakdown: {
        render_usd: renderCostUsd,
        vision_usd: visionCostUsd,
      },
    },
    iterationPreviews,
  };
}
