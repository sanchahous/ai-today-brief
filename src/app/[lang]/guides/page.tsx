import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GUIDES } from '@/content/guides';
import { getStrings } from '@/lib/i18n';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { ArrowRight } from '@/components/icons';
import { HubViewTracker } from '@/components/analytics/hub-view-tracker';

export const revalidate = 86400;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  const t = getStrings(l);
  return {
    title: t.guidesTitle,
    description: t.guidesLede,
    alternates: {
      canonical: `${SITE_URL}/${l}/guides`,
      languages: {
        en: `${SITE_URL}/en/guides`,
        uk: `${SITE_URL}/uk/guides`,
        'x-default': `${SITE_URL}/en/guides`,
      },
    },
  };
}

export default async function GuidesPage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);

  const dateFmt = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t.guidesTitle,
    description: t.guidesLede,
    inLanguage: lang,
    url: `${SITE_URL}/${lang}/guides`,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  };

  return (
    <div className="mx-auto w-full max-w-[760px] flex-1 px-6 py-12">
      <HubViewTracker hubType="guides" slug="guides" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-3xl sm:text-4xl">{t.guidesTitle}</h1>
      <p className="text-muted mt-4 text-lg leading-relaxed">{t.guidesLede}</p>

      <ul className="m-0 mt-8 grid list-none gap-3 p-0">
        {GUIDES.map((guide) => (
          <li key={guide.slug}>
            <Link
              href={`/${lang}/guides/${guide.slug}`}
              className="rounded-card border-border bg-surface hover:border-accent block border p-5 no-underline transition"
            >
              <h2 className="m-0 text-[1.15rem] leading-snug">{guide.title[lang]}</h2>
              <p className="text-muted m-0 mt-2 text-[0.92rem] leading-relaxed">
                {guide.description[lang]}
              </p>
              <p className="text-faint m-0 mt-3 flex items-center gap-2 text-[0.78rem]">
                {t.lastVerifiedLabel}: {dateFmt.format(new Date(`${guide.lastVerified}T00:00:00`))}
                <ArrowRight size={14} aria-hidden />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
