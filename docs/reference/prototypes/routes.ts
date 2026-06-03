/**
 * Lightweight in-prototype router.
 *
 * The prototype is a single Vite bundle with no real router; navigation is
 * held in `ProtoContext` state. This module gives that state a URL grammar so
 * every screen has a representative, shareable hash path (`#/uk/news/<slug>`)
 * — enough to demonstrate the permalink/SEO story without pulling in a router
 * library or touching vite.config. `buildPath` is reused by `usePageMeta` to
 * produce canonical + hreflang URLs.
 */
import type { Lang } from './data';

export type ProtoPage =
  | 'home'
  | 'news'
  | 'item'
  | 'brief'
  | 'category'
  | 'concept'
  | 'search'
  | 'subscribe'
  | 'about'
  | 'advertise'
  | 'privacy'
  | 'terms'
  | 'ai-disclosure'
  | 'dashboard'
  | 'not-found';

export interface RouteParams {
  itemSlug?: string;
  briefSlug?: string;
  categorySlug?: string;
  conceptSlug?: string;
  /** Free-text search query (news + search pages). */
  query?: string;
  /** Category filter carried into the news feed (back-compat with existing callers). */
  category?: string;
}

const LANGS: Lang[] = ['uk', 'en'];

/** Pages that have no localized variant — served at a lang-less path. */
const LANGLESS = new Set<ProtoPage>(['privacy', 'terms', 'ai-disclosure', 'dashboard', 'not-found']);

export function isLangless(page: ProtoPage): boolean {
  return LANGLESS.has(page);
}

/** Build the canonical path (no origin) for a page + params. */
export function buildPath(page: ProtoPage, lang: Lang, params: RouteParams = {}): string {
  const q = params.query ? `?q=${encodeURIComponent(params.query)}` : '';
  switch (page) {
    case 'home':
      return `/${lang}`;
    case 'news':
      return `/${lang}/news${q}`;
    case 'item':
      return `/${lang}/news/${params.itemSlug ?? ''}`;
    case 'brief':
      return `/${lang}/brief/${params.briefSlug ?? ''}`;
    case 'category':
      return `/${lang}/category/${params.categorySlug ?? ''}`;
    case 'concept':
      return `/${lang}/concepts/${params.conceptSlug ?? ''}`;
    case 'search':
      return `/${lang}/search${q}`;
    case 'subscribe':
      return `/${lang}/subscribe`;
    case 'about':
      return `/${lang}/about`;
    case 'advertise':
      return `/${lang}/advertise`;
    case 'privacy':
      return `/privacy`;
    case 'terms':
      return `/terms`;
    case 'ai-disclosure':
      return `/ai-disclosure`;
    case 'dashboard':
      return `/status`;
    case 'not-found':
      return `/404`;
  }
}

export interface ParsedRoute {
  page: ProtoPage;
  lang: Lang | null;
  params: RouteParams;
}

/** Parse `location.hash` (`#/uk/news/foo?q=bar`) back into a route. */
export function parseHash(hash: string): ParsedRoute | null {
  const raw = hash.replace(/^#/, '');
  if (!raw || raw === '/') return null;

  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const params: RouteParams = {};
  if (queryPart) {
    const q = new URLSearchParams(queryPart).get('q');
    if (q) params.query = q;
  }

  // Lang-less pages first.
  const first = segments[0];
  if (first === 'privacy') return { page: 'privacy', lang: null, params };
  if (first === 'terms') return { page: 'terms', lang: null, params };
  if (first === 'ai-disclosure') return { page: 'ai-disclosure', lang: null, params };
  if (first === 'status') return { page: 'dashboard', lang: null, params };
  if (first === '404') return { page: 'not-found', lang: null, params };

  // Localized pages: /:lang/...
  const lang = (LANGS as string[]).includes(first) ? (first as Lang) : null;
  if (!lang) return null;
  const rest = segments.slice(1);

  if (rest.length === 0) return { page: 'home', lang, params };

  switch (rest[0]) {
    case 'news':
      if (rest[1]) {
        params.itemSlug = rest[1];
        return { page: 'item', lang, params };
      }
      return { page: 'news', lang, params };
    case 'brief':
      params.briefSlug = rest[1];
      return { page: 'brief', lang, params };
    case 'category':
      params.categorySlug = rest[1];
      return { page: 'category', lang, params };
    case 'concepts':
      params.conceptSlug = rest[1];
      return { page: 'concept', lang, params };
    case 'search':
      return { page: 'search', lang, params };
    case 'subscribe':
      return { page: 'subscribe', lang, params };
    case 'about':
      return { page: 'about', lang, params };
    case 'advertise':
      return { page: 'advertise', lang, params };
    default:
      return { page: 'not-found', lang, params };
  }
}
