'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import type { HomeItem } from '@/lib/home';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { Reveal } from '@/components/reveal';
import { PostCard } from '@/components/post-card';
import { AccessiblePagination } from '@/components/ui/pagination';
import { SponsorCard } from '@/components/home/sponsor-card';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { trackEvent } from '@/lib/analytics-client';

const PAGE_SIZE = 6;

function readPageFromUrl(): number {
  if (typeof window === 'undefined') return 1;
  const p = new URLSearchParams(window.location.search).get('page');
  const n = p ? parseInt(p, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Paginated PostCard feed — shared by category (and later concept) hubs. */
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
  const t = getStrings(lang).news;
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
      <div className="rounded-card border-border border border-dashed px-4 py-14 text-center">
        <p className="font-serif mb-2 text-xl">{t.emptyTitle}</p>
        <p className="text-muted m-0">{t.emptyBody}</p>
      </div>
    );
  }

  const rows = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <div className="grid gap-4">
        {rows.map((item, i) => (
          <Fragment key={item.id}>
            <Reveal delayMs={i * 45}>
              <PostCard lang={lang} item={item} />
            </Reveal>
            {weaveSponsor && i === 2 && (
              <Reveal delayMs={i * 45 + 20}>
                <SponsorCard lang={lang} placement="category-hub" />
              </Reveal>
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
