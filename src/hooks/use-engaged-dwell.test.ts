import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DWELL_FIRE_MS, simulateDwellTimer } from './use-engaged-dwell.testable';

/**
 * The React hook is a thin useEffect wrapper; the timing/visibility state
 * machine lives in use-engaged-dwell.testable.ts and is exercised here with
 * fake timers and a stubbed visibility source (node test env — no document).
 */

describe('engaged dwell logic', () => {
  let visibilityHandler: (() => void) | null = null;
  let visibilityState: 'visible' | 'hidden' = 'visible';

  beforeEach(() => {
    vi.useFakeTimers();
    visibilityState = 'visible';
    visibilityHandler = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function start(fired: number[]) {
    return simulateDwellTimer((value) => fired.push(value), {
      visibility: () => visibilityState,
      onVisibilityChange: (handler) => {
        visibilityHandler = handler;
      },
    });
  }

  it('fires once after the dwell threshold', () => {
    const fired: number[] = [];
    const stop = start(fired);

    vi.advanceTimersByTime(DWELL_FIRE_MS - 1);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual([30]);

    stop();
  });

  it('does not fire twice', () => {
    const fired: number[] = [];
    const stop = start(fired);

    vi.advanceTimersByTime(DWELL_FIRE_MS);
    vi.advanceTimersByTime(DWELL_FIRE_MS);
    expect(fired).toEqual([30]);

    stop();
  });

  it('pauses while hidden and resumes when visible again', () => {
    const fired: number[] = [];
    const stop = start(fired);

    visibilityState = 'hidden';
    visibilityHandler?.();
    vi.advanceTimersByTime(DWELL_FIRE_MS * 3);
    expect(fired).toEqual([]);

    visibilityState = 'visible';
    visibilityHandler?.();
    vi.advanceTimersByTime(DWELL_FIRE_MS - 1);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual([30]);

    stop();
  });

  it('stop() cancels a pending fire', () => {
    const fired: number[] = [];
    const stop = start(fired);

    vi.advanceTimersByTime(DWELL_FIRE_MS - 1);
    stop();
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual([]);
  });
});
