export interface QueuedDailyVisualRecovery {
  status: string;
  retryMode: string | null;
  retryCount: number;
}

/**
 * A failed GitHub dispatch is operationally recoverable, not a new paid
 * retry. This exact persisted state may be dispatched again; every other
 * state must go through the owner-only database transition (or stay closed).
 */
export function isDispatchableQueuedDailyVisualRecovery(
  value: QueuedDailyVisualRecovery | null | undefined,
): boolean {
  return (
    value?.status === 'queued' && value.retryMode === 'direction_once' && value.retryCount === 1
  );
}
