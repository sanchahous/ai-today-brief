import Link from 'next/link';
import Image from 'next/image';
import { NewsletterForm } from '@/components/ui/newsletter-form';
import { EditorAvatar, EditorLinks } from '@/components/editorial/editor-profile';
import styles from '@/components/editorial/profile-pages.module.css';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  EDITOR_PROFILE,
  isLang,
  SITE_NAME,
  SITE_URL,
  EDITOR_NAME,
  EDITOR_ROLE,
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
    eyebrow: 'About the publication',
    title: 'Intelligence deserves',
    titleEm: 'a human perspective.',
    copyH: 'A quieter place to understand what’s next.',
    context:
      'Each visit should leave you with context you can use: what changed, why it matters and where to go deeper. We select stories about the models, frameworks and MLOps that move your work forward.',
    ai: 'AI helps read sources and draft summaries and translations. A human editor checks facts, refines the text and decides what gets published.',
    artAlt: 'After Hours concept art: a brass sculpture with a glass edge',
    artCaption: 'Concept art · After Hours',
    processH: 'How a story becomes a brief',
    process: [
      {
        title: 'Find the source',
        text: 'Start with official reporting, papers and documentation. Link the source so readers can go deeper.',
      },
      {
        title: 'Separate the signal',
        text: 'Explain what changed, what the evidence shows and what is still uncertain.',
      },
      {
        title: 'Make the editorial call',
        text: 'A human editor checks the facts and approves the final text before publication.',
      },
      {
        title: 'Correct in public',
        text: 'Fix mistakes and note corrections on the story when they materially affect meaning.',
      },
    ],
    editorH: 'Meet the editor',
    profileLink: 'Full profile',
    expertiseH: 'Areas of focus',
    policyLink: 'Read our editorial policy',
  },
  uk: {
    lede: `${SITE_NAME} — щоденний бриф, який редагує людина, для тих, хто будує з AI: інженерів, фаундерів і техлідів. Один сфокусований випуск на день про моделі, фреймворки та MLOps, що справді рухають вашу роботу, — англійською та українською.`,
    eyebrow: 'Про видання',
    title: 'Інтелект потребує',
    titleEm: 'людського погляду.',
    copyH: 'Спокійніше місце, щоб зрозуміти, що далі.',
    context:
      'Кожен візит має давати корисний контекст: що змінилось, чому це важливо й де заглибитись. Ми відбираємо матеріали про моделі, фреймворки та MLOps, що рухають вашу роботу.',
    ai: 'AI допомагає читати джерела та готувати чернетки резюме й перекладів. Редактор-людина перевіряє факти, вивіряє текст і вирішує, що публікувати.',
    artAlt: 'Концепт-арт After Hours: латунна скульптура зі скляним краєм',
    artCaption: 'Концепт-арт · After Hours',
    processH: 'Як матеріал стає брифом',
    process: [
      {
        title: 'Знайти джерело',
        text: 'Почати з офіційних матеріалів, наукових публікацій і документації. Дати посилання, щоб читач міг заглибитись.',
      },
      {
        title: 'Відділити сигнал',
        text: 'Пояснити, що змінилось, що показують докази й що лишається невідомим.',
      },
      {
        title: 'Ухвалити рішення',
        text: 'Редактор-людина перевіряє факти та схвалює остаточний текст перед публікацією.',
      },
      {
        title: 'Виправляти публічно',
        text: 'Виправляти помилки й зазначати виправлення в матеріалі, коли вони суттєво змінюють зміст.',
      },
    ],
    editorH: 'Знайомтеся з редактором',
    profileLink: 'Повний профіль',
    expertiseH: 'Теми експертизи',
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
    ...socialMeta({
      title: getStrings(l).about,
      description: COPY[l].lede,
      path: `/${l}/about`,
      lang: l,
    }),
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
        name: `${t.about} ${SITE_NAME}`,
        inLanguage: lang,
        mainEntity: { '@id': ORG_ID },
      },
      { ...publisherNode(), founder: { '@id': PERSON_ID } },
      authorNode(lang),
    ],
  };

  return (
    <div className={styles.page} data-testid="about-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className={styles.intro}>
        <p className={styles.eyebrow}>{c.eyebrow}</p>
        <h1 className={styles.title}>
          {c.title}
          <br />
          <em>{c.titleEm}</em>
        </h1>
        <p className={styles.lede}>{c.lede}</p>
      </header>

      <section className={styles.split} aria-labelledby="about-context">
        <figure className={styles.art}>
          <picture>
            <source
              type="image/avif"
              srcSet="/images/after-hours/after-hours-800.avif 800w, /images/after-hours/after-hours-1600.avif 1600w"
              sizes="(max-width: 760px) 100vw, 50vw"
            />
            <source
              type="image/webp"
              srcSet="/images/after-hours/after-hours-800.webp 800w, /images/after-hours/after-hours-1600.webp 1600w"
              sizes="(max-width: 760px) 100vw, 50vw"
            />
            <Image
              src="/images/after-hours/after-hours-1600.webp"
              width={1600}
              height={900}
              alt={c.artAlt}
              unoptimized
              loading="eager"
              sizes="(max-width: 760px) 100vw, 50vw"
            />
          </picture>
          <figcaption>{c.artCaption}</figcaption>
        </figure>
        <div className={styles.copy}>
          <h2 id="about-context">{c.copyH}</h2>
          <p>{c.context}</p>
          <p>{c.ai}</p>
          <Link className={styles.action} href={`/${lang}/editorial-policy`}>
            {c.policyLink}
          </Link>
          <p>
            <Link className={styles.action} href={`/${lang}/ai-disclosure`}>
              {t.aiDisclosure}
            </Link>
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="process-title">
        <div className={styles.sectionHead}>
          <h2 id="process-title">{c.processH}</h2>
        </div>
        <ol className={styles.process}>
          {c.process.map((step, index) => (
            <li key={step.title}>
              <span aria-hidden="true">
                {new Intl.NumberFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
                  minimumIntegerDigits: 2,
                }).format(index + 1)}
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="editor-title">
        <div className={styles.sectionHead}>
          <h2 id="editor-title">{c.editorH}</h2>
          <Link className={styles.action} href={`/${lang}/author`}>
            {c.profileLink}
          </Link>
        </div>
        <div className={styles.editor}>
          <EditorAvatar />
          <div>
            <h3>{EDITOR_NAME}</h3>
            <p>
              {EDITOR_ROLE[lang]} · {SITE_NAME}
            </p>
            <p>
              {c.expertiseH}: {EDITOR_PROFILE.expertise[lang].join(' · ')}
            </p>
            <EditorLinks lang={lang} />
          </div>
        </div>
      </section>

      <div className={styles.newsletter}>
        <NewsletterForm lang={lang} variant="band" />
      </div>
    </div>
  );
}
