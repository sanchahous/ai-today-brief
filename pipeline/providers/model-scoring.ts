/**
 * One OpenRouter ranker for every role: quality under a price ceiling, from
 * the live catalog, with family diversity and no name-based allowlist.
 *
 * Replaces rankSocialOpenRouterModels' family list / ~*-latest bonus and the
 * DEFAULT_MODEL_PRIORITY tail that used to follow the quality/$ head.
 *
 * @see wiki/research/2026-08-30-openrouter-routing-api.md §12
 */

import { logEvent } from '../log';
import {
  fetchOpenRouterModels,
  isEligibleOpenRouterModel,
  isFreeOpenRouterModel,
  isOpenRouterAliasId,
  modelHasPriceOverrides,
  openRouterModelFamily,
  openRouterModelSupportsJson,
  type OpenRouterModelRecord,
} from '../openrouter-models';
import type { ProviderRole } from './registry';

export const QUALITY_AXES = ['intelligence', 'coding', 'agentic'] as const;
export type QualityAxis = (typeof QUALITY_AXES)[number];

export const QUALITY_AXIS = {
  'daily.summarize': 'intelligence',
  'daily.verify': 'intelligence',
  'daily.auto_publish_judge': 'intelligence',
  'daily.card_image_scene': 'intelligence',
  'daily.cover_scene': 'intelligence',
  'daily.image_critic': 'intelligence',
  'weekly.master_writer': 'intelligence',
  'weekly.master_critic': 'intelligence',
  'weekly.card_image_scene': 'intelligence',
  'weekly.image_critic': 'intelligence',
  'social.writer': 'intelligence',
  'social.critic': 'intelligence',
  custom_research: 'agentic',
} as const satisfies Record<ProviderRole, QualityAxis>;

/**
 * OpenRouter `?category=` values that match how we actually use each role.
 * Combined with `?sort=<axis>-high-to-low` this is the candidate source;
 * our ceiling and floor still run client-side.
 */
export const ROLE_CATALOG_CATEGORY = {
  'daily.summarize': 'technology',
  'daily.verify': 'technology',
  'daily.auto_publish_judge': 'technology',
  'daily.card_image_scene': 'technology',
  'daily.cover_scene': 'technology',
  'daily.image_critic': 'technology',
  'weekly.master_writer': 'technology',
  'weekly.master_critic': 'technology',
  'weekly.card_image_scene': 'technology',
  'weekly.image_critic': 'technology',
  'social.writer': 'marketing',
  'social.critic': 'marketing',
  custom_research: 'academia',
} as const satisfies Record<ProviderRole, string>;

export const QUALITY_FLOOR = {
  'daily.summarize': 25,
  'daily.verify': 30,
  'daily.auto_publish_judge': 35,
  'daily.card_image_scene': 20,
  'daily.cover_scene': 20,
  'daily.image_critic': 30,
  'weekly.master_writer': 40,
  'weekly.master_critic': 40,
  'weekly.card_image_scene': 20,
  'weekly.image_critic': 30,
  'social.writer': 20,
  'social.critic': 30,
  custom_research: 20,
} as const satisfies Record<ProviderRole, number>;

export type TokenMix = { prompt: number; completion: number };

export const DEFAULT_TOKEN_MIX: TokenMix = { prompt: 0.5, completion: 0.5 };

export const TOKEN_MIX: Partial<Record<ProviderRole, TokenMix>> = {
  'weekly.master_writer': { prompt: 0.2, completion: 0.8 },
  'weekly.image_critic': { prompt: 0.8, completion: 0.2 },
  // Social is prompt-heavy (live ledger 2026-08-28: ~50k prompt vs ~1–6k completion).
  'social.writer': { prompt: 0.9, completion: 0.1 },
  'social.critic': { prompt: 0.9, completion: 0.1 },
};

/** Measured critic cache-hit share on 2026-08-28 (spend-leak audit). Not an assumption. */
export const DEFAULT_CACHE_HIT_RATE = 0.182;

/** Free models may sit this many AA points below the paid floor. */
export const DEFAULT_FREE_QUALITY_FLOOR_DELTA = 5;

/** Default blended USD/M ceiling — same number the owner set for social. */
export const DEFAULT_MAX_PRICE_PER_MILLION = 1.5;

export interface ModelRoleScore {
  id: string;
  /** quality / price for paid models; quality itself for free (never divide by zero). */
  score: number;
  quality: number;
  pricePerM: number;
  axis: QualityAxis;
  free: boolean;
}

export type RankModelsForRoleOptions = {
  maxPricePerMillion?: number;
  cacheHitRate?: number;
  freeQualityFloorDelta?: number;
  excludeIds?: readonly string[];
  excludeFamilies?: readonly string[];
  configuredIds?: readonly string[];
  requireJson?: boolean;
  familyDiversity?: boolean;
  /** Override the role's QUALITY_FLOOR (paid). Free models still subtract the delta. */
  qualityFloor?: number;
};

function parsePerTokenPrice(raw: string | undefined): number | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function tokenMixForRole(role: ProviderRole): TokenMix {
  return TOKEN_MIX[role] ?? DEFAULT_TOKEN_MIX;
}

export function catalogSortForRole(role: ProviderRole): string {
  return `${QUALITY_AXIS[role]}-high-to-low`;
}

export function qualityIndexForAxis(
  model: OpenRouterModelRecord,
  axis: QualityAxis,
): number | null {
  const aa = model.benchmarks?.artificial_analysis;
  if (!aa) return null;
  if (axis === 'intelligence') {
    const raw = aa.intelligence_index;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }
  if (axis === 'coding') {
    const raw = aa.coding_index;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }
  const raw = aa.agentic_index;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

export function resolveCacheHitRate(
  env: { OPENROUTER_CACHE_HIT_RATE?: string; [key: string]: string | undefined } = process.env,
): number {
  const parsed = Number(env.OPENROUTER_CACHE_HIT_RATE);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return DEFAULT_CACHE_HIT_RATE;
  return parsed;
}

export function resolveFreeQualityFloorDelta(
  env: {
    OPENROUTER_FREE_QUALITY_FLOOR_DELTA?: string;
    [key: string]: string | undefined;
  } = process.env,
): number {
  const parsed = Number(env.OPENROUTER_FREE_QUALITY_FLOOR_DELTA);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_FREE_QUALITY_FLOOR_DELTA;
  return parsed;
}

export function resolveMaxPricePerMillion(
  role: ProviderRole,
  env: {
    SOCIAL_LLM_MAX_PRICE_PER_MILLION?: string;
    OPENROUTER_MAX_PRICE_PER_MILLION?: string;
    [key: string]: string | undefined;
  } = process.env,
): number {
  if (role === 'social.writer' || role === 'social.critic') {
    const social = Number(env.SOCIAL_LLM_MAX_PRICE_PER_MILLION);
    if (Number.isFinite(social) && social > 0) return social;
    return DEFAULT_MAX_PRICE_PER_MILLION;
  }
  const parsed = Number(env.OPENROUTER_MAX_PRICE_PER_MILLION);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_MAX_PRICE_PER_MILLION;
}

export function effectivePricePerM(
  model: OpenRouterModelRecord,
  role: ProviderRole,
  cacheHitRate: number = resolveCacheHitRate(),
): number | null {
  const prompt = parsePerTokenPrice(model.pricing?.prompt);
  const completion = parsePerTokenPrice(model.pricing?.completion);
  const free = isFreeOpenRouterModel(model.id);
  if (prompt === null || completion === null) {
    if (free) return 0;
    return null;
  }
  const mix = tokenMixForRole(role);
  const cacheRead = parsePerTokenPrice(model.pricing?.input_cache_read);
  const hit =
    cacheRead !== null && cacheRead < prompt && cacheHitRate > 0
      ? cacheHitRate
      : 0;
  const effectivePrompt = prompt * (1 - hit) + (cacheRead ?? prompt) * hit;
  return (effectivePrompt * mix.prompt + completion * mix.completion) * 1_000_000;
}

function qualityFloorFor(role: ProviderRole, free: boolean, delta: number, override?: number): number {
  const paid = override ?? QUALITY_FLOOR[role];
  if (!free) return paid;
  return Math.max(0, paid - delta);
}

export function scoreModelForRole(
  model: OpenRouterModelRecord,
  role: ProviderRole,
  options: RankModelsForRoleOptions = {},
): ModelRoleScore | null {
  if (!isEligibleOpenRouterModel(model)) return null;
  if (options.requireJson !== false && !openRouterModelSupportsJson(model)) return null;
  const axis = QUALITY_AXIS[role];
  const quality = qualityIndexForAxis(model, axis);
  if (quality === null) return null;
  const free = isFreeOpenRouterModel(model.id);
  const delta = options.freeQualityFloorDelta ?? resolveFreeQualityFloorDelta();
  if (quality < qualityFloorFor(role, free, delta, options.qualityFloor)) return null;
  const pricePerM = effectivePricePerM(model, role, options.cacheHitRate ?? resolveCacheHitRate());
  if (pricePerM === null) return null;
  const ceiling = options.maxPricePerMillion ?? resolveMaxPricePerMillion(role);
  if (!free && pricePerM > ceiling) return null;
  return {
    id: model.id,
    score: free || pricePerM === 0 ? quality : quality / pricePerM,
    quality,
    pricePerM,
    axis,
    free,
  };
}

function compareByMerit(left: ModelRoleScore, right: ModelRoleScore): number {
  if (right.quality !== left.quality) return right.quality - left.quality;
  if (left.pricePerM !== right.pricePerM) return left.pricePerM - right.pricePerM;
  return left.id.localeCompare(right.id);
}

function blockedIdSet(ids: readonly string[] | undefined): Set<string> {
  return new Set((ids ?? []).map((id) => id.trim().toLowerCase()).filter(Boolean));
}

function blockedFamilySet(families: readonly string[] | undefined): Set<string> {
  return new Set((families ?? []).map((id) => id.trim().toLowerCase()).filter(Boolean));
}

export function warnPricingOverrides(models: readonly OpenRouterModelRecord[]): void {
  for (const model of models) {
    if (!modelHasPriceOverrides(model)) continue;
    logEvent('warn', 'openrouter', 'OpenRouter model publishes stepped pricing.overrides', {
      model: model.id,
    });
  }
}

export function scoredModelsForRole(
  models: readonly OpenRouterModelRecord[],
  role: ProviderRole,
  options: RankModelsForRoleOptions = {},
): ModelRoleScore[] {
  const configured = options.configuredIds?.filter(Boolean) ?? [];
  const configuredSet = configured.length > 0 ? new Set(configured) : null;
  const scored: ModelRoleScore[] = [];
  for (const model of models) {
    if (configuredSet && !configuredSet.has(model.id)) continue;
    const row = scoreModelForRole(model, role, options);
    if (!row) continue;
    scored.push(row);
  }
  return scored.sort(compareByMerit);
}

/**
 * Rank by quality under the price ceiling, one model per family.
 * Unbenchmarked models never enter: a concrete model has a score and a price.
 */
export function rankModelsForRole(
  models: OpenRouterModelRecord[],
  role: ProviderRole,
  options: RankModelsForRoleOptions = {},
): string[] {
  warnPricingOverrides(models);
  const scored = scoredModelsForRole(models, role, options);
  const excludedIds = blockedIdSet(options.excludeIds);
  const excludedFamilies = blockedFamilySet(options.excludeFamilies);
  const diversity = options.familyDiversity !== false;
  const queue: string[] = [];
  const seenFamilies = new Set<string>();
  for (const row of scored) {
    if (excludedIds.has(row.id.toLowerCase())) continue;
    const family = openRouterModelFamily(row.id);
    if (excludedFamilies.has(family)) continue;
    if (diversity) {
      if (seenFamilies.has(family)) continue;
      seenFamilies.add(family);
    }
    queue.push(row.id);
  }
  return queue;
}

function mergeCatalogs(
  focused: OpenRouterModelRecord[],
  rest: OpenRouterModelRecord[],
): OpenRouterModelRecord[] {
  const byId = new Map<string, OpenRouterModelRecord>();
  for (const model of focused) {
    if (isOpenRouterAliasId(model.id)) continue;
    byId.set(model.id, model);
  }
  for (const model of rest) {
    if (isOpenRouterAliasId(model.id) || byId.has(model.id)) continue;
    byId.set(model.id, model);
  }
  return [...byId.values()];
}

/**
 * Candidate pool for a role: category+sort (the shortlist OpenRouter already
 * ranks for that use) union sort-only (so a family like z-ai is not hidden
 * just because it is outside the category's ~20).
 */
export async function fetchOpenRouterCatalogForRole(
  apiKey: string,
  role: ProviderRole,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 60_000,
): Promise<OpenRouterModelRecord[]> {
  const sort = catalogSortForRole(role);
  const category = ROLE_CATALOG_CATEGORY[role];
  const [focused, byQuality] = await Promise.all([
    fetchOpenRouterModels(apiKey, fetchFn, timeoutMs, { category, sort }),
    fetchOpenRouterModels(apiKey, fetchFn, timeoutMs, { sort }),
  ]);
  return mergeCatalogs(focused, byQuality);
}
