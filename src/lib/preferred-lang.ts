import { DEFAULT_LANG, isLang, type Lang } from '@/lib/site';

/** Persisted locale from visiting `/{lang}` or the header language switcher. */
export const LANG_COOKIE = 'atb-lang';

export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type LangCandidate = { base: string; q: number };

function parseAcceptLanguageEntries(header: string): LangCandidate[] {
  return header.split(',').map((part) => {
    const [tag, ...params] = part.trim().split(';');
    const qParam = params.find((p) => p.trim().startsWith('q='));
    const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
    const base = tag.trim().toLowerCase().split('-')[0] ?? '';
    return { base, q: Number.isFinite(q) ? q : 0 };
  });
}

/** Highest-q tag wins; only `en` and `uk` are considered. */
export function parseAcceptLanguage(header: string | null | undefined): Lang | null {
  if (!header?.trim()) return null;
  const sorted = parseAcceptLanguageEntries(header).sort((a, b) => b.q - a.q);
  for (const { base } of sorted) {
    if (base === 'uk') return 'uk';
    if (base === 'en') return 'en';
  }
  return null;
}

export function countrySuggestsUk(country: string | null | undefined): boolean {
  return country?.trim().toUpperCase() === 'UA';
}

/**
 * Root redirect locale: saved choice → Ukraine geo → browser language → EN default.
 * EN stays x-default for SEO; UA visitors should land on `/uk` without picking manually.
 */
export function resolvePreferredLang(input: {
  cookieLang?: string | null;
  acceptLanguage?: string | null;
  country?: string | null;
}): Lang {
  if (isLang(input.cookieLang)) return input.cookieLang;
  if (countrySuggestsUk(input.country)) return 'uk';
  const fromAccept = parseAcceptLanguage(input.acceptLanguage);
  if (fromAccept) return fromAccept;
  return DEFAULT_LANG;
}

/** Swap `/{lang}` prefix for the header language toggle. */
export function alternateLangHref(pathname: string | null, lang: Lang): string {
  const alt: Lang = lang === 'uk' ? 'en' : 'uk';
  if (pathname && /^\/(en|uk)(\/|$)/.test(pathname)) {
    return pathname.replace(/^\/(en|uk)/, `/${alt}`);
  }
  return `/${alt}`;
}
