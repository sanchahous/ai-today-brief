import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_URL, type Lang } from '@/lib/site';
import { LEGAL_DOCS } from '@/lib/legal';
import { LegalDocView } from '@/components/legal-doc';

export const revalidate = 86400;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  return {
    title: LEGAL_DOCS.privacy.title[l],
    alternates: {
      canonical: `${SITE_URL}/${l}/privacy`,
      languages: {
        en: `${SITE_URL}/en/privacy`,
        uk: `${SITE_URL}/uk/privacy`,
        'x-default': `${SITE_URL}/en/privacy`,
      },
    },
  };
}

export default async function PrivacyPage({ params }: { params: Promise<Params> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <LegalDocView docKey="privacy" lang={lang} />;
}
