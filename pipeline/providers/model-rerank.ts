/**
 * Daily OpenRouter rerank: one catalog fetch, one audit row per role, and a
 * shared provider queue only when the editorial winner does not drop quality.
 * Pure — the job script does IO. See wiki/pipeline/weekly-illustration-plan.md F3.
 */

import { openRouterModelAttemptCap, type OpenRouterModelRecord } from '../openrouter-models';
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

export type RankSkipReason = 'quality_drop' | 'no_candidate' | 'apply_disabled';

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
   * Scored leaders (quality/$ for RANK_APPLY_ROLE) followed by the family-ranked
   * tail, so every role sharing the default OpenRouter queue keeps a real
   * fallback chain rather than 3 ids picked for one unrelated role (F3).
   *
   * Truncated to `openRouterModelAttemptCap()` -- the same ceiling the live
   * path has always applied. Writing the *whole* ranking here looked like
   * "more resilience" but is the opposite: `generateWithOpenRouterChain` walks
   * the entire queue on failure, `llm_role_chains` is empty in production so
   * all 13 roles inherit this one queue, and the untruncated ranking is ~197
   * ids against a real catalog -- a 33x increase in worst-case attempts for a
   * pipeline that already lost ~20 minutes to a 12-model rotation.
   *
   * Empty when the job must not switch.
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
  applyEnabled: boolean,
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
  // The kill-switch must not fake history: with apply off nothing reaches
  // replace_llm_provider_models, so recording `applied: true` would make the
  // NEXT run read this row as the live baseline for the quality-drop guard and
  // compare against a model that was never in the queue -- corrupting the
  // guard in exactly the emergency the switch exists for.
  if (!applyEnabled) {
    return { ...scored, applied: false, skipReason: 'apply_disabled' };
  }
  return { ...scored, applied: true, skipReason: null };
}

export function planOpenRouterRerank(input: {
  catalog: readonly OpenRouterModelRecord[];
  currentApply: CurrentApplyPick | null;
  /** `OPENROUTER_RERANK_APPLY` resolved by the caller; defaults to enabled. */
  applyEnabled?: boolean;
  /** Overridable for tests; defaults to `OPENROUTER_MAX_MODEL_ATTEMPTS`. */
  queueCap?: number;
}): RerankPlan {
  const catalog = [...input.catalog];
  const applyEnabled = input.applyEnabled ?? true;
  const audits = PROVIDER_ROLES.map((role) =>
    auditForRole(
      role,
      scoredModelsForRole(catalog, role)[0] ?? null,
      input.currentApply,
      applyEnabled,
    ),
  );
  const writer = audits.find((row) => row.role === RANK_APPLY_ROLE);
  const apply = writer?.applied === true;
  const cap = input.queueCap ?? openRouterModelAttemptCap();
  return {
    audits,
    apply,
    openRouterModelIds: apply ? rankModelsForRole(catalog, RANK_APPLY_ROLE).slice(0, cap) : [],
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
