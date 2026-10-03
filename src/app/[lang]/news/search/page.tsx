import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getNewsPageData, searchNewsItems } from '@/lib/news';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { NewsFeed } from '@/components/news/news-feed';
import { NewsSearchForm } from '@/components/news/news-search-form';
import { NewsSearchIdle } from '@/components/news/news-search-idle';

type Params = { lang: string };
type Search = { q?: string; category?: string; page?: string };

/**
 * Search results for the news index.
 *
 * This is deliberately a route of its own rather than `?q=` on `/[lang]/news`.
 * Reading `searchParams` is what makes a route render per request, and on
 * `/[lang]/news` that cost the site its CDN cache: it was the only hub
 * answering `x-vercel-cache: MISS` on every hit, at ~350 KB a time, and the
 * largest consumer of the Fast Origin Transfer allowance (measured
 * 2026-08-24). Splitting the two lets the hub stay prerendered while the
 * search view keeps full server-side results.
 *
 * Staying dynamic is fine here: this view is `noindex`, so no crawler loops
 * through it, and human search traffic is a small fraction of hub traffic.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const { lang } = await params;
  const { q } = await searchParams;
  const l: Lang = isLang(lang) ? lang : 'en';
  const t = getStrings(l).news;
  const sp = t.searchPage;
  const query = (q ?? '').trim();
  const title = query
    ? `${sp.resultsFor} “${query}”`
    : `${sp.idleTitleLead} ${sp.idleTitleEm}`;
  return {
    title,
    description: t.lead,
    // Search result pages have never belonged in the index; `follow` keeps the
    // links through to the stories themselves alive.
    robots: { index: false, follow: true },
    alternates: { canonical: `${SITE_URL}/${l}/news` },
  };
}

export default async function NewsSearchPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const { q, category, page: pageParam } = await searchParams;
  const t = getStrings(lang).news;
  const sp = t.searchPage;

  const query = (q ?? '').trim();
  const categorySlug = (category ?? '').trim();
  const initialPage = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);

  const pageData = await getNewsPageData(lang);
  const items = query ? await searchNewsItems(lang, query) : [];
  const popularQueries = pageData.trending.slice(0, 6).map((topic) => topic.name);

  const crumbs = [
    { label: t.breadcrumbHome, href: `/${lang}` },
    { label: t.title, href: `/${lang}/news` },
    { label: sp.breadcrumb },
  ];

  return (
    <div
      className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10"
      data-testid="news-search-page"
    >
      <Breadcrumbs items={crumbs} />

      <header className="mb-8 max-w-[720px]">
        <p className="text-accent eyebrow mb-2">{sp.eyebrow}</p>
        <h1 className="text-text mb-6 font-serif text-[clamp(1.8rem,4.5vw,2.7rem)] leading-[1.12] font-semibold tracking-tight">
          {query ? (
            <>
              {sp.resultsFor}{' '}
              <em className="font-display italic font-normal text-inherit">&ldquo;{query}&rdquo;</em>
            </>
          ) : (
            <>
              {sp.idleTitleLead}{' '}
              <em className="font-display italic font-normal text-inherit">{sp.idleTitleEm}</em>
            </>
          )}
        </h1>
        <NewsSearchForm
          lang={lang}
          label={sp.breadcrumb}
          placeholder={sp.placeholder}
          button={getStrings(lang).search}
          initialQuery={query}
        />
      </header>

      {query ? (
        <NewsFeed
          lang={lang}
          items={items}
          categories={pageData.categories}
          trending={pageData.trending}
          initialQuery={query}
          initialCategory={categorySlug}
          initialPage={initialPage}
          feedContext="search"
        />
      ) : (
        <NewsSearchIdle
          lang={lang}
          eyebrow={sp.popularSearches}
          popularQueries={popularQueries}
        />
      )}
    </div>
  );
}
