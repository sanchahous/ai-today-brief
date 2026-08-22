'use client';

import { trackItemEvent } from '@/lib/analytics-client';

export const DWELL_SECONDS = 30;
export const DWELL_FIRE_MS = DWELL_SECONDS * 1000;

type Deps = {
  visibility?: () => DocumentVisibilityState;
  onVisibilityChange?: (handler: () => void) => void;
};

/**
 * Framework-free extraction of the engaged-dwell state machine so the timing
 * logic is unit-testable without a DOM effect harness. Returns a stop function
 * that clears the pending timer.
 */
export function simulateDwellTimer(
  fire: (value: number) => void,
  deps: Deps = {},
): () => void {
  const getVisibility =
    deps.visibility ??
    (() =>
      typeof document !== 'undefined'
        ? document.visibilityState
        : ('visible' as DocumentVisibilityState));
  const addVisibilityListener =
    deps.onVisibilityChange ??
    ((handler: () => void) => document.addEventListener('visibilitychange', handler));

  let timer: ReturnType<typeof setTimeout> | null = null;
  let fired = false;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const trigger = () => {
    if (fired) return;
    fired = true;
    clear();
    fire(DWELL_SECONDS);
  };

  const start = () => {
    if (fired || getVisibility() !== 'visible' || timer !== null) return;
    timer = setTimeout(trigger, DWELL_FIRE_MS);
  };

  const onVisibility = () => {
    if (getVisibility() === 'visible') start();
    else clear();
  };

  start();
  addVisibilityListener(onVisibility);

  return () => clear();
}

/** Convenience wrapper used by the React hook. */
export function fireDwellBeacon(target: { id?: string; slug?: string; lang?: string }): void {
  trackItemEvent('dwell', target, { value: DWELL_SECONDS });
}
