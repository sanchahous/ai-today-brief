/**
 * Daily OpenRouter rerank: one catalog fetch, one audit row per role, and a
 * shared provider queue only when the editorial winner does not drop quality.
 * Pure — the job script does IO. See wiki/pipeline/weekly-illustration-plan.md F3.
 */

import type { OpenRouterModelRecord } from '../openrouter-models';
import { PROVIDER_ROLES, type ProviderRole } from './registry';
import {
  QUALITY_AXIS,
  rankModelsForRole,
  scoredModelsForRole,
  type ModelRoleScore,
  type QualityAxis,
} from './model-scoring';

/** Matches registry.ts's default OpenRouter HTTP id. */
export const OPENROUTER_PROVIDER_ID = 'openrouter';

/**
 * llm_provider_models is provider-scoped, not role-scoped: every role that
 * falls through to `defaultChain` (no admin-configured `llm_role_chains` row)
 * shares this one queue. The daily job picks its *ordering* from
 * weekly.master_writer's ranking (highest editorial floor), but writes the
 * FULL `rankModelsForRole` result -- scored leaders plus the family-ranked
 * tail -- not just the top few ids. Truncating to only the top scored
 * entries here previously shrank every other role's fallback chain from the
 * full family-ranked catalog down to 3 ids chosen for an unrelated role's
 * price/quality tradeoff, which is exactly the kind of silent, shared-queue
 * degradation this job is supposed to guard against (R1.3 / F3).
 */
export const RANK_APPLY_ROLE: ProviderRole = 'weekly.master_writer';

/**
 * Owner kill-switch (`OPENROUTER_RERANK_APPLY=off`): the job still fetches the
 * catalog and writes audit rows either way, so the ranking stays visible in
 * `/admin/providers`, but never calls `replace_llm_provider_models`. Same
 * pattern as `WEEKLY_CONTENT_STUDIO_V2=off` / `WEEKLY_STORY_IMAGE_MODE` --
 * every automated write in this project gets a reversible off-switch that
 * does not require a deploy.
 */
export function rerankApplyEnabled(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() !== 'off';
}

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
  /**
   * Scored leaders (quality/$ for RANK_APPLY_ROLE) plus the full family-ranked
   * tail when `apply` is true -- NOT truncated, so every role that shares the
   * default OpenRouter queue keeps a resilient fallback chain, not just 3
   * ids. Empty when the job must not switch.
   */
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
    openRouterModelIds: apply ? rankModelsForRole(catalog, RANK_APPLY_ROLE) : [],
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
