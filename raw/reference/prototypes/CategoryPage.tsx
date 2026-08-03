import React, { useMemo } from 'react';
import { useProto } from './ProtoContext';
import { usePageMeta, useJsonLd } from './hooks';
import { POSTS, categoryBySlug } from './data';
import { Breadcrumbs } from './features';
import { PostFeed } from './PostFeed';
import { NotFoundPage } from './NotFoundPage';
import { CategoryGlyph } from './icons';
import { SITE_URL } from './config';

export function CategoryPage() {
  const { t, lang, routeParams, navigate } = useProto();
  const slug = routeParams.categorySlug ?? '';
  const cat = categoryBySlug.get(slug);

  const posts = useMemo(
    () =>
      POSTS.filter((p) => p.categorySlug === slug).sort(
        (a, b) => b.date.localeCompare(a.date) || a.rank - b.rank,
      ),
    [slug],
  );

  usePageMeta({
    page: 'category',
    lang,
    params: { categorySlug: slug },
    title: cat ? cat.name[lang] : '404',
    description: cat ? cat.blurb[lang] : '',
    noindex: !cat,
  });
  useJsonLd('category', {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: cat?.name[lang] ?? '',
    description: cat?.blurb[lang] ?? '',
    url: `${SITE_URL}/${lang}/category/${slug}`,
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

  if (!cat) return <NotFoundPage />;

  return (
    <div className="shell" style={{ padding: '2.5rem 1.5rem 1rem' }}>
      <Breadcrumbs
        items={[
          { label: t('breadcrumbHome'), page: 'home' },
          { label: t('navNews'), page: 'news' },
          { label: cat.name[lang], page: 'category', params: { categorySlug: slug } },
        ]}
      />

      {/* Category header */}
      <header
        style={{
          display: 'flex',
          gap: '1.1rem',
          alignItems: 'flex-start',
          padding: '1.4rem',
          marginBottom: '1.8rem',
          borderRadius: 'var(--radius)',
          background: `linear-gradient(135deg, ${cat.color}1f, ${cat.color}08)`,
          border: `1px solid ${cat.color}44`,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 56,
            height: 56,
            flexShrink: 0,
            borderRadius: 14,
            color: cat.color,
            background: `${cat.color}1f`,
            border: `1px solid ${cat.color}55`,
          }}
        >
          <CategoryGlyph icon={cat.icon} size={30} strokeWidth={1.5} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', lineHeight: 1.15, marginBottom: '0.3rem' }}>
            {cat.name[lang]}
          </h1>
          <p style={{ fontSize: '0.95rem', color: cat.color, fontWeight: 500, margin: '0 0 0.6rem' }}>
            {cat.tagline[lang]} · {cat.count} {t('categoryArticles')}
          </p>
          <p style={{ fontSize: '0.95rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, maxWidth: 620 }}>
            {cat.blurb[lang]}
          </p>
          {cat.subtopics && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.9rem' }}>
              {cat.subtopics.map((st) => (
                <button
                  key={st}
                  className="topic-chip"
                  onClick={() => navigate('search', { query: st })}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.3rem 0.75rem',
                    color: 'var(--color-text)',
                    background: 'var(--color-surface)',
                    border: `1px solid ${cat.color}55`,
                    borderRadius: 999,
                    cursor: 'pointer',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <PostFeed posts={posts} resetKey={slug} />
    </div>
  );
}
