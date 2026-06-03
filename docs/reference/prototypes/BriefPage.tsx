import React from 'react';
import { useProto } from './ProtoContext';
import { usePageMeta, useJsonLd } from './hooks';
import { findBrief, postById, categoryBySlug, postSlug } from './data';
import { Reveal, Badge } from './ui';
import { Breadcrumbs, AiDisclosureNote, NewsletterBand } from './features';
import { NotFoundPage } from './NotFoundPage';
import { ArrowRight } from './icons';
import { SITE_URL, SITE_NAME } from './config';

export function BriefPage() {
  const { t, lang, routeParams, navigate } = useProto();
  const brief = routeParams.briefSlug ? findBrief(routeParams.briefSlug) : undefined;

  const slug = brief?.slug ?? '';
  const items = (brief?.itemIds ?? []).map((id) => postById.get(id)).filter(Boolean);
  const pageUrl = `${SITE_URL}/${lang}/brief/${slug}`;

  usePageMeta({
    page: 'brief',
    lang,
    params: { briefSlug: slug },
    title: brief ? brief.title[lang] : '404',
    description: brief ? brief.intro[lang] : '',
    noindex: !brief,
  });
  useJsonLd('brief', {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: brief?.title[lang] ?? '',
    description: brief?.intro[lang] ?? '',
    url: pageUrl,
    inLanguage: lang,
    datePublished: brief?.date,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE_URL}/${lang}/` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p!.title[lang],
        url: `${SITE_URL}/${lang}/news/${postSlug(p!)}`,
      })),
    },
  });

  if (!brief) return <NotFoundPage />;

  const dateLabel = new Date(brief.date).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="shell" style={{ padding: '2.5rem 1.5rem 1rem' }}>
      <Breadcrumbs
        items={[
          { label: t('breadcrumbHome'), page: 'home' },
          { label: t('navNews'), page: 'news' },
          { label: brief.title[lang], page: 'brief', params: { briefSlug: slug } },
        ]}
      />

      <header style={{ maxWidth: 760, marginBottom: '1.8rem' }}>
        <p className="eyebrow" style={{ marginBottom: '0.6rem' }}>
          {dateLabel}
        </p>
        <h1 style={{ fontSize: 'clamp(1.9rem, 4.5vw, 2.8rem)', lineHeight: 1.12, marginBottom: '0.8rem' }}>
          {brief.title[lang]}
        </h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--color-muted)', lineHeight: 1.65, margin: '0 0 1rem' }}>
          {brief.intro[lang]}
        </p>
        <AiDisclosureNote />
      </header>

      <section style={{ maxWidth: 760 }}>
        <p
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-faint)',
            margin: '0 0 1rem',
          }}
        >
          {t('briefItemsLabel')} · {items.length}
        </p>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '1rem' }}>
          {items.map((p, i) => {
            const cat = categoryBySlug.get(p!.categorySlug)!;
            return (
              <Reveal key={p!.id} delay={i * 50}>
                <li
                  className="card-hover"
                  onClick={() => navigate('item', { itemSlug: postSlug(p!) })}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '1rem',
                    padding: '1.1rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '1.6rem',
                      fontWeight: 700,
                      color: 'var(--color-faint)',
                      lineHeight: 1,
                      minWidth: 30,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ marginBottom: '0.4rem' }}>
                      <Badge category={cat} lang={lang} />
                    </div>
                    <h3 style={{ fontSize: '1.15rem', lineHeight: 1.3, marginBottom: '0.4rem' }}>
                      {p!.title[lang]}
                    </h3>
                    <p style={{ fontSize: '0.92rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: '0 0 0.5rem' }}>
                      {p!.summary[lang]}
                    </p>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.8rem',
                        color: 'var(--color-accent)',
                        fontWeight: 600,
                      }}
                    >
                      {t('openFull')} <ArrowRight size={14} />
                    </span>
                  </div>
                </li>
              </Reveal>
            );
          })}
        </ol>

        <div style={{ marginTop: '2rem' }}>
          <button onClick={() => navigate('news')} className="btn btn-ghost" style={{ display: 'inline-flex' }}>
            {t('weekCta')} <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <section style={{ maxWidth: 760, marginTop: '3rem' }}>
        <NewsletterBand variant="inline" />
      </section>
    </div>
  );
}
