import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getConcepts } from '@/lib/concepts';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { ConceptsGrid } from '@/components/concepts-grid';
import { Reveal } from '@/components/reveal';

// 24 h: concepts are evergreen and change only via the backfill workflow.
export const revalidate = 86400;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  const t = getStrings(l);
  return {
    title: t.nav.concepts,
    description: t.conceptsLede,
    alternates: {
      canonical: `${SITE_URL}/${l}/concepts`,
      languages: {
        en: `${SITE_URL}/en/concepts`,
        uk: `${SITE_URL}/uk/concepts`,
        'x-default': `${SITE_URL}/en/concepts`,
      },
    },
  };
}

export default async function ConceptsIndex({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);
  const concepts = await getConcepts(lang);

  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${lang}` },
    { label: t.nav.concepts },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: t.nav.concepts,
        description: t.conceptsLede,
        url: `${SITE_URL}/${lang}/concepts`,
        inLanguage: lang,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
    ],
  };

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs items={crumbs} />

      <Reveal>
        <header className="max-w-[720px]">
          <h1 className="text-[clamp(1.8rem,4.5vw,2.7rem)]">{t.nav.concepts}</h1>
          <p className="text-muted mt-4 text-base leading-relaxed">{t.conceptsLede}</p>
        </header>
      </Reveal>

      {concepts.length === 0 ? (
        <p className="text-muted mt-10">{t.noResults}</p>
      ) : (
        <ConceptsGrid lang={lang} concepts={concepts} />
      )}
    </div>
  );
}
