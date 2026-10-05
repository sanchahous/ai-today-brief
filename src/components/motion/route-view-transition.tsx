'use client';

import { ViewTransition } from 'react';

/**
 * Cross-fades route content inside `<main>` (AH-6.3).
 * Always wraps children so SSR and hydration share the same tree — a client-only
 * toggle would remount page content and detach nodes mid-E2E. Reduced motion is
 * handled in CSS (`::view-transition-*` → 0.001ms), not by omitting the wrapper (D13).
 */
export function RouteViewTransition({ children }: { children: React.ReactNode }) {
  return <ViewTransition default="route-crossfade">{children}</ViewTransition>;
}
