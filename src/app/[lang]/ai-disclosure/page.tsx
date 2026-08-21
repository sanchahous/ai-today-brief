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
  const doc = LEGAL_DOCS['ai-disclosure'];
  return {
    title: doc.title[l],
    description: doc.intro[l],
    alternates: {
      canonical: `${SITE_URL}/${l}/ai-disclosure`,
      languages: {
        en: `${SITE_URL}/en/ai-disclosure`,
        uk: `${SITE_URL}/uk/ai-disclosure`,
        'x-default': `${SITE_URL}/en/ai-disclosure`,
      },
    },
    ...socialMeta({ title: doc.title[l], description: doc.intro[l], path: `/${l}/ai-disclosure`, lang: l }),
  };
}

export default async function AiDisclosurePage({ params }: { params: Promise<Params> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <LegalDocView docKey="ai-disclosure" lang={lang} />;
}
