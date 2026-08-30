import 'server-only';

import type { Json } from '@/lib/database.types';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type GenerationCostScope = 'weekly' | 'daily' | 'social' | 'image';
export type GenerationCostKind = 'llm' | 'image';
export type GenerationCostSource = 'reported' | 'estimated' | 'subscription';

export interface RecordGenerationCostInput {
  scope: GenerationCostScope;
  kind: GenerationCostKind;
  provider: string;
  model: string;
  costUsd: number;
  costSource: GenerationCostSource;
  promptTokens?: number | null;
  outputTokens?: number | null;
  weeklyDigestId?: string | null;
  revisionId?: string | null;
  jobId?: string | null;
  attemptId?: string | null;
  artifactId?: string | null;
  stepKey?: string | null;
  metadata?: Record<string, unknown>;
}

export interface GenerationCostEvent {
  id: string;
  created_at: string;
  scope: string;
  kind: string;
  provider: string;
  model: string;
  cost_usd: number;
  cost_source: string;
  prompt_tokens: number | null;
  output_tokens: number | null;
  weekly_digest_id: string | null;
  revision_id: string | null;
  job_id: string | null;
  attempt_id: string | null;
  artifact_id: string | null;
  step_key: string | null;
  metadata: Json;
}

export interface GenerationCostTotals {
  totalUsd: number;
  byKind: Record<string, number>;
  byProvider: Record<string, number>;
  byScope: Record<string, number>;
  byModel: Record<string, number>;
  eventCount: number;
}

function safeCost(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Ledger buckets for illustration spend after 2026-08-15 (wiki G). */
export const ILLUSTRATION_BUDGET_BUCKETS = ['newsImages', 'weeklyImages', 'promptAndQa'] as const;
export type IllustrationBudgetBucket = (typeof ILLUSTRATION_BUDGET_BUCKETS)[number];

export interface IllustrationBudget {
  newsImagesUsd: number;
  weeklyImagesUsd: number;
  promptAndQaUsd: number;
}

function eventCostUsd(cost: number | string): number {
  return safeCost(typeof cost === 'string' ? Number(cost) : cost);
}

function isPromptAndQaStep(stepKey: string): boolean {
  return (
    stepKey === 'daily.cover_scene' ||
    stepKey === 'post_upload_qa' ||
    stepKey.includes('cover_scene') ||
    stepKey.includes('vision') ||
    stepKey.includes('story_image') ||
    stepKey.includes('card_image')
  );
}

/**
 * Classifies one ledger row. Master/social/video LLM is not illustration spend.
 * Policy caps are never consulted — only the event's recorded USD.
 */
export function illustrationBudgetBucket(event: {
  kind: string;
  scope: string;
  step_key?: string | null;
}): IllustrationBudgetBucket | null {
  if (event.kind === 'image') {
    if (event.scope === 'weekly') return 'weeklyImages';
    if (event.scope === 'daily' || event.scope === 'image') return 'newsImages';
    return null;
  }
  if (event.kind !== 'llm') return null;
  const step = event.step_key ?? '';
  if (event.scope === 'daily' && isPromptAndQaStep(step)) return 'promptAndQa';
  if (event.scope === 'weekly' && isPromptAndQaStep(step)) return 'promptAndQa';
  return null;
}

export function illustrationBudgetFromLedger(
  events: Array<{
    cost_usd: number | string;
    kind: string;
    scope: string;
    step_key?: string | null;
  }>,
): IllustrationBudget {
  const budget: IllustrationBudget = {
    newsImagesUsd: 0,
    weeklyImagesUsd: 0,
    promptAndQaUsd: 0,
  };
  for (const event of events) {
    const bucket = illustrationBudgetBucket(event);
    if (!bucket) continue;
    const cost = eventCostUsd(event.cost_usd);
    if (bucket === 'newsImages') budget.newsImagesUsd = safeCost(budget.newsImagesUsd + cost);
    else if (bucket === 'weeklyImages') {
      budget.weeklyImagesUsd = safeCost(budget.weeklyImagesUsd + cost);
    } else {
      budget.promptAndQaUsd = safeCost(budget.promptAndQaUsd + cost);
    }
  }
  return budget;
}

/**
 * Persist one generation spend row. Best-effort: logs a warning and does not
 * throw — generation must not fail because the ledger write failed.
 */
export async function recordGenerationCost(input: RecordGenerationCostInput): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from('generation_cost_events').insert({
    scope: input.scope,
    kind: input.kind,
    provider: input.provider.trim() || 'unknown',
    model: input.model.trim() || 'unknown',
    cost_usd: safeCost(input.costUsd),
    cost_source: input.costSource,
    prompt_tokens: input.promptTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    weekly_digest_id: input.weeklyDigestId ?? null,
    revision_id: input.revisionId ?? null,
    job_id: input.jobId ?? null,
    attempt_id: input.attemptId ?? null,
    artifact_id: input.artifactId ?? null,
    step_key: input.stepKey ?? null,
    metadata: (input.metadata ?? {}) as Json,
  });
  if (error) {
    console.error('[generation-costs] record failed', error.message);
  }
}

/**
 * Hard ceiling on metered generation spend in a rolling 24h window.
 *
 * The per-revision weekly cap (`WEEKLY_MASTER_MAX_SPEND_USD`) could not see
 * this class of failure: it counts only `weekly_digest_artifacts` metadata for
 * one revision, so social spend is invisible to it and every retry that opens
 * a new revision starts the count at zero. On 2026-08-28 that let 190
 * OpenRouter calls / $8.74 through against a $4 "cap".
 *
 * $1 is the owner's chosen ceiling (2026-08-30), deliberately tight. It is
 * below what several past weekly-digest days already booked -- 2026-08-11 was
 * $2.68 of metered spend and 2026-08-22 $1.53, and those are the understated
 * pre-fix numbers -- so a digest day is expected to trip it. That is the point:
 * the owner would rather a run stop and ask than discover the bill afterwards.
 * Raise DAILY_GENERATION_BUDGET_USD for a release day, or per environment.
 */
export const DEFAULT_DAILY_GENERATION_BUDGET_USD = 1;

export function resolveDailyGenerationBudgetUsd(
  env: Record<string, string | undefined> = process.env,
): number {
  const parsed = Number(env.DAILY_GENERATION_BUDGET_USD);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_GENERATION_BUDGET_USD;
}

export class GenerationBudgetExceededError extends Error {
  constructor(
    readonly spentUsd: number,
    readonly budgetUsd: number,
    readonly jobType: string,
  ) {
    super(
      `[generation-costs] Refusing ${jobType}: $${spentUsd.toFixed(2)} of metered generation spend in the last 24h is at or over the $${budgetUsd.toFixed(2)} ceiling. Raise DAILY_GENERATION_BUDGET_USD to continue.`,
    );
    this.name = 'GenerationBudgetExceededError';
  }
}

/**
 * Sum of real money spent in the window. `subscription` rows (Claude CLI and
 * friends) are excluded on purpose: they draw down a plan allowance, not a
 * metered balance, and counting them would starve the budget with $0 work.
 */
export function meteredSpendUsd(
  events: Array<{ cost_usd: number | string; cost_source: string }>,
): number {
  let total = 0;
  for (const event of events) {
    if (event.cost_source === 'subscription') continue;
    const cost = typeof event.cost_usd === 'string' ? Number(event.cost_usd) : event.cost_usd;
    total = safeCost(total + safeCost(cost));
  }
  return total;
}

/** Metered generation spend over the trailing `windowHours`. */
export async function recentMeteredSpendUsd(windowHours = 24, now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000).toISOString();
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('generation_cost_events')
    .select('cost_usd,cost_source')
    .gte('created_at', since);
  if (error) throw new Error(`[generation-costs] spend lookup failed: ${error.message}`);
  return meteredSpendUsd(data ?? []);
}

/**
 * Circuit breaker for anything that spends provider money. Throws before the
 * call is made, so a runaway costs one query rather than another $8 day.
 */
export async function assertDailyGenerationBudget(jobType: string): Promise<void> {
  const budget = resolveDailyGenerationBudgetUsd();
  const spent = await recentMeteredSpendUsd();
  if (spent >= budget) {
    throw new GenerationBudgetExceededError(spent, budget, jobType);
  }
}

export function aggregateGenerationCosts(
  events: Array<{
    cost_usd: number | string;
    kind: string;
    provider: string;
    scope: string;
    model: string;
  }>,
): GenerationCostTotals {
  const totals: GenerationCostTotals = {
    totalUsd: 0,
    byKind: {},
    byProvider: {},
    byScope: {},
    byModel: {},
    eventCount: events.length,
  };
  for (const event of events) {
    const cost = safeCost(
      typeof event.cost_usd === 'string' ? Number(event.cost_usd) : event.cost_usd,
    );
    totals.totalUsd = safeCost(totals.totalUsd + cost);
    totals.byKind[event.kind] = safeCost((totals.byKind[event.kind] ?? 0) + cost);
    totals.byProvider[event.provider] = safeCost((totals.byProvider[event.provider] ?? 0) + cost);
    totals.byScope[event.scope] = safeCost((totals.byScope[event.scope] ?? 0) + cost);
    totals.byModel[event.model] = safeCost((totals.byModel[event.model] ?? 0) + cost);
  }
  return totals;
}

export async function listGenerationCosts(opts: {
  since: string;
  until?: string;
  weeklyDigestId?: string;
  limit?: number;
}): Promise<GenerationCostEvent[]> {
  const db = getSupabaseAdmin();
  let query = db
    .from('generation_cost_events')
    .select(
      'id,created_at,scope,kind,provider,model,cost_usd,cost_source,prompt_tokens,output_tokens,weekly_digest_id,revision_id,job_id,attempt_id,artifact_id,step_key,metadata',
    )
    .gte('created_at', opts.since)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 500);
  if (opts.until) query = query.lt('created_at', opts.until);
  if (opts.weeklyDigestId) query = query.eq('weekly_digest_id', opts.weeklyDigestId);
  const { data, error } = await query;
  if (error) throw new Error(`[generation-costs] list failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    cost_usd: typeof row.cost_usd === 'string' ? Number(row.cost_usd) : Number(row.cost_usd),
  }));
}
