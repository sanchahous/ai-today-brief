'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { SearchIcon } from '@/components/icons';
import type { Lang } from '@/lib/site';

/** Compact header search — submits to /[lang]/news?q=… */
export function HeaderSearchField({
  lang,
  placeholder,
  className = '',
}: {
  lang: Lang;
  placeholder: string;
  className?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/${lang}/news?q=${encodeURIComponent(trimmed)}` : `/${lang}/news`);
  }

  return (
    <form role="search" onSubmit={submit} className={`flex min-w-0 flex-1 items-center gap-2 ${className}`}>
      <label className="sr-only" htmlFor="header-search">
        {placeholder}
      </label>
      <span aria-hidden className="text-muted shrink-0">
        <SearchIcon size={18} />
      </span>
      <input
        id="header-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="border-border bg-surface text-text placeholder:text-faint w-full min-w-0 rounded-lg border px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </form>
  );
}
