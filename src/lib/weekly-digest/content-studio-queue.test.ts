import { describe, expect, it } from 'vitest';
import { WEEKLY_CONTENT_STUDIO_VERSION } from './content-studio';
import {
  contentStudioMasterKey,
  contentStudioResearchKey,
  contentStudioResearchRetryNonce,
  contentStudioVideoManifestKey,
  isWeeklyGenerationInFlight,
  revisionItemIdFromJobInput,
  shouldEnqueueContentStudioMaster,
  shouldEnqueueContentStudioResearch,
} from './content-studio-queue';

const digestId = '11111111-1111-4111-8111-111111111111';
const revisionId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const nonce = '44444444-4444-4444-8444-444444444444';

describe('contentStudioResearchKey', () => {
  it('keeps the composer-stable key when no retry nonce is given', () => {
    expect(contentStudioResearchKey({ digestId, revisionId, itemId })).toBe(
      `${WEEKLY_CONTENT_STUDIO_VERSION}:${digestId}:${revisionId}:research:${itemId}`,
    );
  });

  it('appends a unique retry suffix so a succeeded row is not reused', () => {
    const retried = contentStudioResearchKey({ digestId, revisionId, itemId, retryNonce: nonce });
    expect(retried).toContain(':retry:');
    expect(retried).not.toBe(contentStudioResearchKey({ digestId, revisionId, itemId }));
    expect(retried.length).toBeGreaterThanOrEqual(8);
    expect(retried.length).toBeLessThanOrEqual(250);
  });
});

describe('contentStudioMasterKey', () => {
  it('matches the stable master key used on first start', () => {
    expect(contentStudioMasterKey({ digestId, revisionId })).toBe(
      `${WEEKLY_CONTENT_STUDIO_VERSION}:${digestId}:${revisionId}:master`,
    );
  });
});

describe('contentStudioVideoManifestKey', () => {
  it('matches the post-master companion key so a missing waiting row can be repaired', () => {
    expect(contentStudioVideoManifestKey({ digestId, revisionId })).toBe(
      `${WEEKLY_CONTENT_STUDIO_VERSION}:${digestId}:${revisionId}:video-manifest:en`,
    );
  });
});

describe('revisionItemIdFromJobInput', () => {
  it('reads the research pack slot from job input', () => {
    expect(revisionItemIdFromJobInput({ revision_item_id: itemId, placement: 'feature' })).toBe(
      itemId,
    );
  });

  it('rejects missing or non-object input', () => {
    expect(revisionItemIdFromJobInput(null)).toBeNull();
    expect(revisionItemIdFromJobInput('item')).toBeNull();
    expect(revisionItemIdFromJobInput({ revision_item_id: 1 })).toBeNull();
    expect(revisionItemIdFromJobInput({ revision_item_id: '' })).toBeNull();
  });
});

describe('shouldEnqueueContentStudioResearch', () => {
  it('queues when no prior job exists', () => {
    expect(shouldEnqueueContentStudioResearch([])).toBe(true);
    expect(contentStudioResearchRetryNonce([], nonce)).toBeUndefined();
  });

  it('queues a unique key after succeeded or failed jobs', () => {
    expect(shouldEnqueueContentStudioResearch(['succeeded'])).toBe(true);
    expect(shouldEnqueueContentStudioResearch(['failed', 'cancelled'])).toBe(true);
    expect(contentStudioResearchRetryNonce(['succeeded'], nonce)).toBe(nonce);
  });

  it('skips while a live job already occupies the slot', () => {
    expect(shouldEnqueueContentStudioResearch(['queued'])).toBe(false);
    expect(shouldEnqueueContentStudioResearch(['succeeded', 'running'])).toBe(false);
    expect(isWeeklyGenerationInFlight('waiting')).toBe(true);
    expect(isWeeklyGenerationInFlight('succeeded')).toBe(false);
  });
});

describe('shouldEnqueueContentStudioMaster', () => {
  it('queues on first start and after a failed/cancelled-only history', () => {
    expect(shouldEnqueueContentStudioMaster([])).toBe(true);
    expect(shouldEnqueueContentStudioMaster(['failed'])).toBe(true);
    expect(shouldEnqueueContentStudioMaster(['cancelled', 'failed'])).toBe(true);
  });

  it('leaves a waiting master in place so it can pick up newly approved packs', () => {
    expect(shouldEnqueueContentStudioMaster(['waiting'])).toBe(false);
    expect(shouldEnqueueContentStudioMaster(['queued'])).toBe(false);
  });

  it('does not mint a second master after one already succeeded', () => {
    expect(shouldEnqueueContentStudioMaster(['succeeded'])).toBe(false);
    expect(shouldEnqueueContentStudioMaster(['failed', 'succeeded'])).toBe(false);
  });
});
