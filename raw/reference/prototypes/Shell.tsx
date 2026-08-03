import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useProto } from './ProtoContext';
import { CATEGORIES, TOP_CATEGORY_SLUGS, categoryBySlug } from './data';
import {
  SunIcon,
  MoonIcon,
  MenuIcon,
  CloseIcon,
  ArrowRight,
  CategoryGlyph,
  RssIcon,
  TelegramIcon,
  LinkedInIcon,
  YouTubeIcon,
  XIcon,
} from './icons';
import { SavedButton, SavedDrawer, SubscribeModal, CookieConsent } from './features';
import { HeaderSearchField, MobileSearchTrigger, MobileSearchBar } from './search';
import { SITE_NAME, FOUNDER_INITIALS, MARK_COLOR, SOCIALS, type SocialLink } from './config';
import type { ProtoPage, RouteParams } from './routes';

/**
 * Product chrome shared by every screen: skip-link, sticky header, full footer
 * and the global overlays (saved drawer, subscribe modal).
 *
 * Header search is the canonical search. On desktop it's an inline field in
 * the header; on mobile it's an icon that expands a full-width search bar.
 * On Home it's hidden while the hero search is on screen and fades in once
 * that scrolls away (`heroSearchInView`); elsewhere it's always visible.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const { t, lang, theme, page, heroSearchInView, setLang, setTheme, navigate, setSubscribeOpen } =
    useProto();
  const reduce = useReducedMotion();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const showHeaderSearch = page !== 'home' || !heroSearchInView;

  const navBtn = (active: boolean): React.CSSProperties => ({
    fontSize: '0.9rem',
    fontWeight: active ? 600 : 500,
    color: active ? 'var(--color-text)' : 'var(--color-muted)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.3rem 0',
    borderBottom: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
  });

  const iconBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    color: 'var(--color-text)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  };

  function go(p: ProtoPage, params?: RouteParams) {
    navigate(p, params);
    setMenuOpen(false);
  }

  return (
    <div
      className={theme === 'light' ? 'theme-light' : ''}
      style={{ background: 'var(--color-bg)', minHeight: '100vh' }}
    >
      <a href="#proto-main" className="skip-link">
        {t('skipToContent')}
      </a>

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 60,
          background: 'color-mix(in srgb, var(--color-bg) 88%, transparent)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="shell hdr-row" style={{ height: 60 }}>
          {/* Brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              minWidth: 0,
              flexShrink: 0,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 30,
                height: 30,
                borderRadius: 9,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                fontFamily: 'monospace',
                fontSize: 12,
                fontWeight: 700,
                color: MARK_COLOR,
                flexShrink: 0,
              }}
            >
              {FOUNDER_INITIALS}
            </span>
            <button
              onClick={() => navigate('home')}
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--color-text)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {SITE_NAME}
            </button>
          </div>

          {/* Desktop search slot (centre, reserves space so nav never shifts) */}
          <div className="hdr-search-desktop">
            <HeaderSearchField visible={showHeaderSearch} />
          </div>

          {/* Desktop nav */}
          <nav aria-label="Primary" className="hdr-nav-desktop">
            <button onClick={() => navigate('home')} style={navBtn(page === 'home')}>
              {t('navHome')}
            </button>
            <button
              onClick={() => navigate('news')}
              style={navBtn(page === 'news' || page === 'item')}
            >
              {t('navNews')}
            </button>
            <CategoriesMenu active={page === 'category'} />
            <button onClick={() => navigate('about')} style={navBtn(page === 'about')}>
              {t('navAbout')}
            </button>
            {/* FEATURE F5 — saved stories entry point */}
            <SavedButton />
            <span
              aria-hidden="true"
              style={{ width: 1, height: 18, background: 'var(--color-border)' }}
            />
            <button
              onClick={() => setSubscribeOpen(true)}
              className="btn btn-primary"
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
            >
              {t('subscribeCta')}
            </button>
            <button
              onClick={() => setLang(lang === 'uk' ? 'en' : 'uk')}
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--color-accent)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('langSwitch')}
            </button>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={t('themeToggle')}
              style={{ ...iconBtn, width: 'auto', color: 'var(--color-muted)' }}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </nav>

          {/* Mobile actions */}
          <div className="hdr-actions-mobile" style={{ alignItems: 'center', gap: '0.25rem' }}>
            <MobileSearchTrigger
              visible={showHeaderSearch}
              onOpen={() => {
                setMenuOpen(false);
                setSearchOpen(true);
              }}
            />
            <SavedButton />
            <button
              onClick={() => {
                setSearchOpen(false);
                setMenuOpen((o) => !o);
              }}
              aria-label={menuOpen ? t('closeMenu') : t('menu')}
              aria-expanded={menuOpen}
              style={iconBtn}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {/* Mobile expanding search bar */}
        <MobileSearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />

        {/* Mobile nav menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              className="hdr-menu-mobile"
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden', borderTop: '1px solid var(--color-border)' }}
            >
              <nav aria-label="Mobile" style={{ padding: '0.6rem 1.25rem 1.1rem' }}>
                {(
                  [
                    ['home', t('navHome')],
                    ['news', t('navNews')],
                    ['about', t('navAbout')],
                  ] as [ProtoPage, string][]
                ).map(([p, label]) => (
                  <button
                    key={p}
                    onClick={() => go(p)}
                    style={{
                      ...navBtn(page === p),
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.7rem 0',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    {label}
                  </button>
                ))}

                {/* Category quick-links */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.4rem',
                    padding: '0.8rem 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  {TOP_CATEGORY_SLUGS.map((slug) => {
                    const c = categoryBySlug.get(slug)!;
                    return (
                      <button
                        key={slug}
                        onClick={() => go('category', { categorySlug: slug })}
                        style={{
                          fontSize: '0.78rem',
                          padding: '0.3rem 0.7rem',
                          color: c.color,
                          background: `${c.color}1a`,
                          border: `1px solid ${c.color}44`,
                          borderRadius: 999,
                          cursor: 'pointer',
                        }}
                      >
                        {c.name[lang]}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    setSubscribeOpen(true);
                    setMenuOpen(false);
                  }}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', margin: '0.9rem 0 0.3rem' }}
                >
                  {t('subscribeCta')} <ArrowRight size={16} />
                </button>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.6rem',
                  }}
                >
                  <button
                    onClick={() => setLang(lang === 'uk' ? 'en' : 'uk')}
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--color-accent)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {t('langSwitch')}
                  </button>
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label={t('themeToggle')}
                    style={{ ...iconBtn, color: 'var(--color-muted)' }}
                  >
                    {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                  </button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="proto-main">{children}</main>

      <SiteFooter />

      {/* Global overlays */}
      <SavedDrawer />
      <SubscribeModal />
      <CookieConsent />
    </div>
  );
}

/** Header "Categories" dropdown → category hub pages. */
function CategoriesMenu({ active }: { active: boolean }) {
  const { t, lang, navigate } = useProto();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  const navBtn: React.CSSProperties = {
    fontSize: '0.9rem',
    fontWeight: active ? 600 : 500,
    color: active ? 'var(--color-text)' : 'var(--color-muted)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.3rem 0',
    borderBottom: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
  };

  return (
    <div
      style={{ position: 'relative' }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        style={navBtn}
      >
        {t('navCategories')}
        <ArrowRight
          size={13}
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(90deg)', opacity: 0.6 }}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: 0.16 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 70,
              width: 300,
              maxWidth: '90vw',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-pop)',
              padding: '0.4rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.2rem',
            }}
          >
            {CATEGORIES.map((c) => (
              <button
                key={c.slug}
                role="menuitem"
                onClick={() => {
                  navigate('category', { categorySlug: c.slug });
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.6rem',
                  background: 'none',
                  border: 'none',
                  borderRadius: 7,
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--color-text)',
                  fontSize: '0.82rem',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ color: c.color, display: 'inline-flex', flexShrink: 0 }}>
                  <CategoryGlyph icon={c.icon} size={16} strokeWidth={1.7} />
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.name[lang]}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SOCIAL_ICON: Record<SocialLink['key'], React.FC<{ size?: number }>> = {
  x: XIcon,
  telegram: TelegramIcon,
  linkedin: LinkedInIcon,
  youtube: YouTubeIcon,
  rss: RssIcon,
};

function SiteFooter() {
  const { t, lang, navigate, setLang, reopenConsent } = useProto();

  const colHead: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--color-faint)',
    margin: '0 0 0.8rem',
  };
  const linkBtn: React.CSSProperties = {
    display: 'block',
    background: 'none',
    border: 'none',
    padding: '0.25rem 0',
    color: 'var(--color-muted)',
    fontSize: '0.88rem',
    cursor: 'pointer',
    textAlign: 'left',
  };

  const columns: { head: string; links: { label: string; page: ProtoPage; params?: RouteParams }[] }[] =
    [
      {
        head: t('footerProduct'),
        links: [
          { label: t('navHome'), page: 'home' },
          { label: t('navNews'), page: 'news' },
          { label: t('navCategories'), page: 'category', params: { categorySlug: TOP_CATEGORY_SLUGS[0] } },
          { label: t('footerConcepts'), page: 'concept', params: { conceptSlug: 'claude-code' } },
        ],
      },
      {
        head: t('footerCompany'),
        links: [
          { label: t('footerAbout'), page: 'about' },
          { label: t('footerAdvertise'), page: 'advertise' },
          { label: t('footerStatus'), page: 'dashboard' },
        ],
      },
      {
        head: t('footerLegalCol'),
        links: [
          { label: t('footerPrivacy'), page: 'privacy' },
          { label: t('footerTerms'), page: 'terms' },
          { label: t('footerAiDisclosure'), page: 'ai-disclosure' },
        ],
      },
    ];

  return (
    <footer
      style={{
        borderTop: '1px solid var(--color-border)',
        marginTop: '4rem',
        padding: '3rem 0 2.5rem',
      }}
    >
      <div className="shell">
        <div className="footer-grid">
          {/* Brand blurb + socials */}
          <div style={{ maxWidth: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.7rem' }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  color: MARK_COLOR,
                }}
              >
                {FOUNDER_INITIALS}
              </span>
              <strong style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem' }}>
                {SITE_NAME}
              </strong>
            </div>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
              {t('footerTagline')}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {SOCIALS.map((s) => {
                const Icon = SOCIAL_ICON[s.key];
                return (
                  <a
                    key={s.key}
                    href={s.url}
                    aria-label={s.label}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      color: 'var(--color-muted)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <Icon size={16} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Nav columns */}
          {columns.map((col) => (
            <div key={col.head}>
              <p style={colHead}>{col.head}</p>
              {col.links.map((l) => (
                <button key={l.label} style={linkBtn} onClick={() => navigate(l.page, l.params)}>
                  {l.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* AI-disclosure note */}
        <p
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            margin: '2rem 0 0',
            padding: '0.8rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-muted)',
            fontSize: '0.8rem',
            lineHeight: 1.5,
          }}
        >
          <span aria-hidden="true" style={{ color: 'var(--color-accent)', display: 'inline-flex' }}>
            <RssIcon size={14} />
          </span>
          {t('footerAiNote')}
        </p>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1.5rem',
            paddingTop: '1.2rem',
            borderTop: '1px solid var(--color-border)',
            fontSize: '0.8rem',
            color: 'var(--color-faint)',
          }}
        >
          <span>
            © {new Date().getFullYear()} {SITE_NAME} · {t('footerRights')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={reopenConsent}
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--color-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('footerCookie')}
            </button>
            <button
              onClick={() => setLang(lang === 'uk' ? 'en' : 'uk')}
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--color-accent)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {lang === 'uk' ? 'English' : 'Українська'}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
