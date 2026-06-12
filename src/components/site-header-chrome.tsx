'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { alternateLangHref } from '@/lib/preferred-lang';
import { SITE_NAME, MARK_COLOR, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { trackEvent } from '@/lib/analytics-client';
import { HeaderSearchField } from '@/components/header-search-field';
import { ThemeToggle } from '@/components/theme-toggle';
import { OverlayDrawer } from '@/components/ui/overlay-drawer';
import { CategoryGlyph, CloseIcon, MenuIcon, ArrowRight } from '@/components/icons';
import type { IconKey } from '@/components/icons';

export type NavCategory = {
  slug: string;
  name: string;
  color: string | null;
  icon: IconKey;
};

export function SiteHeaderChrome({ lang, categories }: { lang: Lang; categories: NavCategory[] }) {
  const t = getStrings(lang);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const catsRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const mobileMenuId = 'site-mobile-menu';
  const mobileMenuTitleId = 'site-mobile-menu-title';

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (!catsOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCatsOpen(false);
    }
    function onDoc(e: MouseEvent) {
      if (catsRef.current && !catsRef.current.contains(e.target as Node)) setCatsOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [catsOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const navLink = (href: string, label: string, active?: boolean) => (
    <Link
      href={href}
      className={`border-b-2 pb-0.5 text-[0.9rem] font-medium transition-colors duration-200 ${
        active
          ? 'text-text border-accent font-semibold'
          : 'text-muted hover:text-text border-transparent'
      }`}
    >
      {label}
    </Link>
  );

  const langToggleHref = alternateLangHref(pathname, lang);
  const targetLang: Lang = lang === 'uk' ? 'en' : 'uk';

  function trackLangSwitch() {
    trackEvent('lang_switch', { to_lang: targetLang });
  }

  return (
    <header className="site-header-shell border-border-soft sticky top-0 z-50 border-b">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="flex h-[calc(var(--header-h)-1px)] items-center gap-2 lg:gap-3">
          <Link href={`/${lang}`} className="flex shrink-0 items-center gap-2 no-underline">
            <span
              aria-hidden
              className="border-border bg-surface-2 grid h-8 w-8 place-items-center rounded-[9px] border font-mono text-xs font-bold"
              style={{ color: MARK_COLOR }}
            >
              AT
            </span>
            <span className="font-serif text-lg font-semibold text-[color:inherit]">
              {SITE_NAME}
            </span>
          </Link>

          <div className="mx-1 hidden min-w-0 flex-1 md:flex lg:mx-2">
            <HeaderSearchField
              lang={lang}
              placeholder={t.landing.searchPlaceholder}
              className="max-w-[clamp(10rem,24vw,26rem)] lg:max-w-[clamp(10rem,22vw,32rem)] xl:max-w-xl"
            />
          </div>

          <nav aria-label="Primary" className="ml-auto hidden shrink-0 flex-nowrap items-center gap-3 lg:flex xl:gap-5">
            {navLink(`/${lang}`, t.navHome, pathname === `/${lang}`)}
            {navLink(`/${lang}/news`, t.nav.news, isActive(`/${lang}/news`))}
            {navLink(`/${lang}/concepts`, t.nav.concepts, isActive(`/${lang}/concepts`))}
            {navLink(`/${lang}/guides`, t.guidesTitle, isActive(`/${lang}/guides`))}
            {navLink(`/${lang}/tools`, t.nav.tools, isActive(`/${lang}/tools`))}
            <div ref={catsRef} className="relative" onMouseLeave={() => setCatsOpen(false)}>
              <button
                type="button"
                onClick={() => setCatsOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={catsOpen}
                className={`inline-flex items-center gap-1 border-b-2 pb-0.5 text-[0.9rem] font-medium transition-colors duration-200 ${
                  pathname.includes('/category/')
                    ? 'text-text border-accent font-semibold'
                    : 'text-muted hover:text-text border-transparent'
                }`}
              >
                {t.navCategories}
                <ArrowRight
                  size={13}
                  className={`opacity-60 transition-transform duration-200 ${catsOpen ? 'rotate-90' : ''}`}
                />
              </button>
              {catsOpen ? (
                <div className="absolute top-full left-1/2 z-[70] -translate-x-1/2 pt-2">
                  <ul
                    role="listbox"
                    aria-label={t.navCategories}
                    className="border-border bg-bg shadow-pop grid w-[300px] max-w-[90vw] grid-cols-2 gap-0.5 rounded-[10px] border p-1"
                  >
                    {categories.map((c) => (
                      <li key={c.slug} role="none">
                        <Link
                          role="option"
                          href={`/${lang}/category/${c.slug}`}
                          onClick={() => setCatsOpen(false)}
                          className="text-text hover:bg-surface flex items-center gap-2 rounded-md px-2 py-2 text-[0.82rem] no-underline transition-colors duration-200"
                        >
                          <span
                            className="cat-fg inline-flex shrink-0"
                            style={{ '--cat-color': c.color ?? '#888' } as React.CSSProperties}
                          >
                            <CategoryGlyph icon={c.icon} size={16} strokeWidth={1.7} />
                          </span>
                          <span className="truncate">{c.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            {navLink(`/${lang}/about`, t.navAbout, isActive(`/${lang}/about`))}
            <span aria-hidden className="bg-border h-[18px] w-px" />
            <Link
              href={`/${lang}/subscribe`}
              className="rounded-pill bg-accent text-on-accent px-3.5 py-1.5 text-[0.85rem] font-semibold no-underline transition-opacity duration-200 hover:opacity-90"
            >
              {t.subscribe}
            </Link>
            <Link
              href={langToggleHref}
              aria-label={t.langSwitch}
              onClick={trackLangSwitch}
              className="text-accent text-[0.85rem] font-semibold no-underline transition-opacity duration-200 hover:opacity-80"
            >
              {lang === 'uk' ? 'EN' : 'UA'}
            </Link>
            <ThemeToggle label={t.themeToggle} />
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <ThemeToggle label={t.themeToggle} />
            <Link
              href={`/${lang}/subscribe`}
              className={`rounded-pill bg-accent text-on-accent px-3 py-1.5 text-xs font-semibold no-underline ${menuOpen ? 'hidden' : 'hidden sm:inline-flex'}`}
              aria-hidden={menuOpen}
            >
              {t.subscribe}
            </Link>
            <button
              ref={menuTriggerRef}
              type="button"
              aria-label={menuOpen ? t.closeMenu : t.menu}
              aria-expanded={menuOpen}
              aria-controls={mobileMenuId}
              onClick={() => setMenuOpen((o) => !o)}
              className="text-text inline-flex h-11 w-11 items-center justify-center border-0 bg-transparent"
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        <OverlayDrawer
          open={menuOpen}
          onOpenChange={setMenuOpen}
          labelledBy={mobileMenuTitleId}
          triggerRef={menuTriggerRef}
          initialFocusRef={menuCloseRef}
          placement="fullscreen"
          panelTestId="mobile-menu-panel"
          backdropTestId="mobile-menu-backdrop"
          overlayClassName="bg-bg lg:hidden"
          panelClassName="min-h-dvh bg-bg px-6 pb-8 pt-4"
        >
          <nav id={mobileMenuId} aria-label="Mobile" className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-[720px] flex-col">
            <div className="border-border flex min-h-14 items-center justify-between border-b pb-3">
              <h2 id={mobileMenuTitleId} className="font-serif text-xl font-semibold text-text">
                {t.menu}
              </h2>
              <button
                ref={menuCloseRef}
                type="button"
                aria-label={t.closeMenu}
                onClick={() => setMenuOpen(false)}
                className="text-text hover:bg-surface inline-flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent transition-colors duration-200"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="my-4 md:hidden">
              <HeaderSearchField
                lang={lang}
                placeholder={t.landing.searchPlaceholder}
                variant="mobile"
              />
            </div>

            <div className="grid gap-1">
              <MobileNavLink
                href={`/${lang}`}
                label={t.navHome}
                onNavigate={() => setMenuOpen(false)}
              />
              <MobileNavLink
                href={`/${lang}/news`}
                label={t.nav.news}
                onNavigate={() => setMenuOpen(false)}
              />
              <MobileNavLink
                href={`/${lang}/concepts`}
                label={t.nav.concepts}
                onNavigate={() => setMenuOpen(false)}
              />
              <MobileNavLink
                href={`/${lang}/guides`}
                label={t.guidesTitle}
                onNavigate={() => setMenuOpen(false)}
              />
              <MobileNavLink
                href={`/${lang}/tools`}
                label={t.nav.tools}
                onNavigate={() => setMenuOpen(false)}
              />
              <MobileNavLink
                href={`/${lang}/about`}
                label={t.navAbout}
                onNavigate={() => setMenuOpen(false)}
              />
            </div>

            <details className="border-border mt-4 border-t pt-4">
              <summary className="text-text flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md py-2 text-base font-medium marker:hidden">
                {t.navCategories}
                <ArrowRight size={16} className="opacity-60" />
              </summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/${lang}/category/${c.slug}`}
                      onClick={() => setMenuOpen(false)}
                      className="text-text hover:bg-surface flex min-h-11 items-center gap-2 rounded-md px-2 py-2 text-sm no-underline transition-colors duration-200"
                    >
                      <span
                        className="cat-fg inline-flex shrink-0"
                        style={{ '--cat-color': c.color ?? '#888' } as CSSProperties}
                      >
                        <CategoryGlyph icon={c.icon} size={16} strokeWidth={1.7} />
                      </span>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>

            <div className="border-border mt-auto flex items-center justify-between gap-3 border-t pt-4">
              <Link
                href={langToggleHref}
                aria-label={t.langSwitch}
                className="text-accent inline-flex min-h-11 items-center font-semibold no-underline"
                onClick={() => {
                  trackLangSwitch();
                  setMenuOpen(false);
                }}
              >
                {lang === 'uk' ? 'EN' : 'UA'}
              </Link>
              <Link
                href={`/${lang}/subscribe`}
                className="rounded-pill bg-accent text-on-accent inline-flex min-h-11 items-center gap-1 px-5 py-2 text-sm font-semibold no-underline"
                onClick={() => setMenuOpen(false)}
              >
                {t.subscribe}
                <ArrowRight size={16} />
              </Link>
            </div>
          </nav>
        </OverlayDrawer>
      </div>
    </header>
  );
}

function MobileNavLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="text-text border-border hover:text-accent block border-b py-3 text-base font-medium no-underline transition-colors duration-200"
    >
      {label}
    </Link>
  );
}
