import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  CONTACT_EMAIL,
  EDITOR_NAME,
  isLang,
  SITE_NAME,
  SITE_URL,
  type Lang,
} from '@/lib/site';
import { getStrings } from '@/lib/i18n';

export const revalidate = 86400;

type Params = { lang: string };

const COPY = {
  en: {
    lede: `${SITE_NAME} is a human-edited news product for engineers. This page explains how we select stories, verify facts, handle corrections, and keep editorial independence.`,
    standardsH: 'Editorial standards',
    standards:
      'We publish only stories that change how developers build with AI — tool releases, agent workflows, research with practical impact, security issues, and MLOps shifts. We do not chase viral hype, republish press releases verbatim, or auto-generate dozens of thin pages per day. Every item in the brief is ranked, summarized, and reviewed before it ships.',
    factCheckH: 'How we verify facts',
    factCheck:
      'Each story links to a primary source (official blog, paper, repository, or tier-1 publication). The editor checks that the headline matches the source, that numbers and version names are accurate, and that we are not overstating claims. When a source is ambiguous, we say so. AI drafts summaries and translations; a human editor approves the final text.',
    correctionsH: 'Corrections',
    corrections: `If we get something wrong, we fix it promptly and note the correction on the story when the error materially affected meaning. Report errors to ${CONTACT_EMAIL} — include the URL and what should change.`,
    independenceH: 'Independence',
    independence:
      'Sponsored placements are clearly labelled and never influence which stories enter the daily brief. The editorial team decides ranking and publication. Advertisers do not review or approve news coverage.',
    aiLink: 'For how we use AI in production, see our',
  },
  uk: {
    lede: `${SITE_NAME} — новинний продукт для інженерів, який редагує людина. На цій сторінці — як ми відбираємо матеріали, перевіряємо факти, виправляємо помилки та зберігаємо редакційну незалежність.`,
    standardsH: 'Редакційні стандарти',
    standards:
      'Ми публікуємо лише те, що змінює роботу розробника з AI: релізи інструментів, агентні workflow, дослідження з практичним впливом, питання безпеки та зміни в MLOps. Ми не ганяємось за віральним хайпом, не переписуємо пресрелізи дослівно й не генеруємо десятки поверхових сторінок на день. Кожен матеріал у брифі ранжується, резюмується й перевіряється перед публікацією.',
    factCheckH: 'Як ми перевіряємо факти',
    factCheck:
      'Кожна новина має посилання на першоджерело (офіційний блог, paper, репозиторій або tier-1 медіа). Редактор перевіряє, що заголовок відповідає джерелу, що цифри й назви версій точні, і що ми не перебільшуємо твердження. Якщо джерело неоднозначне — ми це зазначаємо. AI готує чернетки резюме й перекладів; фінальний текст затверджує редактор-людина.',
    correctionsH: 'Виправлення',
    corrections: `Якщо ми помилилися — виправляємо оперативно й зазначаємо виправлення в матеріалі, коли помилка суттєво змінювала зміст. Повідомляйте про помилки на ${CONTACT_EMAIL} — вкажіть URL і що саме треба виправити.`,
    independenceH: 'Незалежність',
    independence:
      'Спонсорські розміщення чітко позначені й ніколи не впливають на те, які історії потрапляють у щоденний бриф. Редакція сама вирішує ранжування й публікацію. Рекламодавці не переглядають і не затверджують новинне покриття.',
    aiLink: 'Про використання AI у виробництві — у нашому',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  const t = getStrings(l);
  return {
    title: t.editorialPolicy,
    description: COPY[l].lede,
    alternates: {
      canonical: `${SITE_URL}/${l}/editorial-policy`,
      languages: {
        en: `${SITE_URL}/en/editorial-policy`,
        uk: `${SITE_URL}/uk/editorial-policy`,
        'x-default': `${SITE_URL}/en/editorial-policy`,
      },
    },
  };
}

export default async function EditorialPolicyPage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);
  const c = COPY[lang];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t.editorialPolicy,
    description: c.lede,
    inLanguage: lang,
    url: `${SITE_URL}/${lang}/editorial-policy`,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    author: { '@type': 'Person', name: EDITOR_NAME },
  };

  return (
    <div className="mx-auto w-full max-w-[760px] flex-1 px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-3xl sm:text-4xl">{t.editorialPolicy}</h1>
      <p className="mt-6 text-lg leading-relaxed">{c.lede}</p>

      <section className="mt-10">
        <h2 className="text-xl">{c.standardsH}</h2>
        <p className="text-muted mt-3 leading-relaxed">{c.standards}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">{c.factCheckH}</h2>
        <p className="text-muted mt-3 leading-relaxed">{c.factCheck}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">{c.correctionsH}</h2>
        <p className="text-muted mt-3 leading-relaxed">{c.corrections}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">{c.independenceH}</h2>
        <p className="text-muted mt-3 leading-relaxed">{c.independence}</p>
      </section>

      <p className="text-muted mt-8 leading-relaxed">
        {c.aiLink}{' '}
        <Link className="text-accent" href={`/${lang}/ai-disclosure`}>
          {t.aiDisclosure}
        </Link>
        .
      </p>
    </div>
  );
}
