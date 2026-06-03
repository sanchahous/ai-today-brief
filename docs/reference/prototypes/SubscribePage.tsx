import React from 'react';
import { useProto } from './ProtoContext';
import { usePageMeta, useJsonLd } from './hooks';
import { Reveal, Badge } from './ui';
import { Breadcrumbs, NewsletterBand, FaqSection } from './features';
import { SUBSCRIBE_BENEFITS } from './content';
import { CategoryGlyph, ArrowRight } from './icons';
import {
  WEEK_FEATURED_ID,
  WEEK_SECONDARY_IDS,
  postById,
  categoryBySlug,
  postSlug,
} from './data';
import { SITE_URL, SITE_NAME } from './config';

export function SubscribePage() {
  const { t, lang, navigate } = useProto();

  usePageMeta({ page: 'subscribe', lang, title: t('subLandTitle'), description: t('subLandLead') });
  useJsonLd('subscribe', {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('subLandTitle'),
    description: t('subLandLead'),
    url: `${SITE_URL}/${lang}/subscribe`,
    inLanguage: lang,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE_URL}/${lang}/` },
  });

  const sample = [WEEK_FEATURED_ID, ...WEEK_SECONDARY_IDS].map((id) => postById.get(id)!);

  return (
    <div className="shell" style={{ padding: '2.5rem 1.5rem 1rem' }}>
      <Breadcrumbs
        items={[
          { label: t('breadcrumbHome'), page: 'home' },
          { label: t('subscribeCta'), page: 'subscribe' },
        ]}
      />

      {/* Hero + form */}
      <section style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <p className="eyebrow" style={{ marginBottom: '0.7rem' }}>
          {t('subEyebrow')}
        </p>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.1rem)', lineHeight: 1.1, marginBottom: '0.9rem' }}>
          {t('subLandTitle')}
        </h1>
        <p
          style={{
            fontSize: 'clamp(1rem, 2.2vw, 1.15rem)',
            color: 'var(--color-muted)',
            lineHeight: 1.6,
            maxWidth: 560,
            margin: '0 auto 1.8rem',
          }}
        >
          {t('subLandLead')}
        </p>
        <div style={{ textAlign: 'left' }}>
          <NewsletterBand showHeader={false} />
        </div>
      </section>

      {/* Benefits */}
      <section style={{ marginTop: '3.5rem' }}>
        <Reveal>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3.2vw, 1.9rem)', textAlign: 'center', marginBottom: '1.8rem' }}>
            {t('subLandWhatTitle')}
          </h2>
        </Reveal>
        <div className="cat-grid">
          {SUBSCRIBE_BENEFITS.map((b, i) => (
            <Reveal key={b.title.en} delay={i * 60}>
              <article
                style={{
                  height: '100%',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.3rem',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 44,
                    height: 44,
                    marginBottom: '0.9rem',
                    borderRadius: 12,
                    color: 'var(--color-accent)',
                    background: 'rgba(240,192,64,0.12)',
                    border: '1px solid rgba(240,192,64,0.35)',
                  }}
                >
                  <CategoryGlyph icon={b.icon} size={22} strokeWidth={1.6} />
                </span>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>{b.title[lang]}</h3>
                <p style={{ fontSize: '0.92rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0 }}>
                  {b.body[lang]}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Sample issue */}
      <section style={{ maxWidth: 760, margin: '3.5rem auto 0' }}>
        <Reveal>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3.2vw, 1.9rem)', marginBottom: '0.4rem' }}>
            {t('subLandSampleTitle')}
          </h2>
          <p style={{ color: 'var(--color-muted)', margin: '0 0 1.4rem' }}>{t('subLandSampleLead')}</p>
        </Reveal>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.7rem' }}>
          {sample.map((p) => {
            const cat = categoryBySlug.get(p.categorySlug)!;
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
                <Badge category={cat} lang={lang} />
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
                    fontSize: '1rem',
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

      {/* FAQ */}
      <section style={{ maxWidth: 760, margin: '3.5rem auto 0' }}>
        <Reveal>
          <FaqSection />
        </Reveal>
      </section>
    </div>
  );
}
