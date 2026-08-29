export type ArtifactReviewGate = 'ready' | 'not_owner' | 'stale_revision';

/** Why ArtifactReview should hide Approve — stale revision must beat the generic owner copy. */
export function artifactReviewGate(input: {
  canReview: boolean;
  artifactRevisionId: string;
  activeRevisionId: string | null | undefined;
}): ArtifactReviewGate {
  if (input.activeRevisionId && input.artifactRevisionId !== input.activeRevisionId) {
    return 'stale_revision';
  }
  return input.canReview ? 'ready' : 'not_owner';
}
