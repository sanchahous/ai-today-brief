/**
 * Daily OpenRouter rerank: one catalog fetch, one audit row per role, and a
 * shared provider queue only when the editorial winner does not drop quality.
 * Pure — the job script does IO. See wiki/pipeline/weekly-illustration-plan.md F3.
 */

import type { OpenRouterModelRecord } from '../openrouter-models';
import { PROVIDER_ROLES, type ProviderRole } from './registry';
import {
  QUALITY_AXIS,
  ROLE_SCORED_CHAIN_CAP,
  rankModelsForRole,
  scoredModelsForRole,
  type ModelRoleScore,
  type QualityAxis,
} from './model-scoring';

/** Matches registry.ts's default OpenRouter HTTP id. */
export const OPENROUTER_PROVIDER_ID = 'openrouter';

/**
 * llm_provider_models is provider-scoped, not role-scoped. The daily job writes
 * the weekly.master_writer top-3 (highest editorial floor) as that shared queue.
 */
export const RANK_APPLY_ROLE: ProviderRole = 'weekly.master_writer';

/** Absolute intelligence points. Spec says "noticeably lower"; 5 is the floor. */
export const QUALITY_DROP_BLOCK = 5;

export type RankSkipReason = 'quality_drop' | 'no_candidate';

export interface RoleRankAudit {
  role: ProviderRole;
  modelId: string | null;
  score: number | null;
  pricePerM: number | null;
  qualityIndex: number | null;
  axis: QualityAxis;
  applied: boolean;
  skipReason: RankSkipReason | null;
  previousModelId: string | null;
  previousQualityIndex: number | null;
}

export interface CurrentApplyPick {
  modelId: string;
  qualityIndex: number | null;
}

export interface RerankPlan {
  audits: RoleRankAudit[];
  /** Top-3 for OpenRouter when `apply` is true; empty when the job must not switch. */
  openRouterModelIds: string[];
  apply: boolean;
}

export function qualityDropBlocked(
  currentQuality: number | null,
  nextQuality: number,
): boolean {
  if (currentQuality === null) return false;
  return nextQuality < currentQuality - QUALITY_DROP_BLOCK;
}

function previousFields(
  role: ProviderRole,
  currentApply: CurrentApplyPick | null,
): Pick<RoleRankAudit, 'previousModelId' | 'previousQualityIndex'> {
  if (role !== RANK_APPLY_ROLE) {
    return { previousModelId: null, previousQualityIndex: null };
  }
  return {
    previousModelId: currentApply?.modelId ?? null,
    previousQualityIndex: currentApply?.qualityIndex ?? null,
  };
}

function auditForRole(
  role: ProviderRole,
  pick: ModelRoleScore | null,
  currentApply: CurrentApplyPick | null,
): RoleRankAudit {
  const axis = QUALITY_AXIS[role];
  const previous = previousFields(role, currentApply);
  if (!pick) {
    return {
      role,
      modelId: null,
      score: null,
      pricePerM: null,
      qualityIndex: null,
      axis,
      applied: false,
      skipReason: 'no_candidate',
      ...previous,
    };
  }

  const scored: Omit<RoleRankAudit, 'applied' | 'skipReason'> = {
    role,
    modelId: pick.id,
    score: pick.score,
    pricePerM: pick.pricePerM,
    qualityIndex: pick.quality,
    axis,
    ...previous,
  };

  if (role !== RANK_APPLY_ROLE) {
    return { ...scored, applied: false, skipReason: null };
  }
  if (qualityDropBlocked(currentApply?.qualityIndex ?? null, pick.quality)) {
    return { ...scored, applied: false, skipReason: 'quality_drop' };
  }
  return { ...scored, applied: true, skipReason: null };
}

export function planOpenRouterRerank(input: {
  catalog: readonly OpenRouterModelRecord[];
  currentApply: CurrentApplyPick | null;
}): RerankPlan {
  const catalog = [...input.catalog];
  const audits = PROVIDER_ROLES.map((role) =>
    auditForRole(role, scoredModelsForRole(catalog, role)[0] ?? null, input.currentApply),
  );
  const writer = audits.find((row) => row.role === RANK_APPLY_ROLE);
  const apply = writer?.applied === true;
  return {
    audits,
    apply,
    openRouterModelIds: apply
      ? rankModelsForRole(catalog, RANK_APPLY_ROLE).slice(0, ROLE_SCORED_CHAIN_CAP)
      : [],
  };
}

/** First row per role when `rows` are newest-first. */
export function latestAuditsByRole<T extends { role: string }>(rows: readonly T[]): Map<string, T> {
  const latest = new Map<string, T>();
  for (const row of rows) {
    if (latest.has(row.role)) continue;
    latest.set(row.role, row);
  }
  return latest;
}
