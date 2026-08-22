import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { CookieConsent } from '@/components/cookie-consent';
import { AnalyticsProvider } from '@/components/analytics-provider';
import { ReaderRevenue } from '@/components/reader-revenue';
import { getStrings } from '@/lib/i18n';
import { LANGS, isLang, SITE_NAME, SITE_TAGLINE, SITE_URL, type Lang } from '@/lib/site';

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  return {
    title: { default: `${SITE_NAME} — ${SITE_TAGLINE[l]}`, template: `%s · ${SITE_NAME}` },
    description: SITE_TAGLINE[l],
    alternates: {
      canonical: `${SITE_URL}/${l}`,
      languages: {
        en: `${SITE_URL}/en`,
        uk: `${SITE_URL}/uk`,
        'x-default': `${SITE_URL}/en`,
      },
      types: {
        'application/rss+xml': `${SITE_URL}${l === 'uk' ? '/rss-uk.xml' : '/rss.xml'}`,
      },
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getStrings(lang);
  return (
    <>
      <a href="#main-content" className="skip-link">
        {t.skipToContent}
      </a>
      <SiteHeader lang={lang} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter lang={lang} />
      <AnalyticsProvider lang={lang} />
      <ReaderRevenue lang={lang} />
      <CookieConsent lang={lang} />
    </>
  );
}
