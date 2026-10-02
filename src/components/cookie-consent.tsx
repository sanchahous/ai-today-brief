'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useFocusTrap } from '@/hooks/use-focus-trap';
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

/** Footer trigger — focus returns here after the card closes from a footer reopen. */
export const footerConsentTriggerRef = { current: null as HTMLButtonElement | null };

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
  const [openedFromFooter, setOpenedFromFooter] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

  const visible = isClient && hasStoredConsent !== null && (!hasStoredConsent || prefsOpen || openedFromFooter);

  const dismiss = useCallback(() => {
    setPrefsOpen(false);
    setOpenedFromFooter(false);
  }, []);

  const apply = useCallback((choice: { analytics: boolean; ads: boolean }) => {
    const next: ConsentState = {
      ...choice,
      updatedAt: new Date().toISOString(),
    };
    persistConsent(next);
    setHasStoredConsent(true);
    dismiss();
  }, [dismiss]);

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
    returnFocusRef.current = footerConsentTriggerRef.current;
  });

  useEffect(() => {
    const onOpen = () => {
      const stored = loadStoredConsent();
      if (stored) {
        setAnalytics(stored.analytics);
        setAds(stored.ads);
      }
      setOpenedFromFooter(true);
      setPrefsOpen(false);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, onOpen);
  }, []);

  useFocusTrap({
    active: visible && openedFromFooter,
    containerRef: cardRef,
    initialFocusRef: acceptRef,
    returnFocusRef,
    onEscape: dismiss,
  });

  if (!visible) return null;

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
      ref={cardRef}
      role="region"
      aria-label={c.cookieTitle}
      data-testid="cookie-consent"
      className={`border-border bg-raised shadow-pop pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-[100] w-[min(440px,calc(100vw-2rem))] overflow-y-auto rounded-[var(--radius-card)] border p-5 ${
        prefsOpen
          ? 'max-h-[min(420px,calc(100dvh-2rem))]'
          : 'max-h-[min(240px,calc(100dvh-2rem))] sm:max-h-[min(420px,calc(100dvh-2rem))]'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-base font-semibold">{c.cookieTitle}</h2>
        <span
          className="text-faint border-border ml-auto rounded-full border px-2 py-0.5 text-2xs font-bold tracking-wide uppercase"
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
        <div className="mb-4 grid gap-2" id="cookie-consent-panel">
          {categories.map((cat) => (
            <div
              key={cat.key}
              className="border-border bg-surface rounded-md border p-3"
            >
              <Switch
                label={titleByKey[cat.key]}
                description={descByKey[cat.key]}
                checked={cat.on}
                readOnly={'locked' in cat && cat.locked}
                disabled={'locked' in cat && cat.locked}
                onChange={
                  'set' in cat
                    ? (event) => cat.set(event.target.checked)
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {prefsOpen ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              className="min-h-[44px] min-w-[44px] flex-1"
              onClick={() => apply({ analytics, ads })}
            >
              {c.cookieSave}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              className="min-h-[44px] min-w-[44px] flex-1"
              onClick={() => setPrefsOpen(false)}
            >
              {strings.news.prev}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                ref={acceptRef}
                type="button"
                variant="primary"
                size="md"
                className="min-h-[44px] min-w-[44px] flex-1"
                onClick={() => apply({ analytics: true, ads: true })}
              >
                {c.cookieAccept}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                className="min-h-[44px] min-w-[44px] flex-1"
                onClick={() => apply({ analytics: false, ads: false })}
              >
                {c.cookieReject}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="min-h-[44px] min-w-[44px] self-start"
              aria-expanded={prefsOpen}
              aria-controls="cookie-consent-panel"
              onClick={() => setPrefsOpen(true)}
            >
              {c.cookieManage}
            </Button>
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
      ref={(node) => {
        footerConsentTriggerRef.current = node;
      }}
      onClick={() => dispatchOpenConsent()}
      className="text-muted hover:text-accent inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center text-left text-sm transition-colors"
    >
      {t.footerCookie}
    </button>
  );
}
