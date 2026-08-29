import { describe, expect, it } from 'vitest';
import { artifactReviewGate } from './artifact-review-gate';

describe('artifactReviewGate', () => {
  it('allows review on the active working copy', () => {
    expect(
      artifactReviewGate({
        canReview: true,
        artifactRevisionId: 'rev-2',
        activeRevisionId: 'rev-2',
      }),
    ).toBe('ready');
  });

  it('explains a silent Approve hide when the artifact is on an older revision', () => {
    expect(
      artifactReviewGate({
        canReview: true,
        artifactRevisionId: 'rev-1',
        activeRevisionId: 'rev-2',
      }),
    ).toBe('stale_revision');
  });

  it('prefers the stale-revision reason even if the caller already AND-ed canReview', () => {
    expect(
      artifactReviewGate({
        canReview: false,
        artifactRevisionId: 'rev-1',
        activeRevisionId: 'rev-2',
      }),
    ).toBe('stale_revision');
  });

  it('keeps the owner-only copy when the artifact is current', () => {
    expect(
      artifactReviewGate({
        canReview: false,
        artifactRevisionId: 'rev-2',
        activeRevisionId: 'rev-2',
      }),
    ).toBe('not_owner');
  });
});
