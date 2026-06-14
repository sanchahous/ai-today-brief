'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  CONSENT_STORAGE_KEY,
  parseConsentJson,
  type ConsentState,
} from '@/lib/consent';
import {
  applyConsentToGtag,
  dispatchOpenConsent,
  OPEN_CONSENT_EVENT,
  trackEvent,
} from '@/lib/analytics-client';
import type { Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';

function ConsentSwitch({
  on,
  disabled,
  label,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  label: string;
  onChange?: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full border transition ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${on ? 'border-accent bg-accent' : 'border-border bg-surface-2'}`}
    >
      <span
        aria-hidden
        className={`absolute top-[2px] h-4 w-4 rounded-full transition-[left] ${
          on ? 'left-[18px] bg-[#141414]' : 'left-[2px] bg-[var(--faint)]'
        }`}
      />
    </button>
  );
}

function persistConsent(next: ConsentState): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
  applyConsentToGtag(next);
  trackEvent('cookie_consent', { analytics: next.analytics, ads: next.ads });
}

function loadStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    return raw ? parseConsentJson(raw) : null;
  } catch {
    return null;
  }
}

export function CookieConsent({ lang }: { lang: Lang }) {
  const strings = getStrings(lang);
  const c = strings.cookie;
  const region = lang === 'uk' ? 'UA' : 'EU';
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  /** null = not yet read from storage (SSR/hydration). */
  const [hasStoredConsent, setHasStoredConsent] = useState<boolean | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [ads, setAds] = useState(false);

  const apply = useCallback((choice: { analytics: boolean; ads: boolean }) => {
    const next: ConsentState = {
      ...choice,
      updatedAt: new Date().toISOString(),
    };
    persistConsent(next);
    setHasStoredConsent(true);
    setPrefsOpen(false);
  }, []);

  useEffect(() => {
    const stored = loadStoredConsent();
    setHasStoredConsent(stored !== null);
    if (stored) {
      setAnalytics(stored.analytics);
      setAds(stored.ads);
      applyConsentToGtag(stored);
    }
  }, []);

  useEffect(() => {
    const onOpen = () => setPrefsOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, onOpen);
  }, []);

  if (!isClient || hasStoredConsent === null) return null;
  if (hasStoredConsent && !prefsOpen) return null;

  const categories = [
    { key: 'essential', on: true, locked: true as const },
    { key: 'analytics', on: analytics, set: setAnalytics },
    { key: 'ads', on: ads, set: setAds },
  ] as const;

  const titleByKey = {
    essential: c.cookieEssential,
    analytics: c.cookieAnalytics,
    ads: c.cookieAds,
  } as const;
  const descByKey = {
    essential: c.cookieEssentialDesc,
    analytics: c.cookieAnalyticsDesc,
    ads: c.cookieAdsDesc,
  } as const;

  return (
    <div
      role="region"
      aria-label={c.cookieTitle}
      className="border-border bg-bg shadow-pop pointer-events-auto fixed bottom-4 left-4 z-[100] w-[min(440px,calc(100vw-2rem))] rounded-[var(--radius)] border p-5"
    >
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-base font-semibold">{c.cookieTitle}</h2>
        <span
          className="text-faint border-border ml-auto rounded-full border px-2 py-0.5 text-[0.6rem] font-bold tracking-wide uppercase"
          title={c.cookieRegionNote}
        >
          {region}
        </span>
      </div>

      <p className="text-muted mb-4 text-sm leading-relaxed">
        {region === 'UA' ? c.cookieBodyUA : c.cookieBodyEU}{' '}
        <Link href={`/${lang}/privacy`} className="text-accent underline">
          {c.cookiePolicy}
        </Link>
      </p>

      {prefsOpen ? (
        <div className="mb-4 grid gap-2">
          {categories.map((cat) => (
            <div
              key={cat.key}
              className="border-border bg-surface flex items-start gap-3 rounded-md border p-3"
            >
              <div className="min-w-0 flex-1">
                <strong className="text-sm">{titleByKey[cat.key]}</strong>
                <p className="text-muted mt-0.5 text-xs leading-snug">{descByKey[cat.key]}</p>
              </div>
              <ConsentSwitch
                on={cat.on}
                disabled={'locked' in cat && cat.locked}
                onChange={'set' in cat ? cat.set : undefined}
                label={titleByKey[cat.key]}
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {prefsOpen ? (
          <>
            <button
              type="button"
              onClick={() => apply({ analytics, ads })}
              className="rounded-pill bg-accent text-on-accent flex-1 px-4 py-2.5 text-sm font-semibold"
            >
              {c.cookieSave}
            </button>
            <button
              type="button"
              onClick={() => setPrefsOpen(false)}
              className="rounded-pill border-border text-muted border px-4 py-2.5 text-sm font-semibold"
            >
              {strings.news.prev}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => apply({ analytics: true, ads: true })}
              className="rounded-pill bg-accent text-on-accent flex-1 px-4 py-2.5 text-sm font-semibold"
            >
              {c.cookieAccept}
            </button>
            <button
              type="button"
              onClick={() => apply({ analytics: false, ads: false })}
              className="rounded-pill border-border text-muted border px-4 py-2.5 text-sm font-semibold"
            >
              {c.cookieReject}
            </button>
            <button
              type="button"
              onClick={() => setPrefsOpen(true)}
              className="text-muted px-2 py-2 text-sm font-semibold"
            >
              {c.cookieManage}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Footer control to reopen CMP preferences. */
export function CookieSettingsButton({ lang }: { lang: Lang }) {
  const t = getStrings(lang);
  return (
    <button
      type="button"
      onClick={() => dispatchOpenConsent()}
      className="hover:text-text inline-flex min-h-10 items-center text-left text-sm"
    >
      {t.footerCookie}
    </button>
  );
}
