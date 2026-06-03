import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ProtoPost } from './data';
import { categoryBySlug, postSlug } from './data';
import { useProto } from './ProtoContext';
import { track } from './analytics';
import { Badge, CategoryThumb } from './ui';
import { Bookmark, ShareIcon, CommentIcon, PlayIcon, ClockIcon, ArrowRight } from './icons';
import { SITE_URL } from './config';
import { StoryBody } from './StoryBody';

function formatDate(iso: string, lang: 'uk' | 'en') {
  return new Date(iso).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * The list/feed unit. Collapsed it shows a category-icon thumbnail; expanded
 * it swaps in the full deep-dive analysis (shared StoryBody). The action bar
 * wires up the *future* features (save, share, comments, video) as real,
 * reachable affordances so the prototype communicates the full product surface.
 */
export function PostCard({ post }: { post: ProtoPost }) {
  const { lang, t, savedIds, toggleSaved, navigate } = useProto();
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // FEATURE F5 — save state is shared via context so the Saved drawer reflects it.
  const saved = savedIds.includes(post.id);
  const cat = categoryBySlug.get(post.categorySlug)!;
  const contentId = `post-${post.id}-body`;

  // Expanding a card = primary content-engagement signal (read intent).
  function toggleExpand() {
    setExpanded((e) => {
      if (!e) track('post_expand', { post_id: post.id, category: post.categorySlug });
      return !e;
    });
  }

  function copyLink() {
    const url = `${SITE_URL}/${lang}/news#${post.id}`;
    void navigator.clipboard?.writeText(url).catch(() => {});
    track('share', { post_id: post.id, method: 'copy_link' });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const iconBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.8rem',
    fontWeight: 500,
    padding: '0.4rem 0.7rem',
    color: 'var(--color-muted)',
    background: 'transparent',
    border: '1px solid var(--color-border)',
    borderRadius: '999px',
    cursor: 'pointer',
  };

  return (
    <article
      className="card-hover"
      id={post.id}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '1.1rem',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="post-grid">
        {/* Thumbnail — collapses to a glyph tile, the "mini icon" requirement */}
        <button
          onClick={toggleExpand}
          aria-expanded={expanded}
          aria-controls={contentId}
          aria-label={post.title[lang]}
          style={{
            display: 'block',
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <CategoryThumb category={cat} size={92} />
        </button>

        <div style={{ minWidth: 0 }}>
          {/* Meta row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              flexWrap: 'wrap',
              marginBottom: '0.5rem',
            }}
          >
            <Badge category={cat} lang={lang} />
            <span style={{ fontSize: '0.74rem', color: 'var(--color-faint)' }}>
              {post.source} · {formatDate(post.date, lang)}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.74rem',
                color: 'var(--color-faint)',
              }}
            >
              <ClockIcon size={13} /> {post.readMinutes} {t('readMin')}
            </span>
            {post.hasVideo && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: cat.color,
                }}
              >
                <PlayIcon size={14} /> {t('watchVideo')}
              </span>
            )}
          </div>

          {/* Headline → full story permalink */}
          <h3
            style={{
              fontSize: '1.18rem',
              lineHeight: 1.35,
              marginBottom: '0.45rem',
              cursor: 'pointer',
            }}
            onClick={() => navigate('item', { itemSlug: postSlug(post) })}
          >
            {post.title[lang]}
          </h3>

          <p
            style={{
              fontSize: '0.92rem',
              lineHeight: 1.6,
              color: 'var(--color-muted)',
              margin: '0 0 0.85rem',
            }}
          >
            {post.summary[lang]}
          </p>

          {/* Action bar — provisioned future features */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              position: 'relative',
            }}
          >
            <button
              onClick={toggleExpand}
              aria-expanded={expanded}
              aria-controls={contentId}
              style={{
                ...iconBtn,
                color: 'var(--color-text)',
                borderColor: 'var(--color-border)',
              }}
            >
              {expanded ? t('readLess') : t('readMore')}
              <ArrowRight
                size={15}
                style={{
                  transform: expanded ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.2s var(--ease)',
                }}
              />
            </button>

            <button
              onClick={() => toggleSaved(post.id)}
              aria-pressed={saved}
              style={{
                ...iconBtn,
                color: saved ? cat.color : 'var(--color-muted)',
                borderColor: saved ? `${cat.color}88` : 'var(--color-border)',
              }}
            >
              <Bookmark size={15} filled={saved} />
              {saved ? t('saved') : t('save')}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShareOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={shareOpen}
                style={iconBtn}
              >
                <ShareIcon size={15} />
                {t('share')}
              </button>
              <AnimatePresence>
                {shareOpen && (
                  <motion.div
                    role="menu"
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    transition={{ duration: 0.16 }}
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 8px)',
                      left: 0,
                      zIndex: 30,
                      minWidth: 190,
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '10px',
                      boxShadow: 'var(--shadow-pop)',
                      padding: '0.35rem',
                    }}
                  >
                    {[
                      { label: t('shareOnX'), key: 'x' },
                      { label: t('shareOnLinkedin'), key: 'li' },
                    ].map((opt) => (
                      <a
                        key={opt.key}
                        href="#"
                        role="menuitem"
                        onClick={(e) => {
                          e.preventDefault();
                          track('share', { post_id: post.id, method: opt.key });
                          setShareOpen(false);
                        }}
                        style={{
                          display: 'block',
                          padding: '0.55rem 0.7rem',
                          fontSize: '0.85rem',
                          color: 'var(--color-text)',
                          textDecoration: 'none',
                          borderRadius: '7px',
                        }}
                      >
                        {opt.label}
                      </a>
                    ))}
                    <button
                      role="menuitem"
                      onClick={() => {
                        copyLink();
                        setShareOpen(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.55rem 0.7rem',
                        fontSize: '0.85rem',
                        color: 'var(--color-accent)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: '7px',
                      }}
                    >
                      {copied ? t('copied') : t('copyLink')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              style={{ ...iconBtn, cursor: 'not-allowed', opacity: 0.7 }}
              title={t('soon')}
              aria-disabled="true"
            >
              <CommentIcon size={15} />
              {t('comments')} · {post.comments}
              <span style={{ fontSize: '0.66rem', color: 'var(--color-faint)' }}>
                ({t('soon')})
              </span>
            </button>
          </div>

          {/* Expanded body: shared deep-dive analysis */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                id={contentId}
                initial={reduce ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <StoryBody post={post} compactHeader />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </article>
  );
}

// ── Skeleton variant of the post card ─────────────────────────────────────────
export function PostCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '1.1rem',
      }}
    >
      <div className="post-grid">
        <span
          className="skeleton"
          style={{
            display: 'block',
            width: '100%',
            aspectRatio: '1/1',
            maxWidth: 132,
            borderRadius: 8,
          }}
        />
        <div>
          <span
            className="skeleton"
            style={{
              display: 'block',
              width: 140,
              height: 18,
              borderRadius: 999,
              marginBottom: 10,
            }}
          />
          <span
            className="skeleton"
            style={{ display: 'block', width: '92%', height: 20, marginBottom: 8 }}
          />
          <span
            className="skeleton"
            style={{ display: 'block', width: '70%', height: 20, marginBottom: 14 }}
          />
          <span
            className="skeleton"
            style={{ display: 'block', width: '100%', height: 13, marginBottom: 6 }}
          />
          <span className="skeleton" style={{ display: 'block', width: '85%', height: 13 }} />
        </div>
      </div>
    </div>
  );
}
