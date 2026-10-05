'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { HomeItem } from '@/lib/home';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { StoryCard } from '@/components/editorial/story-card';
import { AccessiblePagination } from '@/components/ui/pagination';
import { SponsorCard } from '@/components/home/sponsor-card';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchIcon } from '@/components/icons';
import { actionClassName } from '@/lib/ui/action-styles';
import { trackEvent } from '@/lib/analytics-client';

const PAGE_SIZE = 6;

function readPageFromUrl(): number {
  if (typeof window === 'undefined') return 1;
  const p = new URLSearchParams(window.location.search).get('page');
  const n = p ? parseInt(p, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Paginated StoryCard feed — shared by category (and later concept) hubs. */
export function PostFeed({
  lang,
  items,
  weaveSponsor = true,
  showNewsletter = true,
}: {
  lang: Lang;
  items: HomeItem[];
  weaveSponsor?: boolean;
  showNewsletter?: boolean;
}) {
  const rootStrings = getStrings(lang);
  const t = rootStrings.news;
  const [page, setPage] = useState(1);

  // Sync state with URL on mount (without breaking ISR SSR)
  useEffect(() => {
    const initialPage = readPageFromUrl();
    if (initialPage !== 1) {
      setPage(initialPage);
    }
  }, []);

  // Listen for browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setPage(readPageFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const target = Math.max(1, Math.min(nextPage, pageCount));
      setPage(target);
      trackEvent('paginate', { to_page: target, page_count: pageCount });
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (target === 1) {
          url.searchParams.delete('page');
        } else {
          url.searchParams.set('page', String(target));
        }
        const qs = url.searchParams.toString();
        const nextPath = qs ? `${url.pathname}?${qs}` : url.pathname;
        window.history.pushState(null, '', nextPath);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [pageCount],
  );

  if (items.length === 0) {
    return (
      <div className="space-y-8">
        <EmptyState
          icon={<SearchIcon size={24} />}
          title={t.emptyTitle}
          description={t.emptyBody}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/${lang}/news/search`}
                className={actionClassName({ variant: 'primary', size: 'md' })}
              >
                {rootStrings.searchModalTitle || 'Search'}
              </Link>
              <Link
                href={`/${lang}/news`}
                className={actionClassName({ variant: 'outline', size: 'md' })}
              >
                {rootStrings.searchOpenArchive || t.title || 'All news'}
              </Link>
            </div>
          }
        />
        {showNewsletter && <NewsletterBand lang={lang} embedded placement="category-hub" />}
      </div>
    );
  }

  const rows = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <div className="grid gap-4">
        {rows.map((item, i) => (
          <Fragment key={item.id}>
            <div data-gesture="index" data-gesture-delay={String(i * 45)}>
              <StoryCard lang={lang} item={item} />
            </div>
            {weaveSponsor && i === 2 && (
              <div data-gesture="settle" data-gesture-delay={String(i * 45 + 20)}>
                <SponsorCard lang={lang} placement="category-hub" />
              </div>
            )}
          </Fragment>
        ))}
        {showNewsletter && <NewsletterBand lang={lang} embedded placement="category-hub" />}
      </div>
      {pageCount > 1 && (
        <AccessiblePagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={handlePageChange}
          getPageHref={(p) => (p === 1 ? '?' : `?page=${p}`)}
          prevLabel={t.prev}
          nextLabel={t.next}
          ariaLabel={t.page}
        />
      )}
    </>
  );
}
