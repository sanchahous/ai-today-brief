import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getCategoryHub, getCategoryPaths } from '@/lib/categories';
import { categoryMeta } from '@/lib/category-meta';
import { socialMeta } from '@/lib/seo';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { CategoryHeader } from '@/components/category-header';
import { PostFeed } from '@/components/post-feed';
import { HubViewTracker } from '@/components/analytics/hub-view-tracker';

// 24 h: category hubs reshuffle only when new items publish; a day-stale order
// is fine for SEO hubs and saves the bot-driven ISR writes a 1 h window cost.
export const revalidate = 86400;

type Params = { lang: string; slug: string };

export async function generateStaticParams() {
  return getCategoryPaths();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const hub = await getCategoryHub(slug, lang);
  if (!hub) return {};
  const path = `/${lang}/category/${slug}`;
  // DB description first; the curated tagline is a real sentence, unlike the
  // bare "Name — Brand" fallback.
  const description =
    hub.description ||
    `${categoryMeta(slug).tagline[lang]} — ${SITE_NAME}`;
  return {
    title: hub.name,
    description,
    alternates: {
      canonical: `${SITE_URL}${path}`,
      languages: {
        en: `${SITE_URL}/en/category/${slug}`,
        uk: `${SITE_URL}/uk/category/${slug}`,
        'x-default': `${SITE_URL}/en/category/${slug}`,
      },
    },
    ...socialMeta({ title: hub.name, description, path, lang }),
  };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { lang: raw, slug } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;

  const hub = await getCategoryHub(slug, lang);
  if (!hub) notFound();
  const t = getStrings(lang);

  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${lang}` },
    { label: t.nav.news, href: `/${lang}/news` },
    { label: hub.name },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: hub.name,
        description: hub.description || undefined,
        url: `${SITE_URL}/${lang}/category/${slug}`,
        inLanguage: lang,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: hub.items.length,
          itemListElement: hub.items.slice(0, 20).map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.title,
            url: `${SITE_URL}${it.href}`,
          })),
        },
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
    ],
  };

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10">
      <HubViewTracker hubType="category" slug={slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs items={crumbs} />
      <CategoryHeader lang={lang} hub={hub} />
      <PostFeed key={slug} lang={lang} items={hub.items} />
    </div>
  );
}
