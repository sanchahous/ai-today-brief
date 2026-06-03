import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useProto } from './ProtoContext';
import { SearchBlock, Badge } from './ui';
import { SearchIcon, CloseIcon } from './icons';
import { searchPosts, categoryBySlug, type ProtoPost, type Lang } from './data';
import { track } from './analytics';

/**
 * Search architecture
 * ───────────────────
 * The canonical search lives in the header. The Home page additionally shows a
 * big hero search on the first screen; as it scrolls out of view the header
 * search fades in — so the search visually "moves into the header".
 *
 *   • HeroSearch          — first-screen search + IntersectionObserver
 *   • HeaderSearchField    — desktop inline field + preview dropdown (≥768px)
 *   • MobileSearchTrigger  — mobile icon button (<768px)
 *   • MobileSearchBar      — mobile full-width search row + preview
 *   • SearchPreview        — shared, debounced top-5 results + "see all"
 *
 * The reveal transition is opacity/transform only (no layout work) so it stays
 * smooth and cheap on mobile, where Core Web Vitals matter most.
 */

const PREVIEW_LIMIT = 5;

function formatShort(iso: string, lang: Lang) {
  return new Date(iso).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}

export function HeroSearch() {
  const { setHeroSearchInView } = useProto();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setHeroSearchInView(false);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setHeroSearchInView(entry.isIntersecting), {
      // Offset the sticky header height so the hand-off happens exactly as the
      // hero field slides under the header.
      rootMargin: '-68px 0px 0px 0px',
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [setHeroSearchInView]);

  return (
    <div ref={ref}>
      {/* Left-aligned to sit inside the hero copy; the hero h1 already serves
          as the heading, so the search block's own title is suppressed. */}
      <SearchBlock variant="hero" align="left" showTitle={false} />
    </div>
  );
}

/** Debounced top-N results for the live preview. */
function useSearchResults(q: string) {
  const { lang } = useProto();
  const [state, setState] = useState<{ rows: ProtoPost[]; total: number }>({ rows: [], total: 0 });
  useEffect(() => {
    const s = q.trim();
    if (!s) {
      setState({ rows: [], total: 0 });
      return;
    }
    const id = window.setTimeout(() => {
      const all = searchPosts(s, lang);
      setState({ rows: all.slice(0, PREVIEW_LIMIT), total: all.length });
    }, 180);
    return () => window.clearTimeout(id);
  }, [q, lang]);
  return state;
}

/** Shared results dropdown used by the desktop field and the mobile bar. */
function SearchPreview({
  q,
  onNavigate,
  variant,
}: {
  q: string;
  onNavigate: () => void;
  variant: 'desktop' | 'mobile';
}) {
  const { t, lang, navigate } = useProto();
  const { rows, total } = useSearchResults(q);
  if (!q.trim()) return null;

  function selectResult(p: ProtoPost, position: number) {
    track('select_search_result', {
      query: q.trim(),
      post_id: p.id,
      position,
      category: p.categorySlug,
      source: variant,
    });
    navigate('news', { query: q });
    onNavigate();
  }

  function seeAll() {
    track('search', { query: q.trim(), results: total, source: `${variant}_see_all` });
    navigate('news', { query: q });
    onNavigate();
  }

  const desktop = variant === 'desktop';

  return (
    <div
      role="listbox"
      aria-label={t('searchAria')}
      style={{
        ...(desktop
          ? {
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-pop)',
              zIndex: 70,
            }
          : { borderTop: '1px solid var(--color-border)', marginTop: '0.6rem' }),
        padding: '0.4rem',
        maxHeight: '60vh',
        overflowY: 'auto',
      }}
    >
      {rows.length === 0 ? (
        <p
          style={{
            padding: '0.75rem',
            margin: 0,
            fontSize: '0.85rem',
            color: 'var(--color-muted)',
          }}
        >
          {t('searchNoResults')}
        </p>
      ) : (
        rows.map((p, i) => {
          const cat = categoryBySlug.get(p.categorySlug)!;
          return (
            <button
              key={p.id}
              role="option"
              aria-selected={false}
              className="search-row"
              onClick={() => selectResult(p, i + 1)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.55rem 0.65rem',
                background: 'none',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  gap: '0.45rem',
                  alignItems: 'center',
                  marginBottom: '0.25rem',
                }}
              >
                <Badge category={cat} lang={lang} />
                <span style={{ fontSize: '0.72rem', color: 'var(--color-faint)' }}>
                  {p.source} · {formatShort(p.date, lang)}
                </span>
              </span>
              <span
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontSize: '0.88rem',
                  lineHeight: 1.35,
                  color: 'var(--color-text)',
                }}
              >
                {p.title[lang]}
              </span>
            </button>
          );
        })
      )}

      {total > PREVIEW_LIMIT && (
        <button
          onClick={seeAll}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '0.65rem',
            marginTop: '0.2rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--color-accent)',
            background: 'var(--color-surface)',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          {t('seeAll').replace('{n}', String(total))} →
        </button>
      )}
    </div>
  );
}

export function HeaderSearchField({ visible }: { visible: boolean }) {
  const { t, lang, navigate } = useProto();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query)
      track('search', { query, results: searchPosts(query, lang).length, source: 'header' });
    navigate('news', { query });
    setQ('');
    setOpen(false);
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 380,
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(-6px)',
        visibility: visible ? 'visible' : 'hidden',
        transition: 'opacity 0.25s var(--ease), transform 0.25s var(--ease), visibility 0.25s',
      }}
    >
      <form onSubmit={submit} role="search" style={{ position: 'relative' }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '0.85rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-muted)',
            display: 'flex',
            pointerEvents: 'none',
          }}
        >
          <SearchIcon size={17} />
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t('searchHeaderPlaceholder')}
          aria-label={t('searchAria')}
          tabIndex={visible ? 0 : -1}
          style={{
            width: '100%',
            padding: '0.55rem 0.9rem 0.55rem 2.5rem',
            fontSize: '0.9rem',
            fontFamily: 'var(--font-sans)',
            color: 'var(--color-text)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 999,
            outline: 'none',
          }}
        />
      </form>
      {visible && open && (
        <SearchPreview
          q={q}
          variant="desktop"
          onNavigate={() => {
            setQ('');
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function MobileSearchTrigger({ visible, onOpen }: { visible: boolean; onOpen: () => void }) {
  const { t } = useProto();
  return (
    <button
      onClick={onOpen}
      aria-label={t('openSearch')}
      tabIndex={visible ? 0 : -1}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 38,
        height: 38,
        color: 'var(--color-text)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.25s var(--ease)',
      }}
    >
      <SearchIcon size={20} />
    </button>
  );
}

export function MobileSearchBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, navigate } = useProto();
  const reduce = useReducedMotion();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQ('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query)
      track('search', { query, results: searchPosts(query, lang).length, source: 'mobile' });
    navigate('news', { query });
    setQ('');
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="hdr-search-mobile-bar"
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{ overflow: 'hidden', borderTop: '1px solid var(--color-border)' }}
        >
          <div style={{ padding: '0.7rem 1.25rem 0.9rem' }}>
            <form
              onSubmit={submit}
              role="search"
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
              <div style={{ position: 'relative', flex: 1 }}>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-muted)',
                    display: 'flex',
                    pointerEvents: 'none',
                  }}
                >
                  <SearchIcon size={17} />
                </span>
                <input
                  ref={inputRef}
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('searchHeaderPlaceholder')}
                  aria-label={t('searchAria')}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.9rem 0.6rem 2.5rem',
                    fontSize: '0.95rem',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--color-text)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 999,
                    outline: 'none',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('closeSearch')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 38,
                  height: 38,
                  flexShrink: 0,
                  color: 'var(--color-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <CloseIcon />
              </button>
            </form>
            <SearchPreview q={q} variant="mobile" onNavigate={onClose} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
