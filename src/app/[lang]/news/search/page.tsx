import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getNewsPageData, searchNewsItems } from '@/lib/news';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { NewsFeed } from '@/components/news/news-feed';

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
  const query = (q ?? '').trim();
  return {
    title: query ? `${t.title} — ${query}` : t.title,
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

  const query = (q ?? '').trim();
  const categorySlug = (category ?? '').trim();
  const initialPage = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);

  const pageData = await getNewsPageData(lang);
  // With no query this is just the feed, same as the hub — the empty case is
  // reachable by hand-editing the URL, not by any link on the site.
  const items = query ? await searchNewsItems(lang, query) : pageData.items;

  const crumbs = [
    { label: t.breadcrumbHome, href: `/${lang}` },
    { label: t.title, href: `/${lang}/news` },
  ];

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10">
      <Breadcrumbs items={crumbs} />

      <header className="mb-8 max-w-[720px]">
        <h1 className="mb-3 text-[clamp(1.8rem,4.5vw,2.7rem)]">{t.title}</h1>
        <p className="text-muted m-0 mb-4 text-base leading-relaxed">{t.lead}</p>
      </header>

      <NewsFeed
        lang={lang}
        items={items}
        categories={pageData.categories}
        trending={pageData.trending}
        initialQuery={query}
        initialCategory={categorySlug}
        initialPage={initialPage}
      />
    </div>
  );
}
