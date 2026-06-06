import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  isLang,
  SITE_NAME,
  SITE_URL,
  EDITOR_NAME,
  EDITOR_ROLE,
  CONTACT_EMAIL,
  type Lang,
} from '@/lib/site';
import { getStrings } from '@/lib/i18n';

export const revalidate = 86400;

type Params = { lang: string };

const COPY = {
  en: {
    lede: `${SITE_NAME} is a daily, human-edited brief for people who build with AI — engineers, founders and technical leads. One focused read a day across models, frameworks and MLOps, in English and Ukrainian.`,
    methodologyH: 'How we work',
    methodology:
      'Each day we process 80+ stories from official AI labs, research, GitHub, Hacker News, Reddit and tier-1 tech press, rank them, and publish only the few that matter — each with a plain-language summary, a “why it matters”, and a link to the primary source. We publish selected, human-edited items, never dozens of thin auto-generated pages.',
    aiH: 'AI, with a human in the loop',
    ai: 'We use language models to read sources and draft summaries and translations. A human editor reviews every brief before it ships — fact-checks, tone, de-duplication. The editorial team, not the model, decides what is published and is responsible for it. More in our',
    editorH: 'Who edits this',
    editor: `Curated and edited by ${EDITOR_NAME}, ${EDITOR_ROLE.en.toLowerCase()}. Questions, corrections or tips:`,
  },
  uk: {
    lede: `${SITE_NAME} — щоденний, відредагований людиною бриф для тих, хто будує з AI: інженерів, фаундерів і техлідів. Один сфокусований випуск на день про моделі, фреймворки та MLOps — англійською та українською.`,
    methodologyH: 'Як ми працюємо',
    methodology:
      'Щодня ми обробляємо 80+ матеріалів з офіційних AI-лабораторій, досліджень, GitHub, Hacker News, Reddit і tier-1 техмедіа, ранжуємо їх і публікуємо лише ті кілька, що справді важливі — кожен із простим резюме, блоком «чому це важливо» та посиланням на першоджерело. Ми публікуємо вибрані, відредаговані людиною матеріали, а не десятки тонких авто-сторінок.',
    aiH: 'AI — під наглядом людини',
    ai: 'Ми використовуємо мовні моделі, щоб читати джерела й готувати чернетки резюме та перекладів. Редактор-людина переглядає кожен бриф перед публікацією — факти, тон, відсів дублів. Що публікувати — вирішує редакція, а не модель, і вона ж несе відповідальність. Докладніше — в нашому',
    editorH: 'Хто це редагує',
    editor: `Курує й редагує ${EDITOR_NAME}, ${EDITOR_ROLE.uk.toLowerCase()}. Питання, виправлення чи новини:`,
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
    '@type': 'AboutPage',
    inLanguage: lang,
    mainEntity: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      founder: { '@type': 'Person', name: EDITOR_NAME },
    },
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
        <p className="text-muted mt-3 leading-relaxed">
          {c.editor}{' '}
          <a className="text-accent" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </div>
  );
}
