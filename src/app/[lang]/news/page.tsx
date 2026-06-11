import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getNewsPageData, searchNewsItems } from '@/lib/news';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { Byline } from '@/components/byline';
import { Reveal } from '@/components/reveal';
import { NewsFeed } from '@/components/news/news-feed';

type Params = { lang: string };
type Search = { q?: string; category?: string; page?: string };

export const revalidate = 1800;

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
  const path = `/${l}/news`;
  return {
    title: t.title,
    description: t.lead,
    alternates: {
      canonical: `${SITE_URL}${path}`,
      languages: {
        en: `${SITE_URL}/en/news`,
        uk: `${SITE_URL}/uk/news`,
        'x-default': `${SITE_URL}/en/news`,
      },
    },
    ...(q ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function NewsPage({
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
  const initialPage = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);

  const pageData = await getNewsPageData(lang);
  const items = query ? await searchNewsItems(lang, query) : pageData.items;

  const crumbs = [
    { label: t.breadcrumbHome, href: `/${lang}` },
    { label: t.title, href: `/${lang}/news` },
  ];

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: t.title,
        description: t.lead,
        url: `${SITE_URL}/${lang}/news`,
        inLanguage: lang,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
      {
        '@type': 'ItemList',
        numberOfItems: items.length,
        itemListElement: items.slice(0, 20).map((it, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: it.title,
          url: `${SITE_URL}${it.href}`,
        })),
      },
    ],
  };

  const updated = pageData.updatedAt ?? items[0]?.date ?? '2026-01-01';

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <Breadcrumbs items={crumbs} />

      <header className="mb-8 max-w-[720px]">
        <h1 className="mb-3 text-[clamp(1.8rem,4.5vw,2.7rem)]">{t.title}</h1>
        <p className="text-muted m-0 mb-4 text-base leading-relaxed">{t.lead}</p>
        <Byline lang={lang} updated={updated} />
      </header>

      <Reveal>
        <section
          aria-labelledby="summary-title"
          className="rounded-card border-border bg-surface mb-8 border border-l-[3px] border-l-accent p-5 sm:p-6"
        >
          <h2
            id="summary-title"
            className="text-accent m-0 mb-3 text-[0.74rem] font-bold tracking-[0.1em] uppercase"
          >
            {t.summaryTitle}
          </h2>
          {t.weekSummary.map((para, i) => (
            <p
              key={i}
              className={`text-muted text-[0.95rem] leading-relaxed ${i === 0 ? 'mb-3' : 'm-0'}`}
            >
              {para}
            </p>
          ))}
        </section>
      </Reveal>

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
