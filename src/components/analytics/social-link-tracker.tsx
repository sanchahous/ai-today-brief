'use client';

import type { ReactNode } from 'react';
import { trackEvent } from '@/lib/analytics-client';
import { closestFromEventTarget } from '@/lib/dom/event-target';
import { socialProfileClickParams } from '@/lib/analytics-events';

/** Wraps a server-rendered social link and reports the click to GA4. */
export function SocialLinkTracker({
  network,
  placement,
  children,
}: {
  network: string;
  placement: string;
  children: ReactNode;
}) {
  return (
    <span
      style={{ display: 'contents' }}
      onClickCapture={(e) => {
        if (closestFromEventTarget(e.target, 'a[href]')) {
          trackEvent('social_profile_click', socialProfileClickParams(network, placement));
        }
      }}
    >
      {children}
    </span>
  );
}
