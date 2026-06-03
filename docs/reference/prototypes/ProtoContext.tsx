import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Lang } from './data';
import { makeT } from './copy';
import { track, trackPageView, setUserProperties, updateConsent } from './analytics';
import { buildPath, parseHash, type ProtoPage, type RouteParams } from './routes';

export type { ProtoPage, RouteParams } from './routes';

/** Cookie/consent state (Consent Mode v2 categories beyond strictly necessary). */
export interface ConsentState {
  analytics: boolean;
  ads: boolean;
}
/** Demo jurisdiction toggle — EU shows a hard gate, UA shows a softer notice. */
export type ConsentRegion = 'EU' | 'UA';

const CONSENT_KEY = 'proto-consent-v1';

function loadConsent(): ConsentState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as ConsentState) : null;
  } catch {
    return null;
  }
}

interface ProtoCtx {
  lang: Lang;
  theme: 'dark' | 'light';
  page: ProtoPage;
  /** Slug / query params for the current route (item, brief, category, …). */
  routeParams: RouteParams;
  /** Drives the "what does loading look like" skeleton demo across pages. */
  loading: boolean;
  t: (key: string) => string;
  setLang: (l: Lang) => void;
  setTheme: (t: 'dark' | 'light') => void;
  navigate: (page: ProtoPage, params?: RouteParams) => void;
  /** Re-trigger the skeleton state on demand (prototype toolbar). */
  replayLoading: () => void;
  /** Initial query / category seeded by navigation (e.g. clicking a chip). */
  pendingQuery: string;
  pendingCategory: string | null;
  /** FEATURE spotlight — outlines and labels the research-backed features. */
  featureSpotlight: boolean;
  toggleFeatureSpotlight: () => void;
  /** FEATURE F5 — saved stories shared across the feed and the Saved drawer. */
  savedIds: string[];
  toggleSaved: (id: string) => void;
  savedOpen: boolean;
  setSavedOpen: (v: boolean) => void;
  /** F1 — subscribe modal opened from the header CTA / inline prompts. */
  subscribeOpen: boolean;
  setSubscribeOpen: (v: boolean) => void;
  /** Cookie-consent (CMP). `null` consent → the banner is shown. */
  consent: ConsentState | null;
  consentOpen: boolean;
  region: ConsentRegion;
  applyConsent: (next: ConsentState) => void;
  reopenConsent: () => void;
  resetConsent: () => void;
  setRegion: (r: ConsentRegion) => void;
  /** Home only: is the hero search still on screen? Drives the header search
   *  reveal — header search appears once the hero one scrolls away. */
  heroSearchInView: boolean;
  setHeroSearchInView: (v: boolean) => void;
}

const Ctx = createContext<ProtoCtx | null>(null);

export const useProto = (): ProtoCtx => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProto must be used inside <ProtoProvider>');
  return ctx;
};

/** Mirror the current route into location.hash so screens are deep-linkable. */
function syncHash(page: ProtoPage, lang: Lang, params: RouteParams) {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', `#${buildPath(page, lang, params)}`);
}

export function ProtoProvider({ children }: { children: React.ReactNode }) {
  // Seed from the URL hash so a refreshed / shared link lands on the right
  // screen (the prototype's stand-in for real permalinks).
  const initial = typeof window !== 'undefined' ? parseHash(window.location.hash) : null;

  const [lang, setLangState] = useState<Lang>(initial?.lang ?? 'uk');
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  const [page, setPage] = useState<ProtoPage>(initial?.page ?? 'home');
  const [routeParams, setRouteParams] = useState<RouteParams>(initial?.params ?? {});
  // Start in the loading state so the skeleton is the first thing rendered —
  // the brief that follows demonstrates the data-fetch transition.
  const [loading, setLoading] = useState(true);
  const [pendingQuery, setPendingQuery] = useState(initial?.params.query ?? '');
  const [pendingCategory, setPendingCategory] = useState<string | null>(
    initial?.params.category ?? null,
  );
  const [featureSpotlight, setFeatureSpotlight] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [consent, setConsent] = useState<ConsentState | null>(() => loadConsent());
  const [consentOpen, setConsentOpen] = useState<boolean>(() => loadConsent() === null);
  const [region, setRegion] = useState<ConsentRegion>('EU');
  // Home starts with the hero search visible at the top of the page.
  const [heroSearchInView, setHeroSearchInView] = useState((initial?.page ?? 'home') === 'home');

  function applyConsent(next: ConsentState) {
    setConsent(next);
    setConsentOpen(false);
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked — consent still applies for this session */
    }
    updateConsent(next);
    track('cookie_consent', { analytics: next.analytics, ads: next.ads });
  }
  function reopenConsent() {
    setConsentOpen(true);
  }
  function resetConsent() {
    try {
      localStorage.removeItem(CONSENT_KEY);
    } catch {
      /* ignore */
    }
    setConsent(null);
    setConsentOpen(true);
  }

  // Lang/theme go through wrappers so the choice is both tracked and published
  // as a GA4 user property (trust/UX dimension to slice every metric by).
  function setLang(l: Lang) {
    track('lang_switch', { to_lang: l });
    setUserProperties({ lang: l });
    setLangState(l);
    syncHash(page, l, routeParams);
  }
  function setTheme(value: 'dark' | 'light') {
    track('theme_toggle', { to_theme: value });
    setUserProperties({ theme: value });
    setThemeState(value);
  }

  const toggleSaved = (id: string) =>
    setSavedIds((ids) => {
      const next = ids.includes(id);
      track('save_toggle', { post_id: id, saved: !next });
      return next ? ids.filter((x) => x !== id) : [id, ...ids];
    });

  useEffect(() => {
    // Publish the initial dimensions + first page_view on boot.
    setUserProperties({ lang, theme: 'dark' });
    trackPageView(page, { lang });
    syncHash(page, lang, routeParams);
    // Re-apply a previously stored consent choice to Consent Mode on boot.
    const stored = loadConsent();
    if (stored) updateConsent(stored);
    const id = window.setTimeout(() => setLoading(false), 1100);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(next: ProtoPage, params: RouteParams = {}) {
    setPendingQuery(params.query ?? '');
    setPendingCategory(params.category ?? null);
    setRouteParams(params);
    syncHash(next, lang, params);
    trackPageView(next, {
      lang,
      ...(params.query ? { entry: 'search', query: params.query } : {}),
      ...(params.category ? { entry: 'category', category: params.category } : {}),
    });
    // Home scrolls to top where the hero search is visible; other pages have no
    // hero search, so the header search shows immediately. Set synchronously to
    // avoid a flash of the header search on home navigation.
    setHeroSearchInView(next === 'home');
    setPage(next);
    // Simulate a brief network fetch so the skeleton state is demonstrable
    // on every navigation — this is the "loading data" requirement made
    // tangible. Real wiring would key this off the fetch promise.
    setLoading(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => setLoading(false), 900);
  }

  function replayLoading() {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1100);
  }

  const t = makeT(lang);

  return (
    <Ctx.Provider
      value={{
        lang,
        theme,
        page,
        routeParams,
        loading,
        t,
        setLang,
        setTheme,
        navigate,
        replayLoading,
        pendingQuery,
        pendingCategory,
        featureSpotlight,
        toggleFeatureSpotlight: () => setFeatureSpotlight((v) => !v),
        savedIds,
        toggleSaved,
        savedOpen,
        setSavedOpen,
        subscribeOpen,
        setSubscribeOpen,
        consent,
        consentOpen,
        region,
        applyConsent,
        reopenConsent,
        resetConsent,
        setRegion,
        heroSearchInView,
        setHeroSearchInView,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
