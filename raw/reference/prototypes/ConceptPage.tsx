import React, { useMemo } from 'react';
import { useProto } from './ProtoContext';
import { usePageMeta, useJsonLd } from './hooks';
import { CONCEPTS, conceptBySlug, postsForConcept } from './data';
import { Breadcrumbs } from './features';
import { PostFeed } from './PostFeed';
import { NotFoundPage } from './NotFoundPage';
import { CategoryGlyph, ArrowRight } from './icons';
import { SITE_URL } from './config';

export function ConceptPage() {
  const { t, lang, routeParams, navigate } = useProto();
  const slug = routeParams.conceptSlug ?? '';
  const concept = conceptBySlug.get(slug);

  const posts = useMemo(() => postsForConcept(slug, lang), [slug, lang]);

  usePageMeta({
    page: 'concept',
    lang,
    params: { conceptSlug: slug },
    title: concept ? concept.name[lang] : '404',
    description: concept ? concept.description[lang] : '',
    noindex: !concept,
  });
  useJsonLd('concept', {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: concept?.name[lang] ?? '',
    description: concept?.description[lang] ?? '',
    url: `${SITE_URL}/${lang}/concepts/${slug}`,
    inLanguage: lang,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: posts.length,
      itemListElement: posts.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.title[lang],
      })),
    },
  });

  if (!concept) return <NotFoundPage />;

  const others = CONCEPTS.filter((c) => c.slug !== slug);

  return (
    <div className="shell" style={{ padding: '2.5rem 1.5rem 1rem' }}>
      <Breadcrumbs
        items={[
          { label: t('breadcrumbHome'), page: 'home' },
          { label: concept.name[lang], page: 'concept', params: { conceptSlug: slug } },
        ]}
      />

      {/* Concept header */}
      <header style={{ maxWidth: 720, marginBottom: '1.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.7rem' }}>
          <span
            aria-hidden="true"
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 48,
              height: 48,
              flexShrink: 0,
              borderRadius: 12,
              color: 'var(--color-accent)',
              background: 'rgba(240,192,64,0.12)',
              border: '1px solid rgba(240,192,64,0.35)',
            }}
          >
            <CategoryGlyph icon={concept.icon} size={26} strokeWidth={1.6} />
          </span>
          <div>
            <p className="eyebrow" style={{ marginBottom: '0.2rem' }}>
              {t('trendingEyebrow')}
            </p>
            <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', lineHeight: 1.1 }}>
              {concept.name[lang]}
            </h1>
          </div>
        </div>
        <p style={{ fontSize: '1rem', color: 'var(--color-muted)', lineHeight: 1.65, margin: 0 }}>
          {concept.description[lang]}
        </p>
      </header>

      <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
        {t('conceptStories')} · {posts.length}
      </h2>
      <PostFeed posts={posts} resetKey={slug} showNewsletter={false} />

      {/* Other concepts */}
      <section style={{ marginTop: '3rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>{t('conceptOther')}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
          {others.map((c) => (
            <button
              key={c.slug}
              className="topic-chip"
              onClick={() => navigate('concept', { conceptSlug: c.slug })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                padding: '0.45rem 0.9rem',
                color: 'var(--color-text)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              <span style={{ color: 'var(--color-accent)', display: 'inline-flex' }}>
                <CategoryGlyph icon={c.icon} size={16} strokeWidth={1.7} />
              </span>
              {c.name[lang]}
              <ArrowRight size={14} style={{ color: 'var(--color-accent)' }} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
