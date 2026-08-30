import { describe, expect, it } from 'vitest';
import {
  canConsumeFreeModelSlot,
  consumeFreeModelSlot,
  FREE_MODEL_RATE_LIMIT_PER_MINUTE,
  freeModelCallsInWindow,
  resetFreeModelRateLimiter,
} from './openrouter-free-limiter';

describe('free-model rate limiter', () => {
  it('accepts bursts below the reserved window and then refuses', () => {
    resetFreeModelRateLimiter();
    const start = 1_000_000;
    let allowed = 0;
    for (let i = 0; i < FREE_MODEL_RATE_LIMIT_PER_MINUTE; i++) {
      if (consumeFreeModelSlot(start + i)) allowed += 1;
    }
    expect(allowed).toBe(FREE_MODEL_RATE_LIMIT_PER_MINUTE - 2);
    expect(canConsumeFreeModelSlot(start + 50)).toBe(false);
    expect(freeModelCallsInWindow(start + 50)).toBe(allowed);
  });

  it('releases slots after the minute window', () => {
    resetFreeModelRateLimiter([1_000_000, 1_000_100]);
    expect(freeModelCallsInWindow(1_000_200)).toBe(2);
    expect(freeModelCallsInWindow(1_000_000 + 60_000)).toBe(1);
    expect(freeModelCallsInWindow(1_000_100 + 60_000)).toBe(0);
    expect(canConsumeFreeModelSlot(1_000_100 + 60_000)).toBe(true);
  });
});
