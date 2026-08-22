'use client';

import type { ReactNode } from 'react';
import { trackEvent } from '@/lib/analytics-client';
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
        if ((e.target as HTMLElement | null)?.closest('a[href]')) {
          trackEvent('social_profile_click', socialProfileClickParams(network, placement));
        }
      }}
    >
      {children}
    </span>
  );
}
