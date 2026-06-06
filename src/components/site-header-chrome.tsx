'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { alternateLangHref } from '@/lib/preferred-lang';
import { SITE_NAME, MARK_COLOR, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { HeaderSearchField } from '@/components/header-search-field';
import { ThemeToggle } from '@/components/theme-toggle';
import { CategoryGlyph, CloseIcon, MenuIcon, ArrowRight } from '@/components/icons';
import type { IconKey } from '@/components/icons';

export type NavCategory = {
  slug: string;
  name: string;
  color: string | null;
  icon: IconKey;
};

export function SiteHeaderChrome({
  lang,
  categories,
}: {
  lang: Lang;
  categories: NavCategory[];
}) {
  const t = getStrings(lang);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const catsRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="border-border-soft sticky top-0 z-50 border-b bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-[10px]">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="flex h-[60px] items-center gap-3">
          <Link href={`/${lang}`} className="flex shrink-0 items-center gap-2 no-underline">
            <span
              aria-hidden
              className="border-border bg-surface-2 grid h-8 w-8 place-items-center rounded-[9px] border font-mono text-xs font-bold"
              style={{ color: MARK_COLOR }}
            >
              AT
            </span>
            <span className="font-serif text-lg font-semibold text-[color:inherit]">{SITE_NAME}</span>
          </Link>

          <div className="mx-2 hidden min-w-0 flex-1 md:flex">
            <HeaderSearchField
              lang={lang}
              placeholder={t.landing.searchPlaceholder}
              className="max-w-md md:max-w-lg lg:max-w-xl"
            />
          </div>

          <nav aria-label="Primary" className="ml-auto hidden items-center gap-5 lg:flex">
            {navLink(`/${lang}`, t.navHome, pathname === `/${lang}`)}
            {navLink(`/${lang}/news`, t.nav.news, isActive(`/${lang}/news`))}
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
              className="rounded-pill bg-accent px-3.5 py-1.5 text-[0.85rem] font-semibold text-on-accent no-underline transition-opacity duration-200 hover:opacity-90"
            >
              {t.subscribe}
            </Link>
            <Link
              href={langToggleHref}
              aria-label={t.langSwitch}
              className="text-accent text-[0.85rem] font-semibold no-underline transition-opacity duration-200 hover:opacity-80"
            >
              {lang === 'uk' ? 'EN' : 'UK'}
            </Link>
            <ThemeToggle label={t.themeToggle} />
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <ThemeToggle label={t.themeToggle} />
            <Link
              href={`/${lang}/subscribe`}
              className="rounded-pill bg-accent hidden px-3 py-1.5 text-xs font-semibold text-on-accent no-underline sm:inline-flex"
            >
              {t.subscribe}
            </Link>
            <button
              type="button"
              aria-label={menuOpen ? t.closeMenu : t.menu}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="text-text inline-flex h-10 w-10 items-center justify-center border-0 bg-transparent"
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav aria-label="Mobile" className="border-border border-t py-3 lg:hidden">
            <div className="mb-3 md:hidden">
              <HeaderSearchField
                lang={lang}
                placeholder={t.landing.searchPlaceholder}
                variant="mobile"
              />
            </div>
            <div className="grid gap-1">
              <MobileNavLink href={`/${lang}`} label={t.navHome} onNavigate={() => setMenuOpen(false)} />
              <MobileNavLink
                href={`/${lang}/news`}
                label={t.nav.news}
                onNavigate={() => setMenuOpen(false)}
              />
              <MobileNavLink
                href={`/${lang}/about`}
                label={t.navAbout}
                onNavigate={() => setMenuOpen(false)}
              />
            </div>
            <details className="border-border mt-3 border-t pt-3">
              <summary className="text-text py-2 text-base font-medium">{t.navCategories}</summary>
              <ul className="mt-2 grid gap-1">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/${lang}/category/${c.slug}`}
                      onClick={() => setMenuOpen(false)}
                      className="text-text hover:bg-surface flex items-center gap-2 rounded-md px-2 py-2 text-sm no-underline transition-colors duration-200"
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
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <Link
                href={langToggleHref}
                aria-label={t.langSwitch}
                className="text-accent font-semibold no-underline"
                onClick={() => setMenuOpen(false)}
              >
                {lang === 'uk' ? 'EN' : 'UK'}
              </Link>
              <Link
                href={`/${lang}/subscribe`}
                className="rounded-pill bg-accent inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold text-on-accent no-underline"
                onClick={() => setMenuOpen(false)}
              >
                {t.subscribe}
                <ArrowRight size={16} />
              </Link>
            </div>
          </nav>
        ) : null}
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
      className="text-text border-border block border-b py-3 text-base font-medium no-underline transition-colors duration-200 hover:text-accent"
    >
      {label}
    </Link>
  );
}
