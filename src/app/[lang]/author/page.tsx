import Link from 'next/link';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { EditorAvatar, EditorLinks } from '@/components/editorial/editor-profile';
import { CategoryBadge } from '@/components/ui/category-badge';
import { StoryRow } from '@/components/editorial/story-row';
import { getNewsPageData } from '@/lib/news';
import styles from '@/components/editorial/profile-pages.module.css';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  EDITOR_NAME,
  EDITOR_PROFILE,
  EDITOR_ROLE,
  isLang,
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
    bio1: `${EDITOR_NAME} curates and edits every issue of ${SITE_NAME}. The editor decides what is actually worth your time — every published story is hand-approved, checked against its primary source, and shipped in both English and Ukrainian.`,
    bio2: 'Verdicts marked “Editor’s take” on article pages are written personally, not generated. Mistakes happen — corrections are fixed in place and noted.',
    eyebrow: 'Editor profile',
    expertiseH: 'Coverage focus',
    standardsH: 'Standards',
    primary: 'Every story links to its primary source.',
    human: 'A human editor approves the final text; AI assistance is disclosed.',
    recentH: 'Recent stories',
    allNews: 'All news',
    policyLink: 'Editorial policy',
    aiLink: 'How we use AI',
  },
  uk: {
    metaDescription: `${EDITOR_NAME} — редактор ${SITE_NAME}, щоденного AI/engineering брифу з людською редактурою.`,
    bio1: `${EDITOR_NAME} курує та редагує кожен випуск ${SITE_NAME}. Що справді варте вашого часу — вирішує редактор: кожен опублікований матеріал схвалено вручну, звірено з першоджерелом і випущено англійською та українською.`,
    bio2: 'Вердикти з позначкою «Думка редактора» на сторінках статей написані особисто, а не згенеровані. Помилки трапляються — виправлення вносяться в текст із приміткою.',
    eyebrow: 'Профіль редактора',
    expertiseH: 'Фокус висвітлення',
    standardsH: 'Стандарти',
    primary: 'Кожен матеріал посилається на першоджерело.',
    human: 'Редактор-людина схвалює остаточний текст; використання AI розкрито.',
    recentH: 'Останні матеріали',
    allNews: 'Усі новини',
    policyLink: 'Редакційна політика',
    aiLink: 'Як ми використовуємо AI',
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
  const news = await getNewsPageData(lang);
  const focusSlugs = new Set([
    'agents-and-mcp',
    'tools-and-releases',
    'optimization',
    'models-and-research',
  ]);
  const categories = news.categories.filter((category) => focusSlugs.has(category.slug));
  const crumbs = [
    { label: t.news.breadcrumbHome, href: `/${lang}` },
    { label: t.about, href: `/${lang}/about` },
    { label: EDITOR_NAME },
  ];

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
    <div className={styles.page} data-testid="author-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Breadcrumbs items={crumbs} className={styles.crumbs} />

      <header className={styles.profile}>
        <EditorAvatar large />
        <div>
          <p className={styles.eyebrow}>{c.eyebrow}</p>
          <h1 className={styles.title}>{EDITOR_NAME}</h1>
          <p className={styles.lede}>
            {EDITOR_ROLE[lang]} · {SITE_NAME}
          </p>
          <p className={styles.lede}>{c.bio1}</p>
          <EditorLinks lang={lang} />
        </div>
      </header>

      <div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="focus-title">
          <h2 id="focus-title">{c.expertiseH}</h2>
          <ul className={styles.topics}>
            {EDITOR_PROFILE.expertise[lang].map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>
          {categories.length > 0 && (
            <ul className={styles.categories}>
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link href={`/${lang}/category/${category.slug}`}>
                    <CategoryBadge
                      name={category.name}
                      slug={category.slug}
                      color={category.color}
                      size="md"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={styles.panel} aria-labelledby="standards-title">
          <h2 id="standards-title">{c.standardsH}</h2>
          <ul className={styles.standards}>
            <li>{c.primary}</li>
            <li>{c.human}</li>
            <li>{c.bio2}</li>
          </ul>
          <div className={styles.links}>
            <Link href={`/${lang}/editorial-policy`}>{c.policyLink}</Link>
            <Link href={`/${lang}/ai-disclosure`}>{c.aiLink}</Link>
          </div>
        </section>
      </div>

      {news.items.length > 0 && (
        <section className={styles.section} aria-labelledby="recent-title">
          <div className={styles.sectionHead}>
            <h2 id="recent-title">{c.recentH}</h2>
            <Link className={styles.action} href={`/${lang}/news`}>
              {c.allNews}
            </Link>
          </div>
          <div className={styles.stories}>
            {news.items.slice(0, 3).map((item) => (
              <StoryRow key={item.id} item={item} lang={lang} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
