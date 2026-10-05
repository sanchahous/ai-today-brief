'use client';

import { ViewTransition } from 'react';
import { useSyncExternalStore } from 'react';

function subscribeReducedMotion(onStoreChange: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

function readReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Skips route cross-fade when the reader prefers reduced motion (AH-6.3 / D13). */
export function RouteViewTransition({ children }: { children: React.ReactNode }) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => true,
  );

  if (reducedMotion) return children;

  return <ViewTransition default="route-crossfade">{children}</ViewTransition>;
}
