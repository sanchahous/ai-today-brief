'use client';

import { useSyncExternalStore } from 'react';
import { ViewTransition } from 'react';

function subscribeReducedMotion(onStoreChange: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

function readReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Cross-fades route content inside `<main>` (AH-6.3).
 * Always wraps children so SSR and hydration share the same tree — omitting the
 * wrapper remounts page content and detaches nodes mid-E2E. Reduced motion uses
 * `default="none"` (no view-transition-name) plus CSS on `::view-transition-*` (D13).
 */
export function RouteViewTransition({ children }: { children: React.ReactNode }) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => false,
  );
  return (
    <ViewTransition default={reducedMotion ? 'none' : 'route-crossfade'}>
      {children}
    </ViewTransition>
  );
}
