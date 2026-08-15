/**
 * Role-aware OpenRouter model scoring: quality per dollar from live catalog
 * prices and Artificial Analysis indexes. Discounts are already in `pricing`;
 * models below the role floor (e.g. a 14.2 index at $0.01/M) are not candidates.
 */

import { rankOpenRouterModelIds, type OpenRouterModelRecord } from '../openrouter-models';
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
 * Below this index the model is not a candidate, however cheap it is (F4 fix:
 * this used to be a `Partial` covering 3 of 13 roles, so the other 10 --
 * including `daily.auto_publish_judge` and `daily.verify` -- had NO floor and
 * "quality / price" alone will always pick the cheapest model above zero,
 * which is exactly the `ling-2.6-flash` (intelligence_index 14.2) trap the
 * plan warns about (F0). Every role now gets an explicit floor, tiered by
 * how much a bad pick costs: highest for the two editorial-text roles that
 * ship unreviewed prose, next for judge/critic roles that gate quality,
 * lowest for creative scene-brief roles where flair matters more than raw
 * intelligence but a near-zero-competence model is still not acceptable.
 */
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
};

export const ROLE_SCORED_CHAIN_CAP = 3;

export interface ModelRoleScore {
  id: string;
  score: number;
  quality: number;
  pricePerM: number;
  axis: QualityAxis;
}

function parsePerTokenPrice(raw: string | undefined): number | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function tokenMixForRole(role: ProviderRole): TokenMix {
  return TOKEN_MIX[role] ?? DEFAULT_TOKEN_MIX;
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

export function effectivePricePerM(model: OpenRouterModelRecord, role: ProviderRole): number | null {
  const prompt = parsePerTokenPrice(model.pricing?.prompt);
  const completion = parsePerTokenPrice(model.pricing?.completion);
  if (prompt === null || completion === null) return null;
  const mix = tokenMixForRole(role);
  const perToken = prompt * mix.prompt + completion * mix.completion;
  return perToken * 1_000_000;
}

export function scoreModelForRole(
  model: OpenRouterModelRecord,
  role: ProviderRole,
): ModelRoleScore | null {
  const axis = QUALITY_AXIS[role];
  const quality = qualityIndexForAxis(model, axis);
  if (quality === null) return null;
  const floor = QUALITY_FLOOR[role];
  if (floor !== undefined && quality < floor) return null;
  const pricePerM = effectivePricePerM(model, role);
  if (pricePerM === null || pricePerM <= 0) return null;
  return {
    id: model.id,
    score: quality / pricePerM,
    quality,
    pricePerM,
    axis,
  };
}

function compareScored(left: ModelRoleScore, right: ModelRoleScore): number {
  if (right.score !== left.score) return right.score - left.score;
  return left.id.localeCompare(right.id);
}

export function scoredModelsForRole(
  models: readonly OpenRouterModelRecord[],
  role: ProviderRole,
): ModelRoleScore[] {
  const scored: ModelRoleScore[] = [];
  for (const model of models) {
    const row = scoreModelForRole(model, role);
    if (!row) continue;
    scored.push(row);
  }
  return scored.sort(compareScored);
}

/**
 * Top-3 by quality-per-dollar, then the existing family ranking as a tail.
 * Unbenchmarked models never lead a role that has a quality floor.
 */
function isBelowQualityFloor(model: OpenRouterModelRecord, role: ProviderRole): boolean {
  const floor = QUALITY_FLOOR[role];
  if (floor === undefined) return false;
  const quality = qualityIndexForAxis(model, QUALITY_AXIS[role]);
  if (quality === null) return false;
  return quality < floor;
}

export function rankModelsForRole(
  models: OpenRouterModelRecord[],
  role: ProviderRole,
  familyRank: (catalog: OpenRouterModelRecord[]) => string[] = rankOpenRouterModelIds,
): string[] {
  const scored = scoredModelsForRole(models, role);
  const chain: string[] = [];
  const seen = new Set<string>();
  for (const row of scored) {
    if (chain.length >= ROLE_SCORED_CHAIN_CAP) break;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    chain.push(row.id);
  }
  const blocked = new Set<string>();
  for (const model of models) {
    if (isBelowQualityFloor(model, role)) blocked.add(model.id);
  }
  for (const id of familyRank(models)) {
    if (seen.has(id) || blocked.has(id)) continue;
    seen.add(id);
    chain.push(id);
  }
  return chain;
}
