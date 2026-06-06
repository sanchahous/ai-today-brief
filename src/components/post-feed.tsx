'use client';

import { Fragment, useState } from 'react';
import type { HomeItem } from '@/lib/home';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { Reveal } from '@/components/reveal';
import { PostCard } from '@/components/post-card';
import { Pagination } from '@/components/pagination';
import { SponsorCard } from '@/components/home/sponsor-card';
import { NewsletterBand } from '@/components/home/newsletter-band';

const PAGE_SIZE = 6;

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

  if (items.length === 0) {
    return (
      <div className="rounded-card border-border border border-dashed px-4 py-14 text-center">
        <p className="font-serif mb-2 text-xl">{t.emptyTitle}</p>
        <p className="text-muted m-0">{t.emptyBody}</p>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
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
        <Pagination
          lang={lang}
          page={safePage}
          pageCount={pageCount}
          onChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </>
  );
}
