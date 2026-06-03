import React, { useEffect, useState } from 'react';
import type { ProtoPost } from './data';
import { useProto } from './ProtoContext';
import { Reveal, Pagination } from './ui';
import { PostCard, PostCardSkeleton } from './PostCard';
import { Feature, SponsorCard, NewsletterBand } from './features';
import { track } from './analytics';

const PAGE_SIZE = 6;

/**
 * Reusable post feed shared by the category, concept and search pages:
 * paginated PostCards, a woven native sponsor unit, a trailing newsletter
 * prompt, loading skeletons and an empty state. `resetKey` returns the feed to
 * page 1 when the underlying query/slug changes.
 */
export function PostFeed({
  posts,
  resetKey,
  weaveSponsor = true,
  showNewsletter = true,
  emptyTitle,
  emptyBody,
  onReset,
}: {
  posts: ProtoPost[];
  resetKey?: string;
  weaveSponsor?: boolean;
  showNewsletter?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  onReset?: () => void;
}) {
  const { t, loading } = useProto();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '3.5rem 1rem',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', marginBottom: '0.4rem' }}>
          {emptyTitle ?? t('emptyTitle')}
        </p>
        <p style={{ color: 'var(--color-muted)', marginBottom: onReset ? '1.2rem' : 0 }}>
          {emptyBody ?? t('emptyBody')}
        </p>
        {onReset && (
          <button onClick={onReset} className="btn btn-ghost" style={{ display: 'inline-flex' }}>
            {t('filterReset')}
          </button>
        )}
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const rows = posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {rows.map((p, i) => (
          <React.Fragment key={p.id}>
            <Reveal delay={i * 45}>
              <PostCard post={p} />
            </Reveal>
            {weaveSponsor && i === 2 && (
              <Reveal>
                <Feature id="F2" label={t('sponsorLabel')}>
                  <SponsorCard />
                </Feature>
              </Reveal>
            )}
          </React.Fragment>
        ))}

        {showNewsletter && (
          <Reveal>
            <Feature id="F1" label={t('subEyebrow')}>
              <NewsletterBand variant="inline" />
            </Feature>
          </Reveal>
        )}
      </div>

      {pageCount > 1 && (
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
    </>
  );
}
