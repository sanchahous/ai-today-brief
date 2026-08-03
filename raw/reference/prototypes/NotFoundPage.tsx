import React from 'react';
import { useProto } from './ProtoContext';
import { usePageMeta } from './hooks';
import { SearchBlock } from './ui';
import { ArrowRight } from './icons';

export function NotFoundPage() {
  const { t, lang, navigate } = useProto();
  usePageMeta({ page: 'not-found', lang, title: '404', description: t('notFoundBody'), noindex: true });

  return (
    <div
      className="shell"
      style={{ padding: '4rem 1.5rem', display: 'grid', placeItems: 'center', minHeight: '62vh' }}
    >
      <div style={{ maxWidth: 560, textAlign: 'center' }}>
        <p
          aria-hidden="true"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(4rem, 14vw, 7rem)',
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--color-accent)',
            margin: '0 0 0.6rem',
          }}
        >
          404
        </p>
        <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.1rem)', marginBottom: '0.7rem' }}>
          {t('notFoundTitle')}
        </h1>
        <p
          style={{
            fontSize: '1rem',
            color: 'var(--color-muted)',
            lineHeight: 1.6,
            margin: '0 auto 1.8rem',
            maxWidth: 460,
          }}
        >
          {t('notFoundBody')}
        </p>

        <div style={{ marginBottom: '1.6rem', textAlign: 'left' }}>
          <SearchBlock variant="compact" />
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => navigate('home')} className="btn btn-primary">
            {t('navHome')} <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate('news')} className="btn btn-ghost">
            {t('navNews')}
          </button>
          <button onClick={() => navigate('subscribe')} className="btn btn-ghost">
            {t('subscribeCta')}
          </button>
        </div>
      </div>
    </div>
  );
}
