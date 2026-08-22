import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  EDITOR_PROFILE,
  isLang,
  SITE_NAME,
  SITE_URL,
  EDITOR_NAME,
  EDITOR_ROLE,
  CONTACT_EMAIL,
  type Lang,
} from '@/lib/site';
import { authorNode, publisherNode, PERSON_ID, ORG_ID } from '@/lib/schema';
import { getStrings } from '@/lib/i18n';
import { socialMeta } from '@/lib/seo';

export const revalidate = 86400;

type Params = { lang: string };

const COPY = {
  en: {
    lede: `${SITE_NAME} is a daily, human-edited briefing for people who build with AI — engineers, founders and technical leads. One focused read a day on the models, frameworks and MLOps that actually move your work forward — in English and Ukrainian.`,
    methodologyH: 'How we work',
    methodology:
      'Every day we scan 80+ stories from official AI labs, research papers, GitHub, Hacker News, Reddit and tier-1 tech press. We rank them and publish only the handful that matter — each with a plain-language summary, a clear “why it matters”, and a link to the primary source. You get a curated, human-edited selection, not dozens of thin, auto-generated pages.',
    aiH: 'AI, with a human in the loop',
    ai: 'We use language models to read sources and draft summaries and translations. A human editor reviews every brief before it ships — checking facts, refining tone, and removing duplicates. The editorial team, not the model, decides what gets published and stands behind it. Read more in our',
    editorH: 'Who edits this',
    editor: `Curated and edited by ${EDITOR_NAME}, ${EDITOR_ROLE.en.toLowerCase()}.`,
    expertiseH: 'Areas of focus',
    contactH: 'Questions, corrections or tips',
    policyLink: 'Read our editorial policy',
  },
  uk: {
    lede: `${SITE_NAME} — щоденний бриф, який редагує людина, для тих, хто будує з AI: інженерів, фаундерів і техлідів. Один сфокусований випуск на день про моделі, фреймворки та MLOps, що справді рухають вашу роботу, — англійською та українською.`,
    methodologyH: 'Як ми працюємо',
    methodology:
      'Щодня ми переглядаємо 80+ матеріалів з офіційних AI-лабораторій, наукових публікацій, GitHub, Hacker News, Reddit і tier-1 техмедіа. Ми ранжуємо їх і публікуємо лише ті кілька, що справді важливі, — кожен із простим резюме, чітким блоком «чому це важливо» та посиланням на першоджерело. Ви отримуєте курований відбір, відредагований людиною, а не десятки поверхових авто-сторінок.',
    aiH: 'AI — під наглядом людини',
    ai: 'Ми використовуємо мовні моделі, щоб читати джерела та готувати чернетки резюме й перекладів. Редактор-людина переглядає кожен випуск перед публікацією: перевіряє факти, вивіряє тон і прибирає дублі. Що публікувати — вирішує редакція, а не модель, і саме вона відповідає за результат. Докладніше — у нашому',
    editorH: 'Хто це редагує',
    editor: `Курує й редагує ${EDITOR_NAME}, ${EDITOR_ROLE.uk.toLowerCase()}.`,
    expertiseH: 'Теми експертизи',
    contactH: 'Запитання, виправлення чи новини',
    policyLink: 'Редакційна політика',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  return {
    title: getStrings(l).about,
    description: COPY[l].lede,
    alternates: {
      canonical: `${SITE_URL}/${l}/about`,
      languages: {
        en: `${SITE_URL}/en/about`,
        uk: `${SITE_URL}/uk/about`,
        'x-default': `${SITE_URL}/en/about`,
      },
    },
    ...socialMeta({ title: getStrings(l).about, description: COPY[l].lede, path: `/${l}/about`, lang: l }),
  };
}

export default async function AboutPage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);
  const c = COPY[lang];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AboutPage',
        inLanguage: lang,
        mainEntity: { '@id': ORG_ID },
      },
      { ...publisherNode(), founder: { '@id': PERSON_ID } },
      authorNode(lang),
    ],
  };

  return (
    <div className="mx-auto w-full max-w-[760px] flex-1 px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-3xl sm:text-4xl">
        {t.about} {SITE_NAME}
      </h1>
      <p className="mt-6 text-lg leading-relaxed">{c.lede}</p>

      <section className="mt-10">
        <h2 className="text-xl">{c.methodologyH}</h2>
        <p className="text-muted mt-3 leading-relaxed">{c.methodology}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">{c.aiH}</h2>
        <p className="text-muted mt-3 leading-relaxed">
          {c.ai}{' '}
          <Link className="text-accent" href={`/${lang}/ai-disclosure`}>
            {t.aiDisclosure}
          </Link>
          .
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">{c.editorH}</h2>
        <p className="text-muted mt-3 leading-relaxed">{c.editor}</p>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          <span className="text-text font-medium">{c.expertiseH}: </span>
          {EDITOR_PROFILE.expertise[lang].join(' · ')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {EDITOR_PROFILE.links.map((link) => (
            <a
              key={link.url}
              className="text-accent text-sm font-medium hover:underline"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </a>
          ))}
        </div>
        <p className="text-muted mt-4 leading-relaxed">
          <span className="text-text font-medium">{c.contactH}: </span>
          <a className="text-accent" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-3">
          <Link className="text-accent text-sm font-medium hover:underline" href={`/${lang}/editorial-policy`}>
            {c.policyLink}
          </Link>
        </p>
      </section>
    </div>
  );
}
