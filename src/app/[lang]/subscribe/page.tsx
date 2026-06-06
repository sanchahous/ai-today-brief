import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getSubscribeSampleItems } from '@/lib/subscribe-page';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { FaqSection } from '@/components/home/faq-section';
import { SubscribeBenefitsGrid } from '@/components/subscribe-benefits-grid';
import { SubscribeSampleList } from '@/components/subscribe-sample-list';
import { Reveal } from '@/components/reveal';

export const revalidate = 3600;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  const p = getStrings(l).subscribePage;
  return {
    title: p.title,
    description: p.lead,
    alternates: {
      canonical: `${SITE_URL}/${l}/subscribe`,
      languages: {
        en: `${SITE_URL}/en/subscribe`,
        uk: `${SITE_URL}/uk/subscribe`,
        'x-default': `${SITE_URL}/en/subscribe`,
      },
    },
  };
}

export default async function SubscribePage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);
  const p = t.subscribePage;
  const sample = await getSubscribeSampleItems(lang);

  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${lang}` },
    { label: t.subscribe },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: p.title,
        description: p.lead,
        url: `${SITE_URL}/${lang}/subscribe`,
        inLanguage: lang,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE_URL}/${lang}/` },
      },
      breadcrumbJsonLd(crumbs, SITE_URL),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10 pb-4">
        <Breadcrumbs items={crumbs} />

        <section className="mx-auto max-w-[720px] text-center">
          <Reveal>
            <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">{p.eyebrow}</p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3.1rem)] leading-tight">{p.title}</h1>
            <p className="text-muted mx-auto mt-4 max-w-[560px] text-[clamp(1rem,2.2vw,1.15rem)] leading-relaxed">
              {p.lead}
            </p>
          </Reveal>
          <div className="mt-8 text-left">
            <NewsletterBand lang={lang} embedded showHeader={false} placement="subscribe-page" />
          </div>
        </section>

        <SubscribeBenefitsGrid lang={lang} title={p.whatTitle} />
        <SubscribeSampleList title={p.sampleTitle} lead={p.sampleLead} items={sample} />
      </div>

      <FaqSection lang={lang} />
    </>
  );
}
