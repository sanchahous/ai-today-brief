import React, { useState } from 'react';
import type { ProtoCategory, Lang } from './data';
import { CATEGORIES, searchPosts } from './data';
import { useProto } from './ProtoContext';
import { useReveal } from './hooks';
import { CategoryGlyph, SearchIcon } from './icons';
import { POPULAR_QUERIES } from './copy';
import { track } from './analytics';

// ── Reveal wrapper ────────────────────────────────────────────────────────────
export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  style,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  as?: keyof React.JSX.IntrinsicElements;
  style?: React.CSSProperties;
  className?: string;
}) {
  const ref = useReveal<HTMLElement>();
  return React.createElement(
    Tag,
    {
      ref,
      className: `reveal ${className}`,
      style: { transitionDelay: `${delay}ms`, ...style },
    },
    children,
  );
}

// ── Category badge (coloured pill) ────────────────────────────────────────────
export function Badge({
  category,
  lang,
  size = 'sm',
}: {
  category: ProtoCategory;
  lang: Lang;
  size?: 'sm' | 'md';
}) {
  const fs = size === 'md' ? '0.78rem' : '0.68rem';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: size === 'md' ? '0.3rem 0.7rem' : '0.2rem 0.55rem',
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: category.color,
        background: `${category.color}1f`,
        border: `1px solid ${category.color}55`,
        borderRadius: '999px',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
    >
      {category.name[lang]}
    </span>
  );
}

// ── Category icon thumbnail (post list) ───────────────────────────────────────
export function CategoryThumb({
  category,
  size = 120,
  rounded = true,
}: {
  category: ProtoCategory;
  size?: number;
  rounded?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={category.name.en}
      style={{
        width: '100%',
        aspectRatio: '1 / 1',
        maxWidth: size,
        display: 'grid',
        placeItems: 'center',
        borderRadius: rounded ? 'var(--radius-sm)' : 0,
        color: category.color,
        background: `linear-gradient(140deg, ${category.color}33, ${category.color}14)`,
        border: `1px solid ${category.color}44`,
      }}
    >
      <CategoryGlyph icon={category.icon} size={Math.round(size * 0.34)} strokeWidth={1.5} />
    </div>
  );
}

// ── Category banner (16:9, gradient + motif + glyph) ──────────────────────────
export function CategoryBanner({
  category,
  lang,
  variant = 'card',
  motif = 0,
  showLabel = true,
  videoBadge = false,
  videoLabel,
}: {
  category: ProtoCategory;
  lang: Lang;
  variant?: 'card' | 'hero';
  motif?: number;
  showLabel?: boolean;
  videoBadge?: boolean;
  videoLabel?: string;
}) {
  const color = category.color;
  const m = (((motif % 3) + 3) % 3) as 0 | 1 | 2;
  const id = `${category.slug}-${m}`;
  const glyphSize = variant === 'hero' ? 88 : 60;

  return (
    <div
      role="img"
      aria-label={`${category.name[lang]} banner`}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        overflow: 'hidden',
        borderRadius: variant === 'hero' ? 'var(--radius)' : 'var(--radius-sm)',
        background: `linear-gradient(135deg, ${color}cc 0%, ${color}55 60%, ${color}22 100%)`,
        border: `1px solid ${color}55`,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 320 180"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <defs>
          <pattern id={`dots-${id}`} width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" fill={color} fillOpacity="0.22" />
          </pattern>
        </defs>
        {m === 0 && (
          <>
            <circle cx="320" cy="180" r="60" fill="none" stroke={`${color}66`} strokeWidth="1" />
            <circle cx="320" cy="180" r="110" fill="none" stroke={`${color}55`} strokeWidth="1" />
            <circle cx="320" cy="180" r="170" fill="none" stroke={`${color}33`} strokeWidth="1" />
          </>
        )}
        {m === 1 && (
          <>
            <line x1="0" y1="40" x2="320" y2="-20" stroke={`${color}55`} strokeWidth="1" />
            <line x1="0" y1="90" x2="320" y2="30" stroke={`${color}44`} strokeWidth="1" />
            <line x1="0" y1="140" x2="320" y2="80" stroke={`${color}33`} strokeWidth="1" />
          </>
        )}
        {m === 2 && (
          <g stroke={`${color}33`} strokeWidth="1">
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={i} x1={50 + i * 50} y1="-10" x2={20 + i * 50} y2="190" />
            ))}
          </g>
        )}
        <rect x="0" y="0" width="320" height="180" fill={`url(#dots-${id})`} />
      </svg>

      {/* Oversized glyph watermark */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: variant === 'hero' ? '1.25rem' : '0.75rem',
          bottom: variant === 'hero' ? '1rem' : '0.6rem',
          color: '#fff',
          opacity: 0.85,
          filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.35))',
        }}
      >
        <CategoryGlyph icon={category.icon} size={glyphSize} strokeWidth={1.3} />
      </div>

      {showLabel && (
        <span
          style={{
            position: 'absolute',
            top: '0.6rem',
            left: '0.6rem',
            padding: variant === 'hero' ? '0.35rem 0.8rem' : '0.2rem 0.5rem',
            fontSize: variant === 'hero' ? '0.8rem' : '0.62rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#fff',
            background: 'rgba(0,0,0,0.42)',
            border: `1px solid ${color}aa`,
            borderRadius: '999px',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            whiteSpace: 'nowrap',
          }}
        >
          {category.name[lang]}
        </span>
      )}

      {videoBadge && (
        <span
          className="pulse"
          style={{
            position: 'absolute',
            bottom: '0.6rem',
            left: '0.6rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.6rem',
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#fff',
            background: 'rgba(0,0,0,0.55)',
            borderRadius: '999px',
            backdropFilter: 'blur(6px)',
          }}
        >
          <span
            style={{
              width: 0,
              height: 0,
              borderLeft: '7px solid #fff',
              borderTop: '4px solid transparent',
              borderBottom: '4px solid transparent',
            }}
          />
          {videoLabel}
        </span>
      )}
    </div>
  );
}

// ── Skeleton primitives ───────────────────────────────────────────────────────
export function SkeletonBox({
  w = '100%',
  h = 16,
  r = 6,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className="skeleton"
      style={{
        display: 'block',
        width: typeof w === 'number' ? `${w}px` : w,
        height: typeof h === 'number' ? `${h}px` : h,
        borderRadius: r,
        ...style,
      }}
    />
  );
}

// ── Search block (hero / compact) ─────────────────────────────────────────────
export function SearchBlock({
  variant = 'hero',
  align = 'center',
  showTitle = true,
}: {
  variant?: 'hero' | 'compact';
  align?: 'center' | 'left';
  showTitle?: boolean;
}) {
  const { t, lang, navigate } = useProto();
  const [q, setQ] = useState('');
  const big = variant === 'hero';
  const centered = align === 'center';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query) {
      track('search', {
        query,
        results: searchPosts(query, lang).length,
        source: big ? 'hero' : 'compact',
      });
    }
    navigate('news', { query });
  }

  return (
    <div>
      {big && showTitle && (
        <h2
          style={{
            fontSize: 'clamp(1.3rem, 3vw, 1.7rem)',
            marginBottom: '0.9rem',
            textAlign: centered ? 'center' : 'left',
          }}
        >
          {t('searchTitle')}
        </h2>
      )}
      <form
        onSubmit={submit}
        role="search"
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'stretch',
          maxWidth: big ? (centered ? 640 : 560) : '100%',
          margin: big && centered ? '0 auto' : undefined,
        }}
      >
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
            style={{
              width: '100%',
              padding: big ? '0.95rem 1rem 0.95rem 2.7rem' : '0.7rem 1rem 0.7rem 2.5rem',
              fontSize: big ? '1rem' : '0.9rem',
              fontFamily: 'var(--font-sans)',
              color: 'var(--color-text)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '999px',
              outline: 'none',
            }}
          />
        </div>
        <button type="submit" className="btn btn-primary" aria-label={t('searchButton')}>
          {t('searchButton')}
        </button>
      </form>

      {big && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            justifyContent: centered ? 'center' : 'flex-start',
            marginTop: '1rem',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.82rem', color: 'var(--color-faint)' }}>
            {t('searchPopular')}
          </span>
          {POPULAR_QUERIES[lang].map((query) => (
            <button
              key={query}
              onClick={() => {
                track('search', { query, source: 'popular' });
                navigate('news', { query });
              }}
              style={{
                fontSize: '0.82rem',
                padding: '0.3rem 0.75rem',
                color: 'var(--color-muted)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '999px',
                cursor: 'pointer',
              }}
            >
              {query}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
}) {
  const { t } = useProto();
  if (pageCount <= 1) return null;

  // Compact window around the current page with first/last anchors.
  const pages: (number | '…')[] = [];
  const push = (n: number) => pages.push(n);
  const window = 1;
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || (i >= page - window && i <= page + window)) push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  const btn = (active: boolean): React.CSSProperties => ({
    minWidth: 40,
    height: 40,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 0.6rem',
    fontSize: '0.9rem',
    fontWeight: active ? 700 : 500,
    color: active ? '#141414' : 'var(--color-text)',
    background: active ? 'var(--color-accent)' : 'transparent',
    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    borderRadius: '10px',
    cursor: 'pointer',
  });

  return (
    <nav
      aria-label="Pagination"
      style={{
        display: 'flex',
        gap: '0.4rem',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: '2.5rem',
      }}
    >
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="btn btn-ghost"
        style={{ opacity: page === 1 ? 0.4 : 1 }}
      >
        ‹ {t('prev')}
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} style={{ color: 'var(--color-faint)', padding: '0 0.2rem' }}>
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`${t('page')} ${p}`}
            style={btn(p === page)}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
        className="btn btn-ghost"
        style={{ opacity: page === pageCount ? 0.4 : 1 }}
      >
        {t('next')} ›
      </button>
    </nav>
  );
}

export const ALL_CATEGORIES = CATEGORIES;
