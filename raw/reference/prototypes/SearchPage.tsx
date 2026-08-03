import React, { useEffect, useMemo, useState } from 'react';
import { useProto } from './ProtoContext';
import { usePageMeta } from './hooks';
import { searchPosts } from './data';
import { Breadcrumbs } from './features';
import { PostFeed } from './PostFeed';
import { SearchIcon } from './icons';
import { track } from './analytics';

export function SearchPage() {
  const { t, lang, routeParams, navigate } = useProto();
  const query = (routeParams.query ?? '').trim();
  const [q, setQ] = useState(query);

  // Keep the field in sync when navigation changes the query (e.g. a chip).
  useEffect(() => {
    setQ(query);
  }, [query]);

  const results = useMemo(() => (query ? searchPosts(query, lang) : []), [query, lang]);

  usePageMeta({
    page: 'search',
    lang,
    params: query ? { query } : {},
    title: query ? `${t('searchResultsFor')} «${query}»` : t('searchTitlePage'),
    description: query ? `${t('searchResultsFor')} «${query}»` : t('searchTitlePage'),
    noindex: true,
  });

  useEffect(() => {
    if (query && results.length === 0) track('search_no_results', { query });
  }, [query, results.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = q.trim();
    if (next) track('search', { query: next, results: searchPosts(next, lang).length, source: 'search_page' });
    navigate('search', next ? { query: next } : {});
  }

  return (
    <div className="shell" style={{ padding: '2.5rem 1.5rem 1rem' }}>
      <Breadcrumbs
        items={[
          { label: t('breadcrumbHome'), page: 'home' },
          { label: t('searchTitlePage'), page: 'search', params: query ? { query } : {} },
        ]}
      />

      <header style={{ maxWidth: 640, marginBottom: '1.8rem' }}>
        <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', marginBottom: '1rem' }}>
          {t('searchTitlePage')}
        </h1>
        <form onSubmit={submit} role="search" style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-muted)',
                display: 'flex',
              }}
            >
              <SearchIcon />
            </span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchAria')}
              autoFocus
              style={{
                width: '100%',
                padding: '0.85rem 1rem 0.85rem 2.7rem',
                fontSize: '1rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--color-text)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '999px',
                outline: 'none',
              }}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            {t('searchButton')}
          </button>
        </form>
      </header>

      {query && (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.95rem', margin: '0 0 1.4rem' }} aria-live="polite">
          {t('searchResultsFor')} «<strong style={{ color: 'var(--color-text)' }}>{query}</strong>» ·{' '}
          {results.length}
        </p>
      )}

      <PostFeed
        posts={results}
        resetKey={query}
        weaveSponsor={false}
        showNewsletter={false}
        emptyTitle={t('searchNoResults')}
        emptyBody={t('emptyBody')}
      />
    </div>
  );
}
