/**
 * `editorial_master`'s gate-failure path saves `content_quality_report`
 * against the revision that was active *when the job started*, then mints a
 * separate draft revision with the same editorial content (generation-worker.ts,
 * createMasterRevision). If the owner later restores that draft to active
 * (Overview > Editorial versions > Restore this version), the report stays
 * attached to the revision that just went inactive: `revert_weekly_digest_revision`
 * only flips `active_revision_id`, it never touches `weekly_digest_artifacts`.
 * The Research tab then shows "Master quality report is missing" even though
 * editorial_master already ran and scored this exact content — `revision_id`
 * is immutable on artifacts (guard_weekly_digest_artifact_write), so the fix
 * is to insert a fresh copy on the now-active revision via the same RPC the
 * worker itself uses, not to rewrite the orphaned row.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/database.types';

/** Structurally compatible with both the ssr session client and the admin client. */
type WeeklyDb = SupabaseClient<Database>;
type WeeklyArtifactRow = Database['public']['Tables']['weekly_digest_artifacts']['Row'];

export type QualityReportCarryOverResult =
  | { status: 'attached'; artifactId: string; sourceRevisionId: string }
  | { status: 'already_current' }
  | { status: 'nothing_to_carry' };

/** The one artifact type this orphaning failure mode currently applies to. */
const CARRYOVER_ARTIFACT_TYPE = 'content_quality_report';

/**
 * Finds the most recent orphaned `content_quality_report` for this digest —
 * one that is `is_current` but no longer attached to the active revision —
 * without writing anything. Used to decide whether the Research tab should
 * offer the "attach it here" recovery action at all.
 */
export async function findOrphanedQualityReport(
  db: WeeklyDb,
  weeklyDigestId: string,
  activeRevisionId: string,
): Promise<WeeklyArtifactRow | null> {
  const { data, error } = await db
    .from('weekly_digest_artifacts')
    .select('*')
    .eq('weekly_digest_id', weeklyDigestId)
    .eq('artifact_type', CARRYOVER_ARTIFACT_TYPE)
    .eq('is_current', true)
    .neq('revision_id', activeRevisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`[quality-report-carryover] lookup: ${error.message}`);
  return data;
}

/**
 * Copies the most recent orphaned quality report onto the digest's current
 * active revision, if one exists and the active revision doesn't already
 * have one. Safe to call speculatively (e.g. right after a restore) — a
 * no-op both when the active revision is already covered and when there is
 * nothing to carry over.
 */
export async function carryOverOrphanedQualityReport(
  db: WeeklyDb,
  weeklyDigestId: string,
): Promise<QualityReportCarryOverResult> {
  const { data: digest, error: digestError } = await db
    .from('weekly_digests')
    .select('active_revision_id')
    .eq('id', weeklyDigestId)
    .single();
  if (digestError || !digest) {
    throw new Error(`[quality-report-carryover] digest: ${digestError?.message ?? 'not found'}`);
  }
  if (!digest.active_revision_id) return { status: 'nothing_to_carry' };

  const { data: current, error: currentError } = await db
    .from('weekly_digest_artifacts')
    .select('id')
    .eq('revision_id', digest.active_revision_id)
    .eq('artifact_type', CARRYOVER_ARTIFACT_TYPE)
    .eq('is_current', true)
    .maybeSingle();
  if (currentError) throw new Error(`[quality-report-carryover] current: ${currentError.message}`);
  if (current) return { status: 'already_current' };

  const orphan = await findOrphanedQualityReport(db, weeklyDigestId, digest.active_revision_id);
  if (!orphan) return { status: 'nothing_to_carry' };

  const { data: newArtifactId, error: rpcError } = await db.rpc('save_weekly_digest_artifact', {
    p_weekly_digest_id: weeklyDigestId,
    p_revision_id: digest.active_revision_id,
    p_artifact_type: orphan.artifact_type,
    p_locale: orphan.locale,
    p_slot_key: orphan.slot_key,
    p_revision_item_id: orphan.revision_item_id,
    p_generation_status: 'ready',
    p_review_status: 'in_review',
    p_content: (orphan.content ?? {}) as Json,
    p_provider: orphan.provider,
    p_provider_id: orphan.provider_id,
    p_metadata: (orphan.metadata ?? {}) as Json,
  });
  if (rpcError || typeof newArtifactId !== 'string') {
    throw new Error(`[quality-report-carryover] save: ${rpcError?.message ?? 'no id returned'}`);
  }
  return { status: 'attached', artifactId: newArtifactId, sourceRevisionId: orphan.revision_id };
}
