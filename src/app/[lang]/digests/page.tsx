import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { HubViewTracker } from '@/components/analytics/hub-view-tracker';
import { DigestsArchivePanel } from '@/components/digests/digests-archive-panel';
import { DigestsNowPlaying } from '@/components/digests/digests-now-playing';
import { FormatCompareTable } from '@/components/digests/format-compare-table';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { getDigestsPageData } from '@/lib/digests-archive';
import { getStrings } from '@/lib/i18n';
import { socialMeta } from '@/lib/seo';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';

// 1 h timed fallback; tab URL state is client-only (I-2) — never read searchParams here.
export const revalidate = 3600;

const META = {
  en: {
    title: 'AI digests archive — daily briefs and weekly editions',
    description:
      'Every daily brief and weekly AI-engineering edition in one archive. Short dailies and weekly long reads with PDF and video when available.',
    hero: 'Daily context. Weekly perspective.',
    lede:
      'Two formats, one editorial standard: a short daily edit, and a weekly long play that connects the dots.',
    eyebrow: 'The editions',
  },
  uk: {
    title: 'Архів AI-дайджестів — щоденні брифи й тижневі випуски',
    description:
      'Усі щоденні брифи й тижневі випуски в одному архіві. Короткі daily й тижневі long read із PDF та відео, коли доступні.',
    hero: 'Контекст щодня. Перспектива щотижня.',
    lede:
      'Два формати, один редакційний стандарт: короткий щоденний випуск і тижневий long play, що поєднує крапки.',
    eyebrow: 'Випуски',
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Lang = isLang(lang) ? lang : 'en';
  const copy = META[locale];
  const path = `/${locale}/digests`;
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: `${SITE_URL}${path}`,
      languages: {
        en: `${SITE_URL}/en/digests`,
        uk: `${SITE_URL}/uk/digests`,
        'x-default': `${SITE_URL}/en/digests`,
      },
    },
    ...socialMeta({ title: copy.title, description: copy.description, path, lang: locale }),
  };
}

export default async function DigestsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const locale: Lang = lang;
  const copy = META[locale];
  const t = getStrings(locale);
  const data = await getDigestsPageData(locale);

  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${locale}` },
    { label: t.nav.digests },
  ];

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: t.nav.digests,
        description: copy.description,
        url: `${SITE_URL}/${locale}/digests`,
        inLanguage: locale,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
      {
        '@type': 'ItemList',
        numberOfItems: data.itemListEntries.length,
        itemListElement: data.itemListEntries.slice(0, 20).map((entry, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: entry.title,
          url: `${SITE_URL}${entry.href}`,
        })),
      },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <HubViewTracker hubType="digests" slug="digests" />
      <Breadcrumbs items={crumbs} />

      <header className="max-w-[920px]">
        <p className="text-accent eyebrow">{copy.eyebrow}</p>
        <h1 className="mt-3 font-serif text-[clamp(2rem,4.5vw,3.25rem)] leading-tight font-semibold">
          {copy.hero}
        </h1>
        <p className="text-muted mt-5 max-w-2xl text-base leading-7">{copy.lede}</p>
        <DigestsNowPlaying
          lang={locale}
          daily={data.dailySpotlight}
          weekly={data.weeklySpotlight}
        />
      </header>

      <FormatCompareTable lang={locale} titleId="formats-title" />

      <DigestsArchivePanel
        lang={locale}
        counts={data.counts}
        calendarCaption={data.calendarCaption}
        weekdayHeaders={data.weekdayHeaders}
        calendarWeeks={data.calendarWeeks}
        initialTimeline={data.initialTimeline}
        initialMonthKey={data.initialMonthKey}
        hasMoreTimeline={data.hasMoreTimeline}
      />

      <div className="mt-16">
        <NewsletterBand lang={locale} placement="digests-archive" />
      </div>
    </div>
  );
}
