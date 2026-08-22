import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  CONTACT_EMAIL,
  EDITOR_NAME,
  EDITOR_PROFILE,
  EDITOR_ROLE,
  isLang,
  MARK_COLOR,
  SITE_NAME,
  SITE_URL,
  type Lang,
} from '@/lib/site';
import { authorNode, publisherNode, PERSON_ID } from '@/lib/schema';
import { getStrings } from '@/lib/i18n';
import { socialMeta } from '@/lib/seo';

export const revalidate = 86400;

type Params = { lang: string };

const COPY = {
  en: {
    metaDescription: `${EDITOR_NAME} — editor of ${SITE_NAME}, the daily human-edited AI/engineering brief.`,
    bio1: `${EDITOR_NAME} curates and edits every issue of ${SITE_NAME}. The pipeline reads hundreds of sources a day; the editor decides what is actually worth your time — every published story is hand-approved, checked against its primary source, and shipped in both English and Ukrainian.`,
    bio2: 'Verdicts marked “Editor’s take” on article pages are written personally, not generated. Mistakes happen — corrections are fixed in place and noted.',
    expertiseH: 'Areas of focus',
    linksH: 'Elsewhere',
    byEditorH: 'How this site is edited',
    policyLink: 'Editorial policy',
    aiLink: 'How we use AI',
    contactH: 'Corrections and tips',
  },
  uk: {
    metaDescription: `${EDITOR_NAME} — редактор ${SITE_NAME}, щоденного AI/engineering брифу з людською редактурою.`,
    bio1: `${EDITOR_NAME} курує та редагує кожен випуск ${SITE_NAME}. Pipeline щодня читає сотні джерел; що справді варте вашого часу — вирішує редактор: кожен опублікований матеріал схвалено вручну, звірено з першоджерелом і випущено англійською та українською.`,
    bio2: 'Вердикти з позначкою «Думка редактора» на сторінках статей написані особисто, а не згенеровані. Помилки трапляються — виправлення вносяться в текст із приміткою.',
    expertiseH: 'Теми експертизи',
    linksH: 'Соцмережі',
    byEditorH: 'Як редагується цей сайт',
    policyLink: 'Редакційна політика',
    aiLink: 'Як ми використовуємо AI',
    contactH: 'Виправлення та новини',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  return {
    title: `${EDITOR_NAME} — ${EDITOR_ROLE[l]}`,
    description: COPY[l].metaDescription,
    alternates: {
      canonical: `${SITE_URL}/${l}/author`,
      languages: {
        en: `${SITE_URL}/en/author`,
        uk: `${SITE_URL}/uk/author`,
        'x-default': `${SITE_URL}/en/author`,
      },
    },
    ...socialMeta({
      title: `${EDITOR_NAME} — ${EDITOR_ROLE[l]}`,
      description: COPY[l].metaDescription,
      path: `/${l}/author`,
      lang: l,
    }),
  };
}

export default async function AuthorPage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);
  const c = COPY[lang];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        inLanguage: lang,
        mainEntity: { '@id': PERSON_ID },
      },
      authorNode(lang),
      publisherNode(),
    ],
  };

  return (
    <div className="mx-auto w-full max-w-[760px] flex-1 px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="text-on-accent grid h-16 w-16 place-items-center rounded-full text-xl font-bold"
          style={{ background: MARK_COLOR }}
        >
          OK
        </span>
        <div>
          <h1 className="m-0 text-3xl sm:text-4xl">{EDITOR_NAME}</h1>
          <p className="text-muted m-0 mt-1">{EDITOR_ROLE[lang]} · {SITE_NAME}</p>
        </div>
      </div>

      <p className="mt-8 text-lg leading-relaxed">{c.bio1}</p>
      <p className="text-muted mt-4 leading-relaxed">{c.bio2}</p>

      <section className="mt-8">
        <h2 className="text-xl">{c.expertiseH}</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EDITOR_PROFILE.expertise[lang].map((topic) => (
            <span
              key={topic}
              className="rounded-pill border-border bg-surface-2 border px-2.5 py-1 text-[0.8rem]"
            >
              {topic}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">{c.linksH}</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {EDITOR_PROFILE.links.map((link) => (
            <a
              key={link.url}
              className="text-accent text-sm font-medium hover:underline"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer me"
            >
              {link.label}
            </a>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">{c.byEditorH}</h2>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <Link className="text-accent text-sm font-medium hover:underline" href={`/${lang}/editorial-policy`}>
            {c.policyLink}
          </Link>
          <Link className="text-accent text-sm font-medium hover:underline" href={`/${lang}/ai-disclosure`}>
            {c.aiLink}
          </Link>
        </p>
        <p className="text-muted mt-4 leading-relaxed">
          <span className="text-text font-medium">{c.contactH}: </span>
          <a className="text-accent" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-3">
          <Link className="text-accent text-sm font-medium hover:underline" href={`/${lang}/about`}>
            {t.about} {SITE_NAME}
          </Link>
        </p>
      </section>
    </div>
  );
}
