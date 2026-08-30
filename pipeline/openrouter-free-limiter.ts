/**
 * Account-wide limiter for OpenRouter `:free` models.
 *
 * Free-tier traffic shares one 20 requests/minute budget across every model
 * with a `:free` suffix (docs, 2026-08-30). A live peak was ~7/min, so there
 * is headroom, but a weekly digest that fans out six channels can still burst
 * through it. When the window is full we skip the free slot and keep walking
 * the paid tail instead of 429-ing the whole chain.
 *
 * (source: wiki/research/2026-08-30-openrouter-routing-api.md §12 hazard 2)
 */

export const FREE_MODEL_RATE_LIMIT_PER_MINUTE = 20;

const WINDOW_MS = 60_000;
/** Leave two slots so a parallel critic/writer pair still has room. */
const RESERVE_SLOTS = 2;

const timestamps: number[] = [];

function prune(now: number): void {
  while (timestamps.length > 0 && now - timestamps[0]! >= WINDOW_MS) {
    timestamps.shift();
  }
}

export function resetFreeModelRateLimiter(nowTimestamps: readonly number[] = []): void {
  timestamps.length = 0;
  timestamps.push(...nowTimestamps);
}

export function freeModelCallsInWindow(now: number = Date.now()): number {
  prune(now);
  return timestamps.length;
}

export function canConsumeFreeModelSlot(now: number = Date.now()): boolean {
  prune(now);
  return timestamps.length < FREE_MODEL_RATE_LIMIT_PER_MINUTE - RESERVE_SLOTS;
}

/** Record a slot. Call immediately before the HTTP request, not after success. */
export function consumeFreeModelSlot(now: number = Date.now()): boolean {
  if (!canConsumeFreeModelSlot(now)) return false;
  timestamps.push(now);
  return true;
}
