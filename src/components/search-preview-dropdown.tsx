'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { CategoryBadge } from '@/components/home/category-badge';
import { SearchPreviewSkeleton } from '@/components/ui/skeleton';
import { useSearchPreview, type SearchPreviewItem } from '@/hooks/use-search-preview';
import { trackEvent, trackSearch } from '@/lib/analytics-client';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

const PREVIEW_LIMIT = 5;

function panelClassFor(variant: 'desktop' | 'mobile' | 'hero'): string {
  const shell =
    'border-border bg-bg shadow-pop z-[80] overflow-y-auto rounded-xl border p-1.5';

  if (variant === 'mobile') {
    return `${shell} mt-2 max-h-[55vh] w-full`;
  }

  const anchoredDesktop = 'absolute top-[calc(100%+8px)] left-0 min-w-full';
  const anchoredHero = 'absolute top-[calc(100%+8px)] left-1/2 min-w-full -translate-x-1/2';

  if (variant === 'desktop') {
    return `${shell} ${anchoredDesktop} w-[min(calc(100vw-2.5rem),34rem)] max-h-[min(65vh,480px)] sm:w-[min(calc(100vw-3rem),38rem)] md:w-[min(calc(100vw-4rem),42rem)] lg:w-[min(44rem,calc(100vw-6rem))]`;
  }

  return `${shell} ${anchoredHero} w-[min(calc(100vw-2.5rem),36rem)] max-h-[min(70vh,520px)] sm:w-[min(calc(100vw-3rem),40rem)] md:w-[min(calc(100vw-4rem),44rem)] lg:w-[min(48rem,calc(100vw-10rem))]`;
}

function formatShort(iso: string, lang: Lang): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}

function PreviewRow({
  item,
  lang,
  query,
  position,
  onPick,
}: {
  item: SearchPreviewItem;
  lang: Lang;
  query: string;
  position: number;
  onPick: () => void;
}) {
  return (
    <Link
      href={item.href}
      role="option"
      onClick={() => {
        trackEvent('select_search_result', {
          query,
          position,
          post_id: item.id,
        });
        onPick();
      }}
      className="hover:bg-surface block w-full rounded-lg px-3 py-2.5 no-underline transition-colors duration-200 md:px-4 md:py-3"
    >
      <span className="mb-1 flex flex-wrap items-center gap-2">
        {item.categoryName ? (
          <CategoryBadge name={item.categoryName} color={item.categoryColor} />
        ) : null}
        <span className="text-faint text-[0.72rem]">
          {item.sourceName ?? '—'} · {formatShort(item.date, lang)}
        </span>
      </span>
      <span className="text-text line-clamp-2 text-[0.88rem] leading-snug md:text-[0.95rem] md:leading-normal">
        {item.title}
      </span>
    </Link>
  );
}

/** Live top-N results under the search field (prototype SearchPreview). */
export function SearchPreviewDropdown({
  lang,
  query,
  open,
  variant,
  onNavigate,
}: {
  lang: Lang;
  query: string;
  open: boolean;
  variant: 'desktop' | 'mobile' | 'hero';
  onNavigate: () => void;
}) {
  const t = getStrings(lang);
  const router = useRouter();
  const { rows, total, loading } = useSearchPreview(lang, query, PREVIEW_LIMIT);
  const trimmed = query.trim();
  const noResultsTracked = useRef('');

  useEffect(() => {
    if (!open || !trimmed || loading) return;
    if (rows.length > 0) {
      noResultsTracked.current = '';
      return;
    }
    if (noResultsTracked.current === trimmed) return;
    noResultsTracked.current = trimmed;
    trackEvent('search_no_results', { query: trimmed });
  }, [open, trimmed, loading, rows.length]);

  if (!open || !trimmed) return null;

  const panelClass = panelClassFor(variant);
  const seeAllSource = `${variant}_see_all`;

  function seeAll() {
    trackSearch(trimmed, seeAllSource, lang, total);
    router.push(`/${lang}/news?q=${encodeURIComponent(trimmed)}`);
    onNavigate();
  }

  return (
    <div role="listbox" aria-label={t.searchAria} className={panelClass}>
      {loading && rows.length === 0 ? (
        <SearchPreviewSkeleton />
      ) : null}
      {!loading && rows.length === 0 ? (
        <p className="text-muted m-0 px-3 py-3 text-sm">{t.searchNoResults}</p>
      ) : (
        rows.map((item, index) => (
          <PreviewRow
            key={item.id}
            item={item}
            lang={lang}
            query={trimmed}
            position={index + 1}
            onPick={onNavigate}
          />
        ))
      )}
      {total > PREVIEW_LIMIT ? (
        <button
          type="button"
          onClick={seeAll}
          className="text-accent bg-surface hover:bg-surface-2 mt-1 w-full rounded-lg border-0 px-4 py-3 text-left text-sm font-semibold md:text-[0.95rem]"
        >
          {t.searchSeeAll.replace('{n}', String(total))} →
        </button>
      ) : null}
      {!loading && rows.length > 0 && total <= PREVIEW_LIMIT && total > 0 ? (
        <button
          type="button"
          onClick={seeAll}
          className="text-muted hover:text-text mt-1 w-full rounded-lg border-0 bg-transparent px-4 py-2.5 text-left text-sm md:text-[0.95rem]"
        >
          {t.searchOpenArchive} →
        </button>
      ) : null}
    </div>
  );
}
