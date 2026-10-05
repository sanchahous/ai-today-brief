'use client';

import { ViewTransition } from 'react';

/**
 * Cross-fades route content inside `<main>` (AH-6.3).
 * Always wraps children with a stable `default` so SSR/hydration and E2E never
 * remount page content when `prefers-reduced-motion` resolves. Reduced motion is
 * handled in CSS (`::view-transition-*` → `animation: none`) and `data-tension-motion`
 * (D13) — not by toggling this prop after paint.
 */
export function RouteViewTransition({ children }: { children: React.ReactNode }) {
  return <ViewTransition default="route-crossfade">{children}</ViewTransition>;
}
