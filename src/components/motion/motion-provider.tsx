'use client';

import { createMotionRuntime } from '@/lib/motion/runtime';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Mounts Tension v3 once per route; cancels WAAPI on navigation, pagehide and hidden tab. */
export function MotionProvider({ locale }: { locale: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const runtime = createMotionRuntime({ locale });
    runtime.mount();
    return () => runtime.unmount();
  }, [locale, pathname]);

  return null;
}
