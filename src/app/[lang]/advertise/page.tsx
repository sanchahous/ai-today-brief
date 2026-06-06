import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_NAME, SITE_URL, ADVERTISE_EMAIL, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import {
  AD_INVENTORY,
  ADVERTISE_BENEFITS,
  AUDIENCE_STATS,
} from '@/lib/marketing-content';
import { TrustPageShell } from '@/components/trust-page-shell';
import { AdvertiseInquiryCta } from '@/components/advertise-inquiry-cta';
import { CheckIcon } from '@/components/icons';
import { breadcrumbJsonLd } from '@/components/breadcrumbs';
import { Reveal } from '@/components/reveal';

export const revalidate = 86400;

type Params = { lang: string };

function SectionHead({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 mb-4 text-[clamp(1.25rem,3vw,1.65rem)] first:mt-0">{children}</h2>;
}

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
      <TrustPageShell crumbs={crumbs} eyebrow={p.eyebrow} title={p.title} lead={p.lead}>
        <SectionHead>{p.audience}</SectionHead>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
          {AUDIENCE_STATS.map((s) => (
            <div
              key={s.label.en}
              className="rounded-card border-border bg-surface border p-5 text-center"
            >
              <p className="font-serif text-accent text-[1.9rem] font-bold">{s.value}</p>
              <p className="text-muted mt-1 text-sm">{s.label[lang]}</p>
            </div>
          ))}
        </div>

        <SectionHead>{p.inventory}</SectionHead>
        <ul className="grid list-none gap-3 p-0">
          {AD_INVENTORY.map((slot) => (
            <li
              key={slot.name.en}
              className="rounded-card border-border bg-surface flex flex-wrap items-baseline gap-x-4 gap-y-2 border px-4 py-4"
            >
              <strong className="min-w-[220px] flex-1 text-base">{slot.name[lang]}</strong>
              <span className="text-accent text-sm font-semibold">{slot.placement[lang]}</span>
              <span className="text-muted w-full text-sm">{slot.note[lang]}</span>
            </li>
          ))}
        </ul>

        <SectionHead>{p.why}</SectionHead>
        <ul className="grid list-none gap-2.5 p-0">
          {ADVERTISE_BENEFITS.map((b) => (
            <li key={b.en} className="flex gap-2.5 text-base leading-relaxed">
              <span className="text-accent mt-0.5 inline-flex shrink-0">
                <CheckIcon size={16} />
              </span>
              {b[lang]}
            </li>
          ))}
        </ul>

        <Reveal>
          <div
            className="rounded-card border-border bg-surface mt-10 border p-6 sm:p-8"
            style={{
              background:
                'radial-gradient(120% 160% at 0% 0%, rgba(240,192,64,0.12), transparent 55%), var(--surface)',
            }}
          >
            <p className="text-muted max-w-[520px] text-base leading-relaxed">{p.contactBody}</p>
            <AdvertiseInquiryCta email={ADVERTISE_EMAIL} label={p.contactCta} />
          </div>
        </Reveal>
      </TrustPageShell>
    </>
  );
}
