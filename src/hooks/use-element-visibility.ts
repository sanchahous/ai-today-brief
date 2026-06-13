'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Reports whether `ref` is intersecting the viewport (minus a top rootMargin that
 * accounts for the sticky header). Unlike the codebase's reveal.tsx observer this
 * toggles CONTINUOUSLY both ways (never disconnects on first hit) so the header
 * search icon can morph in and out as the hero search scrolls past.
 *
 * rootMargin default '-72px' ≈ --header-h (60px, globals.css) + a small buffer.
 * Returns false when there is no element or no IntersectionObserver (SSR / old
 * engines) so the consumer never spuriously hides the persistent search affordance.
 */
export function useElementVisibility(
  ref: RefObject<Element | null>,
  opts?: { rootMargin?: string },
): boolean {
  const [visible, setVisible] = useState(false);
  const rootMargin = opts?.rootMargin ?? '-72px 0px 0px 0px';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(false);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.isIntersecting);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);

  return visible;
}
