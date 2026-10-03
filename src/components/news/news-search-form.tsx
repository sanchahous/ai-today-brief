'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { SearchIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { trackSearch } from '@/lib/analytics-client';
import type { Lang } from '@/lib/site';

function queryFromLocation(): string {
  if (typeof window === 'undefined') return '';
  return (new URLSearchParams(window.location.search).get('q') ?? '').trim();
}

/** Large search field on `/[lang]/news/search` — submits to the same route with `?q=`. */
export function NewsSearchForm({
  lang,
  label,
  placeholder,
  button,
  initialQuery = '',
}: {
  lang: Lang;
  label: string;
  placeholder: string;
  button: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const syncFromUrl = () => setValue(queryFromLocation());
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = value.trim();
    trackSearch(q, 'search-page', lang);
    router.push(q ? `/${lang}/news/search?q=${encodeURIComponent(q)}` : `/${lang}/news/search`);
  }

  return (
    <form
      className="news-search-form"
      role="search"
      data-testid="news-search-form"
      onSubmit={onSubmit}
    >
      <label className="sr-only" htmlFor="news-search-q">{label}</label>
      <span aria-hidden className="text-muted shrink-0">
        <SearchIcon size={20} />
      </span>
      <input
        id="news-search-q"
        name="q"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="text-text placeholder:text-faint min-h-[44px] min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
      />
      <Button type="submit" variant="primary" className="!rounded-pill shrink-0">
        {button}
      </Button>
    </form>
  );
}
