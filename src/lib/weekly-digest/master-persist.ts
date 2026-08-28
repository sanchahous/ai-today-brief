/**
 * How a finished editorial_master run becomes the version the admin edits.
 *
 * Until 2026-08-22 a non-converged run minted an *inactive* draft and left
 * the previous revision active. That was a second, hidden gate on top of
 * quality review: Article/Video tabs kept showing the old seed copy, and the
 * owner had to "Restore" the latest work. Restore is now only for going
 * *back*. New master output always activates.
 */

export const MASTER_REVISION_RPC = 'create_service_weekly_digest_revision' as const;
export const MASTER_VISUAL_DIRECTION_REVISION_RPC =
  'create_service_weekly_digest_revision_with_visual_direction' as const;

/** Satisfies revert_weekly_digest_revision's 10–500 character reason check. */
export const USE_LATEST_REVISION_REASON =
  'Switch to the latest generated version as the working copy.';

export type MasterPersistDecision = {
  reason: string;
  qualityPassed: boolean;
  needsOwnerReview: boolean;
  queuePostMasterJobs: boolean;
};

export function masterPersistDecision(input: {
  converged: boolean;
  score: number;
  unresolvedCount: number;
  /**
   * True only for coded `issues[].blocker === true`. Warnings
   * (`story_length`, `trust_attribution`, slightly over-long articles) and
   * below-floor critic dimensions must not hold visuals/social/PDF.
   */
  hasBlockingIssues?: boolean;
}): MasterPersistDecision {
  if (input.converged) {
    return {
      reason: 'weekly_content_studio_v2_master',
      qualityPassed: true,
      needsOwnerReview: false,
      queuePostMasterJobs: true,
    };
  }
  return {
    reason: `Needs review: ${input.score}/100, ${input.unresolvedCount} unresolved check(s)`,
    qualityPassed: false,
    needsOwnerReview: true,
    // Owner review is for Ship / optional polish. Downstream generation
    // proceeds unless a real blocking issue remains — warnings are not a
    // reason to stall socials.
    queuePostMasterJobs: input.hasBlockingIssues !== true,
  };
}

export type EditorialVersionRole = 'active' | 'latest-unused' | 'earlier';

export function editorialVersionRole(input: {
  revisionId: string;
  activeRevisionId: string | null;
  latestRevisionId: string | null;
}): EditorialVersionRole {
  if (input.revisionId === input.activeRevisionId) return 'active';
  if (input.revisionId === input.latestRevisionId) return 'latest-unused';
  return 'earlier';
}
