'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, SearchIcon } from '@/components/icons';
import { SearchPreviewDropdown } from '@/components/search-preview-dropdown';
import type { Lang } from '@/lib/site';

/** Popular queries — language-neutral product names, lightly localized. */
const POPULAR: Record<Lang, string[]> = {
  en: ['Claude Code', 'MCP', 'prompt caching', 'agents', 'RAG', 'Cursor'],
  uk: ['Claude Code', 'MCP', 'prompt caching', 'агенти', 'RAG', 'Cursor'],
};

/**
 * Hero search with live preview dropdown; submit or "see all" opens /news?q=….
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

  function go(value: string) {
    const trimmed = value.trim();
    router.push(trimmed ? `/${lang}/news?q=${encodeURIComponent(trimmed)}` : `/${lang}/news`);
    setQuery('');
    setOpen(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    go(query);
  }

  return (
    <div ref={rootRef}>
      <form role="search" onSubmit={submit} className="flex max-w-xl gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="text-muted pointer-events-none absolute top-1/2 left-4 flex -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
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
          className="rounded-pill bg-accent inline-flex shrink-0 items-center gap-2 px-5 py-3 text-sm font-semibold text-black"
        >
          {button}
          <ArrowRight size={16} />
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-faint text-sm">{popularLabel}</span>
        {POPULAR[lang].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => go(q)}
            className="border-border bg-surface text-muted rounded-pill hover:border-accent hover:text-text border px-3 py-1 text-sm transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
