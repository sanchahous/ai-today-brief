import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useProto } from './ProtoContext';
import { useJsonLd } from './hooks';
import { track } from './analytics';
import {
  FAQS,
  SPONSOR,
  TRENDING_TOPICS,
  postById,
  categoryBySlug,
  postSlug,
  conceptBySlug,
  type TrendingTopic,
} from './data';
import { Badge } from './ui';
import {
  ArrowRight,
  CloseIcon,
  Bookmark,
  CategoryGlyph,
  MailIcon,
  CheckIcon,
  ShieldIcon,
  SparkleIcon,
} from './icons';
import { SITE_URL as SITE } from './config';
import { buildPath, type ProtoPage, type RouteParams } from './routes';

/* ───────────────────────────────────────────────────────────────────────────
   Feature spotlight wrapper
   When the prototype toolbar's "Highlight features" toggle is on, every
   research-backed addition is outlined and tagged FEATURE · F# so reviewers
   can see exactly what's new and why. Off by default → clean commercial look.
   ─────────────────────────────────────────────────────────────────────────── */
export function Feature({
  id,
  label,
  children,
  inline = false,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  const { featureSpotlight } = useProto();
  if (!featureSpotlight) return <>{children}</>;
  return (
    <div
      data-feature={id}
      style={{
        position: 'relative',
        outline: '1.5px dashed var(--color-accent)',
        outlineOffset: 4,
        borderRadius: 'var(--radius-sm)',
        display: inline ? 'inline-block' : 'block',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: -11,
          right: 8,
          zIndex: 5,
          fontSize: '0.6rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#141414',
          background: 'var(--color-accent)',
          padding: '0.12rem 0.5rem',
          borderRadius: 999,
          whiteSpace: 'nowrap',
        }}
      >
        Feature · {id} — {label}
      </span>
      {children}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   FEATURE F1 — Email digest subscription
   Why: sponsorships are the #1 revenue model for AI newsletters, and they
   ride on list size — the email list is the monetisable asset. Single field +
   subscriber-count social proof + referral hook follow conversion best
   practice (referrals convert ~32% at ~$0.17/sub).
   ─────────────────────────────────────────────────────────────────────────── */
export function NewsletterBand({
  variant = 'band',
  showHeader = true,
}: {
  variant?: 'band' | 'inline';
  /** Hide the eyebrow/title/body — used when the host page provides its own. */
  showHeader?: boolean;
}) {
  const { t } = useProto();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const inline = variant === 'inline';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim()) {
      track('newsletter_subscribe', { placement: variant });
      setDone(true);
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--color-border)',
        background:
          'radial-gradient(120% 160% at 0% 0%, rgba(240,192,64,0.14), transparent 55%), var(--color-surface)',
        padding: inline ? '1.4rem' : 'clamp(1.6rem, 4vw, 2.6rem)',
      }}
    >
      {showHeader && (
        <>
          <p className="eyebrow" style={{ marginBottom: '0.6rem' }}>
            {t('subEyebrow')}
          </p>
          <h2
            style={{
              fontSize: inline ? '1.3rem' : 'clamp(1.5rem, 3.4vw, 2.1rem)',
              marginBottom: '0.5rem',
            }}
          >
            {t('subTitle')}
          </h2>
          <p
            style={{
              color: 'var(--color-muted)',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              margin: '0 0 1.2rem',
              maxWidth: 540,
            }}
          >
            {t('subBody')}
          </p>
        </>
      )}

      {done ? (
        <p
          role="status"
          style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-accent)', margin: 0 }}
        >
          {t('subDone')}
        </p>
      ) : (
        <>
          <form
            onSubmit={submit}
            style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', maxWidth: 480 }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('subPlaceholder')}
              aria-label={t('subPlaceholder')}
              style={{
                flex: '1 1 220px',
                padding: '0.8rem 1rem',
                fontSize: '0.95rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--color-text)',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 999,
                outline: 'none',
              }}
            />
            <button type="submit" className="btn btn-primary">
              {t('subButton')} <ArrowRight size={16} />
            </button>
          </form>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginTop: '0.9rem',
              flexWrap: 'wrap',
            }}
          >
            <SubscriberAvatars />
            <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
              <strong style={{ color: 'var(--color-text)' }}>24,800+</strong> {t('subProof')}
            </span>
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--color-faint)', margin: '0.7rem 0 0' }}>
            {t('subReferral')}
          </p>
          <p style={{ fontSize: '0.7rem', color: 'var(--color-faint)', margin: '0.3rem 0 0' }}>
            {t('subPrivacy')}
          </p>
        </>
      )}
    </div>
  );
}

function SubscriberAvatars() {
  const colors = ['#47E4D3', '#B58CF7', '#F4C26B', '#5BC9F0'];
  return (
    <div aria-hidden="true" style={{ display: 'flex' }}>
      {colors.map((c, i) => (
        <span
          key={c}
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: `linear-gradient(140deg, ${c}, ${c}66)`,
            border: '2px solid var(--color-surface)',
            marginLeft: i === 0 ? 0 : -8,
          }}
        />
      ))}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   FEATURE F2 — Native sponsor slot
   Why: the dominant revenue model for this product type. Rendered as a clearly
   disclosed native unit ("Sponsored" + "why am I seeing this?") per native-ad
   best practice — monetisation that doesn't break the reading experience.
   ─────────────────────────────────────────────────────────────────────────── */
export function SponsorCard() {
  const { t, lang, navigate } = useProto();
  const [whyOpen, setWhyOpen] = useState(false);
  const s = SPONSOR;
  return (
    <article
      className="card-hover"
      style={{
        position: 'relative',
        background: `linear-gradient(135deg, ${s.color}14, transparent 60%), var(--color-surface)`,
        border: `1px solid ${s.color}55`,
        borderRadius: 'var(--radius)',
        padding: '1.1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.7rem',
        }}
      >
        <span
          style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: s.color,
            border: `1px solid ${s.color}66`,
            borderRadius: 999,
            padding: '0.15rem 0.5rem',
          }}
        >
          {t('sponsorLabel')}
        </span>
        <div style={{ position: 'relative' }} onMouseLeave={() => setWhyOpen(false)}>
          <button
            onClick={() => setWhyOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={whyOpen}
            style={{
              fontSize: '0.68rem',
              color: 'var(--color-faint)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline dotted',
              padding: 0,
            }}
          >
            {t('sponsorWhy')}
          </button>
          <AnimatePresence>
            {whyOpen && (
              <motion.div
                role="dialog"
                aria-label={t('sponsorWhyTitle')}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.16 }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  zIndex: 20,
                  width: 250,
                  maxWidth: '80vw',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-pop)',
                  padding: '0.9rem',
                  textAlign: 'left',
                }}
              >
                <strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>
                  {t('sponsorWhyTitle')}
                </strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', lineHeight: 1.5, margin: '0 0 0.6rem' }}>
                  {t('sponsorWhyBody')}
                </p>
                <button
                  onClick={() => {
                    setWhyOpen(false);
                    navigate('advertise');
                  }}
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--color-accent)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {t('sponsorWhyCta')} →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '0.6rem' }}>
        <span
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 42,
            height: 42,
            borderRadius: 11,
            fontWeight: 800,
            fontSize: '1.05rem',
            color: '#141414',
            background: s.color,
            flexShrink: 0,
          }}
        >
          {s.brand[0]}
        </span>
        <h3 style={{ fontSize: '1.05rem', margin: 0, minWidth: 0 }}>
          {s.brand} — {s.tagline[lang]}
        </h3>
      </div>
      <p
        style={{
          fontSize: '0.88rem',
          color: 'var(--color-muted)',
          lineHeight: 1.55,
          margin: '0 0 1rem',
        }}
      >
        {s.body[lang]}
      </p>
      <a
        href={s.url}
        className="btn btn-ghost"
        onClick={() => track('sponsor_click', { brand: s.brand })}
        style={{ borderColor: `${s.color}66`, color: s.color }}
      >
        {s.cta[lang]} <ArrowRight size={15} />
      </a>
    </article>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   FEATURE F3 — SEO FAQ + FAQPage schema
   Why: answer-led content that targets long-tail/conversational queries and
   feeds FAQPage JSON-LD for AI/answer engines (AEO/GEO). Accessible accordion.
   ─────────────────────────────────────────────────────────────────────────── */
export function FaqSection() {
  const { t, lang } = useProto();
  const [open, setOpen] = useState<number | null>(0);

  useJsonLd('faq', {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q[lang],
      acceptedAnswer: { '@type': 'Answer', text: f.a[lang] },
    })),
  });

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: '0.6rem' }}>
        {t('faqEyebrow')}
      </p>
      <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)', marginBottom: '0.4rem' }}>
        {t('faqTitle')}
      </h2>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.95rem', margin: '0 0 1.6rem' }}>
        {t('faqSubtitle')}
      </p>

      <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 760 }}>
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              <h3 style={{ margin: 0 }}>
                <button
                  onClick={() => {
                    if (!isOpen) track('faq_open', { question_index: i });
                    setOpen(isOpen ? null : i);
                  }}
                  aria-expanded={isOpen}
                  aria-controls={`faq-a-${i}`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    padding: '1rem 1.1rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.02rem',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                  }}
                >
                  {f.q[lang]}
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      color: 'var(--color-accent)',
                      fontSize: '1.3rem',
                      lineHeight: 1,
                      transform: isOpen ? 'rotate(45deg)' : 'none',
                      transition: 'transform 0.2s var(--ease)',
                    }}
                  >
                    +
                  </span>
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={`faq-a-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p
                      style={{
                        padding: '0 1.1rem 1.1rem',
                        margin: 0,
                        fontSize: '0.92rem',
                        lineHeight: 1.65,
                        color: 'var(--color-muted)',
                      }}
                    >
                      {f.a[lang]}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   FEATURE F4 — Trending topics (concept hubs)
   Why: a weighted tag cloud that links into /concepts/:slug hub pages builds
   the hub-and-spoke internal-linking structure SEO rewards (topical authority)
   and gives readers a fast discovery path. Momentum arrows add a freshness cue.
   ─────────────────────────────────────────────────────────────────────────── */
function MomentumMark({ m }: { m: TrendingTopic['momentum'] }) {
  if (m === 'up') return <span style={{ color: '#9CD66F', fontSize: '0.7rem' }}>▲</span>;
  if (m === 'new')
    return (
      <span
        style={{
          fontSize: '0.56rem',
          fontWeight: 700,
          color: 'var(--color-accent)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        new
      </span>
    );
  return <span style={{ color: 'var(--color-faint)', fontSize: '0.7rem' }}>–</span>;
}

export function TrendingTopics({ variant = 'section' }: { variant?: 'section' | 'sidebar' }) {
  const { t, navigate } = useProto();
  const max = Math.max(...TRENDING_TOPICS.map((x) => x.mentions));
  const min = Math.min(...TRENDING_TOPICS.map((x) => x.mentions));
  const sidebar = variant === 'sidebar';

  const size = (n: number) => {
    if (sidebar) return 0.84;
    const ratio = (n - min) / (max - min || 1);
    return 0.82 + ratio * 0.55; // 0.82rem … 1.37rem
  };

  const cloud = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: sidebar ? '0.45rem' : '0.65rem' }}>
      {TRENDING_TOPICS.map((topic) => {
        const fs = size(topic.mentions);
        return (
          <button
            key={topic.slug}
            className="topic-chip"
            onClick={() => {
              track('trending_topic_click', { topic: topic.slug, placement: variant });
              if (conceptBySlug.has(topic.slug)) navigate('concept', { conceptSlug: topic.slug });
              else navigate('search', { query: topic.label });
            }}
            aria-label={`${topic.label} — ${topic.mentions} ${t('mentions')}`}
            title={`${topic.mentions} ${t('mentions')}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: `${fs}rem`,
              fontWeight: 600,
              padding: sidebar ? '0.3rem 0.7rem' : '0.45rem 0.9rem',
              color: 'var(--color-text)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 999,
              cursor: 'pointer',
              lineHeight: 1.2,
            }}
          >
            <span
              aria-hidden="true"
              style={{ color: 'var(--color-accent)', display: 'inline-flex' }}
            >
              <CategoryGlyph icon={topic.icon} size={Math.round(fs * 15)} strokeWidth={1.7} />
            </span>
            {topic.label}
            <MomentumMark m={topic.momentum} />
            <span
              className="chip-arrow"
              aria-hidden="true"
              style={{ color: 'var(--color-accent)', display: 'inline-flex' }}
            >
              <ArrowRight size={Math.round(fs * 14)} />
            </span>
          </button>
        );
      })}
    </div>
  );

  if (sidebar) {
    return (
      <section>
        <h3
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-accent)',
            margin: '0 0 0.7rem',
          }}
        >
          {t('trendingSidebar')}
        </h3>
        {cloud}
      </section>
    );
  }

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: '0.6rem' }}>
        {t('trendingEyebrow')}
      </p>
      <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)', marginBottom: '0.4rem' }}>
        {t('trendingTitle')}
      </h2>
      <p
        style={{
          color: 'var(--color-muted)',
          fontSize: '0.95rem',
          margin: '0 0 1.4rem',
          maxWidth: 560,
        }}
      >
        {t('trendingSubtitle')}
      </p>
      {cloud}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   FEATURE F6 — Structured data + E-E-A-T signals
   Why: clean JSON-LD (Organization / ItemList / BreadcrumbList) is a direct
   channel to Google rich results and to AI/answer engines, and the visible
   byline + freshness/"sources cited" line carries E-E-A-T trust signals.
   ─────────────────────────────────────────────────────────────────────────── */
export function Breadcrumbs({
  items,
}: {
  items: { label: string; page?: ProtoPage; params?: RouteParams }[];
}) {
  const { navigate, lang } = useProto();
  useJsonLd('breadcrumb', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.label,
      item: it.page ? SITE + buildPath(it.page, lang, it.params ?? {}) : undefined,
    })),
  });
  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: '1rem' }}>
      <ol
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.4rem',
          listStyle: 'none',
          padding: 0,
          margin: 0,
          fontSize: '0.8rem',
          color: 'var(--color-muted)',
        }}
      >
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={it.label} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              {it.page && !last ? (
                <button
                  onClick={() => navigate(it.page!, it.params)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {it.label}
                </button>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  style={{ color: last ? 'var(--color-text)' : undefined }}
                >
                  {it.label}
                </span>
              )}
              {!last && (
                <span aria-hidden="true" style={{ color: 'var(--color-faint)' }}>
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Byline({ updated }: { updated: string }) {
  const { t, lang } = useProto();
  const date = new Date(updated).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        flexWrap: 'wrap',
        fontSize: '0.82rem',
        color: 'var(--color-muted)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 28,
          height: 28,
          borderRadius: '50%',
          fontSize: 11,
          fontWeight: 700,
          color: '#141414',
          background: 'var(--color-accent)',
        }}
      >
        OK
      </span>
      <span>
        {t('curatedBy')} <strong style={{ color: 'var(--color-text)' }}>Oleksandr Kuzmenko</strong>,{' '}
        {t('bylineRole')}
      </span>
      <span aria-hidden="true" style={{ color: 'var(--color-faint)' }}>
        ·
      </span>
      <span>
        {t('updated')} {date}
      </span>
      <span aria-hidden="true" style={{ color: 'var(--color-faint)' }}>
        ·
      </span>
      <span style={{ color: 'var(--color-faint)' }}>{t('bylineTrust')}</span>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   FEATURE F5 — Saved stories (bookmarks)
   Why: activates the save affordance the cards already expose and turns it
   into a retention loop — return visits, more sessions, a bigger email list.
   ─────────────────────────────────────────────────────────────────────────── */
export function SavedButton() {
  const { t, savedIds, setSavedOpen } = useProto();
  return (
    <button
      onClick={() => {
        track('saved_open', { count: savedIds.length });
        setSavedOpen(true);
      }}
      aria-label={t('savedTitle')}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: '0.85rem',
        color: 'var(--color-muted)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <Bookmark size={17} filled={savedIds.length > 0} />
      {savedIds.length > 0 && (
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#141414',
            background: 'var(--color-accent)',
            borderRadius: 999,
            padding: '0.02rem 0.4rem',
            minWidth: 16,
            textAlign: 'center',
          }}
        >
          {savedIds.length}
        </span>
      )}
    </button>
  );
}

export function SavedDrawer() {
  const { t, lang, savedIds, toggleSaved, savedOpen, setSavedOpen, navigate } = useProto();
  const reduce = useReducedMotion();
  const items = savedIds.map((id) => postById.get(id)).filter(Boolean);

  return (
    <AnimatePresence>
      {savedOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSavedOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 140,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={t('savedTitle')}
            initial={reduce ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: 'min(380px, 92vw)',
              height: '100%',
              background: 'var(--color-bg)',
              borderLeft: '1px solid var(--color-border)',
              padding: '1.4rem',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.2rem',
              }}
            >
              <h2 style={{ fontSize: '1.2rem' }}>
                {t('savedTitle')}{' '}
                <span
                  style={{
                    color: 'var(--color-faint)',
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {items.length} {t('savedCount')}
                </span>
              </h2>
              <button
                onClick={() => setSavedOpen(false)}
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                }}
              >
                <CloseIcon />
              </button>
            </div>

            {items.length === 0 ? (
              <p style={{ color: 'var(--color-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                {t('savedEmpty')}
              </p>
            ) : (
              <ul
                style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.8rem' }}
              >
                {items.map((p) => {
                  const cat = categoryBySlug.get(p!.categorySlug)!;
                  return (
                    <li
                      key={p!.id}
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.8rem',
                      }}
                    >
                      <div style={{ marginBottom: '0.4rem' }}>
                        <Badge category={cat} lang={lang} />
                      </div>
                      <button
                        onClick={() => {
                          setSavedOpen(false);
                          navigate('item', { itemSlug: postSlug(p!) });
                        }}
                        style={{
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          fontFamily: 'var(--font-serif)',
                          fontSize: '0.96rem',
                          fontWeight: 600,
                          lineHeight: 1.35,
                          color: 'var(--color-text)',
                        }}
                      >
                        {p!.title[lang]}
                      </button>
                      <div style={{ marginTop: '0.5rem' }}>
                        <button
                          onClick={() => toggleSaved(p!.id)}
                          style={{
                            fontSize: '0.76rem',
                            color: 'var(--color-muted)',
                            background: 'none',
                            border: '1px solid var(--color-border)',
                            borderRadius: 999,
                            padding: '0.25rem 0.6rem',
                            cursor: 'pointer',
                          }}
                        >
                          {t('savedRemove')}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   FEATURE F1 — Subscribe modal (the conversion surface for the email asset)
   The public subscribe endpoint is the #1 monetisable asset, so it must be
   bot-resistant: a honeypot field + double opt-in are modelled here. States:
   idle → loading → success (check-inbox) / error.
   ─────────────────────────────────────────────────────────────────────────── */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
type SubStatus = 'idle' | 'loading' | 'success' | 'error';

export function SubscribeModal() {
  const { t, subscribeOpen, setSubscribeOpen } = useProto();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<SubStatus>('idle');

  function close() {
    setSubscribeOpen(false);
    // Reset shortly after the close animation so the next open is clean.
    window.setTimeout(() => {
      setStatus('idle');
      setEmail('');
      setHoneypot('');
    }, 250);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Honeypot: a real bot fills the hidden field. Pretend-succeed without
    // tracking so the bot gets no signal and the list stays clean.
    if (honeypot) {
      setStatus('success');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    track('newsletter_subscribe', { placement: 'modal' });
    // Simulated double opt-in round-trip → "check your inbox".
    window.setTimeout(() => setStatus('success'), 850);
  }

  const trust = [t('subTrustNoSpam'), t('subTrustOptIn'), t('subTrustUnsub')];

  return (
    <AnimatePresence>
      {subscribeOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 160,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('subTitle')}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'relative',
              width: 'min(460px, 100%)',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-pop)',
              padding: 'clamp(1.4rem, 4vw, 2rem)',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(120% 120% at 0% 0%, rgba(240,192,64,0.12), transparent 55%)',
                pointerEvents: 'none',
              }}
            />
            <button
              onClick={close}
              aria-label={t('subClose')}
              style={{
                position: 'absolute',
                top: '0.9rem',
                right: '0.9rem',
                background: 'none',
                border: 'none',
                color: 'var(--color-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                zIndex: 1,
              }}
            >
              <CloseIcon />
            </button>

            <div style={{ position: 'relative' }}>
              {status === 'success' ? (
                <div style={{ textAlign: 'center', padding: '0.6rem 0' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 56,
                      height: 56,
                      margin: '0 auto 1rem',
                      borderRadius: '50%',
                      color: '#141414',
                      background: 'var(--color-accent)',
                    }}
                  >
                    <CheckIcon size={28} />
                  </span>
                  <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>
                    {t('subSuccessTitle')}
                  </h2>
                  <p
                    role="status"
                    style={{
                      color: 'var(--color-muted)',
                      fontSize: '0.95rem',
                      lineHeight: 1.6,
                      margin: '0 0 0.4rem',
                    }}
                  >
                    {t('subDone')}
                  </p>
                  <p style={{ color: 'var(--color-faint)', fontSize: '0.8rem', margin: 0 }}>
                    {t('subReferral')}
                  </p>
                </div>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 46,
                      height: 46,
                      marginBottom: '0.9rem',
                      borderRadius: 12,
                      color: 'var(--color-accent)',
                      background: 'rgba(240,192,64,0.12)',
                      border: '1px solid rgba(240,192,64,0.4)',
                    }}
                  >
                    <MailIcon size={22} />
                  </span>
                  <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>
                    {t('subEyebrow')}
                  </p>
                  <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.8rem)', marginBottom: '0.5rem' }}>
                    {t('subTitle')}
                  </h2>
                  <p
                    style={{
                      color: 'var(--color-muted)',
                      fontSize: '0.95rem',
                      lineHeight: 1.6,
                      margin: '0 0 1.2rem',
                    }}
                  >
                    {t('subBody')}
                  </p>

                  <form onSubmit={submit} noValidate>
                    {/* Honeypot — visually hidden, off-screen, not announced. */}
                    <input
                      type="text"
                      name="company"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      style={{
                        position: 'absolute',
                        left: '-9999px',
                        width: 1,
                        height: 1,
                        opacity: 0,
                      }}
                    />
                    <label htmlFor="sub-modal-email" className="sr-only">
                      {t('subPlaceholder')}
                    </label>
                    <input
                      id="sub-modal-email"
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (status === 'error') setStatus('idle');
                      }}
                      placeholder={t('subPlaceholder')}
                      aria-invalid={status === 'error'}
                      disabled={status === 'loading'}
                      style={{
                        width: '100%',
                        padding: '0.85rem 1rem',
                        fontSize: '0.95rem',
                        fontFamily: 'var(--font-sans)',
                        color: 'var(--color-text)',
                        background: 'var(--color-surface)',
                        border: `1px solid ${
                          status === 'error' ? '#FF8FA3' : 'var(--color-border)'
                        }`,
                        borderRadius: 10,
                        outline: 'none',
                      }}
                    />
                    {status === 'error' && (
                      <p
                        role="alert"
                        style={{
                          color: '#FF8FA3',
                          fontSize: '0.8rem',
                          margin: '0.5rem 0 0',
                        }}
                      >
                        {t('subErrorInvalid')}
                      </p>
                    )}
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={status === 'loading'}
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        marginTop: '0.7rem',
                        opacity: status === 'loading' ? 0.8 : 1,
                      }}
                    >
                      {status === 'loading' ? t('subSending') : t('subButton')}
                      {status !== 'loading' && <ArrowRight size={16} />}
                    </button>
                  </form>

                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: '1.1rem 0 0',
                      display: 'grid',
                      gap: '0.45rem',
                    }}
                  >
                    {trust.map((line) => (
                      <li
                        key={line}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.82rem',
                          color: 'var(--color-muted)',
                        }}
                      >
                        <span style={{ color: 'var(--color-accent)', display: 'inline-flex' }}>
                          <ShieldIcon size={15} />
                        </span>
                        {line}
                      </li>
                    ))}
                  </ul>
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-faint)', margin: '0.9rem 0 0' }}>
                    {t('subPrivacy')}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Cookie-consent CMP (GDPR / Consent Mode v2)
   EN-global → GDPR is in scope, so consent is a real gate, not a placeholder.
   Accept all / Essential only / Customise; the choice is persisted and pushed
   to Consent Mode via analytics.updateConsent(). The demo region toggle (EU/UA)
   shows how the same UI adapts to jurisdiction.
   ─────────────────────────────────────────────────────────────────────────── */
function ConsentSwitch({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      style={{
        position: 'relative',
        width: 38,
        height: 22,
        flexShrink: 0,
        borderRadius: 999,
        border: '1px solid var(--color-border)',
        background: on ? 'var(--color-accent)' : 'var(--color-surface-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.18s var(--ease)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: on ? '#141414' : 'var(--color-faint)',
          transition: 'left 0.18s var(--ease)',
        }}
      />
    </button>
  );
}

export function CookieConsent() {
  const { t, consentOpen, region, applyConsent, navigate } = useProto();
  const reduce = useReducedMotion();
  const [manage, setManage] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [ads, setAds] = useState(false);

  const categories = [
    { key: 'essential', on: true, locked: true },
    { key: 'analytics', on: analytics, set: setAnalytics },
    { key: 'ads', on: ads, set: setAds },
  ] as const;

  return (
    <AnimatePresence>
      {consentOpen && (
        <motion.div
          role="region"
          aria-label={t('cookieTitle')}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed',
            left: '1.1rem',
            bottom: '1.1rem',
            zIndex: 152,
            width: 'min(440px, calc(100vw - 2.2rem))',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-pop)',
            padding: '1.2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.6rem' }}>
            <span style={{ color: 'var(--color-accent)', display: 'inline-flex' }}>
              <ShieldIcon size={18} />
            </span>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{t('cookieTitle')}</h2>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '0.6rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-faint)',
                border: '1px solid var(--color-border)',
                borderRadius: 999,
                padding: '0.1rem 0.45rem',
              }}
              title={t('cookieRegionNote')}
            >
              {region}
            </span>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', lineHeight: 1.55, margin: '0 0 1rem' }}>
            {region === 'UA' ? t('cookieBodyUA') : t('cookieBodyEU')}{' '}
            <button
              onClick={() => navigate('privacy')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--color-accent)',
                cursor: 'pointer',
                textDecoration: 'underline',
                font: 'inherit',
              }}
            >
              {t('cookiePolicy')}
            </button>
          </p>

          {manage && (
            <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1rem' }}>
              {categories.map((c) => (
                <div
                  key={c.key}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.7rem',
                    padding: '0.6rem 0.7rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ fontSize: '0.85rem' }}>{t(`cookie${cap(c.key)}`)}</strong>
                    <p style={{ fontSize: '0.76rem', color: 'var(--color-muted)', margin: '0.15rem 0 0', lineHeight: 1.4 }}>
                      {t(`cookie${cap(c.key)}Desc`)}
                    </p>
                  </div>
                  <ConsentSwitch
                    on={c.on}
                    disabled={'locked' in c && c.locked}
                    onChange={'set' in c ? c.set : undefined}
                    label={t(`cookie${cap(c.key)}`)}
                  />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {manage ? (
              <>
                <button
                  className="btn btn-primary"
                  onClick={() => applyConsent({ analytics, ads })}
                  style={{ flex: '1 1 auto', justifyContent: 'center' }}
                >
                  {t('cookieSave')}
                </button>
                <button className="btn btn-ghost" onClick={() => setManage(false)}>
                  {t('prev')}
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-primary"
                  onClick={() => applyConsent({ analytics: true, ads: true })}
                  style={{ flex: '1 1 auto', justifyContent: 'center' }}
                >
                  {t('cookieAccept')}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => applyConsent({ analytics: false, ads: false })}
                >
                  {t('cookieReject')}
                </button>
                <button
                  onClick={() => setManage(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-muted)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    padding: '0.4rem',
                  }}
                >
                  {t('cookieManage')}
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ───────────────────────────────────────────────────────────────────────────
   AI-disclosure inline note (E-E-A-T + AI Act art. 50 intent)
   A calm, reusable marker — "AI draft · editor-reviewed" + a link to the full
   policy — placed on item / brief / about. Deliberately not a scary banner:
   research shows heavy disclosure depresses trust; a quiet, honest note plus
   visible human review reads as a quality signal.
   ─────────────────────────────────────────────────────────────────────────── */
export function AiDisclosureNote({ align = 'left' }: { align?: 'left' | 'center' }) {
  const { t, navigate } = useProto();
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        padding: '0.4rem 0.7rem',
        borderRadius: 999,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        fontSize: '0.76rem',
        color: 'var(--color-muted)',
      }}
    >
      <span aria-hidden="true" style={{ color: 'var(--color-accent)', display: 'inline-flex' }}>
        <SparkleIcon size={14} />
      </span>
      <span>{t('aiNoteLabel')}</span>
      <span aria-hidden="true" style={{ color: 'var(--color-faint)' }}>
        ·
      </span>
      <button
        onClick={() => navigate('ai-disclosure')}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'var(--color-accent)',
          cursor: 'pointer',
          fontSize: '0.76rem',
          fontWeight: 600,
        }}
      >
        {t('aiNoteLink')}
      </button>
    </div>
  );
}
