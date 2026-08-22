'use client';

import type { ReactNode } from 'react';
import { trackEvent, trackItemEvent, type ItemTarget } from '@/lib/analytics-client';

/**
 * Client-side click beacons for server-rendered home surfaces. Each wrapper
 * renders its children unchanged and reports one event on capture-phase clicks,
 * so the surrounding markup stays a Server Component.
 */

export function WeeklyTopClickTracker({
  slot,
  rank,
  target,
  children,
}: {
  slot: 'featured' | 'secondary';
  rank?: number;
  target: ItemTarget;
  children: ReactNode;
}) {
  return (
    <ClickTracker
      onCapture={() => {
        trackItemEvent('post_expand', target);
        trackEvent('weekly_top_click', {
          slot,
          ...(rank === undefined ? {} : { rank }),
          slug: target.slug,
        });
      }}
    >
      {children}
    </ClickTracker>
  );
}

export function DigestCardClickTracker({
  method,
  digestSlug,
  children,
}: {
  method: 'read' | 'pdf' | 'cover';
  digestSlug: string;
  children: ReactNode;
}) {
  return (
    <ClickTracker
      onCapture={() => trackEvent('digest_card_click', { method, slug: digestSlug })}
    >
      {children}
    </ClickTracker>
  );
}

export function CategoryHubClickTracker({
  slug,
  lang,
  children,
}: {
  slug: string;
  lang: string;
  children: ReactNode;
}) {
  return (
    <ClickTracker
      onCapture={() => trackEvent('category_hub_click', { slug, lang })}
    >
      {children}
    </ClickTracker>
  );
}

export function HeroCtaClickTracker({
  target,
  children,
}: {
  target: 'news' | 'week';
  children: ReactNode;
}) {
  return (
    <ClickTracker onCapture={() => trackEvent('hero_cta_click', { target })}>
      {children}
    </ClickTracker>
  );
}

function ClickTracker({
  onCapture,
  children,
}: {
  onCapture: () => void;
  children: ReactNode;
}) {
  return (
    <span
      style={{ display: 'contents' }}
      onClickCapture={(e) => {
        if ((e.target as HTMLElement | null)?.closest('a[href]')) onCapture();
      }}
    >
      {children}
    </span>
  );
}
