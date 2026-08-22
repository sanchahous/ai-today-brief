import { describe, expect, it } from 'vitest';
import {
  editorialVersionRole,
  MASTER_REVISION_RPC,
  masterPersistDecision,
  USE_LATEST_REVISION_REASON,
} from './master-persist';

describe('masterPersistDecision', () => {
  it('activates a converged run and queues the rest of the studio', () => {
    expect(masterPersistDecision({ converged: true, score: 92, unresolvedCount: 0 })).toEqual({
      reason: 'weekly_content_studio_v2_master',
      qualityPassed: true,
      needsOwnerReview: false,
      queuePostMasterJobs: true,
    });
  });

  it('still activates a non-converged run so the latest copy is what the admin edits', () => {
    const decision = masterPersistDecision({ converged: false, score: 78, unresolvedCount: 1 });
    expect(decision.qualityPassed).toBe(false);
    expect(decision.needsOwnerReview).toBe(true);
    expect(decision.queuePostMasterJobs).toBe(false);
    expect(decision.reason).toBe('Needs review: 78/100, 1 unresolved check(s)');
    expect(MASTER_REVISION_RPC).toBe('create_service_weekly_digest_revision');
  });
});

describe('editorialVersionRole', () => {
  it('treats the working copy as active even when it is also the latest', () => {
    expect(
      editorialVersionRole({
        revisionId: 'r4',
        activeRevisionId: 'r4',
        latestRevisionId: 'r4',
      }),
    ).toBe('active');
  });

  it('flags the newest unused revision so the admin can switch without a restore reason', () => {
    expect(
      editorialVersionRole({
        revisionId: 'r4',
        activeRevisionId: 'r1',
        latestRevisionId: 'r4',
      }),
    ).toBe('latest-unused');
  });

  it('keeps earlier revisions as an explicit go-back path', () => {
    expect(
      editorialVersionRole({
        revisionId: 'r2',
        activeRevisionId: 'r1',
        latestRevisionId: 'r4',
      }),
    ).toBe('earlier');
  });
});

describe('USE_LATEST_REVISION_REASON', () => {
  it('meets the restore RPC length gate so one-click switch does not bounce', () => {
    expect(USE_LATEST_REVISION_REASON.length).toBeGreaterThanOrEqual(10);
    expect(USE_LATEST_REVISION_REASON.length).toBeLessThanOrEqual(500);
  });
});
