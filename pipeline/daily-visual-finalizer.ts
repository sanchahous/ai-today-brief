import { createHash } from 'node:crypto';
import type { Database, Json } from '@/lib/database.types';
import { SITE_URL } from '@/lib/site';
import {
  composeDailyVisualSocialPackage,
  type DailyVisualSocialInput,
} from '@/lib/social/daily-visual-composer';
import {
  DAILY_VISUAL_POLICY_ID,
  DAILY_VISUAL_DIRECTION_RETRY_ATTEMPT,
  buildDailyVisualDirectionInstruction,
  buildDailyVisualImagePrompt,
  buildDailyVisualRepairPrompt,
  dailyVisualBudgetStepMaxCost,
  dailyVisualAltText,
  fallbackDailyVisualDirection,
  hashDailyVisualSnapshot,
  isDailyVisualDirectionRetryMode,
  parseDailyVisualDirection,
  type DailyVisualBudgetStep,
  type DailyVisualDirection,
  type DailyVisualSnapshot,
  type DailyVisualStory,
} from './daily-visual-contract';
import {
  DailyVisualImageError,
  generateDailyVisualImage,
  type DailyVisualRenderedImage,
} from './daily-visual-openai';
import { critiqueDailyVisualCandidate, type DailyVisualQaResult } from './daily-visual-qa';
import {
  DAILY_VISUAL_MASTER_HEIGHT,
  DAILY_VISUAL_MASTER_WIDTH,
  findPrivateDailyVisualCandidate,
  loadPrivateDailyVisualCandidateBytes,
  persistPrivateDailyVisualCandidate,
  promoteDailyVisualCandidate,
  recordDailyVisualQa,
  renderBrandedDailyVisualFallback,
  type StoredDailyVisualCandidate,
} from './daily-visual-storage';
import { dailyVisualSocialInput } from './daily-visual-input';
import type { PipelineDb } from './db';
import { generateDailyVisualDirectionSingleAttempt } from './daily-visual-direction-provider';
import { logEvent } from './log';
import type { ProviderCallResult } from './providers/types';
import { generateWithVisionSingleAttempt } from './providers/vision';

type DailyVisualCandidateKind = Extract<DailyVisualBudgetStep, 'ai_primary' | 'ai_repair'>;

type BriefRow = Pick<
  Database['public']['Tables']['briefs']['Row'],
  'id' | 'date' | 'edition' | 'slug' | 'title_en' | 'title_uk' | 'intro_en' | 'intro_uk' | 'status'
>;

type BriefItemRow = Pick<
  Database['public']['Tables']['brief_items']['Row'],
  | 'id'
  | 'brief_id'
  | 'rank'
  | 'title_en'
  | 'title_uk'
  | 'summary_en'
  | 'summary_uk'
  | 'why_matters_en'
  | 'why_matters_uk'
  | 'review_status'
>;

export type DailyVisualFinalizationStatus =
  'activated' | 'needs_visual_choice' | 'skipped' | 'failed';

export interface DailyVisualFinalizationResult {
  status: DailyVisualFinalizationStatus;
  editorialDate: string;
  visualSetId: string | null;
  reason: string;
  activeCandidateId: string | null;
}

export interface DailyVisualFinalizerDependencies {
  generateDirection?: (prompt: string) => Promise<ProviderCallResult>;
  generateImage?: (prompt: string) => Promise<DailyVisualRenderedImage>;
  critique?: (input: {
    bytes: Buffer;
    mimeType: string;
    width: number;
    height: number;
    direction: DailyVisualDirection;
    snapshot: DailyVisualSnapshot;
  }) => Promise<DailyVisualQaResult>;
  composeSocial?: (input: DailyVisualSocialInput) => Promise<unknown>;
  revalidate?: (paths: string[]) => Promise<void>;
}

/** A newer worker or an editor owns this set now; stop without changing it. */
class DailyVisualLeaseLostError extends Error {
  constructor() {
    super('Daily visual claim is no longer live.');
    this.name = 'DailyVisualLeaseLostError';
  }
}

/** No unreserved provider call is allowed to bypass the $5 monthly ledger. */
class DailyVisualBudgetUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(`Daily visual budget is unavailable: ${reason}.`);
    this.name = 'DailyVisualBudgetUnavailableError';
  }
}

/** A provider returned a price outside the ceiling that authorized its call. */
class DailyVisualBudgetPriceMismatchError extends Error {
  constructor(
    readonly step: DailyVisualBudgetStep,
    readonly maxCostMicroUsd: number,
  ) {
    super(`Daily visual ${step} provider price exceeded its pre-authorized maximum.`);
    this.name = 'DailyVisualBudgetPriceMismatchError';
  }
}

function compact(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function jsonValue(value: unknown): Json {
  // This is the persistence boundary: snapshot/direction/QA structures consist
  // exclusively of plain JSON values before they cross into jsonb.
  return JSON.parse(JSON.stringify(value)) as Json;
}

function promptHash(prompt: string) {
  return createHash('sha256').update(prompt).digest('hex');
}

function microsToUsd(microUsd: number) {
  return microUsd / 1_000_000;
}

function sourceStory(item: BriefItemRow, edition: number): DailyVisualStory {
  return {
    id: item.id,
    rank: edition * 100 + item.rank,
    titleEn: compact(item.title_en),
    titleUk: compact(item.title_uk),
    summaryEn: compact(item.summary_en),
    summaryUk: compact(item.summary_uk),
    whyEn: compact(item.why_matters_en),
    whyUk: compact(item.why_matters_uk),
  };
}

/** Pure snapshot constructor, shared by the worker test and the paid finalizer. */
export function buildDailyVisualSnapshot(
  editorialDate: string,
  briefs: BriefRow[],
  items: BriefItemRow[],
): DailyVisualSnapshot | null {
  const published = briefs
    .filter((brief) => brief.status === 'published')
    .sort((left, right) => left.edition - right.edition || left.id.localeCompare(right.id));
  const lead = published[0];
  if (!lead?.slug) return null;
  const editionByBrief = new Map(published.map((brief) => [brief.id, brief.edition]));
  const stories = items
    .filter((item) => item.review_status === 'approved' && editionByBrief.has(item.brief_id))
    .map((item) => sourceStory(item, editionByBrief.get(item.brief_id)!))
    .sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id));
  if (stories.length === 0) return null;
  return {
    editorialDate,
    leadBriefId: lead.id,
    canonicalSlug: lead.slug,
    titleEn: compact(lead.title_en),
    titleUk: compact(lead.title_uk),
    introEn: compact(lead.intro_en),
    introUk: compact(lead.intro_uk),
    stories,
  };
}

async function loadSnapshot(
  db: PipelineDb,
  editorialDate: string,
): Promise<DailyVisualSnapshot | null> {
  const { data: briefData, error: briefError } = await db
    .from('briefs')
    .select('id,date,edition,slug,title_en,title_uk,intro_en,intro_uk,status')
    .eq('date', editorialDate)
    .eq('status', 'published')
    .order('edition', { ascending: true });
  if (briefError) throw new Error(`[daily-visual] load published briefs: ${briefError.message}`);
  const briefs = (briefData ?? []) as BriefRow[];
  if (briefs.length === 0) return null;
  const briefIds = briefs.map((brief) => brief.id);
  const { data: itemData, error: itemError } = await db
    .from('brief_items')
    .select(
      'id,brief_id,rank,title_en,title_uk,summary_en,summary_uk,why_matters_en,why_matters_uk,review_status',
    )
    .in('brief_id', briefIds)
    .eq('review_status', 'approved')
    .order('rank', { ascending: true });
  if (itemError) throw new Error(`[daily-visual] load approved stories: ${itemError.message}`);
  return buildDailyVisualSnapshot(editorialDate, briefs, (itemData ?? []) as BriefItemRow[]);
}

async function defaultDirectionGenerator(prompt: string): Promise<ProviderCallResult> {
  return generateDailyVisualDirectionSingleAttempt(prompt);
}

type StoredDailyVisualDirection =
  | { state: 'missing' }
  | { state: 'generated'; direction: DailyVisualDirection }
  | { state: 'fallback'; direction: DailyVisualDirection }
  | { state: 'malformed' };

/**
 * A candidate slot is immutable, so a retry must reuse the direction that
 * produced it. The marker also prevents a crash after writing the zero-cost
 * fallback from turning that fallback into a fresh automatic image request.
 */
export function parseStoredDailyVisualDirection(value: unknown): StoredDailyVisualDirection {
  if (value === null || value === undefined) return { state: 'missing' };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { state: 'malformed' };
  const direction = parseDailyVisualDirection(JSON.stringify(value));
  if (!direction) return { state: 'malformed' };
  const source = (value as Record<string, unknown>).daily_visual_direction_source;
  return source === 'fallback'
    ? { state: 'fallback', direction }
    : { state: 'generated', direction };
}

async function loadStoredDailyVisualDirection(
  db: PipelineDb,
  visualSetId: string,
): Promise<StoredDailyVisualDirection> {
  const { data, error } = await db
    .from('daily_visual_sets')
    .select('direction')
    .eq('id', visualSetId)
    .maybeSingle();
  if (error) throw new Error(`[daily-visual] load stored direction: ${error.message}`);
  return parseStoredDailyVisualDirection(data?.direction);
}

async function writeWorkerSetState(
  db: PipelineDb,
  input: {
    visualSetId: string;
    jobId: string;
    claimToken: string;
    mutation: 'direction' | 'latest_ai_candidate' | 'fallback_candidate';
    direction?: DailyVisualDirection;
    candidateId?: string;
  },
): Promise<void> {
  const direction = input.direction;
  const { data, error } = await db.rpc('write_daily_visual_worker_set_state', {
    p_daily_visual_set_id: input.visualSetId,
    p_job_id: input.jobId,
    p_claim_token: input.claimToken,
    p_mutation: input.mutation,
    p_direction: direction ? jsonValue(direction) : null,
    p_display_title_en: direction?.displayTitleEn ?? null,
    p_display_title_uk: direction?.displayTitleUk ?? null,
    p_visual_thesis_en: direction?.visualThesisEn ?? null,
    p_visual_thesis_uk: direction?.visualThesisUk ?? null,
    p_overlay_stat_en: direction?.overlayStatEn ?? null,
    p_overlay_stat_uk: direction?.overlayStatUk ?? null,
    p_candidate_id: input.candidateId ?? null,
  });
  if (error) throw new Error(`[daily-visual] save worker set state: ${error.message}`);
  if (!data) throw new DailyVisualLeaseLostError();
}

async function updateDirection(
  db: PipelineDb,
  input: {
    visualSetId: string;
    jobId: string;
    claimToken: string;
    direction: DailyVisualDirection;
    source?: 'generated' | 'fallback';
  },
): Promise<void> {
  const storedDirection = {
    ...input.direction,
    daily_visual_direction_source: input.source ?? 'generated',
  };
  await writeWorkerSetState(db, {
    visualSetId: input.visualSetId,
    jobId: input.jobId,
    claimToken: input.claimToken,
    direction: storedDirection,
    mutation: 'direction',
  });
}

async function finishJob(
  db: PipelineDb,
  jobId: string,
  claimToken: string,
  status: 'succeeded' | 'needs_visual_choice' | 'failed',
  error?: string,
): Promise<void> {
  const { data, error: rpcError } = await db.rpc('finish_daily_visual_job', {
    p_job_id: jobId,
    p_claim_token: claimToken,
    p_status: status,
    p_error: error?.slice(0, 1000) ?? null,
  });
  if (rpcError) throw new Error(`[daily-visual] finish job: ${rpcError.message}`);
  if (!data) throw new DailyVisualLeaseLostError();
}

async function reserveBudget(
  db: PipelineDb,
  input: {
    editorialDate: string;
    visualSetId: string;
    step: DailyVisualBudgetStep;
    attempt: number;
  },
): Promise<{ reservationId: string | null; granted: boolean; reason: string }> {
  const maxCostMicroUsd = dailyVisualBudgetStepMaxCost(input.step);
  const { data, error } = await db.rpc('reserve_daily_visual_budget', {
    p_editorial_date: input.editorialDate,
    p_daily_visual_set_id: input.visualSetId,
    p_candidate_kind: input.step,
    p_attempt_number: input.attempt,
    p_max_cost_micro_usd: maxCostMicroUsd,
  });
  if (error) throw new Error(`[daily-visual] reserve budget: ${error.message}`);
  const row = data?.[0];
  return row
    ? {
        reservationId: row.reservation_id,
        granted: row.granted,
        reason: row.reason,
      }
    : { reservationId: null, granted: false, reason: 'empty_budget_response' };
}

async function settleBudget(
  db: PipelineDb,
  reservationId: string,
  status: 'committed' | 'released' | 'held_for_reconcile',
  actualCostMicroUsd: number | null = null,
): Promise<void> {
  const { data, error } = await db.rpc('settle_daily_visual_budget', {
    p_reservation_id: reservationId,
    p_status: status,
    p_actual_cost_micro_usd: actualCostMicroUsd,
  });
  if (error || !data) {
    throw new Error(
      `[daily-visual] settle budget: ${error?.message ?? 'reservation was not settled'}`,
    );
  }
}

type DailyVisualProviderBudgetSettlement = {
  status: 'committed' | 'held_for_reconcile';
  accountedCostMicroUsd: number;
  providerPriceExceededReservation: boolean;
};

function reportedProviderCostMicroUsd(result: ProviderCallResult): number | null {
  const costUsd = result.usage.costUsd;
  if (
    result.usage.costSource !== 'reported' ||
    typeof costUsd !== 'number' ||
    !Number.isFinite(costUsd) ||
    costUsd < 0
  ) {
    return null;
  }
  const microUsd = Math.ceil(costUsd * 1_000_000);
  return Number.isSafeInteger(microUsd) ? microUsd : null;
}

/**
 * A provider result is allowed to release reserved headroom only when the
 * provider itself reports a bounded monetary amount. Missing, estimated and
 * subscription usage stay held: their apparent $0 is not evidence of $0
 * spend, and a retry must not turn that uncertainty into an overrun.
 */
async function settleProviderBudget(
  db: PipelineDb,
  reservationId: string,
  result: ProviderCallResult,
  maxCostMicroUsd: number,
): Promise<DailyVisualProviderBudgetSettlement> {
  const reportedCostMicroUsd = reportedProviderCostMicroUsd(result);
  if (reportedCostMicroUsd === null) {
    await settleBudget(db, reservationId, 'held_for_reconcile');
    return {
      status: 'held_for_reconcile',
      accountedCostMicroUsd: maxCostMicroUsd,
      providerPriceExceededReservation: false,
    };
  }
  if (reportedCostMicroUsd > maxCostMicroUsd) {
    await settleBudget(db, reservationId, 'held_for_reconcile');
    return {
      status: 'held_for_reconcile',
      accountedCostMicroUsd: maxCostMicroUsd,
      providerPriceExceededReservation: true,
    };
  }
  await settleBudget(db, reservationId, 'committed', reportedCostMicroUsd);
  return {
    status: 'committed',
    accountedCostMicroUsd: reportedCostMicroUsd,
    providerPriceExceededReservation: false,
  };
}

async function logBudgetedProviderCost(
  db: PipelineDb,
  input: {
    editorialDate: string;
    visualSetId: string;
    step: DailyVisualBudgetStep;
    reservationId: string;
    result: ProviderCallResult | null;
    settlement: DailyVisualProviderBudgetSettlement;
  },
): Promise<void> {
  const { error } = await db.from('generation_cost_events').insert({
    scope: 'daily',
    kind: 'llm',
    provider: input.result?.provider ?? 'unknown',
    model: input.result?.model ?? 'unknown',
    cost_usd: microsToUsd(input.settlement.accountedCostMicroUsd),
    cost_source: input.settlement.status === 'committed' ? 'reported' : 'estimated',
    prompt_tokens: input.result?.usage.promptTokens ?? null,
    output_tokens: input.result?.usage.outputTokens ?? null,
    step_key: `daily.visual_${input.step}`,
    metadata: {
      editorial_date: input.editorialDate,
      daily_visual_set_id: input.visualSetId,
      reservation_id: input.reservationId,
      reservation_cap_micro_usd: dailyVisualBudgetStepMaxCost(input.step),
      reservation_status: input.settlement.status,
      provider_cost_source: input.result?.usage.costSource ?? 'unknown',
      provider_price_exceeded_reservation: input.settlement.providerPriceExceededReservation,
    },
  });
  if (error) {
    logEvent('warn', 'daily-visual', 'Provider budget cost event could not be written', {
      editorial_date: input.editorialDate,
      daily_visual_set_id: input.visualSetId,
      step: input.step,
      error: error.message,
    });
  }
}

async function callBudgetedProvider(
  db: PipelineDb,
  input: {
    editorialDate: string;
    visualSetId: string;
    step: Extract<DailyVisualBudgetStep, 'direction' | 'qa_image_only' | 'qa_story_semantic'>;
    attempt: number;
    invoke: () => Promise<ProviderCallResult>;
  },
): Promise<ProviderCallResult> {
  const reservation = await reserveBudget(db, input);
  if (!reservation.granted || !reservation.reservationId) {
    throw new DailyVisualBudgetUnavailableError(reservation.reason);
  }
  const maxCostMicroUsd = dailyVisualBudgetStepMaxCost(input.step);
  let result: ProviderCallResult;
  try {
    result = await input.invoke();
  } catch (error) {
    // A thrown provider call can still have reached the provider. Keep the
    // full pre-authorized amount until an operator can reconcile it.
    const settlement: DailyVisualProviderBudgetSettlement = {
      status: 'held_for_reconcile',
      accountedCostMicroUsd: maxCostMicroUsd,
      providerPriceExceededReservation: false,
    };
    await settleBudget(db, reservation.reservationId, settlement.status);
    await logBudgetedProviderCost(db, {
      editorialDate: input.editorialDate,
      visualSetId: input.visualSetId,
      step: input.step,
      reservationId: reservation.reservationId,
      result: null,
      settlement,
    });
    throw error;
  }

  const settlement = await settleProviderBudget(
    db,
    reservation.reservationId,
    result,
    maxCostMicroUsd,
  );
  await logBudgetedProviderCost(db, {
    editorialDate: input.editorialDate,
    visualSetId: input.visualSetId,
    step: input.step,
    reservationId: reservation.reservationId,
    result,
    settlement,
  });
  if (settlement.providerPriceExceededReservation) {
    throw new DailyVisualBudgetPriceMismatchError(input.step, maxCostMicroUsd);
  }
  return result;
}

async function logImageCost(
  db: PipelineDb,
  input: {
    editorialDate: string;
    visualSetId: string;
    kind: DailyVisualCandidateKind;
    candidateId: string;
    reservationId: string;
    reservedCostMicroUsd: number;
    reservationStatus: 'committed' | 'held_for_reconcile';
  },
): Promise<void> {
  const { error } = await db.from('generation_cost_events').insert({
    scope: 'daily',
    kind: 'image',
    provider: 'openai',
    model: 'gpt-image-2',
    // The Images API does not return a billable amount. Conservatively record
    // the locked maximum, the same value that protects the $5 monthly cap.
    cost_usd: microsToUsd(input.reservedCostMicroUsd),
    cost_source: 'estimated',
    step_key: `daily.visual_${input.kind}`,
    metadata: {
      editorial_date: input.editorialDate,
      daily_visual_set_id: input.visualSetId,
      candidate_id: input.candidateId,
      reservation_id: input.reservationId,
      reservation_cap_micro_usd: input.reservedCostMicroUsd,
      reservation_status: input.reservationStatus,
    },
  });
  if (error) {
    logEvent('warn', 'daily-visual', 'Image cost event could not be written', {
      editorial_date: input.editorialDate,
      daily_visual_set_id: input.visualSetId,
      error: error.message,
    });
  }
}

function imageMayHaveBeenBilled(error: unknown): boolean {
  return error instanceof DailyVisualImageError && error.mayHaveBeenBilled;
}

type CandidateRenderResult =
  | { kind: 'ready'; candidate: StoredDailyVisualCandidate; bytes: Buffer; reused: boolean }
  | { kind: 'budget_unavailable'; reason: string }
  | { kind: 'render_failed'; reason: string };

async function renderOrReuseCandidate(
  db: PipelineDb,
  input: {
    editorialDate: string;
    visualSetId: string;
    kind: DailyVisualCandidateKind;
    attempt: number;
    prompt: string;
    parentCandidateId?: string | null;
    generateImage: (prompt: string) => Promise<DailyVisualRenderedImage>;
  },
): Promise<CandidateRenderResult> {
  const prior = await findPrivateDailyVisualCandidate(
    db,
    input.visualSetId,
    input.kind,
    input.attempt,
  );
  if (prior) {
    return {
      kind: 'ready',
      candidate: prior,
      bytes: await loadPrivateDailyVisualCandidateBytes(db, prior),
      reused: true,
    };
  }

  const reservation = await reserveBudget(db, {
    editorialDate: input.editorialDate,
    visualSetId: input.visualSetId,
    step: input.kind,
    attempt: input.attempt,
  });
  if (!reservation.granted || !reservation.reservationId) {
    return { kind: 'budget_unavailable', reason: reservation.reason };
  }

  let rendered: DailyVisualRenderedImage;
  try {
    rendered = await input.generateImage(input.prompt);
  } catch (error) {
    await settleBudget(
      db,
      reservation.reservationId,
      imageMayHaveBeenBilled(error) ? 'held_for_reconcile' : 'released',
    );
    return {
      kind: 'render_failed',
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  let candidate: StoredDailyVisualCandidate;
  try {
    candidate = await persistPrivateDailyVisualCandidate(db, {
      editorialDate: input.editorialDate,
      dailyVisualSetId: input.visualSetId,
      kind: input.kind,
      attemptNumber: input.attempt,
      bytes: rendered.bytes,
      provider: rendered.provider,
      model: rendered.model,
      prompt: input.prompt,
      promptHash: promptHash(input.prompt),
      parentCandidateId: input.parentCandidateId ?? null,
    });
  } catch (error) {
    // The model request completed, but we cannot prove durable storage. Keep
    // the reservation for reconciliation rather than creating a retry loophole.
    await settleBudget(db, reservation.reservationId, 'held_for_reconcile');
    return {
      kind: 'render_failed',
      reason: `Rendered image could not be retained: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // GPT Image does not return a billable amount. A successful image is still
  // a successful candidate, but its full declared maximum stays reserved
  // until reconciliation instead of being falsely recorded as a known price.
  await settleBudget(db, reservation.reservationId, 'held_for_reconcile');
  await logImageCost(db, {
    editorialDate: input.editorialDate,
    visualSetId: input.visualSetId,
    kind: input.kind,
    candidateId: candidate.id,
    reservationId: reservation.reservationId,
    reservedCostMicroUsd: dailyVisualBudgetStepMaxCost(input.kind),
    reservationStatus: 'held_for_reconcile',
  });
  return {
    kind: 'ready',
    candidate,
    bytes: await loadPrivateDailyVisualCandidateBytes(db, candidate),
    reused: false,
  };
}

async function setLatestAiCandidate(
  db: PipelineDb,
  input: { visualSetId: string; jobId: string; claimToken: string; candidateId: string },
): Promise<void> {
  await writeWorkerSetState(db, {
    ...input,
    mutation: 'latest_ai_candidate',
  });
}

async function ensureFallbackCandidate(
  db: PipelineDb,
  input: { editorialDate: string; visualSetId: string; jobId: string; claimToken: string },
): Promise<StoredDailyVisualCandidate> {
  const candidate = await persistPrivateDailyVisualCandidate(db, {
    editorialDate: input.editorialDate,
    dailyVisualSetId: input.visualSetId,
    kind: 'branded_fallback',
    attemptNumber: 0,
    bytes: await renderBrandedDailyVisualFallback(),
    provider: 'internal',
    model: 'branded-fallback-v1',
    prompt: null,
    promptHash: null,
  });
  await writeWorkerSetState(db, {
    visualSetId: input.visualSetId,
    jobId: input.jobId,
    claimToken: input.claimToken,
    mutation: 'fallback_candidate',
    candidateId: candidate.id,
  });
  return candidate;
}

async function recordQa(
  db: PipelineDb,
  candidateId: string,
  qa: DailyVisualQaResult,
): Promise<void> {
  for (const stage of qa.stages) {
    await recordDailyVisualQa(db, {
      candidateId,
      stage: stage.stage,
      outcome: stage.outcome,
      report: jsonValue(stage.critique),
      provider: stage.provider,
      model: stage.model,
    });
  }
}

async function critiqueCandidateWithBudget(
  db: PipelineDb,
  input: {
    editorialDate: string;
    visualSetId: string;
    attempt: number;
    bytes: Buffer;
    direction: DailyVisualDirection;
    snapshot: DailyVisualSnapshot;
    critique?: DailyVisualFinalizerDependencies['critique'];
  },
): Promise<DailyVisualQaResult> {
  const critiqueInput = {
    bytes: input.bytes,
    mimeType: 'image/webp' as const,
    width: DAILY_VISUAL_MASTER_WIDTH,
    height: DAILY_VISUAL_MASTER_HEIGHT,
    direction: input.direction,
    snapshot: input.snapshot,
  };
  // Dependency injection is reserved for deterministic local tests. The only
  // production path runs every vision stage through callBudgetedProvider.
  if (input.critique) return input.critique(critiqueInput);
  return critiqueDailyVisualCandidate(critiqueInput, {
    generateVisionStage: (stage, visionInput) =>
      callBudgetedProvider(db, {
        editorialDate: input.editorialDate,
        visualSetId: input.visualSetId,
        step: stage === 'image_only' ? 'qa_image_only' : 'qa_story_semantic',
        attempt: input.attempt,
        invoke: () => generateWithVisionSingleAttempt('daily.image_critic', visionInput),
      }),
  });
}

async function activePublicationMatches(
  db: PipelineDb,
  editorialDate: string,
  candidateId: string,
): Promise<{ publicUrl: string; width: number; height: number } | null> {
  const { data, error } = await db
    .from('daily_visual_publications')
    .select('candidate_id,public_url,width,height')
    .eq('editorial_date', editorialDate)
    .maybeSingle();
  if (error) throw new Error(`[daily-visual] read public projection: ${error.message}`);
  if (!data || data.candidate_id !== candidateId) return null;
  return { publicUrl: data.public_url, width: data.width, height: data.height };
}

async function activateCandidate(
  db: PipelineDb,
  input: {
    editorialDate: string;
    visualSetId: string;
    jobId: string;
    claimToken: string;
    candidate: StoredDailyVisualCandidate;
    direction: DailyVisualDirection;
  },
): Promise<{ publicUrl: string; width: number; height: number }> {
  const existing = await activePublicationMatches(db, input.editorialDate, input.candidate.id);
  const promoted =
    existing ??
    (await promoteDailyVisualCandidate(db, {
      editorialDate: input.editorialDate,
      candidate: input.candidate,
    }));
  const { data, error } = await db.rpc('activate_daily_visual_candidate', {
    p_daily_visual_set_id: input.visualSetId,
    p_candidate_id: input.candidate.id,
    p_public_url: promoted.publicUrl,
    p_width: promoted.width,
    p_height: promoted.height,
    p_alt_en: dailyVisualAltText(input.direction, 'en'),
    p_alt_uk: dailyVisualAltText(input.direction, 'uk'),
    p_selection_kind: 'auto_qa_pass',
    p_reason: `Passed ${DAILY_VISUAL_POLICY_ID} semantic QA.`,
    p_actor_kind: 'service',
    p_claim_token: input.claimToken,
  });
  if (error) throw new Error(`[daily-visual] activate candidate: ${error.message}`);
  if (!data) throw new DailyVisualLeaseLostError();
  return promoted;
}

async function defaultRevalidate(paths: string[]): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) {
    logEvent(
      'warn',
      'daily-visual',
      'REVALIDATE_SECRET is not configured; ISR will refresh naturally.',
      {
        path_count: paths.length,
      },
    );
    return;
  }
  const response = await fetch(`${SITE_URL}/api/revalidate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ paths }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Revalidate endpoint returned HTTP ${response.status}.`);
}

async function publishCandidate(
  db: PipelineDb,
  input: {
    editorialDate: string;
    visualSetId: string;
    jobId: string;
    claimToken: string;
    snapshot: DailyVisualSnapshot;
    direction: DailyVisualDirection;
    candidate: StoredDailyVisualCandidate;
    composeSocial: (input: DailyVisualSocialInput) => Promise<unknown>;
    revalidate: (paths: string[]) => Promise<void>;
  },
): Promise<void> {
  const promoted = await activateCandidate(db, input);
  try {
    await input.composeSocial(
      dailyVisualSocialInput(
        input.snapshot,
        input.direction,
        input.visualSetId,
        promoted.publicUrl,
      ),
    );
  } catch (error) {
    // The image is already safely live and the job is atomically complete.
    // Draft composition is recoverable; do not mark the active cover failed.
    logEvent(
      'warn',
      'daily-visual',
      'Public visual activation completed but social drafts failed',
      {
        editorial_date: input.editorialDate,
        daily_visual_set_id: input.visualSetId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
  try {
    await input.revalidate([
      `/en/${input.snapshot.canonicalSlug}`,
      `/uk/${input.snapshot.canonicalSlug}`,
      '/en/digests',
      '/uk/digests',
    ]);
  } catch (error) {
    // Publication is already atomic and complete; cache invalidation must not
    // roll it back or discard its social drafts.
    logEvent('warn', 'daily-visual', 'Public visual activation completed but revalidation failed', {
      editorial_date: input.editorialDate,
      daily_visual_set_id: input.visualSetId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function needsChoice(
  db: PipelineDb,
  input: {
    jobId: string;
    claimToken: string;
    editorialDate: string;
    visualSetId: string;
    reason: string;
  },
): Promise<DailyVisualFinalizationResult> {
  await finishJob(db, input.jobId, input.claimToken, 'needs_visual_choice', input.reason);
  logEvent('warn', 'daily-visual', 'Daily visual requires an explicit owner choice', {
    editorial_date: input.editorialDate,
    daily_visual_set_id: input.visualSetId,
    reason: input.reason,
  });
  return {
    status: 'needs_visual_choice',
    editorialDate: input.editorialDate,
    visualSetId: input.visualSetId,
    reason: input.reason,
    activeCandidateId: null,
  };
}

/**
 * Finalize one closed editorial day. It never changes a published story list,
 * and it never swaps in the branded fallback automatically. The only automatic
 * public transition is a candidate that passed both visual QA stages.
 */
export async function finalizeDailyVisual(
  db: PipelineDb,
  editorialDate: string,
  dependencies: DailyVisualFinalizerDependencies = {},
): Promise<DailyVisualFinalizationResult> {
  const snapshot = await loadSnapshot(db, editorialDate);
  if (!snapshot) {
    return {
      status: 'skipped',
      editorialDate,
      visualSetId: null,
      reason: 'no_final_approved_items',
      activeCandidateId: null,
    };
  }

  const sourceHash = hashDailyVisualSnapshot(snapshot);
  const { data: claimRows, error: claimError } = await db.rpc('begin_daily_visual_finalization', {
    p_editorial_date: editorialDate,
    p_source_hash: sourceHash,
    p_source_snapshot: jsonValue(snapshot),
    p_lead_brief_id: snapshot.leadBriefId,
  });
  if (claimError) throw new Error(`[daily-visual] begin finalization: ${claimError.message}`);
  const claim = claimRows?.[0];
  if (
    !claim?.should_run ||
    !claim.daily_visual_set_id ||
    !claim.daily_visual_job_id ||
    !claim.claim_token
  ) {
    return {
      status: 'skipped',
      editorialDate,
      visualSetId: claim?.daily_visual_set_id ?? null,
      reason: claim?.reason ?? 'claim_unavailable',
      activeCandidateId: null,
    };
  }

  const visualSetId = claim.daily_visual_set_id;
  const jobId = claim.daily_visual_job_id;
  const claimToken = claim.claim_token;
  // This mode is only written by the owner-only database RPC after it proves
  // that the first attempt never reached an AI candidate. It deliberately
  // uses the otherwise unused attempt-1 slots and omits repair entirely.
  const isDirectionRetry = isDailyVisualDirectionRetryMode(claim.retry_mode);
  const automaticAttempt = isDirectionRetry ? DAILY_VISUAL_DIRECTION_RETRY_ATTEMPT : 0;
  const generateDirection =
    dependencies.generateDirection ?? ((prompt) => defaultDirectionGenerator(prompt));
  const generateImage =
    dependencies.generateImage ?? ((prompt) => generateDailyVisualImage(prompt));
  const composeSocial = dependencies.composeSocial ?? composeDailyVisualSocialPackage;
  const revalidate = dependencies.revalidate ?? defaultRevalidate;

  try {
    await ensureFallbackCandidate(db, { editorialDate, visualSetId, jobId, claimToken });

    const storedDirection = await loadStoredDailyVisualDirection(db, visualSetId);
    if (storedDirection.state === 'fallback' && !isDirectionRetry) {
      return needsChoice(db, {
        jobId,
        claimToken,
        editorialDate,
        visualSetId,
        reason: 'fallback_direction_awaiting_manual_choice',
      });
    }
    if (storedDirection.state === 'malformed' && !isDirectionRetry) {
      return needsChoice(db, {
        jobId,
        claimToken,
        editorialDate,
        visualSetId,
        reason: 'stored_direction_malformed',
      });
    }

    const directionPrompt = buildDailyVisualDirectionInstruction(snapshot);
    let direction: DailyVisualDirection | null =
      !isDirectionRetry && storedDirection.state === 'generated' ? storedDirection.direction : null;
    if (!direction) {
      try {
        const directionResult = await callBudgetedProvider(db, {
          editorialDate,
          visualSetId,
          step: 'direction',
          attempt: automaticAttempt,
          invoke: () => generateDirection(directionPrompt),
        });
        direction = parseDailyVisualDirection(directionResult.text);
      } catch (error) {
        logEvent(
          'warn',
          'daily-visual',
          'Visual direction generation failed; leaving a manual fallback choice',
          {
            editorial_date: editorialDate,
            daily_visual_set_id: visualSetId,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }
    if (!direction) {
      await updateDirection(db, {
        visualSetId,
        jobId,
        claimToken,
        direction: fallbackDailyVisualDirection(snapshot),
        source: 'fallback',
      });
      return needsChoice(db, {
        jobId,
        claimToken,
        editorialDate,
        visualSetId,
        reason: 'direction_unavailable_or_malformed',
      });
    }
    if (storedDirection.state === 'missing' || isDirectionRetry) {
      await updateDirection(db, {
        visualSetId,
        jobId,
        claimToken,
        direction,
        source: 'generated',
      });
    }

    const primary = await renderOrReuseCandidate(db, {
      editorialDate,
      visualSetId,
      kind: 'ai_primary',
      attempt: automaticAttempt,
      prompt: buildDailyVisualImagePrompt(direction),
      generateImage,
    });
    if (primary.kind !== 'ready') {
      return needsChoice(db, {
        jobId,
        claimToken,
        editorialDate,
        visualSetId,
        reason:
          primary.kind === 'budget_unavailable'
            ? `budget:${primary.reason}`
            : `primary:${primary.reason}`,
      });
    }
    await setLatestAiCandidate(db, {
      visualSetId,
      jobId,
      claimToken,
      candidateId: primary.candidate.id,
    });
    const primaryQa = await critiqueCandidateWithBudget(db, {
      editorialDate,
      visualSetId,
      attempt: automaticAttempt,
      bytes: primary.bytes,
      direction,
      snapshot,
      critique: dependencies.critique,
    });
    await recordQa(db, primary.candidate.id, primaryQa);
    if (primaryQa.passed) {
      await publishCandidate(db, {
        editorialDate,
        visualSetId,
        jobId,
        claimToken,
        snapshot,
        direction,
        candidate: primary.candidate,
        composeSocial,
        revalidate,
      });
      return {
        status: 'activated',
        editorialDate,
        visualSetId,
        reason: isDirectionRetry
          ? primary.reused
            ? 'reused_direction_retry_primary_passed'
            : 'direction_retry_primary_passed'
          : primary.reused
            ? 'reused_primary_passed'
            : 'primary_passed',
        activeCandidateId: primary.candidate.id,
      };
    }

    // The owner recovery budget deliberately has no repair slot. A failed
    // fresh primary remains private beside the original fallback for an
    // explicit editorial choice; it can never make the fallback public.
    if (isDirectionRetry) {
      return needsChoice(db, {
        jobId,
        claimToken,
        editorialDate,
        visualSetId,
        reason: 'bounded_direction_retry_failed_semantic_qa',
      });
    }

    const repair = await renderOrReuseCandidate(db, {
      editorialDate,
      visualSetId,
      kind: 'ai_repair',
      attempt: 1,
      prompt: buildDailyVisualRepairPrompt(direction, primaryQa.repairPatches),
      parentCandidateId: primary.candidate.id,
      generateImage,
    });
    if (repair.kind !== 'ready') {
      return needsChoice(db, {
        jobId,
        claimToken,
        editorialDate,
        visualSetId,
        reason:
          repair.kind === 'budget_unavailable'
            ? `repair_budget:${repair.reason}`
            : `repair:${repair.reason}`,
      });
    }
    await setLatestAiCandidate(db, {
      visualSetId,
      jobId,
      claimToken,
      candidateId: repair.candidate.id,
    });
    const repairQa = await critiqueCandidateWithBudget(db, {
      editorialDate,
      visualSetId,
      attempt: 1,
      bytes: repair.bytes,
      direction,
      snapshot,
      critique: dependencies.critique,
    });
    await recordQa(db, repair.candidate.id, repairQa);
    if (!repairQa.passed) {
      return needsChoice(db, {
        jobId,
        claimToken,
        editorialDate,
        visualSetId,
        reason: 'primary_and_repair_failed_semantic_qa',
      });
    }
    await publishCandidate(db, {
      editorialDate,
      visualSetId,
      jobId,
      claimToken,
      snapshot,
      direction,
      candidate: repair.candidate,
      composeSocial,
      revalidate,
    });
    return {
      status: 'activated',
      editorialDate,
      visualSetId,
      reason: repair.reused ? 'reused_repair_passed' : 'repair_passed',
      activeCandidateId: repair.candidate.id,
    };
  } catch (error) {
    if (error instanceof DailyVisualLeaseLostError) {
      logEvent('warn', 'daily-visual', 'Daily visual worker lost its lease; no state was changed', {
        editorial_date: editorialDate,
        daily_visual_set_id: visualSetId,
      });
      return {
        status: 'skipped',
        editorialDate,
        visualSetId,
        reason: 'claim_lost_or_expired',
        activeCandidateId: null,
      };
    }
    const reason = error instanceof Error ? error.message : String(error);
    try {
      await finishJob(db, jobId, claimToken, 'failed', reason);
    } catch (finishError) {
      logEvent(
        'error',
        'daily-visual',
        'Finalizer failed and its job status could not be recorded',
        {
          editorial_date: editorialDate,
          daily_visual_set_id: visualSetId,
          error: reason,
          finish_error: finishError instanceof Error ? finishError.message : String(finishError),
        },
      );
    }
    logEvent('error', 'daily-visual', 'Daily visual finalizer failed', {
      editorial_date: editorialDate,
      daily_visual_set_id: visualSetId,
      error: reason,
    });
    return {
      status: 'failed',
      editorialDate,
      visualSetId,
      reason,
      activeCandidateId: null,
    };
  }
}
