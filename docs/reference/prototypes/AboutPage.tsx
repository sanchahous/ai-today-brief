import React from 'react';
import { useProto } from './ProtoContext';
import { usePageMeta, useJsonLd } from './hooks';
import { PageShell } from './PageShell';
import { Byline, AiDisclosureNote } from './features';
import { ABOUT_INTRO, METHODOLOGY, SOURCES, DISCLOSURE_POINTS } from './content';
import { CheckIcon, ArrowRight, MailIcon } from './icons';
import { SITE_URL, SITE_NAME, FOUNDER_NAME, CONTACT_EMAIL } from './config';

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', margin: '2.4rem 0 1rem' }}>{children}</h2>
  );
}

export function AboutPage() {
  const { t, lang, navigate } = useProto();

  usePageMeta({ page: 'about', lang, title: t('aboutTitle'), description: ABOUT_INTRO[0][lang] });
  useJsonLd('about', {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: t('aboutTitle'),
    url: `${SITE_URL}/${lang}/about`,
    inLanguage: lang,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: `${SITE_URL}/${lang}/`,
    },
    about: {
      '@type': 'Person',
      name: FOUNDER_NAME,
      jobTitle: t('bylineRole'),
      url: SITE_URL,
    },
  });

  return (
    <PageShell
      crumbs={[
        { label: t('breadcrumbHome'), page: 'home' },
        { label: t('navAbout'), page: 'about' },
      ]}
      eyebrow={t('aboutEyebrow')}
      title={t('aboutTitle')}
      lead={ABOUT_INTRO[0][lang]}
      aside={
        <div style={{ marginTop: '1.1rem' }}>
          <Byline updated="2026-05-28" />
        </div>
      }
    >
      <p style={{ fontSize: '1rem', lineHeight: 1.75, color: 'var(--color-text)', margin: 0 }}>
        {ABOUT_INTRO[1][lang]}
      </p>

      {/* How it works — methodology steps */}
      <SectionHead>{t('aboutHowTitle')}</SectionHead>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.9rem' }}>
        {METHODOLOGY.map((step, i) => (
          <li
            key={step.title.en}
            style={{
              display: 'flex',
              gap: '0.9rem',
              padding: '1rem 1.1rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0,
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: '1.2rem',
                color: 'var(--color-accent)',
                minWidth: 26,
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <strong style={{ fontSize: '1rem' }}>{step.title[lang]}</strong>
              <p style={{ fontSize: '0.92rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: '0.3rem 0 0' }}>
                {step.body[lang]}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Sources */}
      <SectionHead>{t('aboutSourcesTitle')}</SectionHead>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.55rem' }}>
        {SOURCES.map((s) => (
          <li key={s.en} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.95rem' }}>
            <span style={{ color: 'var(--color-accent)', display: 'inline-flex' }}>
              <CheckIcon size={16} />
            </span>
            {s[lang]}
          </li>
        ))}
      </ul>

      {/* AI transparency */}
      <SectionHead>{t('aboutDisclosureTitle')}</SectionHead>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.1rem', display: 'grid', gap: '0.7rem' }}>
        {DISCLOSURE_POINTS.map((p) => (
          <li key={p.en} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
            <span aria-hidden="true" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
              ·
            </span>
            {p[lang]}
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.8rem' }}>
        <AiDisclosureNote />
        <button
          onClick={() => navigate('ai-disclosure')}
          className="btn btn-ghost"
          style={{ display: 'inline-flex' }}
        >
          {t('aboutDisclosureCta')} <ArrowRight size={15} />
        </button>
      </div>

      {/* Who + contact */}
      <SectionHead>{t('aboutWhoTitle')}</SectionHead>
      <p style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--color-text)', margin: 0 }}>
        {t('aboutWhoBody')}
      </p>

      <SectionHead>{t('aboutContactTitle')}</SectionHead>
      <p style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--color-muted)', margin: '0 0 1rem' }}>
        {t('aboutContactBody')}
      </p>
      <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-primary" style={{ display: 'inline-flex' }}>
        <MailIcon size={16} /> {t('aboutContactCta')}
      </a>
    </PageShell>
  );
}
