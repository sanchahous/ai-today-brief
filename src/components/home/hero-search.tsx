'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, SearchIcon } from '@/components/icons';
import { SearchPreviewDropdown } from '@/components/search-preview-dropdown';
import { useElementVisibility } from '@/hooks/use-element-visibility';
import { openSearch, setHeroVisible } from '@/lib/mobile-search-store';
import { trackSearch } from '@/lib/analytics-client';
import type { Lang } from '@/lib/site';

/** Popular queries — language-neutral product names, lightly localized. */
export const POPULAR: Record<Lang, string[]> = {
  en: ['Claude Code', 'MCP', 'prompt caching', 'agents', 'RAG', 'Cursor'],
  uk: ['Claude Code', 'MCP', 'prompt caching', 'агенти', 'RAG', 'Cursor'],
};

/**
 * Hero search with live preview dropdown; submit or "see all" opens /news/search?q=….
 */
export function HeroSearch({
  lang,
  placeholder,
  button,
  popularLabel,
}: {
  lang: Lang;
  placeholder: string;
  button: string;
  popularLabel: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const heroVisible = useElementVisibility(mobileTriggerRef);

  // Tell the header whether the hero search is on screen (drives the header search-icon
  // morph). Restore the icon (heroVisible=false) when this page unmounts.
  useEffect(() => {
    setHeroVisible(heroVisible);
  }, [heroVisible]);
  useEffect(() => () => setHeroVisible(false), []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function go(value: string, source: 'hero' | 'popular') {
    const trimmed = value.trim();
    trackSearch(trimmed, source, lang);
    router.push(trimmed ? `/${lang}/news/search?q=${encodeURIComponent(trimmed)}` : `/${lang}/news`);
    setQuery('');
    setOpen(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    go(query, 'hero');
  }

  return (
    <div ref={rootRef}>
      {/* Desktop: inline field with live dropdown (unchanged). */}
      <form role="search" onSubmit={submit} className="hidden max-w-xl gap-2 lg:flex">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="hero-search" className="sr-only">
            {placeholder}
          </label>
          <span className="text-muted pointer-events-none absolute top-1/2 left-4 flex -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            id="hero-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            aria-label={placeholder}
            autoComplete="off"
            className="bg-surface border-border text-text rounded-pill focus-visible:border-accent w-full border py-3 pr-4 pl-11 outline-none"
          />
          <SearchPreviewDropdown
            lang={lang}
            query={query}
            open={open}
            variant="hero"
            onNavigate={() => {
              setQuery('');
              setOpen(false);
            }}
          />
        </div>
        <button
          type="submit"
          className="rounded-pill bg-accent inline-flex shrink-0 items-center gap-2 px-5 py-3 text-sm font-semibold text-on-accent"
        >
          {button}
          <ArrowRight size={16} />
        </button>
      </form>

      {/* Mobile: full-width trigger that opens the fullscreen search modal. */}
      <button
        ref={mobileTriggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openSearch('hero', e.currentTarget);
        }}
        aria-haspopup="dialog"
        aria-label={placeholder}
        className="bg-surface border-border text-faint relative flex w-full touch-manipulation items-center rounded-pill border py-3 pr-4 pl-11 text-base lg:hidden"
      >
        <span className="text-muted pointer-events-none absolute top-1/2 left-4 flex -translate-y-1/2">
          <SearchIcon />
        </span>
        <span className="truncate">{placeholder}</span>
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-faint text-sm">{popularLabel}</span>
        {POPULAR[lang].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => go(q, 'popular')}
            className="border-border bg-surface text-muted rounded-pill hover:border-accent hover:text-text border px-3 py-1 text-sm transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
