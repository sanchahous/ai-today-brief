'use client';

import { useEffect, useRef } from 'react';
import { fireDwellBeacon, simulateDwellTimer } from '@/hooks/use-engaged-dwell.testable';

/**
 * Fires the first-party `dwell` beacon once per page after 30 s of engaged
 * time (tab visible). The `/api/ev` contract already accepts `dwell`; nothing
 * sent it until now. GA4 receives the same milestone through trackItemEvent's
 * dual write.
 */
export function useEngagedDwell(target: { id?: string; slug?: string; lang?: string }): void {
  const targetRef = useRef(target);

  useEffect(() => {
    targetRef.current = target;
    return simulateDwellTimer(() => fireDwellBeacon(targetRef.current));
  });
}
