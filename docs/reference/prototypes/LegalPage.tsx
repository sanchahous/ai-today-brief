import React, { useEffect } from 'react';
import { useProto } from './ProtoContext';
import { usePageMeta, useJsonLd } from './hooks';
import { PageShell } from './PageShell';
import { AiDisclosureNote } from './features';
import { AlertTriangleIcon } from './icons';
import { LEGAL_DOCS, type LegalKey } from './legalContent';
import { SITE_URL, SITE_NAME } from './config';

export function LegalPage({ doc }: { doc: LegalKey }) {
  const { t, lang } = useProto();
  const data = LEGAL_DOCS[doc];

  usePageMeta({ page: doc, lang, title: data.title[lang], description: data.intro[lang] });
  useJsonLd(`legal-${doc}`, {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: data.title[lang],
    description: data.intro[lang],
    url: `${SITE_URL}/${doc}`,
    inLanguage: lang,
    dateModified: data.updated,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` },
    ...(doc === 'ai-disclosure'
      ? { disambiguatingDescription: 'AI-assisted content under human editorial review' }
      : {}),
  });

  // Machine-readable AI marking (AI Act art. 50 intent) on the disclosure page.
  useEffect(() => {
    if (doc !== 'ai-disclosure') return;
    const meta = document.createElement('meta');
    meta.name = 'ai-content';
    meta.content = 'ai-assisted; human-reviewed';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [doc]);

  const updatedLabel = new Date(data.updated).toLocaleDateString(
    lang === 'uk' ? 'uk-UA' : 'en-US',
    { day: 'numeric', month: 'long', year: 'numeric' },
  );

  return (
    <PageShell
      crumbs={[
        { label: t('breadcrumbHome'), page: 'home' },
        { label: data.title[lang], page: doc },
      ]}
      title={data.title[lang]}
      lead={data.intro[lang]}
      aside={
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--color-faint)' }}>
            {t('legalUpdated')} {updatedLabel}
          </span>
          {doc === 'ai-disclosure' && <AiDisclosureNote />}
        </div>
      }
    >
      {/* "Needs a lawyer" banner — honest about what this is */}
      <div
        role="note"
        style={{
          display: 'flex',
          gap: '0.7rem',
          alignItems: 'flex-start',
          padding: '0.9rem 1.1rem',
          marginBottom: '1.8rem',
          borderRadius: 'var(--radius-sm)',
          background: 'color-mix(in srgb, #F4C26B 12%, var(--color-surface))',
          border: '1px solid color-mix(in srgb, #F4C26B 45%, transparent)',
        }}
      >
        <span aria-hidden="true" style={{ color: '#F4C26B', display: 'inline-flex', flexShrink: 0, marginTop: 2 }}>
          <AlertTriangleIcon size={18} />
        </span>
        <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: 1.55, color: 'var(--color-text)' }}>
          {t('legalLawyerWarn')}
        </p>
      </div>

      {/* Table of contents */}
      <nav aria-label={t('legalToc')} style={{ marginBottom: '2rem' }}>
        <p
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-faint)',
            margin: '0 0 0.7rem',
          }}
        >
          {t('legalToc')}
        </p>
        <ol style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.35rem' }}>
          {data.sections.map((s, i) => (
            <li key={i}>
              <a
                href={`#sec-${i}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`sec-${i}`)?.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{ color: 'var(--color-accent)', fontSize: '0.9rem' }}
              >
                {s.heading[lang]}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Sections */}
      {data.sections.map((s, i) => (
        <section key={i} id={`sec-${i}`} style={{ scrollMarginTop: 80, marginBottom: '1.8rem' }}>
          <h2 style={{ fontSize: 'clamp(1.2rem, 2.8vw, 1.5rem)', marginBottom: '0.7rem' }}>
            {s.heading[lang]}
          </h2>
          {s.body.map((p, j) => (
            <p
              key={j}
              style={{
                fontSize: '0.96rem',
                lineHeight: 1.75,
                color: 'var(--color-text)',
                margin: '0 0 0.8rem',
              }}
            >
              {p[lang]}
            </p>
          ))}
        </section>
      ))}
    </PageShell>
  );
}
