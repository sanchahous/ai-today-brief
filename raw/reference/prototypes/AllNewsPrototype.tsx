import React, { useEffect, useMemo, useRef, useState } from 'react';
import { POSTS, categoryBySlug, matchesQuery } from './data';
import type { ProtoPost } from './data';
import { useProto } from './ProtoContext';
import { useJsonLd, usePageMeta } from './hooks';
import { track } from './analytics';
import { Reveal, Pagination } from './ui';
import { PostCard, PostCardSkeleton } from './PostCard';
import { Sidebar } from './Sidebar';
import type { NewsFilters, DatePreset, SortMode } from './Sidebar';
import { WEEK_SUMMARY } from './copy';
import { SlidersIcon, CloseIcon } from './icons';
import { Feature, Breadcrumbs, Byline, SponsorCard, NewsletterBand } from './features';
import { SITE_URL as SITE } from './config';

const PAGE_SIZE = 6;

function daysAgo(n: number): number {
  return Date.now() - n * 86_400_000;
}

function withinPreset(iso: string, preset: DatePreset): boolean {
  if (preset === 'all') return true;
  const ts = new Date(iso).getTime();
  const span = preset === 'today' ? 1 : preset === 'week' ? 7 : 31;
  return ts >= daysAgo(span);
}

function sortPosts(rows: ProtoPost[], sort: SortMode): ProtoPost[] {
  const copy = [...rows];
  switch (sort) {
    case 'newest':
      return copy.sort((a, b) => b.date.localeCompare(a.date) || a.rank - b.rank);
    case 'oldest':
      return copy.sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank);
    case 'discussed':
      return copy.sort((a, b) => b.comments - a.comments);
    case 'relevance':
    default:
      return copy.sort((a, b) => a.rank - b.rank);
  }
}

export function AllNewsPrototype() {
  const { t, lang, loading, pendingCategory, pendingQuery, navigate } = useProto();

  usePageMeta({ page: 'news', lang, title: t('newsTitle'), description: t('newsLead') });

  const [filters, setFilters] = useState<NewsFilters>(() => ({
    q: pendingQuery,
    categories: pendingCategory ? [pendingCategory] : [],
    date: 'all',
    sort: 'newest',
  }));
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const firstRender = useRef(true);

  // Header search navigations land here while this page is already mounted —
  // pick up the new query without remounting.
  useEffect(() => {
    setFilters((f) => (f.q === pendingQuery ? f : { ...f, q: pendingQuery }));
  }, [pendingQuery]);

  // Short skeleton flash whenever the query changes — mimics a fetch.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setBusy(true);
    const id = window.setTimeout(() => setBusy(false), 480);
    return () => window.clearTimeout(id);
  }, [filters]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const filtered = useMemo(() => {
    const rows = POSTS.filter(
      (p) =>
        (filters.categories.length === 0 || filters.categories.includes(p.categorySlug)) &&
        withinPreset(p.date, filters.date) &&
        matchesQuery(p, filters.q, lang),
    );
    return sortPosts(rows, filters.sort);
  }, [filters, lang]);

  // Zero-result searches are a key search-quality signal — track them so the
  // "no results rate" can be monitored and A/B-improved.
  useEffect(() => {
    if (filters.q.trim() && filtered.length === 0) {
      track('search_no_results', { query: filters.q.trim() });
    }
  }, [filters.q, filtered.length]);

  // Facet counts honour the date filter but ignore the category selection —
  // standard faceted-search semantics.
  const facets = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of POSTS) {
      if (!withinPreset(p.date, filters.date)) continue;
      if (!matchesQuery(p, filters.q, lang)) continue;
      m.set(p.categorySlug, (m.get(p.categorySlug) ?? 0) + 1);
    }
    return m;
  }, [filters.date, filters.q, lang]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showSkeleton = loading || busy;
  const hasActive =
    filters.q.trim().length > 0 || filters.categories.length > 0 || filters.date !== 'all';
  // Single selected category → show its curated subtopics (soft subcategory).
  const activeCategory =
    filters.categories.length === 1 ? (categoryBySlug.get(filters.categories[0]) ?? null) : null;

  const toggleCategory = (slug: string) =>
    setFilters((f) => {
      const on = !f.categories.includes(slug);
      track('filter_category', { category: slug, enabled: on });
      return {
        ...f,
        categories: on ? [...f.categories, slug] : f.categories.filter((c) => c !== slug),
      };
    });
  const reset = () => {
    track('filters_reset', {});
    setFilters({ q: '', categories: [], date: 'all', sort: 'newest' });
  };

  // FEATURE F6 — ItemList structured data for the current result set.
  useJsonLd('news', {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t('newsTitle'),
    url: `${SITE}/${lang}/news`,
    numberOfItems: filtered.length,
    itemListElement: pageRows.map((p, i) => ({
      '@type': 'ListItem',
      position: (page - 1) * PAGE_SIZE + i + 1,
      name: p.title[lang],
    })),
  });

  return (
    <div className="shell" style={{ padding: '2.5rem 1.5rem' }}>
      {/* FEATURE F6 — breadcrumbs (BreadcrumbList schema) */}
      <Feature id="F6" label={t('breadcrumbHome')}>
        <Breadcrumbs
          items={[
            { label: t('breadcrumbHome'), page: 'home' },
            { label: t('newsTitle'), page: 'news' },
          ]}
        />
      </Feature>

      {/* Page header */}
      <header style={{ marginBottom: '1.2rem', maxWidth: 720 }}>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4.5vw, 2.7rem)', marginBottom: '0.6rem' }}>
          {t('newsTitle')}
        </h1>
        <p
          style={{
            fontSize: '1rem',
            color: 'var(--color-muted)',
            lineHeight: 1.6,
            margin: '0 0 1rem',
          }}
        >
          {t('newsLead')}
        </p>
        {/* FEATURE F6 — E-E-A-T byline (author + freshness + sources cited) */}
        <Feature id="F6" label={t('curatedBy')} inline>
          <Byline updated="2026-05-28" />
        </Feature>
      </header>

      {/* SEO summary — "this week at a glance" */}
      <Reveal>
        <section
          aria-labelledby="summary-title"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderLeft: '3px solid var(--color-accent)',
            borderRadius: '0 var(--radius) var(--radius) 0',
            padding: '1.3rem 1.4rem',
            marginBottom: '2rem',
          }}
        >
          <h2
            id="summary-title"
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              marginBottom: '0.7rem',
            }}
          >
            {t('summaryTitle')}
          </h2>
          {WEEK_SUMMARY[lang].map((para, i) => (
            <p
              key={i}
              style={{
                fontSize: '0.95rem',
                lineHeight: 1.7,
                color: 'var(--color-text)',
                margin: i === 0 ? '0 0 0.7rem' : 0,
              }}
            >
              {para}
            </p>
          ))}
        </section>
      </Reveal>

      {/* Subtopics — the curated "soft subcategory" facets for the active
          category (concept-hub internal links + scannable refinement). */}
      {activeCategory?.subtopics && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1.6rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-faint)', alignSelf: 'center' }}>
            {t('subtopicsLabel')}:
          </span>
          {activeCategory.subtopics.map((st) => (
            <button
              key={st}
              className="topic-chip"
              onClick={() => navigate('news', { query: st })}
              style={{
                fontSize: '0.8rem',
                padding: '0.3rem 0.75rem',
                color: 'var(--color-text)',
                background: 'var(--color-surface)',
                border: `1px solid ${activeCategory.color}55`,
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      )}

      <div className="news-layout">
        <Sidebar
          filters={filters}
          facets={facets}
          onToggleCategory={toggleCategory}
          onDate={(d) => {
            track('filter_date', { range: d });
            setFilters((f) => ({ ...f, date: d }));
          }}
          onSort={(s) => {
            track('sort_change', { sort: s });
            setFilters((f) => ({ ...f, sort: s }));
          }}
          onReset={reset}
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
          hasActive={hasActive}
        />

        <section aria-label={t('newsTitle')} style={{ minWidth: 0 }}>
          {/* Result toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
              marginBottom: '1.2rem',
            }}
          >
            <p
              style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-muted)' }}
              aria-live="polite"
            >
              {showSkeleton ? t('loading') : `${t('resultsCount')} ${filtered.length}`}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="proto-sort-top" className="sr-only">
                {t('sortLabel')}
              </label>
              <select
                id="proto-sort-top"
                value={filters.sort}
                onChange={(e) => {
                  const sort = e.target.value as SortMode;
                  track('sort_change', { sort });
                  setFilters((f) => ({ ...f, sort }));
                }}
                style={{
                  fontSize: '0.85rem',
                  padding: '0.5rem 0.6rem',
                  color: 'var(--color-text)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <option value="newest">{t('sortNewest')}</option>
                <option value="oldest">{t('sortOldest')}</option>
                <option value="relevance">{t('sortRelevance')}</option>
                <option value="discussed">{t('sortDiscussed')}</option>
              </select>
              <button
                className="mobile-only btn btn-ghost"
                onClick={() => setDrawerOpen(true)}
                style={{ padding: '0.5rem 0.85rem' }}
              >
                <SlidersIcon size={16} /> {t('filters')}
                {hasActive
                  ? ` · ${filters.categories.length + (filters.date !== 'all' ? 1 : 0)}`
                  : ''}
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {hasActive && !showSkeleton && (
            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1.3rem' }}
            >
              {filters.q.trim() && (
                <button
                  onClick={() => setFilters((f) => ({ ...f, q: '' }))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.3rem 0.7rem',
                    fontSize: '0.78rem',
                    color: 'var(--color-accent)',
                    background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)',
                    borderRadius: 999,
                    cursor: 'pointer',
                  }}
                >
                  «{filters.q.trim()}» <CloseIcon size={13} />
                </button>
              )}
              {filters.categories.map((slug) => {
                const c = categoryBySlug.get(slug)!;
                return (
                  <button
                    key={slug}
                    onClick={() => toggleCategory(slug)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.3rem 0.7rem',
                      fontSize: '0.78rem',
                      color: c.color,
                      background: `${c.color}1f`,
                      border: `1px solid ${c.color}55`,
                      borderRadius: 999,
                      cursor: 'pointer',
                    }}
                  >
                    {c.name[lang]} <CloseIcon size={13} />
                  </button>
                );
              })}
              {filters.date !== 'all' && (
                <button
                  onClick={() => setFilters((f) => ({ ...f, date: 'all' }))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.3rem 0.7rem',
                    fontSize: '0.78rem',
                    color: 'var(--color-text)',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 999,
                    cursor: 'pointer',
                  }}
                >
                  {t(`date.${filters.date}`)} <CloseIcon size={13} />
                </button>
              )}
              <button
                onClick={reset}
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--color-accent)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {t('filterReset')}
              </button>
            </div>
          )}

          {/* Results */}
          {showSkeleton ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <PostCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3.5rem 1rem',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius)',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.3rem',
                  marginBottom: '0.4rem',
                }}
              >
                {t('emptyTitle')}
              </p>
              <p style={{ color: 'var(--color-muted)', marginBottom: '1.2rem' }}>
                {t('emptyBody')}
              </p>
              <button onClick={reset} className="btn btn-ghost" style={{ display: 'inline-flex' }}>
                {t('filterReset')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {pageRows.map((p, i) => (
                <React.Fragment key={p.id}>
                  <Reveal delay={i * 45}>
                    <PostCard post={p} />
                  </Reveal>
                  {/* FEATURE F2 — native sponsor woven into the feed */}
                  {i === 2 && (
                    <Reveal>
                      <Feature id="F2" label={t('sponsorLabel')}>
                        <SponsorCard />
                      </Feature>
                    </Reveal>
                  )}
                </React.Fragment>
              ))}

              {/* FEATURE F1 — inline subscribe prompt at the end of the feed */}
              <Reveal>
                <Feature id="F1" label={t('subEyebrow')}>
                  <NewsletterBand variant="inline" />
                </Feature>
              </Reveal>
            </div>
          )}

          {!showSkeleton && filtered.length > 0 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              onChange={(p) => {
                track('paginate', { to_page: p, page_count: pageCount });
                setPage(p);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
}
