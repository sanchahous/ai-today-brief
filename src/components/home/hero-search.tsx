'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, SearchIcon } from '@/components/icons';
import type { Lang } from '@/lib/site';

/** Popular queries — language-neutral product names, lightly localized. */
const POPULAR: Record<Lang, string[]> = {
  en: ['Claude Code', 'MCP', 'prompt caching', 'agents', 'RAG', 'Cursor'],
  uk: ['Claude Code', 'MCP', 'prompt caching', 'агенти', 'RAG', 'Cursor'],
};

/**
 * Hero search — the only interactive island in the hero. Submitting (or tapping
 * a popular query) routes to /news?q=… where the real archive search lives.
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

  function go(value: string) {
    const trimmed = value.trim();
    router.push(trimmed ? `/${lang}/news?q=${encodeURIComponent(trimmed)}` : `/${lang}/news`);
  }

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(query);
        }}
        className="flex max-w-xl gap-2"
      >
        <div className="relative flex-1">
          <span className="text-muted pointer-events-none absolute top-1/2 left-4 flex -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="bg-surface border-border text-text rounded-pill focus-visible:border-accent w-full border py-3 pr-4 pl-11 outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-pill bg-accent inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-black"
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
