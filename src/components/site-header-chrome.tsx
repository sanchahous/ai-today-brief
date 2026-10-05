'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { categoryColor } from '@/lib/category-meta';
import { alternateLangHref } from '@/lib/preferred-lang';
import { SITE_NAME, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { trackEvent } from '@/lib/analytics-client';
import { SearchDialog, SearchDialogShortcut } from '@/components/search/search-dialog';
import { SearchTrigger } from '@/components/search/search-trigger';
import { ThemeToggle } from '@/components/theme-toggle';
import { OverlayDrawer } from '@/components/ui/overlay-drawer';
import { IconButton } from '@/components/ui/icon-button';
import { BrandMark, CategoryGlyph, CloseIcon, MenuIcon, ArrowRight, SearchIcon } from '@/components/icons';
import type { IconKey } from '@/components/icons';
import type { TrendingTopic } from '@/lib/home';
import { useSearchDialog } from '@/hooks/use-search-dialog';
import { formatEditionDate } from '@/lib/date-format';

export type NavCategory = {
  slug: string;
  name: string;
  color: string | null;
  icon: IconKey;
  count?: number;
};

export function SiteHeaderChrome({
  lang,
  categories,
  trending,
  briefDate,
}: {
  lang: Lang;
  categories: NavCategory[];
  trending: TrendingTopic[];
  briefDate?: string | null;
}) {
  const t = getStrings(lang);
  const pathname = usePathname();
  const { open: searchOpen, heroVisible, openSearchDialog } = useSearchDialog();
  const [menuOpen, setMenuOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const catsRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const mobileMenuId = 'site-mobile-menu';
  const mobileMenuTitleId = 'site-mobile-menu-title';

  const [isScrolled, setIsScrolled] = useState(false);

  const isActive = (href: string) => {
    if (pathname === href || pathname.startsWith(`${href}/`)) return true;
    
    // SECTION_OF mapping for digests
    if (href === `/${lang}/digests`) {
      if (pathname.startsWith(`/${lang}/weekly/`)) return true;
      if (/^\/[a-z]{2}\/\d{4}-\d{2}-\d{2}$/.test(pathname)) return true;
      
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length === 2 && parts[0] === lang) {
        const knownRoutes = ['about', 'advertise', 'ai-disclosure', 'author', 'category', 'categories', 'concepts', 'digests', 'editorial-policy', 'guides', 'news', 'privacy', 'subscribe', 'terms', 'tools', 'weekly'];
        if (!knownRoutes.includes(parts[1])) {
          return true; // It's a /[lang]/[brief]
        }
      }
    }
    // SECTION_OF mapping for news (assuming articles are under /news, wait, articles are /news/[category]/[slug])
    if (href === `/${lang}/news`) {
      // Actually startsWith(href + '/') is covered by the first check for /news/..., 
      // but if there are other article formats, we cover them.
      // Usually news are /en/news/... which is covered by startsWith.
      return false;
    }
    
    return false;
  };

  useEffect(() => {
    if (!catsOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setCatsOpen(false);
        const btn = catsRef.current?.querySelector('button');
        if (btn) btn.focus();
      }
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

  useEffect(() => {
    const sentinel = document.createElement('div');
    sentinel.className = 'absolute top-0 w-full h-px pointer-events-none -z-50';
    sentinel.setAttribute('aria-hidden', 'true');
    document.body.prepend(sentinel);
    const observer = new IntersectionObserver(([entry]) => {
      setIsScrolled(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, []);

  const navLink = (href: string, label: string, active?: boolean, extraClass = '') => (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-[44px] items-center gap-1 whitespace-nowrap px-3 text-[0.875rem] transition-colors duration-150 no-underline ${
        active
          ? 'font-semibold text-text'
          : 'font-medium text-muted hover:text-text'
      } ${extraClass}`}
    >
      {label}
    </Link>
  );

  const langToggleHref = alternateLangHref(pathname, lang);
  const targetLang: Lang = lang === 'uk' ? 'en' : 'uk';

  function trackLangSwitch() {
    trackEvent('lang_switch', { to_lang: targetLang });
  }

  let formattedDate = '';
  let editionDay = '';
  if (briefDate) {
    formattedDate = formatEditionDate(briefDate, lang) || '';
    const dateObj = new Date(briefDate + 'T00:00:00Z');
    editionDay = String(dateObj.getUTCDate());
  }

  return (
    <header className="site-header-shell sticky top-0 tablet:-top-[4.75rem] z-50 flex h-(--header-h) flex-col border-b border-border bg-bg/90 backdrop-blur-[14px] backdrop-saturate-[1.2]">
      <div className="mx-auto flex min-h-0 w-full max-w-page flex-1 items-center gap-2 px-gutter phone:gap-6 tablet:h-[4.75rem] tablet:flex-none">
        <Link href={`/${lang}`} data-brand-strum aria-label={`${SITE_NAME} — ${t.navHome}`} className="mr-auto inline-flex min-h-[44px] min-w-0 items-center gap-2.5 whitespace-nowrap py-2 text-[1.0625rem] leading-none tracking-[-0.02em] text-text font-serif no-underline hover:text-text compact:text-[1.1875rem] phone:gap-3 phone:text-[1.4375rem]">
          <BrandMark size={40} className="size-[30px] shrink-0 compact:size-[34px] phone:size-10" />
          <span className="min-w-0">
            <span className="block truncate">AI Today Brief</span>
            <small className="mt-[6px] hidden truncate font-mono text-[0.75rem] uppercase tracking-[0.14em] text-faint phone:block">
              {t.header.intelligenceEdit}
            </small>
          </span>
        </Link>
        
        {briefDate ? (
          <p className="hidden tablet:flex items-center font-mono text-[0.75rem] uppercase tracking-[0.06em] text-muted whitespace-nowrap">
            <span className="live-dot" aria-hidden="true" />
            {formattedDate}
            <span className="mx-1.5">·</span>
            {t.header.dailyEdition} {editionDay}
          </p>
        ) : null}

        <div className="flex items-center gap-0 shrink-0 phone:gap-2">
          <IconButton
            type="button"
            data-testid="header-search-icon"
            onClick={(e) => {
              e.stopPropagation();
              openSearchDialog('header', e.currentTarget);
            }}
            aria-label={t.searchOpen}
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            aria-hidden={heroVisible}
            tabIndex={heroVisible ? -1 : 0}
            className={`text-text tablet:hidden ${
              heroVisible ? 'pointer-events-none scale-90 opacity-0' : 'scale-100 opacity-100'
            }`}
          >
            <SearchIcon size={20} />
          </IconButton>
          
          <Link
            href={langToggleHref}
            lang={targetLang}
            aria-label={t.langSwitch}
            onClick={trackLangSwitch}
            className="hidden tablet:inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-pill border border-line px-2.5 font-mono text-[0.75rem] font-semibold tracking-[0.06em] text-accent transition-colors hover:border-accent no-underline"
          >
            {lang === 'uk' ? 'EN' : 'UA'}
          </Link>
          
          <ThemeToggle dayLabel={t.themeDay} nightLabel={t.themeNight} />
          
          <Link
            href={`/${lang}/subscribe`}
            className="hidden tablet:inline-flex rounded-sm bg-accent text-on-accent px-4 py-2 text-[0.875rem] font-semibold no-underline transition-opacity duration-200 hover:opacity-90"
          >
            {t.subscribe}
          </Link>
          
          <IconButton
            ref={menuTriggerRef}
            type="button"
            aria-label={menuOpen ? t.closeMenu : t.menu}
            aria-expanded={menuOpen}
            aria-controls={mobileMenuId}
            onClick={() => setMenuOpen((o) => !o)}
            className="text-text tablet:hidden"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </IconButton>
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 border-t border-line tablet:block">
        <div className="mx-auto flex h-full max-w-page items-center gap-4 px-gutter">
          <Link
            href={`/${lang}`}
            data-brand-strum
            aria-label={SITE_NAME}
            tabIndex={-1}
            className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center transition-opacity duration-300 ${isScrolled ? 'opacity-100 flex' : 'hidden opacity-0 pointer-events-none'}`}
          >
             <BrandMark size={28} />
          </Link>

          <nav aria-label="Primary" className="mr-auto flex items-center gap-0.5">
            {navLink(`/${lang}/news`, t.nav.news, isActive(`/${lang}/news`))}
            {navLink(`/${lang}/digests`, t.nav.digests, isActive(`/${lang}/digests`))}
            {navLink(`/${lang}/concepts`, t.nav.concepts, isActive(`/${lang}/concepts`))}
            {navLink(`/${lang}/guides`, t.guidesTitle, isActive(`/${lang}/guides`))}
            {navLink(`/${lang}/tools`, t.nav.tools, isActive(`/${lang}/tools`))}
            
            <div ref={catsRef} className="relative" onMouseLeave={() => setCatsOpen(false)}>
              <button
                type="button"
                onClick={() => setCatsOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={catsOpen}
                className={`inline-flex min-h-[44px] items-center gap-1 whitespace-nowrap px-3 text-[0.875rem] transition-colors duration-150 ${
                  pathname.includes('/category/')
                    ? 'font-semibold text-text'
                    : 'font-medium text-muted hover:text-text'
                }`}
              >
                {t.navCategories}
                <ArrowRight
                  size={14}
                  className={`opacity-60 transition-transform duration-200 ${catsOpen ? '-rotate-90' : 'rotate-90'}`}
                />
              </button>
              {catsOpen ? (
                <div className="absolute top-[calc(100%+8px)] left-1/2 z-[70] -translate-x-1/2 w-[min(560px,92vw)] p-3 border border-border bg-raised shadow-pop rounded-md">
                  <ul
                    role="listbox"
                    aria-label={t.navCategories}
                    className="grid grid-cols-2 gap-[2px] list-none p-0 m-0"
                  >
                    {categories.map((c) => (
                      <li key={c.slug} role="none">
                        <Link
                          role="option"
                          href={`/${lang}/category/${c.slug}`}
                          onClick={() => setCatsOpen(false)}
                          className="text-text hover:bg-surface focus-visible:bg-surface flex min-h-[44px] items-center gap-2.5 rounded-sm px-2.5 py-2 text-[0.875rem] no-underline transition-colors duration-200"
                        >
                          <span
                            className="cat-fg inline-flex shrink-0"
                            style={{ '--cat-color': categoryColor(c.slug, c.color) } as React.CSSProperties}
                          >
                            <CategoryGlyph icon={c.icon} size={18} strokeWidth={1.7} />
                          </span>
                          <span className="truncate">{c.name}</span>
                          {c.count != null ? (
                            <small className="ml-auto text-faint font-mono text-[0.75rem]">{c.count}</small>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href={`/${lang}/categories`} className="flex items-center justify-between min-h-[44px] mt-2 pt-2 px-2.5 border-t border-line text-accent text-[0.875rem] font-semibold no-underline" onClick={() => setCatsOpen(false)}>
                    {t.header.allCategories}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ) : null}
            </div>
            
            {navLink(`/${lang}/about`, t.navAbout, isActive(`/${lang}/about`))}
          </nav>

          <SearchTrigger lang={lang} source="header" variant="field" className="min-w-[240px] max-w-sm rounded-pill" placeholder={t.header.searchPlaceholder} testId="search-trigger-compact" />
          
          <Link
             href={`/${lang}/subscribe`}
             className="hidden tablet:inline-flex rounded-sm bg-accent text-on-accent px-4 py-2 text-[0.875rem] font-semibold no-underline transition-opacity duration-200 hover:opacity-90 shrink-0"
             tabIndex={-1}
          >
             {t.subscribe}
          </Link>
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
        overlayClassName="bg-bg/90 backdrop-blur-[14px] tablet:hidden"
        panelClassName="min-h-[100dvh] bg-bg flex flex-col"
      >
        <div id={mobileMenuId} className="flex-1 overflow-y-auto px-gutter pb-8 pt-4">
           <div className="flex items-center justify-between mb-4">
              <h2 id={mobileMenuTitleId} className="font-serif text-2xl font-normal text-text m-0">{t.menu}</h2>
              <IconButton ref={menuCloseRef} type="button" aria-label={t.closeMenu} onClick={() => setMenuOpen(false)} className="text-text !rounded-pill -mr-2">
                 <CloseIcon />
              </IconButton>
           </div>
           
           <SearchTrigger lang={lang} source="menu" variant="field" className="rounded-pill mb-6 w-full py-3" placeholder={t.header.searchPlaceholder} />
           
           <nav aria-label="Mobile">
              <ul className="list-none p-0 m-0 border-t border-line">
                 {[
                   { href: `/${lang}`, label: t.navHome },
                   { href: `/${lang}/news`, label: t.nav.news },
                   { href: `/${lang}/digests`, label: t.nav.digests },
                   { href: `/${lang}/concepts`, label: t.nav.concepts },
                   { href: `/${lang}/guides`, label: t.guidesTitle },
                   { href: `/${lang}/tools`, label: t.nav.tools },
                   { href: `/${lang}/about`, label: t.navAbout },
                 ].map((item) => (
                    <li key={item.href} className="border-b border-line">
                       <Link
                         href={item.href}
                         aria-current={isActive(item.href) && item.href !== `/${lang}` ? 'page' : undefined}
                         onClick={() => setMenuOpen(false)}
                         className="flex items-center justify-between py-4 text-lg font-medium text-text no-underline hover:text-accent"
                       >
                         {item.label}
                         <ArrowRight size={18} />
                       </Link>
                    </li>
                 ))}
              </ul>
           </nav>
           
           <details className="mt-6 border border-line rounded-lg bg-surface">
              <summary className="flex cursor-pointer min-h-[44px] items-center justify-between p-4 text-base font-medium text-text marker:hidden">
                 {t.navCategories}
              </summary>
              <ul className="list-none p-0 m-0 border-t border-line">
                 {categories.map((c) => (
                    <li key={c.slug} className="border-b border-line/50 last:border-b-0">
                       <Link
                          href={`/${lang}/category/${c.slug}`}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 min-h-[44px] text-base text-text no-underline hover:bg-surface-2"
                       >
                          <span
                             className="cat-fg inline-flex shrink-0"
                             style={{ '--cat-color': categoryColor(c.slug, c.color) } as CSSProperties}
                          >
                             <CategoryGlyph icon={c.icon} size={20} strokeWidth={1.7} />
                          </span>
                          {c.name}
                       </Link>
                    </li>
                 ))}
              </ul>
           </details>
        </div>
        
        <div className="border-t border-line p-gutter flex items-center justify-between shrink-0 gap-3">
           <Link
              href={langToggleHref}
              lang={targetLang}
              aria-label={t.langSwitch}
              onClick={() => {
                trackLangSwitch();
                setMenuOpen(false);
              }}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-pill border border-line px-3 font-mono text-[0.75rem] font-semibold tracking-[0.06em] text-accent transition-colors hover:border-accent no-underline"
           >
              {lang === 'uk' ? 'EN' : 'UA'}
           </Link>
           <ThemeToggle dayLabel={t.themeDay} nightLabel={t.themeNight} />
           <Link
              href={`/${lang}/subscribe`}
              className="flex items-center gap-2 min-h-[44px] rounded-pill bg-accent text-on-accent px-5 py-3 text-base font-semibold no-underline transition-opacity duration-200 hover:opacity-90"
              onClick={() => setMenuOpen(false)}
           >
              {t.subscribe}
              <ArrowRight size={18} />
           </Link>
        </div>
      </OverlayDrawer>

      <SearchDialog lang={lang} trending={trending} />
      <SearchDialogShortcut lang={lang} />
    </header>
  );
}
