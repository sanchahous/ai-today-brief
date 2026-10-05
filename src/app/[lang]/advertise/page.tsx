import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, ADVERTISE_EMAIL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { AD_INVENTORY } from '@/lib/marketing-content';
import { AdvertiseInquiryCta } from '@/components/advertise-inquiry-cta';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { Reveal } from '@/components/reveal';
import { socialMeta } from '@/lib/seo';

export const revalidate = 86400;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  const p = getStrings(l).advertisePage;
  return {
    title: p.title,
    description: p.lead,
    alternates: {
      canonical: `${SITE_URL}/${l}/advertise`,
      languages: {
        en: `${SITE_URL}/en/advertise`,
        uk: `${SITE_URL}/uk/advertise`,
        'x-default': `${SITE_URL}/en/advertise`,
      },
    },
    ...socialMeta({ title: p.title, description: p.lead, path: `/${l}/advertise`, lang: l }),
  };
}

export default async function AdvertisePage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);
  const p = t.advertisePage;

  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${lang}` },
    { label: p.breadcrumb },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: p.title,
        description: p.lead,
        url: `${SITE_URL}/${lang}/advertise`,
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
      <div className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10 pb-16">
        <Breadcrumbs items={crumbs} />

        <Reveal>
          <header className="page-intro max-w-2xl mt-4 mb-10">
            <p className="eyebrow text-accent">{p.eyebrow}</p>
            <h1 className="font-serif text-[clamp(2rem,4.5vw,3rem)] font-bold leading-tight mt-2 mb-4 text-text">
              {p.title}
            </h1>
            <p className="text-muted text-base sm:text-lg leading-relaxed">{p.lead}</p>
          </header>
        </Reveal>

        <section className="section ad-grid my-10 grid grid-cols-1 lg:grid-cols-3 gap-4" aria-label={p.inventory}>
          {AD_INVENTORY.map((slot, i) => (
            <article
              key={slot.name.en}
              className="ad-card rounded-card border border-dashed border-border-strong bg-surface p-6 flex flex-col gap-3 justify-between"
            >
              <div>
                <span className="font-serif text-3xl sm:text-4xl font-bold text-accent leading-none">
                  0{i + 1}
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-text mt-3 mb-2">
                  {slot.name[lang]}
                </h2>
                <p className="text-muted text-sm leading-relaxed">{slot.note[lang]}</p>
              </div>
              <div className="pt-3 border-t border-border/50">
                <span className="text-faint font-mono text-2xs uppercase tracking-wider font-medium">
                  {slot.exampleLabel[lang]}
                </span>
              </div>
            </article>
          ))}
        </section>

        <Reveal>
          <section className="section ad-contact rounded-card border border-border bg-surface p-6 sm:p-8 mt-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="font-serif text-2xl font-bold text-text mb-2">
                {lang === 'uk' ? 'Почнімо розмову.' : 'Start a conversation.'}
              </h2>
              <p className="text-muted text-sm sm:text-base leading-relaxed">{p.contactBody}</p>
            </div>
            <AdvertiseInquiryCta email={ADVERTISE_EMAIL} label={p.contactCta} />
          </section>
        </Reveal>
      </div>
    </>
  );
}
