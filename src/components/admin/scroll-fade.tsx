'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Wraps a horizontally-scrollable row (e.g. the workspace tab bar) and adds
 * a soft edge fade wherever there is more content to swipe to. Mobile
 * browsers hide the scrollbar, so an `overflow-x-auto` row otherwise looks
 * like it simply ends at the screen edge instead of hinting it scrolls.
 */
export function ScrollFade({ children }: { children: React.ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflowLeft, setOverflowLeft] = useState(false);
  const [overflowRight, setOverflowRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      setOverflowLeft(el.scrollLeft > 2);
      setOverflowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      <div ref={scrollerRef} className="overflow-x-auto">
        {children}
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#0c1014] to-transparent transition-opacity ${
          overflowLeft ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#0c1014] to-transparent transition-opacity ${
          overflowRight ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
