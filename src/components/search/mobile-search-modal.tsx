'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { POPULAR } from '@/components/home/hero-search';
import { SearchPreviewDropdown } from '@/components/search-preview-dropdown';
import { CloseIcon, SearchIcon } from '@/components/icons';
import { OverlayDrawer } from '@/components/ui/overlay-drawer';
import { useMobileSearch } from '@/hooks/use-mobile-search';
import { trackSearch } from '@/lib/analytics-client';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

/**
 * Single fullscreen mobile search modal (mounted once in the header). Reuses the
 * OverlayDrawer primitive (portal, backdrop, aria-modal, focus-trap, body-scroll-lock,
 * Escape). Focus returns to whatever the user tapped via OverlayDrawer's previous-focus
 * capture. Results render in-flow (variant="modal") so they can never be clipped.
 */
export function MobileSearchModal({ lang }: { lang: Lang }) {
  const t = getStrings(lang);
  const router = useRouter();
  const pathname = usePathname();
  const { open, triggerEl, closeSearch } = useMobileSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  // Inner column height tracks the visual viewport so results stay above the on-screen
  // keyboard (100dvh does not subtract the keyboard). null => fall back to h-full.
  const [vvHeight, setVvHeight] = useState<number | null>(null);

  // Reset the query each time the modal opens.
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  // Close on client navigation (belt-and-suspenders against a stuck overlay).
  useEffect(() => {
    closeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // If the viewport grows to desktop while open, close — otherwise the lg:hidden overlay
  // disappears visually but `open` stays true and the body remains scroll-locked.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    if (mq.matches) {
      closeSearch();
      return;
    }
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) closeSearch();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [open, closeSearch]);

  // Track the visual viewport (keyboard) only while open.
  useEffect(() => {
    if (!open || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setVvHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setVvHeight(null);
    };
  }, [open]);

  // Hide the rest of the page from assistive tech while open (Safari/VoiceOver honors
  // aria-modal inconsistently).
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const main = document.getElementById('main-content');
    main?.setAttribute('inert', '');
    return () => main?.removeAttribute('inert');
  }, [open]);

  function go(value: string) {
    const trimmed = value.trim();
    trackSearch(trimmed, 'modal', lang);
    inputRef.current?.blur(); // dismiss keyboard before the scroll-restore unlock
    router.push(trimmed ? `/${lang}/news?q=${encodeURIComponent(trimmed)}` : `/${lang}/news`);
    closeSearch();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    go(query);
  }

  function handleOpenChange(next: boolean) {
    if (next) return;
    // Capture the opener before closeSearch() nulls it, then restore focus on the next
    // frame (after the overlay unmounts). Explicit because WebKit/Safari don't focus a
    // <button> on tap, so OverlayDrawer's previous-focus fallback can't recover it.
    const returnTo = triggerEl;
    inputRef.current?.blur();
    closeSearch();
    if (returnTo) requestAnimationFrame(() => returnTo.focus({ preventScroll: true }));
  }

  const trimmed = query.trim();

  return (
    <OverlayDrawer
      open={open}
      onOpenChange={handleOpenChange}
      ariaLabel={t.searchModalTitle}
      placement="fullscreen"
      initialFocusRef={inputRef}
      panelTestId="mobile-search-panel"
      backdropTestId="mobile-search-backdrop"
      overlayClassName="bg-bg lg:hidden"
      panelClassName="bg-bg p-0"
    >
      <div
        data-testid="mobile-search-column"
        className="mx-auto flex h-full w-full max-w-[720px] flex-col px-4 pt-3"
        style={vvHeight ? { height: `${vvHeight}px` } : undefined}
      >
        <form role="search" onSubmit={submit} className="flex shrink-0 items-center gap-2">
          <span aria-hidden className="text-muted shrink-0">
            <SearchIcon size={20} />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.landing.searchPlaceholder}
            aria-label={t.searchModalTitle}
            autoComplete="off"
            enterKeyHint="search"
            className="text-text placeholder:text-faint min-w-0 flex-1 touch-manipulation border-0 bg-transparent py-2 text-base outline-none"
          />
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            aria-label={t.searchClose}
            className="text-muted hover:text-text inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full border-0 bg-transparent"
          >
            <CloseIcon />
          </button>
        </form>
        <div className="border-border mt-2 shrink-0 border-t" />
        {trimmed ? (
          <SearchPreviewDropdown
            lang={lang}
            query={query}
            open={open}
            variant="modal"
            onNavigate={closeSearch}
          />
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-faint w-full text-sm">{t.landing.searchPopular}</span>
            {POPULAR[lang].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => go(q)}
                className="border-border bg-surface text-muted rounded-pill hover:border-accent hover:text-text touch-manipulation border px-3 py-1.5 text-sm transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </OverlayDrawer>
  );
}
