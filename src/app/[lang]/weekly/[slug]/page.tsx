import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/breadcrumbs';
import { MarkdownBody } from '@/components/markdown-body';
import { LiteYouTube } from '@/components/weekly/lite-youtube';
import { WEEKLY_COPY } from '@/components/weekly/copy';
import { DigestEngagement } from '@/components/weekly/digest-engagement';
import { WeeklyHero } from '@/components/weekly/weekly-hero';
import { WeeklyActionBoard } from '@/components/weekly/weekly-action-board';
import { WeeklyStory } from '@/components/weekly/weekly-story';
import { WeeklyToc } from '@/components/weekly/weekly-toc';
import {
  getPublishedWeeklyDigestPaths,
  getWeeklyDigest,
  type WeeklyDigestView,
} from '@/lib/digests';
import { clipToMaxChars } from '@/lib/weekly-digest/clip-text';
import { markdownToPlainText } from '@/lib/markdown';
import {
  weeklyFaqFromDigest,
  weeklyMetaDescription,
  weeklyMetricsFromItems,
} from '@/lib/weekly-digest/weekly-geo';
import { authorNode, publisherNode } from '@/lib/schema';
import { isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';

export const revalidate = 86400;

type Params = { lang: string; slug: string };

export async function generateStaticParams() {
  return getPublishedWeeklyDigestPaths();
}

function descriptionFor(digest: WeeklyDigestView) {
  return weeklyMetaDescription(digest);
}

function absoluteUrl(url: string) {
  return url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function isoDuration(seconds: number | null) {
  if (!seconds || seconds < 1) return undefined;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `PT${minutes ? `${minutes}M` : ''}${remainder ? `${remainder}S` : ''}`;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();
  const digest = await getWeeklyDigest(slug, lang);
  if (!digest) notFound();

  const path = `/${lang}/weekly/${slug}`;
  const description = descriptionFor(digest);
  const image = digest.cover ? absoluteUrl(digest.cover.url) : undefined;

  return {
    title: digest.seoTitle,
    description,
    keywords: digest.entities.length ? digest.entities : undefined,
    alternates: {
      canonical: `${SITE_URL}${path}`,
      languages: {
        en: `${SITE_URL}/en/weekly/${slug}`,
        uk: `${SITE_URL}/uk/weekly/${slug}`,
        'x-default': `${SITE_URL}/en/weekly/${slug}`,
      },
    },
    openGraph: {
      title: digest.ogTitle,
      description: clipToMaxChars(digest.ogDescription || description, 200),
      type: 'article',
      url: `${SITE_URL}${path}`,
      siteName: SITE_NAME,
      locale: lang === 'uk' ? 'uk_UA' : 'en_US',
      alternateLocale: lang === 'uk' ? ['en_US'] : ['uk_UA'],
      publishedTime: digest.publishedAt ?? undefined,
      modifiedTime: digest.modifiedAt,
      images: image
        ? [
            {
              url: image,
              width: digest.cover?.width,
              height: digest.cover?.height,
              alt: digest.cover?.alt,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: digest.ogTitle,
      description: clipToMaxChars(digest.ogDescription || description, 200),
      images: image ? [image] : undefined,
    },
  };
}

export default async function WeeklyDigestPage({ params }: { params: Promise<Params> }) {
  const { lang: raw, slug } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const digest = await getWeeklyDigest(slug, lang);
  if (!digest) notFound();

  const copy = WEEKLY_COPY[lang];
  const pagePath = `/${lang}/weekly/${slug}`;
  const crumbs = [
    { label: lang === 'uk' ? 'Головна' : 'Home', href: `/${lang}` },
    { label: copy.allDigests, href: `/${lang}/digests` },
    { label: digest.title },
  ];
  const images = [digest.cover, ...digest.items.map((item) => item.image)]
    .filter((image): image is NonNullable<typeof image> => Boolean(image))
    .map((image) => absoluteUrl(image.url));
  const articleBody = [
    digest.intro,
    digest.editorNote,
    ...digest.items.flatMap((item) => [
      item.title,
      item.summary,
      item.body ? markdownToPlainText(item.body) : '',
      item.why,
      item.practicalExample,
      item.takeaway,
    ]),
  ]
    .filter(Boolean)
    .join('\n\n');
  const citations = digest.items.flatMap((item) =>
    item.sources.map((source) => ({
      '@type': 'CreativeWork',
      name: source.name ?? item.title,
      url: source.url,
    })),
  );

  const faq = weeklyFaqFromDigest(digest);
  const metrics = weeklyMetricsFromItems(digest.items);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsArticle',
        headline: digest.title,
        description: descriptionFor(digest),
        articleBody,
        ...(images.length ? { image: images } : {}),
        datePublished: digest.publishedAt ?? digest.weekEnd,
        dateModified: digest.modifiedAt,
        inLanguage: lang,
        isAccessibleForFree: true,
        url: `${SITE_URL}${pagePath}`,
        mainEntityOfPage: `${SITE_URL}${pagePath}`,
        author: authorNode(lang),
        publisher: publisherNode(),
        ...(citations.length ? { citation: citations } : {}),
        ...(digest.video ? { video: { '@id': `${SITE_URL}${pagePath}#video` } } : {}),
      },
      ...(faq.length
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: faq.map((entry) => ({
                '@type': 'Question',
                name: entry.question,
                acceptedAnswer: { '@type': 'Answer', text: entry.answer },
              })),
            },
          ]
        : []),
      ...(digest.video
        ? [
            {
              '@type': 'VideoObject',
              '@id': `${SITE_URL}${pagePath}#video`,
              name: copy.videoTitle,
              description: copy.videoDescription,
              thumbnailUrl: [absoluteUrl(digest.video.thumbnailUrl)],
              embedUrl: `https://www.youtube-nocookie.com/embed/${digest.video.youtubeId}`,
              contentUrl: digest.video.youtubeUrl,
              uploadDate: digest.video.uploadedAt ?? digest.publishedAt ?? digest.weekEnd,
              ...(isoDuration(digest.video.durationSeconds)
                ? { duration: isoDuration(digest.video.durationSeconds) }
                : {}),
              inLanguage: 'en',
              caption: ['en', 'uk'],
            },
          ]
        : []),
      breadcrumbJsonLd(crumbs, SITE_URL),
    ],
  };

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-10 lg:py-14">
      {digest.revisionId ? (
        <DigestEngagement digestId={digest.id} revisionId={digest.revisionId} locale={lang} />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs items={crumbs} />

      <article>
        <WeeklyHero digest={digest} lang={lang} />

        <div className="mt-10 grid gap-10 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-14">
          <aside className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
            <WeeklyToc items={digest.items} lang={lang} />
            <div className="border-border-soft mt-7 border-t pt-6">
              {digest.hasPdf ? (
                <a
                  href={`/${lang}/weekly/${digest.slug}/download`}
                  data-digest-event="pdf_download"
                  className="border-border text-text hover:border-accent hover:text-accent rounded-pill flex w-full items-center justify-center border px-4 py-2.5 text-center text-sm font-semibold no-underline transition-colors"
                >
                  {copy.downloadPdf}
                </a>
              ) : null}
              <Link
                href={`/${lang}/subscribe`}
                data-digest-event="subscribe_click"
                className="text-accent mt-4 block text-center text-sm font-semibold no-underline hover:underline"
              >
                {lang === 'uk' ? 'Отримувати нові випуски' : 'Get the next issue'}
              </Link>
            </div>
          </aside>

          <div id="stories" className="min-w-0 scroll-mt-[calc(var(--header-h)+2rem)]">
            {digest.video ? (
              <section
                aria-labelledby="weekly-video-title"
                data-digest-event="video_play"
                className="mb-10"
              >
                <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
                  {copy.watch}
                </p>
                <h2 id="weekly-video-title" className="mt-2 text-2xl sm:text-3xl">
                  {copy.videoTitle}
                </h2>
                <p className="text-muted mt-2 mb-5 max-w-2xl leading-7">{copy.videoDescription}</p>
                <LiteYouTube
                  videoId={digest.video.youtubeId}
                  thumbnailUrl={digest.video.thumbnailUrl}
                  title={copy.videoTitle}
                  lang={lang}
                />
              </section>
            ) : null}

            <WeeklyActionBoard items={digest.items} lang={lang} />

            {faq.length ? (
              <section aria-labelledby="weekly-faq-title" className="mt-8">
                <h2 id="weekly-faq-title" className="text-2xl">
                  {copy.faq}
                </h2>
                <dl className="mt-5 grid gap-4">
                  {faq.map((entry) => (
                    <div
                      key={entry.question}
                      className="border-border bg-surface rounded-card border p-4"
                    >
                      <dt className="font-semibold">{entry.question}</dt>
                      <dd className="text-muted mt-2 leading-7">{entry.answer}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {metrics.length ? (
              <section aria-labelledby="weekly-metrics-title" className="mt-8">
                <h2 id="weekly-metrics-title" className="text-2xl">
                  {copy.metrics}
                </h2>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <thead className="text-faint text-xs tracking-wide uppercase">
                      <tr>
                        <th className="border-border-soft border-b py-2 pr-3">
                          {lang === 'uk' ? 'Мітка' : 'Label'}
                        </th>
                        <th className="border-border-soft border-b py-2 pr-3">
                          {lang === 'uk' ? 'Значення' : 'Value'}
                        </th>
                        <th className="border-border-soft border-b py-2">
                          {lang === 'uk' ? 'Історія' : 'Story'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((row) => (
                        <tr key={`${row.value}:${row.storyTitle}`}>
                          <td className="border-border-soft border-b py-2 pr-3">{row.label}</td>
                          <td className="border-border-soft border-b py-2 pr-3 font-semibold">
                            {row.value}
                          </td>
                          <td className="border-border-soft text-muted border-b py-2">
                            {row.storyTitle}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {digest.editorNote ? (
              <section
                aria-labelledby="editor-note-title"
                className="border-border bg-surface rounded-card mt-8 border p-6 sm:p-8"
              >
                <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
                  {copy.editorNote}
                </p>
                <h2 id="editor-note-title" className="sr-only">
                  {copy.editorNote}
                </h2>
                <div className="mt-3">
                  <MarkdownBody markdown={digest.editorNote} />
                </div>
              </section>
            ) : null}

            {digest.keyTakeaways.length ? (
              <section aria-labelledby="takeaways-title" className="mt-8">
                <h2 id="takeaways-title" className="text-2xl">
                  {copy.keyTakeaways}
                </h2>
                <ol className="mt-5 grid gap-3">
                  {digest.keyTakeaways.map((takeaway, index) => (
                    <li
                      key={`${index}-${takeaway}`}
                      className="border-border bg-surface rounded-card grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border p-4"
                    >
                      <span
                        aria-hidden
                        className="bg-accent text-on-accent grid h-7 w-7 place-items-center rounded-full text-xs font-bold"
                      >
                        {index + 1}
                      </span>
                      <span className="text-muted leading-7">{takeaway}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <div className="mt-10 grid gap-12">
              {digest.items.map((item) => (
                <WeeklyStory key={item.id} item={item} lang={lang} />
              ))}
            </div>

            <nav
              aria-label={`${copy.previous} / ${copy.next}`}
              className="mt-10 grid gap-3 sm:grid-cols-2"
            >
              {digest.previous ? (
                <Link
                  href={`/${lang}/weekly/${digest.previous.slug}`}
                  className="border-border bg-surface hover:border-accent rounded-card border p-4 no-underline transition-colors"
                >
                  <span className="text-faint block text-xs uppercase">← {copy.previous}</span>
                  <span className="text-text mt-2 block font-serif font-semibold">
                    {digest.previous.title}
                  </span>
                </Link>
              ) : (
                <span aria-hidden className="hidden sm:block" />
              )}
              {digest.next ? (
                <Link
                  href={`/${lang}/weekly/${digest.next.slug}`}
                  className="border-border bg-surface hover:border-accent rounded-card border p-4 text-right no-underline transition-colors"
                >
                  <span className="text-faint block text-xs uppercase">{copy.next} →</span>
                  <span className="text-text mt-2 block font-serif font-semibold">
                    {digest.next.title}
                  </span>
                </Link>
              ) : null}
            </nav>

            <section className="border-border rounded-card mt-10 border p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div>
                <h2 className="text-xl">
                  {lang === 'uk'
                    ? 'Наступний випуск — у понеділок'
                    : 'The next issue arrives Monday'}
                </h2>
                <p className="text-muted mt-2 text-sm leading-6">
                  {lang === 'uk'
                    ? 'Підпишіться, щоб отримати повний тижневий контекст без інформаційного шуму.'
                    : 'Subscribe for the full week in context, without the information overload.'}
                </p>
              </div>
              <Link
                href={`/${lang}/subscribe`}
                data-digest-event="subscribe_click"
                className="bg-accent text-on-accent rounded-pill mt-5 inline-flex shrink-0 px-5 py-3 text-sm font-semibold no-underline sm:mt-0"
              >
                {lang === 'uk' ? 'Підписатися' : 'Subscribe'}
              </Link>
            </section>
          </div>
        </div>
      </article>
    </div>
  );
}
