import { notFound } from 'next/navigation';
import { EDITOR_NAME, SITE_NAME, SITE_URL, isLang, type Lang } from '@/lib/site';
import { getHomeData } from '@/lib/home';
import { HomeHero } from '@/components/home/home-hero';
import { CategoryGrid } from '@/components/home/category-grid';
import { TopOfWeek } from '@/components/home/top-of-week';
import { TrendingTopics } from '@/components/home/trending-topics';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { VideoTeaser } from '@/components/home/video-teaser';
import { FaqSection } from '@/components/home/faq-section';

// ISR: refresh every 30 min. (On-publish revalidation gets wired in P4.)
export const revalidate = 1800;

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;

  const data = await getHomeData(lang);

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#org`,
        name: SITE_NAME,
        url: `${SITE_URL}/${lang}`,
        founder: { '@type': 'Person', name: EDITOR_NAME },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/${lang}`,
        inLanguage: ['en', 'uk'],
      },
      ...(data.featured
        ? [
            {
              '@type': 'ItemList',
              itemListElement: [data.featured, ...data.secondary].map((it, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: it.title,
                url: `${SITE_URL}${it.href}`,
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <main className="flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <HomeHero lang={lang} categoryCount={data.categoryCount} />
      <CategoryGrid lang={lang} categories={data.categories} />
      <TopOfWeek lang={lang} featured={data.featured} secondary={data.secondary} />
      <TrendingTopics lang={lang} topics={data.trending} />
      <NewsletterBand lang={lang} />
      <VideoTeaser lang={lang} />
      <FaqSection lang={lang} />
    </main>
  );
}
