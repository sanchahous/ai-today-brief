import React, { useState } from 'react';
import { useProto } from './ProtoContext';
import { usePageMeta, useJsonLd } from './hooks';
import { track } from './analytics';
import {
  findPost,
  postSlug,
  categoryBySlug,
  latestByCategory,
} from './data';
import { Reveal, Badge, CategoryBanner } from './ui';
import { Breadcrumbs, Byline, AiDisclosureNote, NewsletterBand } from './features';
import { StoryBody } from './StoryBody';
import { NotFoundPage } from './NotFoundPage';
import { ClockIcon, PlayIcon, ExternalLinkIcon, ArrowRight, ShareIcon } from './icons';
import { SITE_URL, SITE_NAME, FOUNDER_NAME } from './config';

export function ItemPage() {
  const { t, lang, routeParams, navigate } = useProto();
  const post = routeParams.itemSlug ? findPost(routeParams.itemSlug) : undefined;
  const [copied, setCopied] = useState(false);

  // Hooks must run unconditionally — compute safe fallbacks when the slug misses.
  const cat = post ? categoryBySlug.get(post.categorySlug)! : null;
  const slug = post ? postSlug(post) : '';
  const pageUrl = `${SITE_URL}/${lang}/news/${slug}`;

  usePageMeta({
    page: 'item',
    lang,
    params: { itemSlug: slug },
    title: post ? post.title[lang] : '404',
    description: post ? post.summary[lang] : '',
    noindex: !post,
  });
  useJsonLd('item', {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post?.title[lang] ?? '',
    description: post?.summary[lang] ?? '',
    articleBody: post?.deepDive[lang].join('\n\n') ?? '',
    datePublished: post?.date,
    dateModified: post?.date,
    inLanguage: lang,
    url: pageUrl,
    image: `${SITE_URL}/og-image.png`,
    author: { '@type': 'Person', name: FOUNDER_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/${lang}/` },
    citation: post ? [{ '@type': 'CreativeWork', name: post.source }] : undefined,
  });

  if (!post || !cat) return <NotFoundPage />;

  const related = latestByCategory(cat.slug, 4).filter((p) => p.id !== post.id);

  function copyLink() {
    void navigator.clipboard?.writeText(pageUrl).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const dateLabel = new Date(post.date).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="shell" style={{ padding: '2.5rem 1.5rem 1rem' }}>
      <Breadcrumbs
        items={[
          { label: t('breadcrumbHome'), page: 'home' },
          { label: t('navNews'), page: 'news' },
          { label: cat.name[lang], page: 'category', params: { categorySlug: cat.slug } },
          { label: post.title[lang] },
        ]}
      />

      <article style={{ maxWidth: 760 }}>
        <div style={{ marginBottom: '1.2rem' }}>
          <Badge category={cat} lang={lang} size="md" />
        </div>
        <h1 style={{ fontSize: 'clamp(1.9rem, 4.5vw, 2.9rem)', lineHeight: 1.12, marginBottom: '0.9rem' }}>
          {post.title[lang]}
        </h1>

        {/* Meta row */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            fontSize: '0.82rem',
            color: 'var(--color-faint)',
            marginBottom: '1.1rem',
          }}
        >
          <span>{post.source}</span>
          <span aria-hidden="true">·</span>
          <span>{dateLabel}</span>
          <span aria-hidden="true">·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <ClockIcon size={13} /> {post.readMinutes} {t('readMin')}
          </span>
          {post.hasVideo && (
            <>
              <span aria-hidden="true">·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: cat.color }}>
                <PlayIcon size={13} /> {t('watchVideo')}
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.4rem' }}>
          <Byline updated={post.date} />
          <AiDisclosureNote />
        </div>

        <Reveal>
          <div style={{ marginBottom: '1.6rem' }}>
            <CategoryBanner category={cat} lang={lang} variant="hero" motif={post.rank} videoBadge={post.hasVideo} videoLabel={t('watchVideo')} />
          </div>
        </Reveal>

        {/* Lead summary */}
        <p style={{ fontSize: '1.1rem', lineHeight: 1.7, color: 'var(--color-text)', margin: '0 0 1.4rem' }}>
          {post.summary[lang]}
        </p>

        {/* Shared deep-dive body */}
        <StoryBody post={post} />

        {/* Primary source */}
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '1.6rem',
            padding: '0.6rem 0.9rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: '0.88rem',
          }}
        >
          {t('itemSource')}: <strong>{post.source}</strong>
          <ExternalLinkIcon size={14} />
        </a>

        {/* Share row */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.6rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-faint)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ShareIcon size={15} /> {t('share')}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => track('share', { post_id: post.id, method: 'x' })}
            style={{ padding: '0.4rem 0.8rem' }}
          >
            {t('shareOnX')}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => track('share', { post_id: post.id, method: 'li' })}
            style={{ padding: '0.4rem 0.8rem' }}
          >
            {t('shareOnLinkedin')}
          </button>
          <button className="btn btn-ghost" onClick={copyLink} style={{ padding: '0.4rem 0.8rem' }}>
            {copied ? t('copied') : t('copyLink')}
          </button>
        </div>
      </article>

      {/* Related */}
      {related.length > 0 && (
        <section style={{ maxWidth: 760, marginTop: '3rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>{t('itemRelated')}</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.7rem' }}>
            {related.map((p) => {
              const pc = categoryBySlug.get(p.categorySlug)!;
              return (
                <li
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.8rem',
                    padding: '0.85rem 1rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <Badge category={pc} lang={lang} />
                  <button
                    onClick={() => navigate('item', { itemSlug: postSlug(p) })}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: 'var(--font-serif)',
                      fontSize: '0.98rem',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                    }}
                  >
                    {p.title[lang]}
                  </button>
                  <ArrowRight size={16} style={{ color: 'var(--color-faint)', flexShrink: 0 }} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Newsletter */}
      <section style={{ maxWidth: 760, marginTop: '3rem' }}>
        <NewsletterBand variant="inline" />
      </section>
    </div>
  );
}
