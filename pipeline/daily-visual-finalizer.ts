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
  parseDailyVisualImageRoute,
  resolveDailyVisualImageRoute,
  withDailyVisualImageRouteWinner,
  winningDailyVisualImageModelRoute,
  type DailyVisualImageModelRoute,
  type DailyVisualImageRoute,
  type DailyVisualRenderedImage,
} from './daily-visual-openrouter';
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
  generateImage?: (
    prompt: string,
    route: DailyVisualImageModelRoute,
  ) => Promise<DailyVisualRenderedImage>;
  resolveImageRoute?: (input: {
    currentChampion: DailyVisualImageModelRoute | null;
    rejectedModelIds: ReadonlySet<string>;
  }) => Promise<DailyVisualImageRoute>;
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
  | {
      state: 'generated';
      direction: DailyVisualDirection;
      imageRoute: DailyVisualImageRoute | null;
    }
  | { state: 'fallback'; direction: DailyVisualDirection; imageRoute: null }
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
  const stored = value as Record<string, unknown>;
  const source = stored.daily_visual_direction_source;
  const rawRoute = stored.daily_visual_image_route;
  const imageRoute =
    rawRoute === undefined || rawRoute === null ? null : parseDailyVisualImageRoute(rawRoute);
  if (rawRoute !== undefined && rawRoute !== null && !imageRoute) return { state: 'malformed' };
  return source === 'fallback'
    ? { state: 'fallback', direction, imageRoute: null }
    : { state: 'generated', direction, imageRoute };
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

type DailyVisualImageRouteHistory = {
  currentChampion: DailyVisualImageModelRoute | null;
  rejectedModelIds: Set<string>;
};

function openRouterImageRoutingConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.OPEN_ROUTER_API_KEY?.trim() || env.OPENROUTER_API_KEY?.trim());
}

/**
 * Only an already active visual may define the next day's champion. A canary
 * that failed and was repaired is remembered, so the same model is not billed
 * again every day merely because it remains in the live catalog.
 */
export function collectDailyVisualImageRouteHistory(
  rows: readonly { direction: unknown }[],
): DailyVisualImageRouteHistory {
  let currentChampion: DailyVisualImageModelRoute | null = null;
  const rejectedModelIds = new Set<string>();
  for (const row of rows) {
    const direction = row.direction;
    if (!direction || typeof direction !== 'object' || Array.isArray(direction)) continue;
    const route = parseDailyVisualImageRoute(
      (direction as Record<string, unknown>).daily_visual_image_route,
    );
    if (!route) continue;
    // A repair that wins a canary is evidence against the new model and
    // restores the previous champion. A routine fallback for the established
    // champion is only a one-day recovery, never an accidental global switch.
    if (route.strategy === 'canary' && route.winner === 'repair') {
      rejectedModelIds.add(route.primary.model);
    }
    if (!currentChampion) {
      currentChampion =
        route.strategy === 'champion' ? route.primary : winningDailyVisualImageModelRoute(route);
    }
  }
  return { currentChampion, rejectedModelIds };
}

async function loadDailyVisualImageRouteHistory(
  db: PipelineDb,
): Promise<DailyVisualImageRouteHistory> {
  const { data, error } = await db
    .from('daily_visual_sets')
    .select('direction')
    .eq('status', 'active')
    .order('editorial_date', { ascending: false })
    .limit(60);
  if (error) throw new Error(`[daily-visual] load image route history: ${error.message}`);

  return collectDailyVisualImageRouteHistory((data ?? []) as { direction: unknown }[]);
}

async function resolveFreshDailyVisualImageRoute(
  db: PipelineDb,
  dependencies: DailyVisualFinalizerDependencies,
): Promise<DailyVisualImageRoute> {
  if (dependencies.resolveImageRoute) {
    return dependencies.resolveImageRoute({ currentChampion: null, rejectedModelIds: new Set() });
  }
  if (!openRouterImageRoutingConfigured()) {
    throw new Error('OPEN_ROUTER_API_KEY is not configured for daily image routing.');
  }

  let history: DailyVisualImageRouteHistory;
  try {
    history = await loadDailyVisualImageRouteHistory(db);
  } catch (error) {
    // We cannot tell an actual first daily from a read outage here. Do not
    // silently treat a possibly established champion as absent and promote a
    // fresh catalog model without the intended canary rollback path.
    logEvent(
      'warn',
      'daily-visual',
      'Image route history was unavailable; refusing route selection',
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
    throw new Error('Daily image route history is unavailable.');
  }
  return resolveDailyVisualImageRoute({
    currentChampion: history.currentChampion,
    rejectedModelIds: history.rejectedModelIds,
  });
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
    imageRoute?: DailyVisualImageRoute;
  },
): Promise<void> {
  const storedDirection = {
    ...input.direction,
    daily_visual_direction_source: input.source ?? 'generated',
    ...(input.imageRoute ? { daily_visual_image_route: input.imageRoute } : {}),
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
  if (row?.reason === 'reservation_exists' && typeof row.reservation_id === 'string') {
    const wasQuarantined = await quarantineExistingBudgetReservation(db, row.reservation_id);
    return {
      reservationId: row.reservation_id,
      granted: false,
      // A process can die immediately after reservation, before it has bytes
      // or a provider response to persist. Do not retry that paid slot: keep
      // the conservative reservation visible for ledger reconciliation.
      reason: wasQuarantined ? 'existing_reservation_held_for_reconcile' : 'reservation_exists',
    };
  }
  return row
    ? {
        reservationId: row.reservation_id,
        granted: row.granted,
        reason: row.reason,
      }
    : { reservationId: null, granted: false, reason: 'empty_budget_response' };
}

/**
 * A duplicate reservation can mean the previous worker died after its provider
 * request was dispatched, but before it persisted any recoverable output. A
 * fresh worker must never make another paid request for that slot. `held` keeps
 * its maximum cost in the monthly ledger until an operator reconciles it.
 */
async function quarantineExistingBudgetReservation(
  db: PipelineDb,
  reservationId: string,
): Promise<boolean> {
  // This must be one atomic transition, not a read followed by `settleBudget`:
  // a lease-expired worker can finish the same slot between those calls. The
  // SQL function locks the reservation and returns false when it was already
  // settled, which is still a no-render outcome for this retry.
  const { data, error } = await db.rpc('settle_daily_visual_budget', {
    p_reservation_id: reservationId,
    p_status: 'held_for_reconcile',
    p_actual_cost_micro_usd: null,
  });
  if (error) {
    throw new Error(`[daily-visual] quarantine existing budget reservation: ${error.message}`);
  }
  return data === true;
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

function reportedRenderedImageCostMicroUsd(rendered: DailyVisualRenderedImage): number | null {
  const costUsd = rendered.usage.costUsd;
  if (
    rendered.usage.costSource !== 'reported' ||
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
 * OpenRouter reports a completed image's exact cost. We commit it only when it
 * agrees with both the hard ledger reservation and the frozen endpoint price;
 * an unexpected amount remains held for reconciliation and cannot auto-publish.
 */
async function settleRenderedImageBudget(
  db: PipelineDb,
  reservationId: string,
  rendered: DailyVisualRenderedImage,
  route: DailyVisualImageModelRoute,
  maxCostMicroUsd: number,
): Promise<DailyVisualProviderBudgetSettlement> {
  const reportedCostMicroUsd = reportedRenderedImageCostMicroUsd(rendered);
  if (reportedCostMicroUsd === null) {
    await settleBudget(db, reservationId, 'held_for_reconcile');
    return {
      status: 'held_for_reconcile',
      accountedCostMicroUsd: maxCostMicroUsd,
      providerPriceExceededReservation: false,
    };
  }
  if (reportedCostMicroUsd > maxCostMicroUsd || reportedCostMicroUsd > route.fixedCostMicroUsd) {
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
    rendered: DailyVisualRenderedImage;
    route: DailyVisualImageModelRoute;
    settlement: DailyVisualProviderBudgetSettlement;
  },
): Promise<void> {
  const { error } = await db.from('generation_cost_events').insert({
    scope: 'daily',
    kind: 'image',
    provider: input.rendered.provider,
    model: input.rendered.model,
    cost_usd: microsToUsd(input.settlement.accountedCostMicroUsd),
    cost_source: input.settlement.status === 'committed' ? 'reported' : 'estimated',
    step_key: `daily.visual_${input.kind}`,
    metadata: {
      editorial_date: input.editorialDate,
      daily_visual_set_id: input.visualSetId,
      candidate_id: input.candidateId,
      reservation_id: input.reservationId,
      reservation_cap_micro_usd: dailyVisualBudgetStepMaxCost(input.kind),
      reservation_status: input.settlement.status,
      route_model: input.route.model,
      route_provider: input.route.provider,
      route_fixed_cost_micro_usd: input.route.fixedCostMicroUsd,
      provider_cost_source: input.rendered.usage.costSource,
      provider_price_exceeded_reservation: input.settlement.providerPriceExceededReservation,
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

/**
 * A private candidate can survive a process crash between Storage persistence
 * and budget settlement. Reusing those bytes without this ledger check would
 * let an unknown-cost image skip the exact-cost gate on the next worker run.
 * A persisted candidate proves the provider call got far enough to produce
 * bytes, so a stranded `reserved` slot is first made reconcilable rather than
 * permanently consuming the monthly cap.
 */
async function hasCommittedReusableImageReservation(
  db: PipelineDb,
  input: {
    visualSetId: string;
    kind: DailyVisualCandidateKind;
    attempt: number;
    route: DailyVisualImageModelRoute;
  },
): Promise<boolean> {
  const { data, error } = await db
    .from('daily_visual_budget_reservations')
    .select('id,status,actual_cost_micro_usd,max_cost_micro_usd')
    .eq('daily_visual_set_id', input.visualSetId)
    .eq('candidate_kind', input.kind)
    .eq('attempt_number', input.attempt)
    .maybeSingle();
  if (error) {
    throw new Error(`[daily-visual] load reusable image reservation: ${error.message}`);
  }
  if (data?.status === 'reserved' && data.id) {
    // This is intentionally not a release: Storage has a completed model
    // output, but we cannot prove its exact charge after the crash window.
    await settleBudget(db, data.id, 'held_for_reconcile');
    return false;
  }
  const actual = data?.actual_cost_micro_usd;
  return (
    data?.status === 'committed' &&
    data.max_cost_micro_usd === dailyVisualBudgetStepMaxCost(input.kind) &&
    typeof actual === 'number' &&
    Number.isSafeInteger(actual) &&
    actual >= 0 &&
    actual <= input.route.fixedCostMicroUsd
  );
}

async function renderOrReuseCandidate(
  db: PipelineDb,
  input: {
    editorialDate: string;
    visualSetId: string;
    kind: DailyVisualCandidateKind;
    attempt: number;
    prompt: string;
    parentCandidateId?: string | null;
    route: DailyVisualImageModelRoute;
    generateImage: (
      prompt: string,
      route: DailyVisualImageModelRoute,
    ) => Promise<DailyVisualRenderedImage>;
  },
): Promise<CandidateRenderResult> {
  const prior = await findPrivateDailyVisualCandidate(
    db,
    input.visualSetId,
    input.kind,
    input.attempt,
  );
  if (prior) {
    const isCostAttested = await hasCommittedReusableImageReservation(db, {
      visualSetId: input.visualSetId,
      kind: input.kind,
      attempt: input.attempt,
      route: input.route,
    });
    if (!isCostAttested) {
      return { kind: 'render_failed', reason: 'persisted_image_cost_unattested' };
    }
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
    rendered = await input.generateImage(input.prompt, input.route);
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

  const settlement = await settleRenderedImageBudget(
    db,
    reservation.reservationId,
    rendered,
    input.route,
    dailyVisualBudgetStepMaxCost(input.kind),
  );
  await logImageCost(db, {
    editorialDate: input.editorialDate,
    visualSetId: input.visualSetId,
    kind: input.kind,
    candidateId: candidate.id,
    reservationId: reservation.reservationId,
    rendered,
    route: input.route,
    settlement,
  });
  if (settlement.providerPriceExceededReservation) {
    return {
      kind: 'render_failed',
      reason: 'provider_reported_image_price_exceeded_frozen_route',
    };
  }
  if (settlement.status !== 'committed') {
    return {
      kind: 'render_failed',
      reason: 'provider_reported_image_cost_unavailable',
    };
  }
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
    dependencies.generateImage ?? ((prompt, route) => generateDailyVisualImage(prompt, route));
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
    let imageRoute =
      !isDirectionRetry && storedDirection.state === 'generated'
        ? storedDirection.imageRoute
        : null;
    if (!imageRoute) {
      // Persist the editorial contract before any network-based route
      // discovery. A safe route outage must still leave the branded fallback
      // and manual source replacement activatable with real display titles.
      await updateDirection(db, {
        visualSetId,
        jobId,
        claimToken,
        direction,
        source: 'generated',
      });
      const existingPrimary = await findPrivateDailyVisualCandidate(
        db,
        visualSetId,
        'ai_primary',
        automaticAttempt,
      );
      if (existingPrimary) {
        // A historical candidate made before route snapshots cannot safely be
        // repaired with a newly discovered model. Keep it private for review.
        return needsChoice(db, {
          jobId,
          claimToken,
          editorialDate,
          visualSetId,
          reason: 'unfrozen_image_route_for_existing_candidate',
        });
      }
      try {
        imageRoute = await resolveFreshDailyVisualImageRoute(db, dependencies);
      } catch (error) {
        logEvent('warn', 'daily-visual', 'Image route could not be resolved', {
          editorial_date: editorialDate,
          daily_visual_set_id: visualSetId,
          error: error instanceof Error ? error.message : String(error),
        });
        return needsChoice(db, {
          jobId,
          claimToken,
          editorialDate,
          visualSetId,
          reason: 'image_route_unavailable',
        });
      }
      await updateDirection(db, {
        visualSetId,
        jobId,
        claimToken,
        direction,
        source: 'generated',
        imageRoute,
      });
    }

    const primary = await renderOrReuseCandidate(db, {
      editorialDate,
      visualSetId,
      kind: 'ai_primary',
      attempt: automaticAttempt,
      prompt: buildDailyVisualImagePrompt(direction),
      route: imageRoute.primary,
      generateImage,
    });
    if (primary.kind === 'budget_unavailable') {
      return needsChoice(db, {
        jobId,
        claimToken,
        editorialDate,
        visualSetId,
        reason: `budget:${primary.reason}`,
      });
    }
    let repairPatches: readonly string[] = [];
    let repairParentCandidateId: string | null = null;
    if (primary.kind === 'ready') {
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
        await updateDirection(db, {
          visualSetId,
          jobId,
          claimToken,
          direction,
          source: 'generated',
          imageRoute: withDailyVisualImageRouteWinner(imageRoute, 'primary'),
        });
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
      repairPatches = primaryQa.repairPatches;
      repairParentCandidateId = primary.candidate.id;
    }

    // The owner recovery budget deliberately has no repair slot. A failed
    // fresh primary (including a render that could not be cost-attested)
    // remains private beside the original fallback for an explicit editorial
    // choice; it can never make the fallback public.
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
      // A canary that never rendered still gets one bounded, frozen champion
      // route. It is the outage fallback as well as the semantic repair path.
      prompt: buildDailyVisualRepairPrompt(direction, repairPatches),
      parentCandidateId: repairParentCandidateId,
      route: imageRoute.repair,
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
    await updateDirection(db, {
      visualSetId,
      jobId,
      claimToken,
      direction,
      source: 'generated',
      imageRoute: withDailyVisualImageRouteWinner(imageRoute, 'repair'),
    });
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
