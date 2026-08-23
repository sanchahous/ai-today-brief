'use client';

import { useEffect, useState } from 'react';
import type { WeeklyDigestItemView } from '@/lib/digests';
import type { Lang } from '@/lib/site';
import { WEEKLY_COPY } from './copy';

export function rankFromStoryHash(hash: string): number | null {
  const match = /^#story-(\d+)$/.exec(hash);
  if (!match) return null;
  const rank = Number(match[1]);
  return Number.isSafeInteger(rank) && rank > 0 ? rank : null;
}

export function WeeklyToc({ items, lang }: { items: WeeklyDigestItemView[]; lang: Lang }) {
  const copy = WEEKLY_COPY[lang];
  const [activeRank, setActiveRank] = useState<number | null>(null);

  useEffect(() => {
    const ranks = new Set(items.map((item) => item.rank));
    let frame: number | null = null;

    const syncFromHash = () => {
      const rank = rankFromStoryHash(window.location.hash);
      if (rank !== null && ranks.has(rank)) setActiveRank(rank);
    };
    const syncFromViewport = () => {
      const target = window.innerHeight * 0.28;
      const closest = items
        .map((item) => ({ item, element: document.getElementById(`story-${item.rank}`) }))
        .filter(
          (entry): entry is { item: WeeklyDigestItemView; element: HTMLElement } =>
            entry.element !== null,
        )
        .filter(({ element }) => element.getBoundingClientRect().bottom > 0)
        .sort(
          (a, b) =>
            Math.abs(a.element.getBoundingClientRect().top - target) -
            Math.abs(b.element.getBoundingClientRect().top - target),
        )[0];
      if (closest) setActiveRank(closest.item.rank);
    };
    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        syncFromViewport();
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top - window.innerHeight * 0.28) -
              Math.abs(b.boundingClientRect.top - window.innerHeight * 0.28),
          )[0];
        const rank = visible ? rankFromStoryHash(`#${visible.target.id}`) : null;
        if (rank !== null) setActiveRank(rank);
      },
      { rootMargin: '-18% 0px -58% 0px', threshold: [0, 0.01, 0.25] },
    );
    const sections = items
      .map((item) => document.getElementById(`story-${item.rank}`))
      .filter((section): section is HTMLElement => section !== null);
    sections.forEach((section) => observer.observe(section));

    syncFromHash();
    if (!window.location.hash) syncFromViewport();
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('scroll', onScroll);
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
                onClick={() => setActiveRank(item.rank)}
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
