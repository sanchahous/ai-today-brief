'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { SearchPreviewDropdown } from '@/components/search-preview-dropdown';
import { SearchIcon } from '@/components/icons';
import { trackSearch } from '@/lib/analytics-client';
import type { Lang } from '@/lib/site';

/** Header search with live preview dropdown (prototype parity). */
export function HeaderSearchField({
  lang,
  placeholder,
  className = '',
  variant = 'desktop',
  expandOnFocus = false,
}: {
  lang: Lang;
  placeholder: string;
  className?: string;
  variant?: 'desktop' | 'mobile';
  /** Grow past the collapsed footprint on focus (absolutely positioned, so
   * it overlays neighboring content instead of reflowing it). Only makes
   * sense where the collapsed width is narrower than the expanded target —
   * the tight primary header, not the already-full-width mobile/404 fields. */
  expandOnFocus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
    const trimmed = (inputRef.current?.value ?? query).trim();
    trackSearch(trimmed, variant, lang);
    router.push(trimmed ? `/${lang}/news?q=${encodeURIComponent(trimmed)}` : `/${lang}/news`);
    setQuery('');
    setOpen(false);
  }

  function clearAfterNav() {
    setQuery('');
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`relative min-w-0 flex-1 ${expandOnFocus ? 'h-10' : ''} ${className}`}
    >
      {/* Unfocused, this is a normal in-flow box (identical footprint to
          before). With expandOnFocus, it also goes absolute and grows past
          that footprint on :focus-within — overlaying neighboring header
          content instead of reflowing it; the wrapper div above keeps
          reserving the collapsed space in the flex row either way. */}
      <form
        role="search"
        action={`/${lang}/news`}
        onSubmit={submit}
        className={`border-border bg-surface focus-within:border-accent flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 ${
          expandOnFocus
            ? 'absolute inset-y-0 left-0 z-10 w-full transition-[width,box-shadow] duration-300 ease-out focus-within:w-[20rem] focus-within:shadow-pop lg:focus-within:w-[26rem] xl:focus-within:w-[32rem]'
            : ''
        }`}
      >
        <label className="sr-only" htmlFor={inputId}>
          {placeholder}
        </label>
        <span aria-hidden className="text-muted shrink-0">
          <SearchIcon size={18} />
        </span>
        <input
          ref={inputRef}
          id={inputId}
          name="q"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="text-text placeholder:text-faint w-full min-w-0 border-0 bg-transparent text-sm outline-none"
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
