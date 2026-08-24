import { describe, expect, it } from 'vitest';
import { isDispatchableQueuedDailyVisualRecovery } from './retry-state';

describe('isDispatchableQueuedDailyVisualRecovery', () => {
  it('keeps a failed-dispatch recovery available without granting a second retry slot', () => {
    expect(
      isDispatchableQueuedDailyVisualRecovery({
        status: 'queued',
        retryMode: 'direction_once',
        retryCount: 1,
      }),
    ).toBe(true);
  });

  it.each([
    { status: 'needs_visual_choice', retryMode: null, retryCount: 0 },
    { status: 'running', retryMode: 'direction_once', retryCount: 1 },
    { status: 'queued', retryMode: null, retryCount: 1 },
    { status: 'queued', retryMode: 'direction_once', retryCount: 0 },
    { status: 'queued', retryMode: 'direction_once', retryCount: 2 },
  ])('does not dispatch an unqueued or non-one-shot state: %#', (state) => {
    expect(isDispatchableQueuedDailyVisualRecovery(state)).toBe(false);
  });
});
