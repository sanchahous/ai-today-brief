import 'server-only';

import { createHash } from 'node:crypto';
import type { PipelineDb } from '../../../pipeline/db';
import {
  criticVerdictLooksUnreliable,
  editorialQualityFailures,
  editorialQualityRetryGuidance,
  validateMasterBundle,
  WEEKLY_MASTER_SPEC_VERSION,
  type WeeklyArticleMaster,
  type WeeklyContentQualityReport,
  type WeeklyLocale,
  type WeeklyMasterBundle,
  type WeeklyMasterStory,
  type WeeklyQualityIssue,
  type WeeklyResearchPack,
} from './content-studio';
import {
  approvedStoryPromptMaterial,
  criticPrompt,
  frameSegmentPrompt,
  generateFirstAvailable,
  generateIndependentCritic,
  generatePreferringProvider,
  parseFrameSegment,
  parseRepairedValue,
  parseStorySegment,
  repairFieldPrompt,
  splitMasterRetryGuidance,
  storySegmentPrompt,
  ukrainianFramePrompt,
  ukrainianStorySegmentPrompt,
  type EditorialGenerationMetadata,
  type FramePromptStory,
  type WeeklyMasterInputStory,
  type WeeklyMasterProviderStep,
  type WeeklyMasterRetryGuidance,
} from './editorial-llm';
import {
  assembleArticle,
  masterSegmentKey,
  masterSegmentLabel,
  masterSegmentPlan,
  type MasterFrame,
  type MasterSegment,
} from './master-segments';
import {
  applyRepairValue,
  describeRepairTarget,
  isListRepairField,
  planRepairTasks,
  readRepairValue,
  repairTargetKey,
  ukrainianCounterpart,
  type RepairTarget,
  type RepairTask,
  type UnresolvedIssue,
} from './master-repair';

export const MASTER_RUN_STATE_VERSION = 'weekly-master-run-v2';

type StorySegmentValue = Omit<WeeklyMasterStory, 'revisionItemId' | 'placement'>;

interface SegmentRecord {
  value: StorySegmentValue | MasterFrame;
  metadata: EditorialGenerationMetadata;
}

/**
 * Everything a resumed run needs to pick up exactly where the last one
 * stopped. Persisted by the worker after every segment and every repair
 * round, so the unit of lost work is one call rather than one edition.
 */
export interface MasterRunState {
  version: typeof MASTER_RUN_STATE_VERSION;
  /** Invalidates the whole state when the approved research or guidance changes. */
  planHash: string;
  segments: Record<string, SegmentRecord>;
  /** Field repairs already applied, replayed on resume so they are never re-paid. */
  repairs: Array<{ target: RepairTarget; value: string | string[] }>;
  repairAttempts: Record<string, number>;
  criticRounds: number;
  quality: WeeklyContentQualityReport | null;
  unresolved: UnresolvedIssue[];
  calls: {
    english: EditorialGenerationMetadata[];
    ukrainian: EditorialGenerationMetadata[];
    critic: EditorialGenerationMetadata[];
  };
}

export interface EngineProgress {
  step: WeeklyMasterProviderStep | 'prepare' | 'validate' | 'persist';
  percent: number;
  message: string;
}

export interface MasterEngineHooks {
  /** Called after every durable change; the worker turns this into a checkpoint. */
  onState?: (state: MasterRunState, progress: EngineProgress) => Promise<void> | void;
  onProviderCallStarted?: (
    step: WeeklyMasterProviderStep,
    context: { label: string; percent: number },
  ) => Promise<void> | void;
  onProviderCallCompleted?: (
    step: WeeklyMasterProviderStep,
    metadata: EditorialGenerationMetadata,
    context: { label: string; percent: number; durationMs: number },
  ) => Promise<void> | void;
  onNote?: (note: {
    level: 'info' | 'warning';
    step: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void> | void;
}

export interface WeeklyMasterRunInput {
  stories: WeeklyMasterInputStory[];
  researchPacks: WeeklyResearchPack[];
  retryGuidance?: WeeklyMasterRetryGuidance[];
  state?: MasterRunState | null;
  db?: PipelineDb;
  /** Epoch ms after which the run stops starting new work and saves what it has. */
  deadlineAt?: number;
  hooks?: MasterEngineHooks;
}

export type WeeklyMasterRunOutcome =
  | {
      status: 'complete';
      bundle: WeeklyMasterBundle;
      quality: WeeklyContentQualityReport;
      /** True when the quality gate passes with nothing unresolved. */
      converged: boolean;
      unresolved: UnresolvedIssue[];
      generation: {
        english: EditorialGenerationMetadata;
        ukrainian: EditorialGenerationMetadata;
        critic: EditorialGenerationMetadata;
      };
      state: MasterRunState;
    }
  | {
      status: 'incomplete';
      state: MasterRunState;
      completedSegments: number;
      totalSegments: number;
      reason: string;
    };

export function computeMasterPlanHash(
  researchPacks: WeeklyResearchPack[],
  retryGuidance: WeeklyMasterRetryGuidance[],
): string {
  return createHash('sha256')
    .update(JSON.stringify({ researchPacks, retryGuidance, spec: WEEKLY_MASTER_SPEC_VERSION }))
    .digest('hex');
}

export function emptyMasterRunState(planHash: string): MasterRunState {
  return {
    version: MASTER_RUN_STATE_VERSION,
    planHash,
    segments: {},
    repairs: [],
    repairAttempts: {},
    criticRounds: 0,
    quality: null,
    unresolved: [],
    calls: { english: [], ukrainian: [], critic: [] },
  };
}

/**
 * A stored state is reusable only when it was written by this engine version
 * for this exact plan. Anything else starts clean rather than resuming onto a
 * shape it cannot interpret.
 */
export function reusableMasterRunState(
  value: unknown,
  planHash: string,
): MasterRunState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const state = value as Partial<MasterRunState>;
  if (state.version !== MASTER_RUN_STATE_VERSION || state.planHash !== planHash) return null;
  if (!state.segments || typeof state.segments !== 'object') return null;
  return {
    ...emptyMasterRunState(planHash),
    ...state,
    segments: state.segments,
    repairs: Array.isArray(state.repairs) ? state.repairs : [],
    repairAttempts: state.repairAttempts ?? {},
    unresolved: Array.isArray(state.unresolved) ? state.unresolved : [],
    calls: {
      english: state.calls?.english ?? [],
      ukrainian: state.calls?.ukrainian ?? [],
      critic: state.calls?.critic ?? [],
    },
  } as MasterRunState;
}

function numberFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** How many times one field may be sent back before it is declared unresolved. */
function maxRepairAttemptsPerTarget() {
  return Math.max(1, numberFromEnv('WEEKLY_MASTER_MAX_REPAIR_ATTEMPTS', 2));
}

/** How many critic → repair → critic cycles a run may spend. */
function maxCriticRounds() {
  return Math.max(1, numberFromEnv('WEEKLY_MASTER_MAX_CRITIC_ROUNDS', 3));
}

/** How many deterministic-validate → repair cycles run before the first critic call. */
function maxDeterministicRounds() {
  return Math.max(1, numberFromEnv('WEEKLY_MASTER_MAX_DETERMINISTIC_ROUNDS', 3));
}

function maxRepairsPerRound() {
  return Math.max(1, numberFromEnv('WEEKLY_MASTER_MAX_REPAIRS_PER_ROUND', 12));
}

const WRITE_ATTEMPTS_PER_SEGMENT = 2;

function accumulate(calls: EditorialGenerationMetadata[]): EditorialGenerationMetadata {
  const last = calls[calls.length - 1];
  if (!last) {
    return {
      provider: 'openrouter',
      model: 'none',
      promptTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      costSource: 'estimated',
      promptVersion: WEEKLY_MASTER_SPEC_VERSION,
    };
  }
  return {
    provider: last.provider,
    model: last.model,
    promptTokens: calls.reduce((sum, call) => sum + call.promptTokens, 0),
    outputTokens: calls.reduce((sum, call) => sum + call.outputTokens, 0),
    estimatedCostUsd: Number(
      calls.reduce((sum, call) => sum + call.estimatedCostUsd, 0).toFixed(6),
    ),
    costSource: calls.every((call) => call.costSource === 'subscription')
      ? 'subscription'
      : calls.every((call) => call.costSource === 'reported')
        ? 'reported'
        : 'estimated',
    promptVersion: last.promptVersion,
  };
}

function storySegmentValue(record: SegmentRecord | undefined): StorySegmentValue | null {
  const value = record?.value as StorySegmentValue | undefined;
  return value && typeof value.body === 'string' ? value : null;
}

function frameSegmentValue(record: SegmentRecord | undefined): MasterFrame | null {
  const value = record?.value as MasterFrame | undefined;
  return value && typeof value.title === 'string' ? value : null;
}

/**
 * Runs one weekly master end to end, as a sequence of small resumable steps.
 *
 * Contract that matters most: **this function does not throw because the copy
 * is imperfect.** A failed quality check produces a repair, and a repair that
 * cannot be made produces an entry in `unresolved` that travels back to the
 * owner with the draft. The only errors that escape are infrastructural --
 * no provider reachable at all, or the deadline hit mid-write, which returns
 * an `incomplete` outcome whose state resumes rather than restarts.
 */
export async function runWeeklyMaster(
  input: WeeklyMasterRunInput,
): Promise<WeeklyMasterRunOutcome> {
  const retryGuidance = input.retryGuidance ?? [];
  const planHash = computeMasterPlanHash(input.researchPacks, retryGuidance);
  const state = input.state?.planHash === planHash ? input.state : emptyMasterRunState(planHash);
  const hooks = input.hooks ?? {};
  const deadlineAt = input.deadlineAt ?? Number.POSITIVE_INFINITY;
  const outOfTime = () => Date.now() >= deadlineAt;

  const storiesById = new Map(input.stories.map((story) => [story.revisionItemId, story]));
  const materialById = new Map(
    approvedStoryPromptMaterial(input.stories).map((material) => [material.revisionItemId, material]),
  );
  const order = input.stories.map((story) => ({
    revisionItemId: story.revisionItemId,
    placement: story.placement,
    rank: story.rank,
  }));
  const featureIds = order
    .filter((story) => story.placement === 'feature')
    .sort((left, right) => left.rank - right.rank)
    .map((story) => story.revisionItemId);
  const plan = masterSegmentPlan(order);
  const { english: englishGuidance, ukrainian: ukrainianGuidance } =
    splitMasterRetryGuidance(retryGuidance);

  const segmentPercent = (index: number) => 4 + Math.round((index / plan.length) * 62);

  const saveState = async (progress: EngineProgress) => {
    await hooks.onState?.(state, progress);
  };

  const note = async (
    level: 'info' | 'warning',
    step: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) => {
    await hooks.onNote?.({ level, step, message, ...(metadata ? { metadata } : {}) });
  };

  const call = async <T>(
    step: WeeklyMasterProviderStep,
    label: string,
    percent: number,
    run: () => Promise<{ value: T; metadata: EditorialGenerationMetadata }>,
  ) => {
    await hooks.onProviderCallStarted?.(step, { label, percent });
    const startedAt = Date.now();
    const result = await run();
    await hooks.onProviderCallCompleted?.(step, result.metadata, {
      label,
      percent,
      durationMs: Date.now() - startedAt,
    });
    const bucket = step === 'critic' ? 'critic' : step === 'ukrainian' ? 'ukrainian' : 'english';
    state.calls[bucket].push(result.metadata);
    return result;
  };

  // ---------------------------------------------------------------- writing

  await saveState({
    step: 'prepare',
    percent: 4,
    message: `Editorial plan: ${plan.length} segments, ${Object.keys(state.segments).length} already written`,
  });

  const writerProviderOf = (segment: MasterSegment) => {
    // Ukrainian adapts English, so it prefers whichever provider wrote the
    // English counterpart -- one voice across both locales. The preference is
    // never fatal: generatePreferringProvider falls through the rest of the
    // ladder when that provider fails (a live 2026-08-09 job died precisely
    // because this preference had no fallback).
    const counterpartKey =
      segment.kind === 'frame'
        ? masterSegmentKey({ kind: 'frame', locale: 'en' })
        : masterSegmentKey({ ...segment, locale: 'en' });
    return state.segments[counterpartKey]?.metadata.provider ?? null;
  };

  for (const [index, segment] of plan.entries()) {
    const key = masterSegmentKey(segment);
    if (state.segments[key]) continue;
    if (outOfTime()) {
      return {
        status: 'incomplete',
        state,
        completedSegments: Object.keys(state.segments).length,
        totalSegments: plan.length,
        reason: `Run deadline reached while writing ${masterSegmentLabel(segment)}.`,
      };
    }
    const label = masterSegmentLabel(segment);
    const percent = segmentPercent(index);
    const step: WeeklyMasterProviderStep = segment.locale === 'en' ? 'english' : 'ukrainian';

    let lastError: unknown;
    for (let attempt = 1; attempt <= WRITE_ATTEMPTS_PER_SEGMENT; attempt += 1) {
      try {
        const record = await call<StorySegmentValue | MasterFrame>(step, label, percent, async () => {
          if (segment.kind === 'story') {
            return writeStorySegment(segment, {
              storiesById,
              materialById,
              state,
              order,
              englishGuidance,
              ukrainianGuidance,
              db: input.db,
              preferredProvider: writerProviderOf(segment),
            });
          }
          return writeFrameSegment(segment, {
            state,
            order,
            englishGuidance,
            ukrainianGuidance,
            db: input.db,
            preferredProvider: writerProviderOf(segment),
          });
        });
        state.segments[key] = { value: record.value, metadata: record.metadata };
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        await note(
          'warning',
          step,
          `${label} attempt ${attempt}/${WRITE_ATTEMPTS_PER_SEGMENT} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    if (lastError) {
      // Every provider in the ladder refused this one segment twice. The
      // segments already written stay durable, so a retry resumes here
      // instead of re-paying for the whole edition.
      return {
        status: 'incomplete',
        state,
        completedSegments: Object.keys(state.segments).length,
        totalSegments: plan.length,
        reason: `${label} could not be written: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      };
    }
    await saveState({ step, percent, message: `${label} written` });
  }

  // ------------------------------------------------------------- assembling

  let bundle = assembleBundle(state, order);
  // Replay repairs from a previous attempt so a resume never re-pays for
  // fixes that already landed.
  for (const repair of state.repairs) {
    if (readRepairValue(bundle, repair.target) !== null) {
      bundle = applyRepairValue(bundle, repair.target, repair.value);
    }
  }

  const expectedStories = input.stories.map((story) => ({
    revisionItemId: story.revisionItemId,
    placement: story.placement,
    claimIds: story.claims.map((claim) => claim.id),
  }));
  const approvedClaimIds = input.stories.flatMap((story) => story.claims.map((claim) => claim.id));

  const applyRepairRound = async (
    tasks: RepairTask[],
    percent: number,
    roundLabel: string,
  ): Promise<{ repaired: number; failed: UnresolvedIssue[] }> => {
    const failed: UnresolvedIssue[] = [];
    let repaired = 0;
    // English first: a Ukrainian counterpart is re-adapted from the repaired
    // English value in the same round, which keeps the locales in parity
    // without re-adapting the whole Ukrainian article.
    const ordered = [...tasks].sort((left, right) =>
      left.target.locale === right.target.locale ? 0 : left.target.locale === 'en' ? -1 : 1,
    );
    const queue: RepairTask[] = [];
    const seen = new Set<string>();
    for (const task of ordered) {
      const key = repairTargetKey(task.target);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(task);
      const counterpart = ukrainianCounterpart(task.target);
      if (counterpart && !seen.has(repairTargetKey(counterpart))) {
        seen.add(repairTargetKey(counterpart));
        queue.push({
          target: counterpart,
          priority: task.priority,
          issues: [
            {
              code: 'parity_readaptation',
              message:
                'The English counterpart of this field was just rewritten. Re-adapt this field from the new English so both locales carry the same facts and numbers.',
              blocker: false,
            },
          ],
        });
      }
    }

    for (const task of queue.slice(0, maxRepairsPerRound())) {
      const key = repairTargetKey(task.target);
      const attempts = state.repairAttempts[key] ?? 0;
      if (attempts >= maxRepairAttemptsPerTarget()) continue;
      if (outOfTime()) {
        failed.push(
          ...task.issues.map((issue) => unresolvedFrom(issue, task.target, 'deadline')),
        );
        continue;
      }
      const currentValue = readRepairValue(bundle, task.target);
      if (currentValue === null) continue;
      state.repairAttempts[key] = attempts + 1;
      const label = describeRepairTarget(task.target);
      try {
        const result = await call('revisions', `${roundLabel}: ${label}`, percent, async () => {
          const prompt = repairFieldPrompt({
            target: task.target,
            currentValue,
            issues: task.issues.map((issue) => ({
              code: issue.code,
              message: issue.message,
              ...(issue.span ? { span: issue.span } : {}),
              ...(issue.suggestedFix ? { suggestedFix: issue.suggestedFix } : {}),
            })),
            ...groundingFor(task.target, storiesById, approvedClaimIds),
            ...counterpartFor(task.target, bundle),
            ...siblingsFor(task.target, bundle),
          });
          const preferred = state.segments[preferredSegmentKeyFor(task.target)]?.metadata.provider;
          const parse = (raw: string) => parseRepairedValue(raw, isListRepairField(task.target.field));
          return preferred
            ? generatePreferringProvider(preferred, prompt, parse, 'weekly.master_writer', input.db)
            : generateFirstAvailable(prompt, parse, 'weekly.master_writer', input.db);
        });
        const value = sanitizeRepairValue(task.target, result.value, approvedClaimIds);
        if (value === null) {
          failed.push(
            ...task.issues.map((issue) => unresolvedFrom(issue, task.target, 'repair_failed')),
          );
          continue;
        }
        bundle = applyRepairValue(bundle, task.target, value);
        state.repairs = [
          ...state.repairs.filter(
            (entry) => repairTargetKey(entry.target) !== repairTargetKey(task.target),
          ),
          { target: task.target, value },
        ];
        repaired += 1;
      } catch (error) {
        // One field refusing to be repaired must never end the edition: log
        // it, mark those issues unresolved, keep repairing the rest.
        await note('warning', 'revisions', `Repair of ${label} failed: ${
          error instanceof Error ? error.message : String(error)
        }`);
        failed.push(
          ...task.issues.map((issue) => unresolvedFrom(issue, task.target, 'repair_failed')),
        );
      }
    }
    return { repaired, failed };
  };

  // --------------------------------------------- deterministic repair phase

  // Runs before the first paid critic call. Roughly half of the blockers this
  // pipeline has ever produced (metadata length, template leaks, missing
  // editor's view, numeric parity, Ukrainian language residue, generic
  // practical) are decided by code, not judgment -- fixing them here means the
  // critic never spends five minutes rejecting a draft over something a
  // regular expression already knew about.
  let deterministicUnresolved: UnresolvedIssue[] = [];
  for (let round = 1; round <= maxDeterministicRounds(); round += 1) {
    const issues = validateMasterBundle(bundle, input.researchPacks, expectedStories);
    const blocking = issues.filter((issue) => issue.blocker);
    if (!blocking.length) {
      deterministicUnresolved = [];
      break;
    }
    const percent = 66 + round;
    await note(
      'info',
      'validate',
      `Deterministic check round ${round}: ${blocking.length} blocking issue(s) to repair (${[
        ...new Set(blocking.map((issue) => issue.code)),
      ].join(', ')})`,
    );
    const { tasks, unmapped } = planRepairTasks(
      bundle,
      { issues, factualFlags: [] },
      { featureIds, exhaustedTargetKeys: exhaustedTargets(state) },
    );
    if (!tasks.length) {
      deterministicUnresolved = unmapped;
      break;
    }
    const { repaired, failed } = await applyRepairRound(tasks, percent, `Pre-critic round ${round}`);
    deterministicUnresolved = [...unmapped, ...failed];
    await saveState({
      step: 'validate',
      percent,
      message: `Repaired ${repaired} field(s) before the critic`,
    });
    if (!repaired) break;
  }

  // ------------------------------------------------------------ critic loop

  let quality = state.quality;
  let criticUnresolved: UnresolvedIssue[] = [];
  // Only used to pick a critic from a different provider/vendor than the
  // writer. Every path above guarantees the English frame exists by now; the
  // fallbacks keep a missing one from throwing an opaque property error here.
  const writerMetadata: Pick<EditorialGenerationMetadata, 'provider' | 'model'> = state.segments[
    masterSegmentKey({ kind: 'frame', locale: 'en' })
  ]?.metadata ??
    state.calls.english[0] ?? { provider: 'openrouter', model: 'unknown' };

  for (let round = state.criticRounds + 1; round <= maxCriticRounds(); round += 1) {
    // Out of time but never scored: still make one critic call. A bundle with
    // no verdict at all cannot be persisted as anything, and the deadline
    // leaves deliberate slack for exactly this (see WEEKLY_MASTER_DEADLINE_MS).
    if (outOfTime() && quality) break;
    const percent = Math.min(94, 72 + (round - 1) * 8);
    let critic: Awaited<ReturnType<typeof generateIndependentCritic>>;
    try {
      critic = await call('critic', `Editorial critic round ${round}`, percent, () =>
        generateIndependentCritic(writerMetadata, criticPrompt(bundle, input.stories), input.db),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // The bilingual bundle is durable before the critic starts. Treat a
      // critic outage like any other resumable infrastructure failure, so a
      // retry can score the saved copy instead of throwing the edition away.
      await note('warning', 'critic', `Critic round ${round} could not score the edition: ${message}`);
      await saveState({
        step: 'critic',
        percent,
        message: 'Editorial critic unavailable; retry will reuse the saved segments.',
      });
      return {
        status: 'incomplete',
        state,
        completedSegments: Object.keys(state.segments).length,
        totalSegments: plan.length,
        reason: `Editorial critic round ${round} could not score the edition: ${message}`,
      };
    }
    const deterministicIssues = validateMasterBundle(bundle, input.researchPacks, expectedStories);
    quality = {
      schemaVersion: 'weekly-quality-v2',
      score: critic.value.score,
      dimensions: critic.value.dimensions,
      issues: [...deterministicIssues, ...critic.value.issues],
      factualFlags: critic.value.factualFlags,
      approvedClaimIds,
      checkedAt: new Date().toISOString(),
    };
    state.quality = quality;
    state.criticRounds = round;
    await saveState({
      step: 'critic',
      percent,
      message: `Critic round ${round}: ${quality.score}/100`,
    });

    const failures = editorialQualityFailures(quality);
    if (!failures.length) {
      criticUnresolved = [];
      break;
    }
    await note('info', 'critic', `Round ${round} did not pass: ${failures.join('; ')}`);

    if (round === maxCriticRounds()) {
      criticUnresolved = failures.map((failure) => ({
        code: 'quality_gate',
        message: failure,
        blocker: true,
        reason: 'rounds_exhausted' as const,
      }));
      break;
    }

    // A low dimension score is a real instruction once it is attached to the
    // span the critic quoted -- it used to be the one failure class that
    // reached the retry path with nothing actionable in it.
    const dimensionIssues: WeeklyQualityIssue[] = editorialQualityRetryGuidance(quality).map(
      (entry) => ({ code: entry.code, message: entry.message, blocker: true, ...(entry.locale ? { locale: entry.locale } : {}) }),
    );
    const { tasks, unmapped } = planRepairTasks(
      bundle,
      { issues: [...quality.issues, ...dimensionIssues], factualFlags: quality.factualFlags },
      { featureIds, exhaustedTargetKeys: exhaustedTargets(state) },
    );
    if (!tasks.length) {
      // Nothing in the copy to fix. If the verdict itself is the problem (seven
      // identical scores, a malformed dimension set), score it again rather
      // than declaring the edition unfixable over the critic's own laziness --
      // the exact case that used to fail a job outright.
      if (criticVerdictLooksUnreliable(quality)) {
        await note('info', 'critic', `Round ${round} verdict looks unreliable — re-scoring`);
        criticUnresolved = [];
        continue;
      }
      criticUnresolved = unmapped.length
        ? unmapped
        : failures.map((failure) => ({
            code: 'quality_gate',
            message: failure,
            blocker: true,
            reason: 'attempts_exhausted' as const,
          }));
      break;
    }
    const { repaired, failed } = await applyRepairRound(
      tasks,
      percent + 3,
      `Critic round ${round} repair`,
    );
    criticUnresolved = [...unmapped, ...failed];
    await saveState({
      step: 'revisions',
      percent: percent + 3,
      message: `Applied ${repaired} targeted repair(s) after critic round ${round}`,
    });
    if (!repaired) break;
  }

  if (!quality) {
    // Only reachable when the deadline hit before any critic call ran.
    return {
      status: 'incomplete',
      state,
      completedSegments: Object.keys(state.segments).length,
      totalSegments: plan.length,
      reason: 'Run deadline reached before the editorial critic could score the edition.',
    };
  }

  const remainingFailures = editorialQualityFailures(quality);
  const converged = remainingFailures.length === 0;
  const unresolved = dedupeUnresolved([
    ...deterministicUnresolved,
    ...criticUnresolved,
    // A gate that still fails must always hand the owner something to read.
    // The loop can exit with an empty list (e.g. the last round was spent
    // re-scoring an unreliable verdict), and "needs review, 0 items" would be
    // the same uninformative dead end this refactor exists to remove.
    ...(converged
      ? []
      : remainingFailures.map((failure) => ({
          code: 'quality_gate',
          message: failure,
          blocker: true,
          reason: 'rounds_exhausted' as const,
        }))),
  ]);
  state.unresolved = unresolved;
  await saveState({
    step: 'persist',
    percent: 95,
    message: converged
      ? 'Editorial quality gate passed'
      : `Editorial quality gate has ${unresolved.length} unresolved item(s) for owner review`,
  });

  return {
    status: 'complete',
    bundle,
    quality,
    converged,
    unresolved,
    generation: {
      english: accumulate(state.calls.english),
      ukrainian: accumulate(state.calls.ukrainian),
      critic: accumulate(state.calls.critic),
    },
    state,
  };
}

function exhaustedTargets(state: MasterRunState): Set<string> {
  const limit = maxRepairAttemptsPerTarget();
  return new Set(
    Object.entries(state.repairAttempts)
      .filter(([, attempts]) => attempts >= limit)
      .map(([key]) => key),
  );
}

function unresolvedFrom(
  issue: WeeklyQualityIssue,
  target: RepairTarget,
  reason: UnresolvedIssue['reason'],
): UnresolvedIssue {
  return {
    code: issue.code,
    message: issue.message,
    blocker: issue.blocker,
    locale: target.locale,
    ...(target.revisionItemId ? { revisionItemId: target.revisionItemId } : {}),
    field: target.field,
    reason,
  };
}

function dedupeUnresolved(entries: UnresolvedIssue[]): UnresolvedIssue[] {
  const byKey = new Map<string, UnresolvedIssue>();
  for (const entry of entries) {
    const key = `${entry.code}:${entry.locale ?? ''}:${entry.revisionItemId ?? ''}:${entry.field ?? ''}`;
    if (!byKey.has(key)) byKey.set(key, entry);
  }
  return [...byKey.values()];
}

function assembleBundle(
  state: MasterRunState,
  order: Array<{ revisionItemId: string; placement: 'feature' | 'radar'; rank: number }>,
): WeeklyMasterBundle {
  const build = (locale: WeeklyLocale): WeeklyArticleMaster => {
    const frame = frameSegmentValue(state.segments[masterSegmentKey({ kind: 'frame', locale })]);
    if (!frame) throw new Error(`Missing ${locale} frame segment.`);
    const stories = new Map<string, WeeklyMasterStory>();
    for (const entry of order) {
      const value = storySegmentValue(
        state.segments[
          masterSegmentKey({
            kind: 'story',
            locale,
            revisionItemId: entry.revisionItemId,
            placement: entry.placement,
            rank: entry.rank,
          })
        ],
      );
      if (!value) throw new Error(`Missing ${locale} story segment for ${entry.revisionItemId}.`);
      stories.set(entry.revisionItemId, {
        ...value,
        revisionItemId: entry.revisionItemId,
        placement: entry.placement,
      });
    }
    return assembleArticle(locale, frame, stories, order);
  };
  return { en: build('en'), uk: build('uk') };
}

function preferredSegmentKeyFor(target: RepairTarget): string {
  return target.revisionItemId
    ? `${target.locale}:story:${target.revisionItemId}`
    : `${target.locale}:frame`;
}

function groundingFor(
  target: RepairTarget,
  storiesById: Map<string, WeeklyMasterInputStory>,
  approvedClaimIds: string[],
): { grounding?: unknown } {
  if (!target.revisionItemId) return {};
  const story = storiesById.get(target.revisionItemId);
  if (!story) return {};
  if (target.field === 'claimIds') {
    return { grounding: { allowedClaimIds: story.claims.map((claim) => claim.id), approvedClaimIds } };
  }
  const [material] = approvedStoryPromptMaterial([story]);
  return {
    grounding: {
      claims: material?.claims ?? [],
      ...(material?.primarySourceExcerpt
        ? { primarySourceExcerpt: material.primarySourceExcerpt }
        : {}),
    },
  };
}

function counterpartFor(
  target: RepairTarget,
  bundle: WeeklyMasterBundle,
): { englishCounterpart?: string | string[] } {
  if (target.locale !== 'uk') return {};
  const value = readRepairValue(bundle, { ...target, locale: 'en' });
  return value === null ? {} : { englishCounterpart: value };
}

const SIBLING_FIELDS = ['why', 'practical', 'takeaway', 'limitation'] as const;

function siblingsFor(
  target: RepairTarget,
  bundle: WeeklyMasterBundle,
): { siblings?: Record<string, string> } {
  if (!target.revisionItemId) return {};
  if (!SIBLING_FIELDS.includes(target.field as (typeof SIBLING_FIELDS)[number])) return {};
  const siblings: Record<string, string> = {};
  for (const field of SIBLING_FIELDS) {
    if (field === target.field) continue;
    const value = readRepairValue(bundle, { ...target, field });
    if (typeof value === 'string') siblings[field] = value;
  }
  return { siblings };
}

/**
 * Last line of defence on a repair response: a replacement that is empty, or
 * a claim-id list carrying ids outside the approved set, is worse than the
 * text it would overwrite.
 */
function sanitizeRepairValue(
  target: RepairTarget,
  value: string | string[],
  approvedClaimIds: string[],
): string | string[] | null {
  if (typeof value === 'string') return value.trim() ? value.trim() : null;
  const cleaned = value.map((entry) => entry.trim()).filter(Boolean);
  if (target.field === 'claimIds') {
    const approved = new Set(approvedClaimIds);
    const filtered = cleaned.filter((entry) => approved.has(entry));
    return filtered.length ? filtered : null;
  }
  return cleaned.length ? cleaned : null;
}

async function writeStorySegment(
  segment: Extract<MasterSegment, { kind: 'story' }>,
  context: {
    storiesById: Map<string, WeeklyMasterInputStory>;
    materialById: Map<string, ReturnType<typeof approvedStoryPromptMaterial>[number]>;
    state: MasterRunState;
    order: Array<{ revisionItemId: string; placement: 'feature' | 'radar'; rank: number }>;
    englishGuidance: WeeklyMasterRetryGuidance[];
    ukrainianGuidance: WeeklyMasterRetryGuidance[];
    db?: PipelineDb;
    preferredProvider: EditorialGenerationMetadata['provider'] | null;
  },
) {
  const story = context.storiesById.get(segment.revisionItemId);
  if (!story) throw new Error(`Unknown story ${segment.revisionItemId}.`);
  const approvedIds = story.claims.map((claim) => claim.id);

  if (segment.locale === 'en') {
    const alreadyWritten = context.order
      .filter((entry) => entry.rank < segment.rank)
      .sort((left, right) => left.rank - right.rank)
      .flatMap((entry) => {
        const value = storySegmentValue(context.state.segments[`en:story:${entry.revisionItemId}`]);
        return value ? [{ rank: entry.rank, headline: value.headline, hook: value.hook }] : [];
      });
    const material = context.materialById.get(segment.revisionItemId);
    if (!material) throw new Error(`Missing prompt material for ${segment.revisionItemId}.`);
    return generateFirstAvailable(
      storySegmentPrompt({
        material,
        placement: segment.placement,
        rank: segment.rank,
        alreadyWritten,
        guidance: context.englishGuidance,
      }),
      (raw) => parseStorySegment(raw, approvedIds),
      'weekly.master_writer',
      context.db,
    );
  }

  const english = storySegmentValue(context.state.segments[`en:story:${segment.revisionItemId}`]);
  if (!english) throw new Error(`English story ${segment.revisionItemId} must be written first.`);
  const prompt = ukrainianStorySegmentPrompt({
    english,
    placement: segment.placement,
    terminology: { titleUk: story.titleUk, summaryUk: story.summaryUk, whyUk: story.whyUk },
    guidance: context.ukrainianGuidance,
  });
  // Claim ids are copied from English rather than re-asked for: identical
  // arrays across locales are the whole content of the `bilingual_claim_parity`
  // blocker, so making them structural removes that failure mode entirely.
  const parse = (raw: string) => ({
    ...parseStorySegment(raw, english.claimIds),
    claimIds: english.claimIds,
  });
  return context.preferredProvider
    ? generatePreferringProvider(
        context.preferredProvider,
        prompt,
        parse,
        'weekly.master_writer',
        context.db,
      )
    : generateFirstAvailable(prompt, parse, 'weekly.master_writer', context.db);
}

async function writeFrameSegment(
  segment: Extract<MasterSegment, { kind: 'frame' }>,
  context: {
    state: MasterRunState;
    order: Array<{ revisionItemId: string; placement: 'feature' | 'radar'; rank: number }>;
    englishGuidance: WeeklyMasterRetryGuidance[];
    ukrainianGuidance: WeeklyMasterRetryGuidance[];
    db?: PipelineDb;
    preferredProvider: EditorialGenerationMetadata['provider'] | null;
  },
) {
  const stories: FramePromptStory[] = context.order.map((entry) => {
    const value = storySegmentValue(
      context.state.segments[`${segment.locale}:story:${entry.revisionItemId}`],
    );
    if (!value) throw new Error(`Story ${entry.revisionItemId} must be written before the frame.`);
    return {
      rank: entry.rank,
      placement: entry.placement,
      headline: value.headline,
      hook: value.hook,
      why: value.why,
      takeaway: value.takeaway,
    };
  });

  if (segment.locale === 'en') {
    return generateFirstAvailable(
      frameSegmentPrompt(stories, context.englishGuidance),
      parseFrameSegment,
      'weekly.master_writer',
      context.db,
    );
  }

  const english = frameSegmentValue(context.state.segments['en:frame']);
  if (!english) throw new Error('The English frame must be written first.');
  const prompt = ukrainianFramePrompt({
    english,
    stories: stories.map(({ rank, headline, takeaway }) => ({ rank, headline, takeaway })),
    guidance: context.ukrainianGuidance,
  });
  return context.preferredProvider
    ? generatePreferringProvider(
        context.preferredProvider,
        prompt,
        parseFrameSegment,
        'weekly.master_writer',
        context.db,
      )
    : generateFirstAvailable(prompt, parseFrameSegment, 'weekly.master_writer', context.db);
}
