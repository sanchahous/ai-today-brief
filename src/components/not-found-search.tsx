'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useRef } from 'react';
import { SearchIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { trackSearch } from '@/lib/analytics-client';
import type { Lang } from '@/lib/site';

/** Inline search on the 404 page — navigates to `/[lang]/news/search?q=`. */
export function NotFoundSearch({
  lang,
  label,
  placeholder,
  button,
}: {
  lang: Lang;
  label: string;
  placeholder: string;
  button: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = inputRef.current?.value.trim() ?? '';
    trackSearch(q, '404', lang);
    router.push(q ? `/${lang}/news/search?q=${encodeURIComponent(q)}` : `/${lang}/news`);
  }

  return (
    <form className="not-found-search" role="search" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="nf-q">{label}</label>
      <span aria-hidden className="text-muted shrink-0">
        <SearchIcon size={20} />
      </span>
      <input
        ref={inputRef}
        id="nf-q"
        name="q"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder={placeholder}
        className="text-text placeholder:text-faint min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
      />
      <Button type="submit" variant="primary" className="!rounded-pill shrink-0">
        {button}
      </Button>
    </form>
  );
}
