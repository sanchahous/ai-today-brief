import type { Json } from '@/lib/database.types';
import { COVER_PROMPT_SLOT, storyPromptSlot } from './story-prompt-job';

export const WEEKLY_VISUAL_REFRESH_PROMPT_JOB_TYPES = ['cover', 'story_image'] as const;
export type WeeklyVisualRefreshPromptJobType =
  (typeof WEEKLY_VISUAL_REFRESH_PROMPT_JOB_TYPES)[number];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isWeeklyVisualRefreshRevision(value: {
  visual_refresh_source_revision_id?: string | null;
}): boolean {
  return Boolean(value.visual_refresh_source_revision_id?.trim());
}

/**
 * Carried artifacts represent the already-published bytes. Only explicitly
 * staged replacements need a new owner review and can later be copied into
 * the public revision by the visual-only promotion RPC.
 */
export function isWeeklyVisualRefreshStagedAsset(metadata: unknown): boolean {
  return record(metadata).visual_refresh_asset_staged === true;
}

/**
 * A newly created refresh must land on the required direction fields before an
 * owner can regenerate prompts. Keep the destination together with the refresh
 * contract so server actions cannot quietly send that first step to Visuals.
 */
export function weeklyVisualRefreshDirectionHref(input: {
  weeklyDigestId: string;
  revisionId: string;
}): string {
  const weeklyDigestId = input.weeklyDigestId.trim();
  const revisionId = input.revisionId.trim();
  if (!weeklyDigestId || !revisionId)
    throw new Error('Visual refresh destination requires both IDs.');
  return `/admin/weekly/${encodeURIComponent(weeklyDigestId)}?tab=article&visual_refresh_draft=${encodeURIComponent(revisionId)}#visual-refresh-direction-heading`;
}

/**
 * Requires both flags, rather than trusting an arbitrary `prompt_only` input.
 * The worker uses this as a final render fence for published visual refreshes.
 */
export function isWeeklyVisualRefreshPromptJob(input: unknown): boolean {
  const value = record(input);
  return value.visual_refresh === true && value.prompt_only === true;
}

export function isWeeklyVisualRefreshPromptJobType(
  value: string,
): value is WeeklyVisualRefreshPromptJobType {
  return (WEEKLY_VISUAL_REFRESH_PROMPT_JOB_TYPES as readonly string[]).includes(value);
}

/**
 * Mirrors the narrow SQL queue contract for tests and server callers. It has
 * no source URL, render configuration, asset location, or pixel parameters.
 */
export function visualRefreshPromptJobInput(input: {
  jobType: WeeklyVisualRefreshPromptJobType;
  revisionItemId?: string | null;
  /** Immutable refresh-revision hash used to fence a stale worker at save time. */
  revisionContentHash?: string | null;
  sourceRevisionId: string;
}): Record<string, Json> {
  const sourceRevisionId = input.sourceRevisionId.trim();
  if (!sourceRevisionId) throw new Error('Visual refresh source revision is required.');
  const revisionContentHash = input.revisionContentHash?.trim();
  if (input.jobType === 'cover') {
    if (input.revisionItemId) throw new Error('Cover prompts cannot target a story item.');
    return {
      prompt_only: true,
      visual_refresh: true,
      visual_refresh_source_revision_id: sourceRevisionId,
      locale: 'neutral',
      slot_key: COVER_PROMPT_SLOT,
      revision_item_id: null,
      ...(revisionContentHash ? { visual_refresh_revision_hash: revisionContentHash } : {}),
    };
  }
  const revisionItemId = input.revisionItemId?.trim();
  if (!revisionItemId) throw new Error('Story prompts require a revision item.');
  return {
    prompt_only: true,
    visual_refresh: true,
    visual_refresh_source_revision_id: sourceRevisionId,
    locale: 'neutral',
    slot_key: storyPromptSlot(revisionItemId),
    revision_item_id: revisionItemId,
    ...(revisionContentHash ? { visual_refresh_revision_hash: revisionContentHash } : {}),
  };
}
