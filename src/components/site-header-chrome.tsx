'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { alternateLangHref } from '@/lib/preferred-lang';
import { SITE_NAME, MARK_COLOR, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { TOP_CATEGORY_SLUGS } from '@/lib/category-meta';
import { HeaderSearchField } from '@/components/header-search-field';
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const navLink = (href: string, label: string, active?: boolean) => (
    <Link
      href={href}
      className={`border-b-2 pb-0.5 text-[0.9rem] font-medium transition ${
        active
          ? 'text-text border-accent font-semibold'
          : 'text-muted hover:text-text border-transparent'
      }`}
    >
      {label}
    </Link>
  );

  const topCats = TOP_CATEGORY_SLUGS.map((slug) => categories.find((c) => c.slug === slug)).filter(
    (c): c is NavCategory => Boolean(c),
  );

  const langToggleHref = alternateLangHref(pathname, lang);

  return (
    <header className="border-border-soft sticky top-0 z-50 border-b bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-[10px]">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="flex h-[60px] items-center gap-3">
          <Link href={`/${lang}`} className="flex shrink-0 items-center gap-2 no-underline">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-[9px] border border-white/10 font-mono text-xs font-bold"
              style={{ color: MARK_COLOR, background: 'rgba(255,255,255,0.06)' }}
            >
              AT
            </span>
            <span className="font-serif text-lg font-semibold text-[color:inherit]">{SITE_NAME}</span>
          </Link>

          <div className="mx-2 hidden min-w-0 flex-1 md:flex">
            <HeaderSearchField
              lang={lang}
              placeholder={t.landing.searchPlaceholder}
              className="max-w-md"
            />
          </div>

          <nav
            aria-label="Primary"
            className="ml-auto hidden items-center gap-5 lg:flex"
          >
            {navLink(`/${lang}`, t.navHome, pathname === `/${lang}`)}
            {navLink(`/${lang}/news`, t.nav.news, isActive(`/${lang}/news`))}
            <div
              className="relative"
              onMouseLeave={() => setCatsOpen(false)}
            >
              <button
                type="button"
                onClick={() => setCatsOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={catsOpen}
                className={`inline-flex items-center gap-1 border-b-2 pb-0.5 text-[0.9rem] font-medium ${
                  pathname.includes('/category/')
                    ? 'text-text border-accent font-semibold'
                    : 'text-muted hover:text-text border-transparent'
                }`}
              >
                {t.navCategories}
                <ArrowRight size={13} className="opacity-60" />
              </button>
              {catsOpen && (
                <div
                  role="menu"
                  className="border-border bg-bg absolute top-[calc(100%+10px)] left-1/2 z-[70] grid w-[300px] max-w-[90vw] -translate-x-1/2 grid-cols-2 gap-0.5 rounded-[10px] border p-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
                >
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      role="menuitem"
                      href={`/${lang}/category/${c.slug}`}
                      onClick={() => setCatsOpen(false)}
                      className="text-text hover:bg-surface flex items-center gap-2 rounded-md px-2 py-2 text-[0.82rem] no-underline"
                    >
                      <span className="inline-flex shrink-0" style={{ color: c.color ?? '#888' }}>
                        <CategoryGlyph icon={c.icon} size={16} strokeWidth={1.7} />
                      </span>
                      <span className="truncate">{c.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {navLink(`/${lang}/about`, t.navAbout, isActive(`/${lang}/about`))}
            <span aria-hidden className="bg-border h-[18px] w-px" />
            <Link
              href={`/${lang}/subscribe`}
              className="rounded-pill bg-accent px-3.5 py-1.5 text-[0.85rem] font-semibold text-black no-underline"
            >
              {t.subscribe}
            </Link>
            <Link
              href={langToggleHref}
              className="text-accent text-[0.85rem] font-semibold no-underline"
            >
              {lang === 'uk' ? 'EN' : 'UK'}
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <Link
              href={`/${lang}/subscribe`}
              className="rounded-pill bg-accent hidden px-3 py-1.5 text-xs font-semibold text-black no-underline sm:inline-flex"
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

        {menuOpen && (
          <nav
            aria-label="Mobile"
            className="border-border border-t py-3 lg:hidden"
          >
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
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {topCats.map((c) => (
                <Link
                  key={c.slug}
                  href={`/${lang}/category/${c.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-pill border px-2.5 py-1 text-[0.78rem] font-medium no-underline"
                  style={{
                    color: c.color ?? '#888',
                    background: `${c.color ?? '#888'}1a`,
                    borderColor: `${c.color ?? '#888'}44`,
                  }}
                >
                  {c.name}
                </Link>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <Link
                href={langToggleHref}
                className="text-accent font-semibold no-underline"
                onClick={() => setMenuOpen(false)}
              >
                {lang === 'uk' ? 'EN' : 'UK'}
              </Link>
              <Link
                href={`/${lang}/subscribe`}
                className="rounded-pill bg-accent inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold text-black no-underline"
                onClick={() => setMenuOpen(false)}
              >
                {t.subscribe}
                <ArrowRight size={16} />
              </Link>
            </div>
          </nav>
        )}
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
      className="text-text border-border block border-b py-3 text-base font-medium no-underline"
    >
      {label}
    </Link>
  );
}
