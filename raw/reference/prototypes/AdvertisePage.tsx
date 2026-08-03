import React from 'react';
import { useProto } from './ProtoContext';
import { usePageMeta, useJsonLd } from './hooks';
import { PageShell } from './PageShell';
import { AUDIENCE_STATS, AD_INVENTORY, ADVERTISE_BENEFITS } from './content';
import { CheckIcon, MailIcon } from './icons';
import { SITE_URL, SITE_NAME, ADVERTISE_EMAIL } from './config';

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', margin: '2.4rem 0 1rem' }}>{children}</h2>
  );
}

export function AdvertisePage() {
  const { t, lang } = useProto();

  usePageMeta({ page: 'advertise', lang, title: t('advTitle'), description: t('advLead') });
  useJsonLd('advertise', {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('advTitle'),
    description: t('advLead'),
    url: `${SITE_URL}/${lang}/advertise`,
    inLanguage: lang,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE_URL}/${lang}/` },
  });

  return (
    <PageShell
      crumbs={[
        { label: t('breadcrumbHome'), page: 'home' },
        { label: t('footerAdvertise'), page: 'advertise' },
      ]}
      eyebrow={t('advEyebrow')}
      title={t('advTitle')}
      lead={t('advLead')}
      maxWidth={820}
    >
      {/* Audience stats */}
      <SectionHead>{t('advAudience')}</SectionHead>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1rem',
        }}
      >
        {AUDIENCE_STATS.map((s) => (
          <div
            key={s.label.en}
            style={{
              padding: '1.2rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.9rem',
                fontWeight: 700,
                color: 'var(--color-accent)',
                margin: '0 0 0.3rem',
              }}
            >
              {s.value}
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: 0 }}>
              {s.label[lang]}
            </p>
          </div>
        ))}
      </div>

      {/* Inventory */}
      <SectionHead>{t('advInventory')}</SectionHead>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.8rem' }}>
        {AD_INVENTORY.map((slot) => (
          <li
            key={slot.name.en}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.6rem 1rem',
              alignItems: 'baseline',
              padding: '1rem 1.1rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <strong style={{ fontSize: '1rem', flex: '1 1 220px' }}>{slot.name[lang]}</strong>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-accent)', fontWeight: 600 }}>
              {slot.placement[lang]}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', flexBasis: '100%' }}>
              {slot.note[lang]}
            </span>
          </li>
        ))}
      </ul>

      {/* Why */}
      <SectionHead>{t('advWhy')}</SectionHead>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
        {ADVERTISE_BENEFITS.map((b) => (
          <li key={b.en} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.96rem', lineHeight: 1.6 }}>
            <span style={{ color: 'var(--color-accent)', display: 'inline-flex', flexShrink: 0, marginTop: 3 }}>
              <CheckIcon size={16} />
            </span>
            {b[lang]}
          </li>
        ))}
      </ul>

      {/* Contact */}
      <div
        style={{
          marginTop: '2.4rem',
          padding: 'clamp(1.4rem, 4vw, 2rem)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border)',
          background:
            'radial-gradient(120% 160% at 0% 0%, rgba(240,192,64,0.12), transparent 55%), var(--color-surface)',
        }}
      >
        <p style={{ fontSize: '1rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: '0 0 1.2rem', maxWidth: 520 }}>
          {t('advContactBody')}
        </p>
        <a href={`mailto:${ADVERTISE_EMAIL}`} className="btn btn-primary" style={{ display: 'inline-flex' }}>
          <MailIcon size={16} /> {t('advContactCta')}
        </a>
      </div>
    </PageShell>
  );
}
