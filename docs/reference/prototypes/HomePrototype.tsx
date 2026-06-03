import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  TOP_CATEGORY_SLUGS,
  categoryBySlug,
  postById,
  postSlug,
  latestByCategory,
  WEEK_FEATURED_ID,
  WEEK_SECONDARY_IDS,
} from './data';
import type { ProtoCategory, ProtoPost } from './data';
import { useProto } from './ProtoContext';
import { useJsonLd, usePageMeta } from './hooks';
import { Reveal, Badge, SkeletonBox } from './ui';
import { ArrowRight, ClockIcon, PlayIcon, CategoryGlyph } from './icons';
import { Feature, TrendingTopics, NewsletterBand, FaqSection, SponsorCard } from './features';
import { HeroSearch } from './search';
import { SITE_URL as SITE } from './config';

const topCategories = TOP_CATEGORY_SLUGS.map((s) => categoryBySlug.get(s)!);

export function HomePrototype() {
  const { t, lang, loading, navigate } = useProto();
  const reduce = useReducedMotion();

  usePageMeta({ page: 'home', lang, title: t('heroTitle'), description: t('heroSubtitle') });

  const featured = postById.get(WEEK_FEATURED_ID)!;
  const secondary = WEEK_SECONDARY_IDS.map((id) => postById.get(id)!);

  // FEATURE F6 — Organization + WebSite + ItemList structured data.
  useJsonLd('home', {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE}/#org`,
        name: 'AI Brief',
        url: `${SITE}/${lang}/`,
        founder: { '@type': 'Person', name: 'Oleksandr Kuzmenko' },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        name: 'AI Brief',
        url: `${SITE}/${lang}/`,
        inLanguage: ['uk', 'en'],
      },
      {
        '@type': 'ItemList',
        name: t('weekTitle'),
        itemListElement: [featured, ...secondary].map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: p.title[lang],
        })),
      },
    ],
  });

  return (
    <div>
      {/* ── Hero / product description (SEO, first screen) ── */}
      <section
        aria-labelledby="hero-title"
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '1px solid var(--color-border)',
          // Static gradient stands in for the animated orbs on mobile (where
          // they're disabled for performance) so the hero never looks bare.
          background:
            'radial-gradient(80% 120% at 85% -10%, rgba(240,192,64,0.10), transparent 60%)',
        }}
      >
        {/* Decorative animated backdrop (desktop only — see .hero-orbs) */}
        <HeroBackdrop />
        <div className="shell" style={{ position: 'relative', padding: '4.5rem 1.5rem 3.5rem' }}>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ maxWidth: 760 }}
          >
            <p className="eyebrow" style={{ marginBottom: '1rem' }}>
              {t('heroEyebrow')}
            </p>
            <h1
              id="hero-title"
              style={{
                fontSize: 'clamp(2.1rem, 5.5vw, 3.6rem)',
                lineHeight: 1.08,
                marginBottom: '1.1rem',
              }}
            >
              {t('heroTitle')}
            </h1>
            <p
              style={{
                fontSize: 'clamp(1rem, 2.2vw, 1.2rem)',
                lineHeight: 1.65,
                color: 'var(--color-muted)',
                maxWidth: 620,
                marginBottom: '1.8rem',
              }}
            >
              {t('heroSubtitle')}
            </p>

            <div
              style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '1.6rem' }}
            >
              <button onClick={() => navigate('news')} className="btn btn-primary">
                {t('heroCtaPrimary')} <ArrowRight size={17} />
              </button>
              <a
                href="#week"
                className="btn btn-ghost"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('week')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {t('heroCtaSecondary')}
              </a>
            </div>

            {/* Search integrated into the first screen — hands off to the
                header search on scroll (see HeroSearch / Shell). */}
            <div style={{ marginBottom: '2.4rem' }}>
              <HeroSearch />
            </div>

            <dl className="hero-stats" style={{ margin: 0 }}>
              {[
                { n: '70+', l: t('heroStatStories') },
                { n: '120+', l: t('heroStatSources') },
                { n: '9', l: t('heroStatCategories') },
              ].map((s) => (
                <div key={s.l}>
                  <dt
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '2rem',
                      fontWeight: 700,
                      color: 'var(--color-accent)',
                      lineHeight: 1,
                    }}
                  >
                    {s.n}
                  </dt>
                  <dd
                    style={{
                      margin: '0.3rem 0 0',
                      fontSize: '0.82rem',
                      color: 'var(--color-muted)',
                    }}
                  >
                    {s.l}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </div>
      </section>

      {/* ── Top-6 categories ── */}
      <section aria-labelledby="cats-title" className="shell" style={{ padding: '3rem 1.5rem' }}>
        <Reveal>
          <SectionHead
            eyebrow={t('categoriesEyebrow')}
            title={t('categoriesTitle')}
            subtitle={t('categoriesSubtitle')}
            titleId="cats-title"
          />
        </Reveal>

        <div className="cat-grid" style={{ marginTop: '1.8rem' }}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <CategoryCardSkeleton key={i} />)
            : topCategories.map((c, i) => (
                <Reveal key={c.slug} delay={i * 60}>
                  <CategoryCard category={c} />
                </Reveal>
              ))}
        </div>
      </section>

      {/* ── Top of the week ── */}
      <section
        id="week"
        aria-labelledby="week-title"
        className="shell"
        style={{ padding: '2rem 1.5rem 3rem', scrollMarginTop: 80 }}
      >
        <Reveal>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <SectionHead
              eyebrow={t('weekEyebrow')}
              title={t('weekTitle')}
              subtitle={t('weekSubtitle')}
              titleId="week-title"
            />
            <button onClick={() => navigate('news')} className="btn btn-ghost">
              {t('weekCta')} <ArrowRight size={16} />
            </button>
          </div>
        </Reveal>

        <div className="week-grid" style={{ marginTop: '1.8rem' }}>
          {loading ? (
            <>
              <FeaturedSkeleton />
              <div style={{ display: 'grid', gap: '1rem' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <SecondarySkeleton key={i} />
                ))}
              </div>
            </>
          ) : (
            <>
              <Reveal>
                <FeaturedCard post={featured} />
              </Reveal>
              <div style={{ display: 'grid', gap: '0.9rem' }}>
                {secondary.map((p, i) => (
                  <Reveal key={p.id} delay={i * 70}>
                    <SecondaryRow post={p} rank={i + 2} />
                  </Reveal>
                ))}
                {/* FEATURE F2 — native sponsor slot inside the week block */}
                <Reveal delay={secondary.length * 70}>
                  <Feature id="F2" label={t('sponsorLabel')}>
                    <SponsorCard />
                  </Feature>
                </Reveal>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── FEATURE F4 — Trending topics (concept hubs) ── */}
      <section
        aria-label={t('trendingTitle')}
        className="shell"
        style={{ padding: '1rem 1.5rem 3rem' }}
      >
        <Reveal>
          <Feature id="F4" label={t('trendingEyebrow')}>
            <TrendingTopics />
          </Feature>
        </Reveal>
      </section>

      {/* ── FEATURE F1 — Email digest subscription ── */}
      <section className="shell" style={{ padding: '0 1.5rem 3rem' }}>
        <Reveal>
          <Feature id="F1" label={t('subEyebrow')}>
            <NewsletterBand />
          </Feature>
        </Reveal>
      </section>

      {/* ── Weekly video review teaser (provisioned) ── */}
      <section className="shell" style={{ padding: '0 1.5rem 4rem' }}>
        <Reveal>
          <VideoTeaser />
        </Reveal>
      </section>

      {/* ── FEATURE F3 — SEO FAQ (FAQPage schema) ── */}
      <section className="shell" style={{ padding: '0 1.5rem 4rem' }}>
        <Reveal>
          <Feature id="F3" label={t('faqEyebrow')}>
            <FaqSection />
          </Feature>
        </Reveal>
      </section>
    </div>
  );
}

// ── pieces ────────────────────────────────────────────────────────────────────

function SectionHead({
  eyebrow,
  title,
  subtitle,
  titleId,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  titleId: string;
}) {
  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: '0.6rem' }}>
        {eyebrow}
      </p>
      <h2 id={titleId} style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)', marginBottom: '0.4rem' }}>
        {title}
      </h2>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.95rem', margin: 0, maxWidth: 560 }}>
        {subtitle}
      </p>
    </div>
  );
}

function CategoryCard({ category }: { category: ProtoCategory }) {
  const { t, lang, navigate } = useProto();
  const latest = latestByCategory(category.slug, 3);
  return (
    <article
      className="card-hover"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Slim category-coloured header — identity without the empty banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.8rem',
          padding: '1rem 1.1rem',
          background: `linear-gradient(135deg, ${category.color}26, ${category.color}0a)`,
          borderBottom: `1px solid ${category.color}33`,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 12,
            color: category.color,
            background: `${category.color}1f`,
            border: `1px solid ${category.color}55`,
          }}
        >
          <CategoryGlyph icon={category.icon} size={24} strokeWidth={1.5} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontSize: '1.1rem', lineHeight: 1.2 }}>{category.name[lang]}</h3>
          <p
            style={{
              fontSize: '0.8rem',
              color: category.color,
              fontWeight: 500,
              margin: '0.2rem 0 0',
            }}
          >
            {category.tagline[lang]}
          </p>
        </div>
      </div>

      <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Recent headlines — real content preview + internal-link sense */}
        <p
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-faint)',
            margin: '0 0 0.6rem',
          }}
        >
          {t('categoryLatest')}
        </p>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 0 1.1rem',
            display: 'grid',
            gap: '0.6rem',
          }}
        >
          {latest.map((p) => (
            <li key={p.id} style={{ display: 'flex', gap: '0.5rem' }}>
              <span
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  width: 6,
                  height: 6,
                  marginTop: 7,
                  borderRadius: '50%',
                  background: category.color,
                }}
              />
              <button
                onClick={() => navigate('item', { itemSlug: postSlug(p) })}
                style={{
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  lineHeight: 1.4,
                  color: 'var(--color-text)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {p.title[lang]}
              </button>
            </li>
          ))}
        </ul>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <button
            onClick={() => navigate('category', { categorySlug: category.slug })}
            className="btn btn-ghost"
            style={{ alignSelf: 'flex-start' }}
          >
            {t('categoryCta')} <ArrowRight size={16} />
          </button>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-faint)', whiteSpace: 'nowrap' }}>
            {category.count} {t('categoryArticles')}
          </span>
        </div>
      </div>
    </article>
  );
}

function FeaturedCard({ post }: { post: ProtoPost }) {
  const { t, lang, navigate } = useProto();
  const cat = categoryBySlug.get(post.categorySlug)!;
  return (
    <article
      className="card-hover"
      onClick={() => navigate('item', { itemSlug: postSlug(post) })}
      style={{
        cursor: 'pointer',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Compact category strip (replaces the large hero banner) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          padding: '0.9rem 1.3rem',
          background: `linear-gradient(135deg, ${cat.color}26, ${cat.color}0a)`,
          borderBottom: `1px solid ${cat.color}33`,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 46,
            height: 46,
            flexShrink: 0,
            borderRadius: 12,
            color: cat.color,
            background: `${cat.color}1f`,
            border: `1px solid ${cat.color}55`,
          }}
        >
          <CategoryGlyph icon={cat.icon} size={24} strokeWidth={1.5} />
        </span>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#141414',
              background: 'var(--color-accent)',
              padding: '0.2rem 0.55rem',
              borderRadius: 999,
            }}
          >
            {t('featured')}
          </span>
          <Badge category={cat} lang={lang} />
        </div>
        {post.hasVideo && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: cat.color,
              flexShrink: 0,
            }}
          >
            <PlayIcon size={15} /> {t('watchVideo')}
          </span>
        )}
      </div>

      <div style={{ padding: '1.3rem' }}>
        <h3
          style={{
            fontSize: 'clamp(1.3rem, 2.6vw, 1.7rem)',
            lineHeight: 1.25,
            marginBottom: '0.6rem',
          }}
        >
          {post.title[lang]}
        </h3>
        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--color-muted)',
            lineHeight: 1.6,
            margin: '0 0 1rem',
          }}
        >
          {post.summary[lang]}
        </p>
        <div
          style={{
            display: 'flex',
            gap: '0.45rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            fontSize: '0.76rem',
            color: 'var(--color-faint)',
          }}
        >
          <span>{post.source}</span>
          <span aria-hidden="true">·</span>
          <span>
            {new Date(post.date).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          <span aria-hidden="true">·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <ClockIcon size={13} /> {post.readMinutes} {t('readMin')}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {post.saves} {t('savedCount')}
          </span>
        </div>
      </div>
    </article>
  );
}

function SecondaryRow({ post, rank }: { post: ProtoPost; rank: number }) {
  const { lang, t, navigate } = useProto();
  const cat = categoryBySlug.get(post.categorySlug)!;
  return (
    <article
      className="card-hover"
      onClick={() => navigate('item', { itemSlug: postSlug(post) })}
      style={{
        cursor: 'pointer',
        display: 'flex',
        gap: '0.9rem',
        alignItems: 'flex-start',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.9rem',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--color-faint)',
          lineHeight: 1,
          minWidth: 28,
        }}
      >
        {rank}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.35rem',
            flexWrap: 'wrap',
          }}
        >
          <Badge category={cat} lang={lang} />
          {post.hasVideo && (
            <span style={{ display: 'inline-flex', color: cat.color }}>
              <PlayIcon size={14} />
            </span>
          )}
        </div>
        <h4
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1rem',
            lineHeight: 1.35,
            fontWeight: 600,
            margin: 0,
          }}
        >
          {post.title[lang]}
        </h4>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.74rem',
            color: 'var(--color-faint)',
            marginTop: '0.35rem',
          }}
        >
          <ClockIcon size={13} /> {post.readMinutes} {t('readMin')}
        </span>
      </div>
    </article>
  );
}

function VideoTeaser() {
  const { t } = useProto();
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--color-border)',
        background:
          'radial-gradient(120% 140% at 100% 0%, rgba(240,192,64,0.16), transparent 55%), var(--color-surface)',
        padding: 'clamp(1.6rem, 4vw, 2.8rem)',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        flexWrap: 'wrap',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 72,
          height: 72,
          borderRadius: '50%',
          color: 'var(--color-accent)',
          background: 'rgba(240,192,64,0.12)',
          border: '1px solid rgba(240,192,64,0.4)',
          flexShrink: 0,
        }}
      >
        <PlayIcon size={34} />
      </div>
      <div style={{ flex: 1, minWidth: 240 }}>
        <p className="eyebrow pulse" style={{ marginBottom: '0.5rem' }}>
          {t('videoEyebrow')}
        </p>
        <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', marginBottom: '0.5rem' }}>
          {t('videoTitle')}
        </h2>
        <p
          style={{
            color: 'var(--color-muted)',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            margin: 0,
            maxWidth: 540,
          }}
        >
          {t('videoSubtitle')}
        </p>
      </div>
      <button className="btn btn-primary" disabled style={{ opacity: 0.8, cursor: 'not-allowed' }}>
        {t('videoCta')}
      </button>
    </div>
  );
}

// ── skeletons ──────────────────────────────────────────────────────────────────

function CategoryCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      {/* header */}
      <div
        style={{
          display: 'flex',
          gap: '0.8rem',
          alignItems: 'center',
          padding: '1rem 1.1rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <SkeletonBox w={44} h={44} r={12} />
        <div style={{ flex: 1 }}>
          <SkeletonBox w="55%" h={18} style={{ marginBottom: 8 }} />
          <SkeletonBox w="40%" h={12} />
        </div>
      </div>
      <div style={{ padding: '1.1rem' }}>
        <SkeletonBox w="35%" h={11} style={{ marginBottom: 12 }} />
        <SkeletonBox w="92%" h={13} style={{ marginBottom: 8 }} />
        <SkeletonBox w="85%" h={13} style={{ marginBottom: 8 }} />
        <SkeletonBox w="70%" h={13} style={{ marginBottom: 18 }} />
        <SkeletonBox w={120} h={36} r={999} />
      </div>
    </div>
  );
}

function FeaturedSkeleton() {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      {/* strip */}
      <div
        style={{
          display: 'flex',
          gap: '0.85rem',
          alignItems: 'center',
          padding: '0.9rem 1.3rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <SkeletonBox w={46} h={46} r={12} />
        <SkeletonBox w={150} h={20} r={999} />
      </div>
      <div style={{ padding: '1.3rem' }}>
        <SkeletonBox w="95%" h={26} style={{ marginBottom: 8 }} />
        <SkeletonBox w="60%" h={26} style={{ marginBottom: 14 }} />
        <SkeletonBox w="100%" h={13} style={{ marginBottom: 6 }} />
        <SkeletonBox w="80%" h={13} style={{ marginBottom: 14 }} />
        <SkeletonBox w="50%" h={12} />
      </div>
    </div>
  );
}

function SecondarySkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.9rem',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.9rem',
      }}
    >
      <SkeletonBox w={28} h={28} />
      <div style={{ flex: 1 }}>
        <SkeletonBox w={90} h={16} r={999} style={{ marginBottom: 8 }} />
        <SkeletonBox w="100%" h={14} style={{ marginBottom: 6 }} />
        <SkeletonBox w="70%" h={14} />
      </div>
    </div>
  );
}

// Subtle drifting gradient orbs behind the hero — disabled under reduced motion.
function HeroBackdrop() {
  const reduce = useReducedMotion();
  const orb = (color: string, size: number, x: string, y: string, dur: number): React.ReactNode => (
    <motion.div
      aria-hidden="true"
      initial={false}
      animate={reduce ? {} : { x: [0, 24, 0], y: [0, -18, 0] }}
      transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        filter: 'blur(70px)',
        opacity: 0.5,
      }}
    />
  );
  return (
    <div
      aria-hidden="true"
      className="hero-orbs"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {orb('rgba(240,192,64,0.22)', 320, '62%', '-10%', 13)}
      {orb('rgba(91,201,240,0.16)', 280, '78%', '38%', 17)}
      {orb('rgba(181,140,247,0.14)', 240, '45%', '12%', 15)}
    </div>
  );
}
