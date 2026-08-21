'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics-client';
import { hubViewParams, type HubType } from '@/lib/analytics-events';

/**
 * Mount inside a server-rendered hub page (concepts / categories / digests /
 * guides) to fire one `hub_view` per navigation. Renders nothing.
 */
export function HubViewTracker({ hubType, slug }: { hubType: HubType; slug: string }) {
  useEffect(() => {
    trackEvent('hub_view', hubViewParams(hubType, slug));
  }, [hubType, slug]);

  return null;
}
