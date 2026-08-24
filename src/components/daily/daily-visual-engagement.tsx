'use client';

import { useEffect } from 'react';
import { trackDailyVisualEngagement, type DailyVisualTarget } from '@/lib/analytics-client';
import {
  createDailyVisualEngagementAttributionRegistry,
  createDailyVisualExposureTracker,
  isDailySignupHref,
  isDailyStoryHref,
  isExternalHttpHref,
} from '@/lib/daily-visual-engagement';

const dailyVisualAttributions = createDailyVisualEngagementAttributionRegistry();

/**
 * A zero-layout client island for a daily cover. It first qualifies the public
 * cover, then joins aggregate daily outcomes to that visual without changing
 * the server-rendered, SEO-visible page.
 */
export function DailyVisualEngagement({
  targetId,
  visualSetId,
  candidateId,
  lang,
}: DailyVisualTarget & { targetId: string }) {
  useEffect(() => {
    const targetKey = `${visualSetId}:${candidateId}:${lang}`;
    const target: DailyVisualTarget = { visualSetId, candidateId, lang };
    const attribution = dailyVisualAttributions.attributionFor(
      targetKey,
      (eventType, entrySource) => {
        trackDailyVisualEngagement(eventType, target, entrySource);
      },
    );
    const cover = document.getElementById(targetId);
    const mainContent = document.getElementById('main-content');
    const onScroll = () => {
      const root = document.documentElement;
      const scrollable = root.scrollHeight - root.clientHeight;
      if (scrollable > 0 && root.scrollTop / scrollable >= 0.5) {
        attribution.recordOutcome('scroll_50');
      }
    };
    const onClick = (event: MouseEvent) => {
      const targetElement = event.target as HTMLElement | null;
      const anchor = targetElement?.closest<HTMLAnchorElement>('a[href]');
      if (anchor) {
        const base = window.location.href;
        if (isDailySignupHref(anchor.href, base, lang)) {
          attribution.recordOutcome('signup_click');
          return;
        }
        if (!mainContent?.contains(anchor)) return;
        if (isDailyStoryHref(anchor.href, base, lang)) {
          attribution.recordOutcome('story_open');
          return;
        }
        if (isExternalHttpHref(anchor.href, base)) {
          attribution.recordOutcome('outbound_click');
        }
        return;
      }

      const submitControl = targetElement?.closest('button[type="submit"], input[type="submit"]');
      const form = submitControl?.closest('form');
      if (form && mainContent?.contains(form) && form.querySelector('input[type="email"]')) {
        attribution.recordOutcome('signup_click');
      }
    };
    const onSubmit = (event: Event) => {
      const form = event.target;
      if (
        !(form instanceof HTMLFormElement) ||
        !mainContent?.contains(form) ||
        !form.querySelector('input[type="email"]')
      ) {
        return;
      }
      attribution.recordOutcome('signup_click');
    };

    let tracker: ReturnType<typeof createDailyVisualExposureTracker> | null = null;
    let observer: IntersectionObserver | null = null;
    const onVisibilityChange = () => {
      tracker?.setDocumentVisible(document.visibilityState === 'visible');
    };

    if (cover && typeof IntersectionObserver !== 'undefined') {
      tracker = createDailyVisualExposureTracker({
        isDocumentVisible: () => document.visibilityState === 'visible',
        onThreshold: (eventType, entrySource) => {
          attribution.recordVisualEvent(eventType, entrySource);
          if (eventType === 'visual_impression') onScroll();
        },
        sourceAtFirstExposure: () => (window.scrollY === 0 ? 'entry_hero' : 'scrolled'),
      });
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          tracker?.setAtLeastHalfVisible(Boolean(entry && entry.intersectionRatio >= 0.5));
        },
        { threshold: 0.5 },
      );
      observer.observe(cover);
      document.addEventListener('visibilitychange', onVisibilityChange);
      tracker.setDocumentVisible(document.visibilityState === 'visible');
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);

    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      tracker?.stop();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, [candidateId, lang, targetId, visualSetId]);

  return null;
}
