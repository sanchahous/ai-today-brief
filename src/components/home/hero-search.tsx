'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ArrowRight } from '@/components/icons';
import { SearchTrigger } from '@/components/search/search-trigger';
import { Button } from '@/components/ui/button';
import { useElementVisibility } from '@/hooks/use-element-visibility';
import { useSearchDialog } from '@/hooks/use-search-dialog';
import { trackSearch } from '@/lib/analytics-client';
import { setHeroVisible } from '@/lib/search-dialog-store';
import type { Lang } from '@/lib/site';

/**
 * Hero search entry: one trigger opens SearchDialog; popular chips navigate directly.
 */
export function HeroSearch({
  lang,
  placeholder,
  button,
  popularLabel,
  popularQueries,
}: {
  lang: Lang;
  placeholder: string;
  button: string;
  popularLabel: string;
  popularQueries: string[];
}) {
  const router = useRouter();
  const heroTriggerRef = useRef<HTMLDivElement>(null);
  const heroVisible = useElementVisibility(heroTriggerRef);
  const { openSearchDialog } = useSearchDialog();

  useEffect(() => {
    setHeroVisible(heroVisible);
  }, [heroVisible]);
  useEffect(() => () => setHeroVisible(false), []);

  function go(value: string, source: 'popular') {
    const trimmed = value.trim();
    trackSearch(trimmed, source, lang);
    router.push(trimmed ? `/${lang}/news/search?q=${encodeURIComponent(trimmed)}` : `/${lang}/news`);
  }

  return (
    <div>
      <div ref={heroTriggerRef} className="flex max-w-xl flex-col gap-2 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <SearchTrigger
            lang={lang}
            source="hero"
            variant="hero"
            placeholder={placeholder}
            testId="hero-search-trigger"
          />
        </div>
        <Button
          variant="primary"
          type="button"
          className="hidden !rounded-pill lg:inline-flex"
          rightIcon={<ArrowRight size={16} />}
          onClick={(e) => openSearchDialog('hero', e.currentTarget)}
        >
          {button}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-faint text-sm">{popularLabel}</span>
        {popularQueries.map((q) => (
          <Button
            variant="outline"
            size="sm"
            key={q}
            type="button"
            onClick={() => go(q, 'popular')}
            className="!rounded-pill"
          >
            {q}
          </Button>
        ))}
      </div>
    </div>
  );
}
