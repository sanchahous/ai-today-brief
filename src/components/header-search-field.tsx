'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { SearchPreviewDropdown } from '@/components/search-preview-dropdown';
import { SearchIcon } from '@/components/icons';
import type { Lang } from '@/lib/site';

/** Header search with live preview dropdown (prototype parity). */
export function HeaderSearchField({
  lang,
  placeholder,
  className = '',
  variant = 'desktop',
}: {
  lang: Lang;
  placeholder: string;
  className?: string;
  variant?: 'desktop' | 'mobile';
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

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

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/${lang}/news?q=${encodeURIComponent(trimmed)}` : `/${lang}/news`);
    setQuery('');
    setOpen(false);
  }

  function clearAfterNav() {
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 flex-1 ${className}`}>
      <form role="search" onSubmit={submit} className="flex min-w-0 items-center gap-2">
        <label className="sr-only" htmlFor={inputId}>
          {placeholder}
        </label>
        <span aria-hidden className="text-muted shrink-0">
          <SearchIcon size={18} />
        </span>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="border-border bg-surface text-text placeholder:text-faint w-full min-w-0 rounded-lg border px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </form>
      <SearchPreviewDropdown
        lang={lang}
        query={query}
        open={open}
        variant={variant === 'mobile' ? 'mobile' : 'desktop'}
        onNavigate={clearAfterNav}
      />
    </div>
  );
}
