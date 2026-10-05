'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

function focusablePageTarget(): HTMLElement | null {
  const main = document.getElementById('main-content');
  if (!main) return null;
  const h1 = main.querySelector('h1');
  const target = (h1 ?? main) as HTMLElement;
  if (!target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
  }
  return target;
}

/** Moves focus into the next page after client navigations (AH-6.3). */
export function RouteFocusMain() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const target = focusablePageTarget();
    target?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
