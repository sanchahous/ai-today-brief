import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL, SOCIALS, isLang, type Lang } from '@/lib/site';
import { socialMeta } from '@/lib/seo';
import { authorNode, PERSON_ID } from '@/lib/schema';
import { getHomeData } from '@/lib/home';
import { getLatestWeeklyDigest } from '@/lib/digests';
import { HomeHero } from '@/components/home/home-hero';
import { CategoryGrid } from '@/components/home/category-grid';
import { TopOfWeek } from '@/components/home/top-of-week';
import { WeeklyDigestBlock } from '@/components/home/weekly-digest';
import { TrendingTopics } from '@/components/home/trending-topics';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { FaqSection } from '@/components/home/faq-section';

// ISR: 1 h timed fallback. Freshness is driven on-demand — the publish flow
// calls revalidatePath('/', '/en', '/uk') (see api/telegram revalidateSite),
// so the timer only backstops a missed hook. Kept short (vs the 24 h used on
// content pages) because the home is just 2 pages and must never look stale.
export const revalidate = 3600;

type Params = { lang: string };

const HOME_DESCRIPTION = {
  en: 'Daily AI-engineering brief for developers, founders and tech leads. We read 120+ sources and publish only what matters — tool releases, agents, research and practical guides. In English and Ukrainian.',
  uk: 'Щоденний бриф з AI-інженерії для розробників, фаундерів і техлідів. Читаємо 120+ джерел і публікуємо лише те, що важливо — релізи інструментів, агенти, дослідження та практичні гайди. Англійською та українською.',
} as const;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  return {
    // absolute: the layout template would append "· SITE_NAME" to a title
    // that already starts with the brand → duplicated brand, truncated SERP.
    title: {
      absolute: `${SITE_NAME} — ${l === 'uk' ? 'AI-новини для розробників за 5 хвилин на день' : 'AI news for developers in 5 minutes a day'}`,
    },
    description: HOME_DESCRIPTION[l],
    alternates: {
      canonical: `${SITE_URL}/${l}`,
      languages: {
        en: `${SITE_URL}/en`,
        uk: `${SITE_URL}/uk`,
        'x-default': `${SITE_URL}/en`,
      },
    },
    ...socialMeta({
      title: `${SITE_NAME} — ${l === 'uk' ? 'AI-новини для розробників за 5 хвилин на день' : 'AI news for developers in 5 minutes a day'}`,
      description: HOME_DESCRIPTION[l],
      path: `/${l}`,
      lang: l,
    }),
  };
}

export default async function Home({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;

  const [data, weeklyDigest] = await Promise.all([getHomeData(lang), getLatestWeeklyDigest(lang)]);

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#org`,
        name: SITE_NAME,
        url: `${SITE_URL}/${lang}`,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png`, width: 512, height: 512 },
        sameAs: SOCIALS.filter((s) => s.key !== 'rss').map((s) => s.url),
        founder: { '@id': PERSON_ID },
      },
      authorNode(lang),
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        description: HOME_DESCRIPTION[lang],
        url: `${SITE_URL}/${lang}`,
        inLanguage: ['en', 'uk'],
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/${lang}/news?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
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
    <div className="flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <HomeHero lang={lang} categoryCount={data.categoryCount} categories={data.categories} />
      <CategoryGrid lang={lang} categories={data.categories} />
      <TopOfWeek lang={lang} featured={data.featured} secondary={data.secondary} />
      <WeeklyDigestBlock lang={lang} digest={weeklyDigest} />
      <TrendingTopics lang={lang} topics={data.trending} />
      <NewsletterBand lang={lang} />
      <FaqSection lang={lang} />
    </div>
  );
}
