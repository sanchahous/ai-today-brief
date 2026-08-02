'use client';

import { useEffect } from 'react';
import type { Lang } from '@/lib/site';
import {
  rememberWeeklyAttribution,
  weeklyDigestSessionKey,
} from '@/lib/weekly-digest/attribution-client';

type DigestEvent =
  'digest_view' | 'scroll_50' | 'story_open' | 'subscribe_click' | 'pdf_download' | 'video_play';

export function DigestEngagement({
  digestId,
  revisionId,
  locale,
}: {
  digestId: string;
  revisionId: string;
  locale: Lang;
}) {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const channel = params.get('utm_source') ?? params.get('channel');
    const hookAngle = params.get('hook_angle') ?? params.get('utm_content');
    const seen = new Set<string>();
    const emit = (eventType: DigestEvent, storyId?: string) => {
      const key = `${eventType}:${storyId ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      void fetch('/api/weekly/engagement', {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventType,
          digestId,
          revisionId,
          locale,
          channel,
          hookAngle,
          storyId,
          sessionKey: weeklyDigestSessionKey(),
          pathname: location.pathname,
          referrerHost: document.referrer ? new URL(document.referrer).hostname : null,
        }),
      });
    };

    emit('digest_view');
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - innerHeight;
      if (scrollable > 0 && scrollY / scrollable >= 0.5) emit('scroll_50');
    };
    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        '[data-digest-event]',
      );
      const eventType = target?.dataset.digestEvent as DigestEvent | undefined;
      if (eventType === 'subscribe_click') {
        rememberWeeklyAttribution({ digestId, revisionId, locale, channel, hookAngle });
      }
      if (eventType && EVENT_TYPES.has(eventType)) emit(eventType, target?.dataset.storyId);
    };
    const storyObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            emit('story_open', (entry.target as HTMLElement).dataset.storyId);
          }
        }
      },
      { threshold: 0.5 },
    );
    document
      .querySelectorAll<HTMLElement>('[data-weekly-story]')
      .forEach((node) => storyObserver.observe(node));
    addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick);
    onScroll();
    return () => {
      storyObserver.disconnect();
      removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick);
    };
  }, [digestId, locale, revisionId]);

  return null;
}

const EVENT_TYPES = new Set<DigestEvent>([
  'digest_view',
  'scroll_50',
  'story_open',
  'subscribe_click',
  'pdf_download',
  'video_play',
]);
