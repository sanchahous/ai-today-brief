'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { trackSearch } from '@/lib/analytics-client';
import type { Lang } from '@/lib/site';

/** Idle state on `/[lang]/news/search` when `q` is empty — popular queries from real trending data. */
export function NewsSearchIdle({
  lang,
  eyebrow,
  popularQueries,
}: {
  lang: Lang;
  eyebrow: string;
  popularQueries: string[];
}) {
  const router = useRouter();

  function go(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    trackSearch(trimmed, 'popular', lang);
    router.push(`/${lang}/news/search?q=${encodeURIComponent(trimmed)}`);
  }

  if (popularQueries.length === 0) return null;

  return (
    <section
      className="search-idle mt-10"
      data-testid="news-search-idle"
      aria-live="polite"
    >
      <p className="text-accent eyebrow mb-3">{eyebrow}</p>
      <div className="flex flex-wrap gap-2">
        {popularQueries.map((query) => (
          <Button
            key={query}
            type="button"
            variant="outline"
            size="sm"
            className="!rounded-pill"
            onClick={() => go(query)}
          >
            {query}
          </Button>
        ))}
      </div>
    </section>
  );
}
