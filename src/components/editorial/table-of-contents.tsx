'use client';

import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/site';

export interface TocItem {
  id: string;
  title: string;
  level: number;
}

export function TableOfContents({ lang, items }: { lang: Lang; items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0% -35% 0%' }
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return null;

  return (
    <nav aria-label={lang === 'uk' ? 'Зміст' : 'Table of Contents'}>
      <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">
        {lang === 'uk' ? 'Зміст' : 'Contents'}
      </h4>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li
              key={item.id}
              className={`text-sm ${item.level === 3 ? 'ml-3' : ''}`}
            >
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={`block transition-colors hover:text-accent ${
                  isActive ? 'font-medium text-accent' : 'text-muted'
                }`}
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
