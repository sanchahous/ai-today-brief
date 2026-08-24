'use client';

import { useEffect, useRef, useState } from 'react';
import type { WeeklyDigestItemView } from '@/lib/digests';
import type { Lang } from '@/lib/site';
import { WEEKLY_COPY } from './copy';

const SCROLL_KEYS = new Set([' ', 'ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp']);

export function rankFromStoryHash(hash: string): number | null {
  const match = /^#story-(\d+)$/.exec(hash);
  if (!match) return null;
  const rank = Number(match[1]);
  return Number.isSafeInteger(rank) && rank > 0 ? rank : null;
}

export type WeeklyStoryViewport = {
  rank: number;
  top: number;
  bottom: number;
};

/**
 * Finds the story at the reader's orientation line, rather than trusting an
 * observer batch that may contain only the section which just entered or left.
 * This gives scroll and anchor navigation the same deterministic active item on
 * desktop and mobile viewports.
 */
export function activeRankFromStoryViewport(
  stories: WeeklyStoryViewport[],
  viewportHeight: number,
): number | null {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return null;
  const orientationLine = viewportHeight * 0.28;
  let latestPassedRank: number | null = null;
  let firstViewportRank: number | null = null;

  for (const story of stories) {
    if (!Number.isSafeInteger(story.rank) || story.rank <= 0) continue;
    if (story.top <= orientationLine) latestPassedRank = story.rank;
    if (firstViewportRank === null && story.top < viewportHeight && story.bottom > 0) {
      firstViewportRank = story.rank;
    }
  }

  return latestPassedRank ?? firstViewportRank;
}

/**
 * Keeps a clicked hash link selected while the document's global smooth scroll
 * is still travelling toward it. Once the target reaches the reader's line,
 * the normal viewport calculation resumes.
 */
export function shouldKeepAnchorActiveDuringSmoothScroll(
  story: WeeklyStoryViewport | null,
  viewportHeight: number,
): boolean {
  if (!story || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return false;
  return story.bottom <= 0 || story.top > viewportHeight * 0.28;
}

export function WeeklyToc({ items, lang }: { items: WeeklyDigestItemView[]; lang: Lang }) {
  const copy = WEEKLY_COPY[lang];
  const [activeRank, setActiveRank] = useState<number | null>(null);
  const pendingAnchorRank = useRef<number | null>(null);

  useEffect(() => {
    const ranks = new Set(items.map((item) => item.rank));
    let frame: number | null = null;

    const setRank = (rank: number | null) => {
      setActiveRank((current) => (current === rank ? current : rank));
    };

    const syncFromHash = (): boolean => {
      const rank = rankFromStoryHash(window.location.hash);
      if (rank === null || !ranks.has(rank)) {
        pendingAnchorRank.current = null;
        return false;
      }
      pendingAnchorRank.current = rank;
      setRank(rank);
      return true;
    };
    const syncFromViewport = () => {
      const pendingRank = pendingAnchorRank.current;
      if (pendingRank !== null) {
        const pendingElement = document.getElementById(`story-${pendingRank}`);
        if (pendingElement) {
          const { top, bottom } = pendingElement.getBoundingClientRect();
          if (
            shouldKeepAnchorActiveDuringSmoothScroll(
              { rank: pendingRank, top, bottom },
              window.innerHeight,
            )
          ) {
            setRank(pendingRank);
            return;
          }
        }
        pendingAnchorRank.current = null;
      }

      const stories: WeeklyStoryViewport[] = [];
      for (const item of items) {
        const element = document.getElementById(`story-${item.rank}`);
        if (!element) continue;
        const { top, bottom } = element.getBoundingClientRect();
        stories.push({ rank: item.rank, top, bottom });
      }
      setRank(activeRankFromStoryViewport(stories, window.innerHeight));
    };
    const scheduleViewportSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        syncFromViewport();
      });
    };
    const sections = items
      .map((item) => document.getElementById(`story-${item.rank}`))
      .filter((section): section is HTMLElement => section !== null);
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(scheduleViewportSync, { threshold: [0, 0.01, 0.25] });
    sections.forEach((section) => observer?.observe(section));

    const onHashChange = () => {
      syncFromHash();
      scheduleViewportSync();
    };
    const cancelPendingAnchor = () => {
      pendingAnchorRank.current = null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) cancelPendingAnchor();
    };

    if (!syncFromHash()) syncFromViewport();
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('scroll', scheduleViewportSync, { passive: true });
    window.addEventListener('resize', scheduleViewportSync);
    window.addEventListener('wheel', cancelPendingAnchor, { passive: true });
    window.addEventListener('touchstart', cancelPendingAnchor, { passive: true });
    window.addEventListener('pointerdown', cancelPendingAnchor, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      observer?.disconnect();
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('scroll', scheduleViewportSync);
      window.removeEventListener('resize', scheduleViewportSync);
      window.removeEventListener('wheel', cancelPendingAnchor);
      window.removeEventListener('touchstart', cancelPendingAnchor);
      window.removeEventListener('pointerdown', cancelPendingAnchor);
      window.removeEventListener('keydown', onKeyDown);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [items]);

  return (
    <nav aria-label={copy.contents}>
      <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">{copy.contents}</p>
      <ol className="mt-4 grid gap-3">
        {items.map((item) => {
          const active = activeRank === item.rank;
          return (
            <li key={item.id}>
              <a
                href={`#story-${item.rank}`}
                aria-current={active ? 'location' : undefined}
                data-active={active ? 'true' : undefined}
                onClick={() => {
                  pendingAnchorRank.current = item.rank;
                  setActiveRank(item.rank);
                }}
                className={`grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 text-sm leading-5 no-underline transition-colors ${
                  active ? 'text-accent font-semibold' : 'text-muted hover:text-accent'
                }`}
              >
                <span
                  className={`font-serif text-lg leading-5 ${
                    active ? 'text-accent' : 'text-faint'
                  }`}
                >
                  {item.rank}
                </span>
                <span>{item.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
