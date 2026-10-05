import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getSubscribeSampleEdition } from '@/lib/subscribe-page';
import { SUBSCRIBE_FAQS } from '@/lib/marketing-content';
import { socialMeta } from '@/lib/seo';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { NewsletterForm } from '@/components/home/newsletter-form';
import { SubscribeBenefitsGrid } from '@/components/subscribe-benefits-grid';
import { SubscribeSampleList } from '@/components/subscribe-sample-list';
import { FaqAccordionItem } from '@/components/home/faq-accordion-item';

// 24 h: near-static landing; only the sample-items strip changes day to day.
export const revalidate = 86400;

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
    ...socialMeta({ title: p.title, description: p.lead, path: `/${l}/subscribe`, lang: l }),
  };
}

export default async function SubscribePage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);
  const p = t.subscribePage;
  const sampleEdition = await getSubscribeSampleEdition(lang);

  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${lang}` },
    { label: t.subscribe },
  ];

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: SUBSCRIBE_FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q[lang],
      acceptedAnswer: { '@type': 'Answer', text: f.a[lang] },
    })),
  };

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
      faqSchema,
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

        <div className="subscribe-layout mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-10 items-start pb-12">
          <section className="subscribe-main" aria-labelledby="sub-title">
            <p className="eyebrow text-accent">{p.eyebrow}</p>
            <h1
              id="sub-title"
              data-gesture="curtain"
              className="font-serif text-[clamp(2rem,4.5vw,3.1rem)] font-bold leading-tight mt-2 mb-4 text-text"
            >
              {p.title}
            </h1>
            <p
              data-gesture="reveal"
              data-gesture-delay="90"
              className="text-muted text-base sm:text-lg leading-relaxed max-w-xl mb-8"
            >
              {p.lead}
            </p>
            <div>
              <NewsletterForm lang={lang} variant="full" placement="subscribe-page" />
            </div>
          </section>

          <SubscribeSampleList
            kicker={p.sampleTitle}
            title={sampleEdition.title}
            items={sampleEdition.items}
            readHref={sampleEdition.href}
            readLabel={lang === 'uk' ? 'Читати на сайті' : 'Read it on the web'}
          />
        </div>

        <SubscribeBenefitsGrid lang={lang} title={p.whatTitle} />

        <section aria-labelledby="sub-faq-title" className="section faq mt-16 mx-auto w-full max-w-3xl">
          <h2
            id="sub-faq-title"
            data-gesture="settle"
            className="text-center font-serif text-[clamp(1.5rem,3.2vw,2rem)] font-bold text-text mb-8"
          >
            {p.faqTitle}
          </h2>
          <div className="grid gap-3">
            {SUBSCRIBE_FAQS.map((f, i) => (
              <FaqAccordionItem
                key={f.q.en}
                question={f.q[lang]}
                answer={f.a[lang]}
                questionIndex={i}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
