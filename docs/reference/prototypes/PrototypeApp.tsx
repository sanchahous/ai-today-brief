import React, { useEffect } from 'react';
import { ProtoProvider, useProto } from './ProtoContext';
import { Shell } from './Shell';
import { HomePrototype } from './HomePrototype';
import { AllNewsPrototype } from './AllNewsPrototype';
import { SubscribePage } from './SubscribePage';
import { AboutPage } from './AboutPage';
import { LegalPage } from './LegalPage';
import { NotFoundPage } from './NotFoundPage';
import { ItemPage } from './ItemPage';
import { BriefPage } from './BriefPage';
import { CategoryPage } from './CategoryPage';
import { ConceptPage } from './ConceptPage';
import { SearchPage } from './SearchPage';
import { AdvertisePage } from './AdvertisePage';
import { DashboardPage } from './DashboardPage';
import { usePageMeta } from './hooks';
import { track } from './analytics';
import { POSTS, postSlug } from './data';
import type { ProtoPage, RouteParams } from './routes';

/** Fire scroll_depth at 25/50/75/100% once per page — engagement signal. */
function useScrollDepth(page: string) {
  useEffect(() => {
    const seen = new Set<number>();
    const thresholds = [25, 50, 75, 100];
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? (window.scrollY / max) * 100 : 100;
      for (const tHold of thresholds) {
        if (pct >= tHold && !seen.has(tHold)) {
          seen.add(tHold);
          track('scroll_depth', { page, percent: tHold });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [page]);
}

/** i18n key for each screen's label (toolbar navigator + placeholder titles). */
const SCREEN_LABEL_KEY: Record<ProtoPage, string> = {
  home: 'scHome',
  news: 'scNews',
  item: 'scItem',
  brief: 'scBrief',
  category: 'scCategory',
  concept: 'scConcept',
  search: 'scSearch',
  subscribe: 'scSubscribe',
  about: 'scAbout',
  advertise: 'scAdvertise',
  privacy: 'scPrivacy',
  terms: 'scTerms',
  'ai-disclosure': 'scAiDisclosure',
  dashboard: 'scDashboard',
  'not-found': 'sc404',
};

/** Toolbar groups → the screens under them (drives the grouped <select>). */
const SCREEN_GROUPS: { groupKey: string; pages: ProtoPage[] }[] = [
  { groupKey: 'grpProduct', pages: ['home', 'news', 'item', 'brief', 'category', 'concept', 'search'] },
  { groupKey: 'grpTrust', pages: ['subscribe', 'about', 'advertise'] },
  { groupKey: 'grpLegal', pages: ['privacy', 'terms', 'ai-disclosure'] },
  { groupKey: 'grpSystem', pages: ['dashboard', 'not-found'] },
];

/** Representative params so toolbar jumps to slug pages produce a real path. */
const SAMPLE_PARAMS: Partial<Record<ProtoPage, RouteParams>> = {
  item: { itemSlug: postSlug(POSTS[0]) },
  brief: { briefSlug: 'latest' },
  category: { categorySlug: 'tools-and-releases' },
  concept: { conceptSlug: 'claude-code' },
  search: { query: 'MCP' },
};

/** Which build slice ships each screen (shown on the placeholder). */
const SLICE_OF: Record<ProtoPage, number> = {
  home: 0,
  news: 0,
  subscribe: 1,
  about: 1,
  privacy: 2,
  terms: 2,
  'ai-disclosure': 2,
  'not-found': 2,
  item: 3,
  brief: 3,
  category: 3,
  concept: 3,
  search: 3,
  advertise: 4,
  dashboard: 5,
};

/**
 * Standalone prototype harness. Self-contained on mock data — no Supabase —
 * so every screen renders anywhere. The floating toolbar lets a reviewer jump
 * between screens, replay the loading/skeleton state and spotlight features.
 */
function PrototypeInner() {
  const { page } = useProto();
  useScrollDepth(page);
  return (
    <Shell>
      <ScreenRouter page={page} />
      <ProtoToolbar />
    </Shell>
  );
}

function ScreenRouter({ page }: { page: ProtoPage }) {
  switch (page) {
    case 'home':
      return <HomePrototype />;
    case 'news':
      return <AllNewsPrototype />;
    case 'subscribe':
      return <SubscribePage />;
    case 'about':
      return <AboutPage />;
    case 'privacy':
      return <LegalPage doc="privacy" />;
    case 'terms':
      return <LegalPage doc="terms" />;
    case 'ai-disclosure':
      return <LegalPage doc="ai-disclosure" />;
    case 'item':
      return <ItemPage />;
    case 'brief':
      return <BriefPage />;
    case 'category':
      return <CategoryPage />;
    case 'concept':
      return <ConceptPage />;
    case 'search':
      return <SearchPage />;
    case 'advertise':
      return <AdvertisePage />;
    case 'dashboard':
      return <DashboardPage />;
    case 'not-found':
      return <NotFoundPage />;
    default:
      return <PlaceholderPage page={page} />;
  }
}

/** Temporary stand-in for screens not yet built — keeps every nav target alive. */
function PlaceholderPage({ page }: { page: ProtoPage }) {
  const { t, lang, navigate } = useProto();
  const label = t(SCREEN_LABEL_KEY[page]);
  usePageMeta({ page, lang, title: label, description: label, noindex: true });
  return (
    <div
      className="shell"
      style={{
        minHeight: '60vh',
        display: 'grid',
        placeItems: 'center',
        padding: '4rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 460 }}>
        <p className="eyebrow" style={{ marginBottom: '0.6rem' }}>
          {t('protoLabel')}
        </p>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', marginBottom: '0.6rem' }}>{label}</h1>
        <p style={{ color: 'var(--color-muted)', lineHeight: 1.6, marginBottom: '1.4rem' }}>
          {lang === 'uk'
            ? `Цей екран додається у слайсі ${SLICE_OF[page]} збірки прототипу.`
            : `This screen ships in build slice ${SLICE_OF[page]} of the prototype.`}
        </p>
        <button onClick={() => navigate('home')} className="btn btn-ghost" style={{ display: 'inline-flex' }}>
          {t('navHome')}
        </button>
      </div>
    </div>
  );
}

function ProtoToolbar() {
  const {
    t,
    page,
    loading,
    navigate,
    replayLoading,
    featureSpotlight,
    toggleFeatureSpotlight,
    resetConsent,
    region,
    setRegion,
  } = useProto();

  const ghostPill: React.CSSProperties = {
    fontSize: '0.8rem',
    fontWeight: 600,
    padding: '0.4rem 0.8rem',
    borderRadius: 999,
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-muted)',
    cursor: 'pointer',
  };

  return (
    <div
      role="toolbar"
      aria-label={t('protoLabel')}
      style={{
        position: 'fixed',
        bottom: '1.1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.4rem 0.5rem',
        background: 'color-mix(in srgb, var(--color-bg) 82%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--color-border)',
        borderRadius: 999,
        boxShadow: 'var(--shadow-pop)',
        maxWidth: 'calc(100vw - 1.5rem)',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontSize: '0.66rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-faint)',
          padding: '0 0.4rem',
        }}
      >
        {t('protoLabel')}
      </span>

      <label htmlFor="proto-screen" className="sr-only">
        {t('protoScreen')}
      </label>
      <select
        id="proto-screen"
        value={page}
        onChange={(e) => {
          const next = e.target.value as ProtoPage;
          navigate(next, SAMPLE_PARAMS[next]);
        }}
        style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          padding: '0.4rem 0.6rem',
          color: 'var(--color-text)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 999,
          cursor: 'pointer',
          maxWidth: 200,
        }}
      >
        {SCREEN_GROUPS.map((g) => (
          <optgroup key={g.groupKey} label={t(g.groupKey)}>
            {g.pages.map((p) => (
              <option key={p} value={p}>
                {t(SCREEN_LABEL_KEY[p])}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <span aria-hidden="true" style={{ width: 1, height: 18, background: 'var(--color-border)' }} />

      <button
        onClick={replayLoading}
        disabled={loading}
        style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          padding: '0.4rem 0.8rem',
          borderRadius: 999,
          border: '1px solid var(--color-border)',
          background: 'transparent',
          color: 'var(--color-muted)',
          cursor: loading ? 'progress' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? `${t('loading')}` : t('protoLoading')}
      </button>
      <button
        onClick={toggleFeatureSpotlight}
        aria-pressed={featureSpotlight}
        style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          padding: '0.4rem 0.8rem',
          borderRadius: 999,
          border: `1px solid ${featureSpotlight ? 'var(--color-accent)' : 'var(--color-border)'}`,
          background: featureSpotlight ? 'var(--color-accent)' : 'transparent',
          color: featureSpotlight ? '#141414' : 'var(--color-muted)',
          cursor: 'pointer',
        }}
      >
        {t('protoFeatures')}
      </button>

      <span aria-hidden="true" style={{ width: 1, height: 18, background: 'var(--color-border)' }} />

      <button onClick={resetConsent} style={ghostPill} title={t('protoResetConsent')}>
        🍪
      </button>
      <button
        onClick={() => setRegion(region === 'EU' ? 'UA' : 'EU')}
        style={ghostPill}
        title={t('protoRegion')}
      >
        {region}
      </button>
    </div>
  );
}

export function PrototypeApp() {
  return (
    <ProtoProvider>
      <PrototypeInner />
    </ProtoProvider>
  );
}
