import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getNewsPageData } from '@/lib/news';
import { socialMeta } from '@/lib/seo';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { Byline } from '@/components/byline';
import { Reveal } from '@/components/reveal';
import { NewsFeed } from '@/components/news/news-feed';

type Params = { lang: string };

// 1 h timed fallback; the publish flow revalidates /en/news + /uk/news on-demand.
//
// Nothing here may read `searchParams`. It is a Next 16 runtime API: touching
// it renders the route per request, silently voids the `revalidate` above and
// makes Next emit `private, no-cache, no-store`, which the CDN cannot store.
// Measured on production 2026-08-24, that left /en/news (343 KB) and /uk/news
// (390 KB) the only `x-vercel-cache: MISS` routes on the site and the largest
// consumer of the Fast Origin Transfer allowance — every other hub was a HIT.
// A `Cache-Control` header rule does not rescue it: Next overrides that header
// for a dynamically rendered route (also verified on production).
//
// Search therefore lives on its own dynamic route, `/[lang]/news/search`.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  const t = getStrings(l).news;
  const path = `/${l}/news`;
  // One canonical for the whole surface. `?page=` was never a crawlable view:
  // `Pagination` renders buttons, not anchors, so nothing links to page 2.
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
    ...socialMeta({ title: t.title, description: t.lead, path, lang: l }),
  };
}

export default async function NewsPage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang).news;

  const pageData = await getNewsPageData(lang);
  const items = pageData.items;

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
      />
    </div>
  );
}
