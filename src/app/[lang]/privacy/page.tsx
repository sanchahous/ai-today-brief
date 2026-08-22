import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, SITE_URL, type Lang } from '@/lib/site';
import { LEGAL_DOCS } from '@/lib/legal';
import { LegalDocView } from '@/components/legal-doc';
import { socialMeta } from '@/lib/seo';

export const revalidate = 86400;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  const doc = LEGAL_DOCS.privacy;
  return {
    title: doc.title[l],
    description: doc.intro[l],
    alternates: {
      canonical: `${SITE_URL}/${l}/privacy`,
      languages: {
        en: `${SITE_URL}/en/privacy`,
        uk: `${SITE_URL}/uk/privacy`,
        'x-default': `${SITE_URL}/en/privacy`,
      },
    },
    ...socialMeta({ title: doc.title[l], description: doc.intro[l], path: `/${l}/privacy`, lang: l }),
  };
}

export default async function PrivacyPage({ params }: { params: Promise<Params> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <LegalDocView docKey="privacy" lang={lang} />;
}
