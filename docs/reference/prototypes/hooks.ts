import { useEffect, useRef } from 'react';
import type { Lang } from './data';
import { SITE_URL, SITE_NAME } from './config';
import { buildPath, isLangless, type ProtoPage, type RouteParams } from './routes';

const OG_IMAGE = `${SITE_URL}/og-image.png`;

/**
 * Scroll-reveal: adds `.is-in` when the element first enters the viewport.
 * Pure IntersectionObserver — no dependency, and the CSS already disables
 * the transform under prefers-reduced-motion.
 *
 * Lives outside context.tsx so that file only exports React components/its
 * own hook — keeps Fast Refresh happy (react-refresh/only-export-components).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/**
 * FEATURE F6 — inject a JSON-LD <script> into <head> and keep it in sync.
 * Demonstrates the structured-data layer (Organization / ItemList / FAQPage /
 * BreadcrumbList) that drives rich results and AI/answer-engine parsing.
 */
export function useJsonLd(id: string, data: unknown) {
  useEffect(() => {
    const elId = `proto-jsonld-${id}`;
    let el = document.getElementById(elId) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = elId;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {
      document.getElementById(elId)?.remove();
    };
  }, [id, data]);
}

// ── per-page SEO meta (mirrors src/lib/pageMeta.ts + adds hreflang) ───────────
function setMeta(name: string, content: string) {
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setOg(property: string, content: string) {
  let el = document.head.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]:not([hreflang])`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

const ALL_LANGS: Lang[] = ['uk', 'en'];

/** Rebuild the hreflang alternates for the current page (cleared on each run). */
function setHreflangAlternates(page: ProtoPage, params: RouteParams) {
  document.head.querySelectorAll('link[data-proto-alt]').forEach((n) => n.remove());
  const add = (hreflang: string, href: string) => {
    const el = document.createElement('link');
    el.rel = 'alternate';
    el.setAttribute('hreflang', hreflang);
    el.setAttribute('data-proto-alt', '');
    el.href = href;
    document.head.appendChild(el);
  };
  if (isLangless(page)) {
    add('x-default', SITE_URL + buildPath(page, 'en', params));
    return;
  }
  ALL_LANGS.forEach((l) => add(l, SITE_URL + buildPath(page, l, params)));
  add('x-default', SITE_URL + buildPath(page, 'en', params));
}

/**
 * Set document title, description, canonical, OpenGraph/Twitter and hreflang
 * for a screen. The prototype is globally `noindex` (it's a prototype), but
 * wiring these per-page demonstrates the production SEO intent: every screen
 * owns a canonical URL, language alternates and social cards.
 */
export function usePageMeta(opts: {
  page: ProtoPage;
  lang: Lang;
  title: string;
  description: string;
  params?: RouteParams;
  /** Pages like search / 404 that should not be indexed even in production. */
  noindex?: boolean;
}) {
  const { page, lang, title, description, params = {}, noindex } = opts;
  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    const canonical = SITE_URL + buildPath(page, lang, params);
    document.title = `${title} · ${SITE_NAME}`;
    document.documentElement.lang = lang;
    setMeta('description', description);
    upsertLink('canonical', canonical);
    setOg('og:title', title);
    setOg('og:description', description);
    setOg('og:url', canonical);
    setOg('og:type', page === 'item' ? 'article' : 'website');
    setOg('og:site_name', SITE_NAME);
    setOg('og:image', OG_IMAGE);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', OG_IMAGE);
    setHreflangAlternates(page, params);
    // The prototype index.html keeps a global robots:noindex; expose the
    // production *intent* per page so the SEO story is visible in devtools.
    setMeta('robots:intent', noindex ? 'noindex, follow' : 'index, follow');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, lang, title, description, paramsKey, noindex]);
}
