# AI Today Brief — Responsive & Cross-Browser Defect Handoff Spec

Summary: Повний референс responsive / cross-browser аудиту.
Sources: none (analysis)
Last updated: 2026-06-12


Target: `D:/domains/ai-today-brief` (Next.js 16, Tailwind v4). 88 verified defects: 13 high, 36 medium, 39 low.

Read the **Recommended global fixes** section first — several themes share two root causes (the breakpoint split and the `--header-h` mismatch), and fixing those collapses many individual items.

---

## Recommended global fixes (do these first)

1. **Unify the breakpoint system.** The layout flips at a custom `min-width:900px` (globals.css:420-431) while the header flips at Tailwind `lg`/1024px (site-header-chrome.tsx:96,165,186). Pick ONE desktop/mobile threshold (recommend aligning the globals.css `@media` to 1024px, or registering a `--breakpoint-*` token / Tailwind screen alias so both sources read the same value). This single change resolves or de-risks: header-topbar-02, mobile-menu-08, filters-drawer-01, filters-drawer-06, global-css-01, and the related test items (test-infra-03).

2. **Fix `--header-h` to the real header height.** `--header-h:76px` (globals.css:37) but the header is `h-[60px]` (site-header-chrome.tsx:76). Set the token to 60px AND make it the single source of truth — ideally drive the header with `h-[var(--header-h)]` so they can never drift, and have the hero anchor use `scroll-mt-[var(--header-h)]` instead of the hard-coded `scroll-mt-20`/80px. Resolves: header-topbar-03, filters-drawer-02, global-css-02, global-css-06, home-landing-03, crossbrowser-features-03, test-infra-13.

3. **Build one reusable overlay/drawer primitive** and use it for BOTH the header mobile menu and the filters drawer. It must provide: `position:fixed` full-viewport layer; an opaque-backed dimmed backdrop (`bg-black/55`); outside/backdrop-click close; Escape close; `role="dialog"` + `aria-modal="true"` + `aria-controls` on the trigger; focus move-in on open, Tab focus trap, focus-return to trigger on close; route-change auto-close; and an opaque panel background (`var(--bg)` at alpha 1, not the translucent header surface). The filters drawer already has most of this — the mobile menu has none of it. Resolves the entire Mobile menu theme plus filters-drawer-11 and crossbrowser-features-05.

4. **Add a body-scroll-lock utility** (toggle `overflow:hidden` on `<body>`, with iOS `position:fixed` + top-offset to preserve scroll position; compensate scrollbar width). No scroll-lock exists anywhere in the repo. Wire it into the overlay primitive. Resolves: mobile-menu-04, filters-drawer-04, crossbrowser-features-05.

5. **Add a root overflow-x guard + base text-wrapping.** Add `overflow-x:clip` (or hidden) + `max-width:100%` on `html`/`body` in `@layer base` (globals.css), and `overflow-wrap:anywhere`/`break-words` on prose containers, titles, summaries, links, and inline code. Keep intentional inner `overflow-x-auto` regions. Resolves/backstops: global-css-04, home-landing-02/04, content-templates-01/02/03/06/07/08, feed-cards-02.

6. **Establish a cross-browser feature-support policy with fallbacks.** For every `color-mix(in srgb,...)`, `backdrop-filter`, and `100dvh` usage, declare a solid/`vh` fallback FIRST and layer the modern value behind `@supports`. Resolves: crossbrowser-features-01/06, filters-drawer-09, global-css-07, content-templates-10, home-landing-08.

---

## Theme: Header & nav

### header-topbar-02 — Dead band 900-1023px (custom layout desktop while header still hamburger)
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:96,165`; `src/app/globals.css:420-431`
- Current: globals.css flips `.desktop-only`/`.news-layout` to desktop at 900px; header nav is `lg:flex` and hamburger `lg:hidden` (1024px). 900-1023px shows desktop sidebar with a hamburger header simultaneously.
- Expected: one consistent breakpoint governs desktop vs mobile across header and layout; no band shows desktop sidebar with hamburger.
- Acceptance: at 960px, EITHER `<nav aria-label="Primary">` is visible AND the hamburger is hidden, OR vice versa — never the desktop sidebar visible while the hamburger is also visible.

### header-topbar-03 — `--header-h` 76px vs real 60px header (sticky offset/max-height off by 16px)
- Severity: **medium**
- File: `src/app/globals.css:37`; `src/components/site-header-chrome.tsx:76`; `src/components/news/news-sidebar.tsx:224`
- Current: token overstates header by 16px; sticky sidebar starts 16px low and its max-height is 16px short.
- Expected: `--header-h` equals the rendered header height so the sidebar pins flush and max-height fills the viewport.
- Acceptance: `getComputedStyle(document.documentElement).getPropertyValue('--header-h')` trimmed === rendered `<header>` offsetHeight + 'px' (60px); when scrolled, sticky `[data-testid="news-sidebar"]` top === header bottom (±1px).

### crossbrowser-features-01 — Sticky header has no opaque fallback (see-through where blur/color-mix degrade)
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:74`
- Current: only background is `color-mix(in srgb,var(--bg) 88%,transparent)` + `backdrop-blur-[10px]`, no solid fallback; header is sticky and content scrolls under it.
- Expected: opaque/near-opaque solid fallback when backdrop-filter and/or color-mix are unavailable, blur as progressive enhancement (`@supports`).
- Acceptance: with backdrop-filter disabled and/or color-mix unsupported, computed header `background-color` alpha >= ~0.95; no body text bleeds through the header band while scrolled.

### crossbrowser-features-02 — `input[type=search]` has no appearance reset (native styling/clear button)
- Severity: **medium**
- File: `src/components/header-search-field.tsx:66-78`; `src/components/home/hero-search.tsx:73-86`
- Current: `type="search"` inputs with custom radius/padding but no `appearance` reset; WebKit adds native inner styling + `::-webkit-search-cancel-button`, so Safari shows a second clear affordance; Firefox shows none.
- Expected: consistent rounded control across Chrome/Firefox/Safari, no surprise native clear button, app-controlled padding/width.
- Acceptance: in WebKit with a non-empty value, no native `::-webkit-search-cancel-button` renders (or is intentionally styled), and computed border-radius/padding match design tokens.

---

## Theme: Mobile menu

### mobile-menu-01 — Menu renders in-flow (border-t panel), not a fixed overlay; no backdrop
- Severity: **high**
- File: `src/components/site-header-chrome.tsx:185-251`
- Current: open `<nav aria-label="Mobile">` is a normal-flow child of the header container with no `position:fixed/absolute` and no backdrop; page content stays visible/interactive beneath it. The filters drawer (news-sidebar.tsx:230-232) uses `fixed inset-0 z-[120] bg-black/55`.
- Expected: menu presents as a distinct fixed layer with a dimmed/blurred backdrop, matching the drawer pattern.
- Acceptance: at 375px with menu open, the menu container computed `position` is `fixed` (or wrapped by a fixed full-viewport overlay) AND a backdrop with a non-transparent background covers the viewport behind it; clicking page content below the menu does not activate it.

### mobile-menu-02 — No outside-click / backdrop-click close
- Severity: **high**
- File: `src/components/site-header-chrome.tsx:31,173-181,185-251`
- Current: `menuOpen` toggled only by the hamburger and cleared by per-link onClicks; no document mousedown listener, no backdrop. Inconsistent with catsOpen, HeaderSearchField, and the drawer backdrop.
- Expected: tapping outside the open menu closes it.
- Acceptance: with menu open at 375px, tapping a point outside the menu bounds makes the menu leave the DOM / sets `aria-expanded=false` on the hamburger.

### mobile-menu-03 — No Escape-key handler
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:37-51,185-251`
- Current: no keydown/Escape listener tied to `menuOpen` (catsOpen, search field, and drawer all have one).
- Expected: Escape closes the menu and returns focus to the hamburger.
- Acceptance: with menu open, dispatching keydown Escape removes the menu, sets `aria-expanded=false`, and `document.activeElement` is the hamburger button.

### mobile-menu-04 — No body-scroll-lock while open
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:185-251`
- Current: opening the menu sets no `overflow:hidden`/`position:fixed` on body/html; no scroll-lock anywhere in src. Background scrolls; iOS jitter/scroll-bleed.
- Expected: background scroll locked while open; unlock restores prior scroll position.
- Acceptance: with menu open at 375px, body/documentElement has `overflow:hidden` (or position:fixed lock); after close, overflow returns to prior value and `window.scrollY` is unchanged.

### mobile-menu-05 — Two visible "Subscribe" buttons at 640-1023px when menu open
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:167-172,241-248`
- Current: top cluster Subscribe is `hidden ... sm:inline-flex` (>=640); in-menu Subscribe is unconditional; both show at 640-1023px with menu open.
- Expected: exactly one Subscribe CTA visible at any viewport while menu open.
- Acceptance: at 768px with menu open, exactly one visible element links to `/{lang}/subscribe` in the header.

### mobile-menu-06 — Menu does not close on route change / logo navigation
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:30-31,77-86,185-251`
- Current: closing relies on per-link onClicks; no `useEffect` keyed on pathname; brand/logo Link and back/forward leave it open.
- Expected: any route change auto-closes the menu.
- Acceptance: with menu open at 375px, clicking the brand/logo link and waiting for URL change to `/{lang}` leaves the menu closed (`aria-expanded=false`, not in DOM).

### mobile-menu-07 — Not a dialog: no aria-modal / focus trap / focus return
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:173-181,185-186`
- Current: bare `<nav aria-label="Mobile">`, no `role=dialog`, no `aria-modal`, no `aria-controls` on toggle, no focus move/trap/return.
- Expected: modal semantic, focus trap, focus move-in on open, focus-return to toggle on close, `aria-controls` linkage.
- Acceptance: with menu open at 375px, the panel exposes a modal role; repeated Tab cycles only within the panel (never background content); on close `document.activeElement` is the hamburger toggle.

### mobile-menu-08 — Menu active across 900-1023px where desktop layout already shows
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:165,186`; `src/components/news/news-sidebar.tsx:222-228`
- Current: mobile cluster/menu gated `lg:hidden` (<1024) but layout flips to desktop at 900px; in 900-1023px the menu coexists with the desktop sidebar.
- Expected: menu-activation breakpoint matches the layout-switch breakpoint.
- Acceptance: at 960px the hamburger toggle and `[data-testid="news-sidebar"]` are never both visible.

### mobile-menu-09 — In-flow menu inherits translucent header bg; content shows through
- Severity: **low**
- File: `src/components/site-header-chrome.tsx:74,185-186`
- Current: header bg is 88%-opacity color-mix + backdrop-blur; menu panel sets no opaque bg, so it rides the translucent surface; degrades further where backdrop-filter/color-mix unsupported.
- Expected: menu surface fully opaque (or backed by an opaque overlay) regardless of feature support.
- Acceptance: with menu open at 375px, pixels in the menu's empty gaps match the opaque surface token (no bleed-through); menu container `background-color` alpha is 1.

### mobile-menu-10 — Categories `<details>/<summary>` tap target <44px, marker inconsistent
- Severity: **low**
- File: `src/components/site-header-chrome.tsx:207-228`
- Current: `<summary>` is `py-2 text-base` → ~40px target (<44px); native disclosure marker varies across engines vs the scripted desktop button.
- Expected: consistent >=44px tap target with a cross-browser-consistent disclosure indicator.
- Acceptance: summary/toggle bounding-box height >= 44px at 375px; disclosure indicator renders identically across engines (no UA marker leaking).

### mobile-menu-11 — Language toggle is a small inline link below 44px
- Severity: **low**
- File: `src/components/site-header-chrome.tsx:229-240`
- Current: bare inline Link, no padding/min-size; hit area ~20x24px, an outlier vs adjacent `py-3`/`px-4 py-2` rows.
- Expected: touch-friendly hit area >=44x44px consistent with other menu rows.
- Acceptance: language toggle bounding box >=44px in both dimensions at 375px.

---

## Theme: Filters

### filters-drawer-01 — Desktop sidebar shows at 900-1023px while header is hamburger
- Severity: **high**
- File: `src/app/globals.css:420-431`; `src/components/news/news-sidebar.tsx:222-228`; `src/components/site-header-chrome.tsx:96-182`
- Current: layout/`.desktop-only` flip at 900px decoupled from header's 1024px swap; desktop sidebar + 2-col layout render while header is still compact hamburger.
- Expected: filter-layout breakpoint aligned with header nav breakpoint (1024/lg); desktop sidebar appears only with full desktop chrome; mobile Filters trigger available through the whole hamburger range.
- Acceptance: at 960px, `[data-testid="news-sidebar"]` NOT visible while hamburger IS visible, and the mobile Filters trigger IS visible; at 1024px the aside becomes visible and the trigger hides, in lockstep with the header nav.

### filters-drawer-02 — Sticky sidebar offset wrong (76px token vs 60px header)
- Severity: **medium**
- File: `src/components/news/news-sidebar.tsx:224`; `src/app/globals.css:37`; `src/components/site-header-chrome.tsx:74-76`
- Current: aside uses `sticky top-[var(--header-h)]` and `max-h-[calc(100dvh-var(--header-h)-1rem)]` with 76px token; parks 16px below the 60px header and max-height is 16px short.
- Expected: `--header-h` equals the rendered header height (60px).
- Acceptance: at >=1024px when scrolled, aside top === header bottom (delta <=1px); aside max-height === innerHeight − header − 16px.

### filters-drawer-03 — Mobile drawer is a narrow single-column right drawer, not fullscreen multi-column
- Severity: **low**
- File: `src/components/news/news-sidebar.tsx:230-264,87-198`
- Current: panel `w-[min(340px,88vw)]` right-anchored, single tall vertical stack requiring long scrolling.
- Expected: fullscreen (inset-0) drawer with filter groups laid out compactly across the width (multi-column).
- Acceptance: at 390px with drawer open, dialog width >= 95vw and height === viewport height; filter groups arranged in >1 column (computed `grid-template-columns` with 2+ tracks).

### filters-drawer-04 — Open drawer does not lock body scroll
- Severity: **high**
- File: `src/components/news/news-sidebar.tsx:211-218,230-242`
- Current: only an Escape handler; no body-scroll-lock; scrolling/touch over the backdrop scrolls the underlying feed; iOS rubber-bands.
- Expected: while the drawer (role=dialog aria-modal) is open, underlying page does not scroll; body lock restored on close.
- Acceptance: open at 390px, record `window.scrollY`, wheel/touch scroll over backdrop → `scrollY` unchanged; after close, body overflow returns and scrolling works.

### filters-drawer-05 — Drawer scroll container missing overscroll containment
- Severity: **medium**
- File: `src/components/news/news-sidebar.tsx:237-242,224`
- Current: desktop aside has `overscroll-y-contain`; mobile drawer panel (`overflow-y-auto`) does not, so reaching scroll bounds chains to the page.
- Expected: drawer panel uses `overscroll-contain` (paired with body lock; not sole defense on iOS<16).
- Acceptance: drawer panel computed `overscroll-behavior-y: contain`, matching the desktop aside.

### filters-drawer-06 — Mobile Filters trigger hidden in 900-1023px band, filters inaccessible
- Severity: **medium**
- File: `src/components/news/news-feed.tsx:174-184`; `src/app/globals.css:428-430`
- Current: trigger uses `.mobile-only` → `display:none !important` at >=900px; it's the only drawer entry point, so 900px+ the drawer can't be opened.
- Expected: whenever the desktop sidebar is not the active filter UI, the trigger is present; trigger and sidebar mutually exclusive at all widths.
- Acceptance: across 320-1440px, exactly one of {desktop aside, mobile Filters trigger} is visible at every width — never zero, never both.

### filters-drawer-07 — Duplicate sort control (top-bar select + drawer radio group)
- Severity: **low**
- File: `src/components/news/news-feed.tsx:159-173`; `src/components/news/news-sidebar.tsx:89-107`
- Current: top-bar `<select>` shows on mobile (no responsive hiding) AND drawer renders a Sort radio group; both bind `filters.sort`.
- Expected: sort presented once per context.
- Acceptance: at 390px with drawer open, exactly one visible control sets the sort mode.

### filters-drawer-09 — Sidebar `100dvh` max-height has no fallback (invalid on iOS<15.4)
- Severity: **low**
- File: `src/components/news/news-sidebar.tsx:224`
- Current: `max-height:calc(100dvh - var(--header-h) - 1rem)` with no `vh`/`@supports` fallback; on engines lacking dvh the whole declaration drops → no height cap → long list overflows.
- Expected: valid `vh` fallback so the sidebar always caps and scrolls internally.
- Acceptance: in a build without dvh support, aside has a numeric computed max-height (>0, <=viewport) and scrolls internally.

### filters-drawer-10 — Custom scrollbar styling not applied to drawer panel (inconsistent)
- Severity: **low**
- File: `src/app/globals.css:380-393`
- Current: `.sidebar-scroll` styling is on the desktop aside only; the drawer panel uses `overflow-y-auto` without it, so its scrollbar is native/inconsistent.
- Expected: consistent scrollbar treatment across drawer and desktop sidebar, degrading gracefully.
- Acceptance: drawer scroll panel carries the same scrollbar class (`sidebar-scroll`) as the desktop aside; scrollbar region matches visually.

### filters-drawer-11 — Drawer focus not trapped / not moved into dialog
- Severity: **medium**
- File: `src/components/news/news-sidebar.tsx:237-262`; `src/components/news/news-feed.tsx:174-184`
- Current: role=dialog aria-modal but no focus move-in, trap, or return; background controls stay in tab order (not inert/aria-hidden).
- Expected: focus moves into dialog on open; Tab/Shift+Tab cycle within; background inert; focus returns to trigger on close.
- Acceptance: after open, `document.activeElement` is inside the dialog; repeated Tab never lands outside; after close, focus is on the Filters trigger.

### crossbrowser-features-03 — Sidebar `100dvh` + wrong `--header-h` diverges worst on iOS toolbar
- Severity: **high**
- File: `src/components/news/news-sidebar.tsx:224`; `src/app/globals.css:37`; `src/components/site-header-chrome.tsx:76`
- Current: `top-[var(--header-h)] max-h-[calc(100dvh-var(--header-h)-1rem)]`; token 76px vs real 60px header; on iOS the dvh resolves against the dynamic toolbar while the subtracted header constant is a fixed wrong 76px, so usable height/gap differ per engine.
- Expected: `--header-h`=60px so the dvh calc and top offset align; sidebar sits flush and uses full remaining height on every engine.
- Acceptance: `--header-h` resolves to 60px; sticky top === header bottom (gap ~0, ±1px); max-height === viewport − header − 1rem, equal (within tolerance) in Chromium and WebKit at the same viewport.

### crossbrowser-features-04 — Native checkbox/radio rely solely on accent-color, no fallback
- Severity: **medium**
- File: `src/components/news/news-sidebar.tsx:94-124`; `src/app/globals.css:103-110`
- Current: filter inputs styled only via `accent-accent` + inline `accentColor`; degrades to OS default where unsupported; `size-4` (16px) is a small touch target; no `appearance:none` custom control.
- Expected: checked-state coloring reflects accent/category color consistently; comfortable touch target; consistent across supported engines.
- Acceptance: a checked category checkbox's indicator color matches the category color (within tolerance) in Chromium AND WebKit; control >=16px; checked/unchecked distinguishable in screenshot diff.

### crossbrowser-features-10 — Mobile drawer height uses `fixed inset-0` (no dvh); iOS Apply button under toolbar
- Severity: **low**
- File: `src/components/news/news-sidebar.tsx:224,241`
- Current: `100dvh` only on desktop; mobile drawer is `fixed inset-0` with `h-full` panel — `inset-0` resolves to the layout viewport on iOS, so the bottom Apply button can sit under the Safari toolbar.
- Expected: mobile drawer fills the visible viewport with the Apply button reachable above the toolbar.
- Acceptance: on iOS Safari (or emulated dynamic toolbar), the open drawer's Apply button is fully visible/tappable; panel height === visible viewport (within tolerance).

---

## Theme: Page layouts

### Home / landing

#### home-landing-01 — Hero search preview dropdown mis-centered and clipped by `overflow-hidden` hero
- Severity: **high**
- File: `src/components/home/hero-search.tsx:64-97`; `src/components/search-preview-dropdown.tsx:23-31`; `src/components/home/home-hero.tsx:31-37,76-83`
- Current: panel `absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2` is rendered inside the input wrapper (not the form), so it centers on an off-center anchor (shrink-0 Search button pushes the input left); near-full-viewport width; the section is `relative overflow-hidden`, so the overflowing edge is clipped (result rows / "See all" cut off; at small widths the LEFT edge overflows ~-41px and is clipped).
- Expected: dropdown anchored/aligned to the input/form (left-aligned), within hero content padding, never clipped by section overflow.
- Acceptance: at 360/480/768/1024px, after typing a query with results, dropdown `getBoundingClientRect().right` <= hero content right edge (and <= innerWidth−8) and `.left` >= hero content left edge; rightmost characters of titles and the "See all (n)" button are not cut off.

#### home-landing-02 — No global overflow-x guard; hero orbs/gradient are a horizontal-scroll hazard
- Severity: **medium**
- File: `src/app/globals.css:69-122,184-227`; `src/components/home/home-hero.tsx:33-51`
- Current: no `overflow-x:hidden`/`max-width` on html/body; orbs absolutely positioned at left:62/78/45% up to 320px wide with blur(70px), contained only by per-section `overflow-hidden`; no root backstop.
- Expected: document never scrolls horizontally; decorative overflow contained by an explicit root-level guard.
- Acceptance: load `/en` and `/uk` at 320/360/414/768/1024/1440px and assert `document.documentElement.scrollWidth <= window.innerWidth`.

#### home-landing-03 — Hero "Top of the week" jump link lands at wrong offset (scroll-mt-20 vs token vs real header)
- Severity: **low**
- File: `src/components/home/home-hero.tsx:68-73`; `src/components/home/top-of-week.tsx:33-38`; `src/app/globals.css:37,118-121`
- Current: `#week` uses `scroll-mt-20` (80px) while `--header-h` is 76px and real header 60px; with smooth scroll the section lands ~20px below where it should.
- Expected: section sits just below the actual header with a small consistent gap at all widths.
- Acceptance: after clicking the CTA, `#week` `getBoundingClientRect().top` >= real header height and within ~8px of it.

#### home-landing-04 — Hero H1 has no word-break/hyphenation; long uk tokens can overflow at 320px
- Severity: **low**
- File: `src/components/home/home-hero.tsx:55-57`; `src/lib/i18n.ts:27,277`
- Current: H1 has no `overflow-wrap`/`break-words`/`hyphens`; long tokens (e.g. `AI-індустрія`) lack break protection.
- Expected: headline wraps cleanly within the content column at 320px in both languages.
- Acceptance: at 320/360px on `/en` and `/uk`, H1 `scrollWidth <= clientWidth` and the H1 right edge stays within the px-6 padding.

#### home-landing-05 — Hero search row does not wrap; input cramped at small widths
- Severity: **low**
- File: `src/components/home/hero-search.tsx:65-105`; `src/lib/i18n.ts:37-38,287-288`
- Current: form is `flex max-w-xl gap-2` with no `flex-wrap`; at 320px the input computes ~149px while the shrink-0 button keeps full padding/label.
- Expected: input stays comfortably usable on narrow viewports (button wraps or shrinks).
- Acceptance: at 320px, hero search `<input>` clientWidth >= 160px and the input and button rects do not intersect; placeholder's first word is visible.

#### home-landing-06 — Category-coverage bar segments have no min-width (sub-pixel slivers)
- Severity: **low**
- File: `src/components/home/category-mix-bar.tsx:22-36`
- Current: segment width is `(count/total)*100%` with no min-width; small categories render <1px in an `h-3` bar; sub-pixel rounding under/overfills the pill.
- Expected: every legend category with count>0 is a visible (>=2-3px) segment; segments exactly fill the bar.
- Acceptance: at 320/768px, each segment `getBoundingClientRect().width >= 2px`; sum of segment widths === container width within 1px.

#### home-landing-07 — Trending chart fixed 7.5rem label column squeezes bars on narrow screens
- Severity: **low**
- File: `src/components/home/trending-topics.tsx:30-31,60-84`
- Current: mobile single-column; rows are `grid-cols-[7.5rem_1fr_2ch] gap-3` inside `p-5`; at 320px the 1fr bar track computes ~74px and labels truncate aggressively.
- Expected: bars remain meaningfully wide and labels have room before truncating on narrow viewports.
- Acceptance: at 320px, each row's middle (bar) track computed width >= 90px; the label column shrinks responsively rather than staying fixed at 120px.

#### home-landing-08 — `scroll-behavior:smooth` jump has no graceful path on older WebKit
- Severity: **low**
- File: `src/app/globals.css:118-121`; `src/components/home/home-hero.tsx:68-73`
- Current: global smooth scroll with no JS fallback; on engines lacking smooth-scroll the jump is instant (fine) but combined with home-landing-03 the offset is wrong.
- Expected: jump lands at the correct offset below the header even without smooth-scroll (instant is acceptable).
- Acceptance: in a WebKit engine without smooth-scroll, clicking the CTA lands `#week` below the header within ~8px.

#### home-landing-09 — Hero orbs `blur(70px)` repaint/scroll-jank cost on tablet WebKit
- Severity: **low**
- File: `src/app/globals.css:184-227`; `src/components/home/home-hero.tsx:38-51`
- Current: three 240-320px orbs each `filter:blur(70px)` with infinite transform keyframes; gated `md:block` (phones spared) but 768-1024px animates three heavy blur layers; reduced-motion zeroes animation but blur remains.
- Expected: orbs do not measurably degrade scroll/paint on tablets; cheap or suppressed where blur compositing is costly.
- Acceptance: at 834px WebKit, scrolling the hero maintains >=50fps (no sustained long-frame >50ms from orb layers); orbs remain hidden below md.

### Content templates (article / concept / category / about)

#### content-templates-01 — No global overflow-wrap/word-break + no overflow-x guard; long URLs break page width
- Severity: **high**
- File: `src/app/globals.css:69-122`; `src/app/layout.tsx:38`; `src/app/[lang]/layout.tsx:52-54`; `src/components/markdown-body.tsx:18-29,79-83`
- Current: no base `overflow-wrap`/`word-break`/`hyphens`; no `overflow-x` guard on html/body/main; body paragraphs render arbitrary strings, so a long unbroken URL forces the paragraph wider than the 760px column and scrolls the whole page.
- Expected: long words/URLs wrap; root overflow-x guard prevents residual sideways scroll.
- Acceptance: on `/[lang]/[brief]/[item]` at 320px with a 60+ char unbroken URL in a paragraph, `document.documentElement.scrollWidth === window.innerWidth` and the paragraph wraps within the column.

#### content-templates-02 — Citation/source links render full URL as text with no break
- Severity: **high**
- File: `src/components/story-body.tsx:259-277`; `src/components/markdown-body.tsx:18-29`
- Current: sources render `{citation.title || citation.url}` inside an `<a>` with no `break-words`; bare URLs (no title) overflow the column; inline markdown links likewise.
- Expected: citation and inline link text wrap on long URLs, never exceed the column.
- Acceptance: on an article whose first citation has no title (bare URL), at 360px the citations `<a>` wraps and page `scrollWidth === window.innerWidth`.

#### content-templates-03 — Inline `code` spans do not wrap (unlike fenced blocks)
- Severity: **medium**
- File: `src/components/markdown-body.tsx:9-17`; `src/components/story-body.tsx:129-140`
- Current: fenced code uses `overflow-x-auto`; inline `<code>` has only padding/border/font, no `break-words`; long tokens (e.g. `gemini-embedding-001@768`) overflow.
- Expected: inline code wraps or is constrained so it cannot exceed the container.
- Acceptance: with a 40+ char unbroken inline `code` token, at 360px the span wraps and page `scrollWidth === window.innerWidth`.

#### content-templates-04 — Facts table dt/dd row can overflow before wrapping at narrow widths
- Severity: **low**
- File: `src/components/story-body.tsx:105-115`
- Current: rows are `flex flex-wrap`, dt `min-w-[140px] flex-1`, dd `flex-[2]` with no `min-w-0`/`break-words`; a long unbreakable value overflows the facts box (contained from page scroll by the section's `overflow-hidden`, so it's clipped mid-word).
- Expected: label/value stack or wrap cleanly; long values break rather than overflow.
- Acceptance: with a 50+ char unbroken value, at 320px the facts `<section>` `scrollWidth <= clientWidth` and the value text wraps (not clipped mid-word).

#### content-templates-05 — Facts comparison grid columns can overflow on very narrow viewports
- Severity: **low**
- File: `src/components/facts-visual.tsx:14-31`
- Current: grid `minmax(96px,9rem) 1fr auto`; label truncates but the auto value column is unconstrained and can push the grid past the box (clipped by the parent section `overflow-hidden`).
- Expected: bars/values fit within the facts box at the narrowest mobile column.
- Acceptance: with a long display value, at 320px `FactsVisualBlock` container `scrollWidth <= clientWidth` (and value not clipped mid-word).

#### content-templates-06 — Concept header title wrapper lacks `min-w-0`; long names overflow the flex row
- Severity: **medium**
- File: `src/components/concept-header.tsx:23-41`
- Current: row `flex items-center gap-3` with shrink-0 icon and a sibling text `<div>` with no `min-w-0`; long h1 names can't shrink and overflow; h1 also lacks `break-words` (contrast category-header.tsx:26 which has `min-w-0`).
- Expected: long concept names wrap beside the icon, never overflow.
- Acceptance: with a 30+ char unbroken concept name, at 360px header `scrollWidth <= clientWidth` and the h1 wraps under/next to the icon.

#### content-templates-07 — Category header h1/tagline/description lack break-words (overflow despite min-w-0)
- Severity: **low**
- File: `src/components/category-header.tsx:26-33`
- Current: text column has `min-w-0` but h1/tagline/description lack `break-words`; an unbreakable word sets a min content size that overflows the banner (no root overflow-x guard).
- Expected: long names/taglines break and stay inside the banner on mobile.
- Acceptance: with a 30+ char unbroken category name, at 360px `cat-header` `scrollWidth <= clientWidth`.

#### content-templates-08 — About page email/external links are non-breaking and can overflow
- Severity: **low**
- File: `src/app/[lang]/about/page.tsx:125-143`
- Current: links row `flex flex-wrap gap-3`; anchors/email render labels inline with no `break-words`; a long single label overflows its line within the 760px column.
- Expected: long author-link labels and the contact email wrap on mobile.
- Acceptance: on `/[lang]/about` at 320px, no element inside the editor section overflows (`section scrollWidth <= clientWidth`).

#### content-templates-09 — Prev/next nav cards: long right-aligned titles unbalanced/awkward at mid widths
- Severity: **low**
- File: `src/app/[lang]/[brief]/[item]/page.tsx:262-296`
- Current: `grid sm:grid-cols-2`; title cells have no truncation/line-clamp; the next cell is `text-right`; long titles wrap to many lines making cells unequal height.
- Expected: prev/next cards keep balanced heights with long titles (clamped to ~2 lines), legible when right-aligned.
- Acceptance: with two long adjacent titles, at 768px both cards clamp their title to <=2 lines and have equal heights.

#### content-templates-10 — `color-mix(in srgb)` borders/accents need a cross-browser support floor/fallback
- Severity: **low**
- File: `src/components/story-body.tsx:67-70`; `src/components/facts-visual.tsx:22-24,44-46`; `src/app/globals.css:264-355`
- Current: color-mix drives why-it-matters border, comparison bar/stat colors, and all `cat-*` utilities, with no solid fallback; on older engines the declaration drops, leaving fills/borders transparent.
- Expected: tinted borders/bar fills fall back to a solid color where color-mix is unsupported.
- Acceptance: with color-mix disabled, the comparison bar fill and why-it-matters border render a visible non-transparent color (computed alpha > 0).

#### crossbrowser-features-06 — color-mix with runtime author colors, no fallback (silent drop)
- Severity: **medium**
- File: `src/components/facts-visual.tsx:23,44`; `src/components/story-body.tsx:69`; `src/app/globals.css:268-396`
- Current: ~40 color-mix declarations + inline `color-mix(in srgb, ${color} 75%, var(--text))` built from runtime CMS color strings, every one a single declaration with no fallback; a malformed color also invalidates the whole declaration.
- Expected: each color-mix has a plain solid-color fallback first; inline usages guard a validated color.
- Acceptance: with color-mix forced unsupported, facts bars, stat numbers, story-body borders, and category chips all retain a visible color with adequate contrast (>=3:1 bar/border, >=4.5:1 text); nothing collapses to transparent.

---

## Theme: Feed cards & footer/newsletter

### Feed cards

#### feed-cards-01 — Card action buttons ~30px tall (below 44px tap target)
- Severity: **high**
- File: `src/components/post-card.tsx:87-88,156-254`
- Current: shared `iconBtn` is `px-2.5 py-1.5 text-[0.8rem]` (~30px); all four actions (Read more/Save/Share/Comments) use it; no min-height.
- Expected: primary card actions present >=44x44px touch targets on touch/mobile.
- Acceptance: at 375px, each card action button within `article[data-testid=post-card]` returns `getBoundingClientRect().height >= 44`.

#### feed-cards-02 — Title/summary lack overflow-wrap; long tokens overflow the card horizontally
- Severity: **high**
- File: `src/components/post-card.tsx:124,148-154`
- Current: text column has `min-w-0` (shrinks track) but title link and summary `<p>` lack `break-words`/`overflow-wrap`; a long unbroken token creates horizontal overflow at narrow widths.
- Expected: long strings in title/summary wrap; card never exceeds viewport; no horizontal scrollbar.
- Acceptance: with a 40-char unbroken token in a title, at 320px `document.documentElement.scrollWidth <= 320` and the card's right edge stays within the viewport.

#### feed-cards-03 — PostCardSkeleton structure does not match real PostCard (layout shift on swap)
- Severity: **medium**
- File: `src/components/ui/skeleton.tsx:62-74`; `src/components/post-card.tsx:90-95`
- Current: skeleton outer is a bare `.post-grid` with thumbnail first and the bordered/padded box as the second (text-only) cell, thumbnail hidden <640; real card has the border+p-4 on the OUTER article wrapping `.post-grid`, gap 1.1rem, thumbnail always shown. Geometry differs on skeleton→card swap.
- Expected: skeleton occupies the same box (outer border, padding, gap, thumbnail presence at <640) as the rendered card.
- Acceptance: at 375px and 1024px, the skeleton's bounding box (width/height/offsetTop) matches a real post-card within <8px; both show/hide the thumbnail consistently at <640px.

#### feed-cards-05 — Share popover left-anchored with min-w-[190px]; overflows right edge when Share wraps right
- Severity: **medium**
- File: `src/components/post-card.tsx:186-201`
- Current: share menu `absolute bottom-full left-0 ... min-w-[190px]`; in the flex-wrap action row the Share button can wrap near the card's right edge, so the 190px menu opens rightward past the viewport; no collision handling.
- Expected: popover stays fully within the card/viewport horizontally regardless of where Share wraps.
- Acceptance: at 320-480px, after opening share, menu `getBoundingClientRect().right <= window.innerWidth` and document `scrollWidth` does not exceed the viewport.

#### feed-cards-06 — Summary has no line-clamp (uneven, very tall cards on mobile)
- Severity: **low**
- File: `src/components/post-card.tsx:154`
- Current: summary `<p>` renders the full text with no `line-clamp`; long summaries make cards disproportionately tall and the feed inconsistent.
- Expected: summaries clamped to a consistent line count (~2-3); full text available via expand/open affordances.
- Acceptance: at 375px, a long-summary card's paragraph renders at most N lines (height <= N*lineHeight); feed card heights stay within a bounded range.

#### feed-cards-07 — Meta row wraps badly; source/date span has no min-w-0/truncation
- Severity: **low**
- File: `src/components/post-card.tsx:125-146`
- Current: meta row `flex flex-wrap gap-2`; CategoryBadge is `whitespace-nowrap`; `{source} · {date}` span has no truncate/min-w-0; long tokens wrap to 3+ lines.
- Expected: meta row stays compact (1-2 lines), eliding long source names.
- Acceptance: at 320px with a long source name, the meta row occupies <=2 visual lines and does not overflow the card width.

#### feed-cards-08 — `.card-hover` lift persists on touch tap (no hover-capability guard)
- Severity: **low**
- File: `src/app/globals.css:244-253`
- Current: `.card-hover:hover` applies `translateY(-3px)` + pop shadow with no `@media (hover: hover)`; sticky :hover on touch leaves a tapped card lifted.
- Expected: lift/shadow applies only on hover-capable devices; touch tap leaves no stuck state.
- Acceptance: under an emulated touch/coarse-pointer profile, tapping a card leaves no translated transform/pop shadow after the tap.

#### feed-cards-09 — Thumbnail tap area mismatches the 92px visual at <640
- Severity: **low**
- File: `src/components/post-card.tsx:96-122`; `src/components/category-thumb.tsx:16-25`
- Current: at <640 the thumbnail trigger is `block w-full` (full-width grid row) wrapping a fixed 92px image span or a 92px-capped CategoryThumb, both left-aligned; the tap area spans the whole row while the visual is only 92px, and the two branches read inconsistently vs the >=640 layout.
- Expected: thumbnail presents consistently (same size/alignment for image vs placeholder) and the expand tap area matches the visible thumbnail.
- Acceptance: at 375px, both thumbnail branches have the same width/height and the trigger hit box matches the visible thumbnail bounds.

### Footer & newsletter

#### footer-newsletter-01 — Footer has no designed mobile stack (emergent flex-wrap)
- Severity: **medium**
- File: `src/components/site-footer.tsx:11-62`
- Current: container `flex flex-wrap items-start justify-between gap-8` with no sm/md/lg utilities; row→stack is emergent flex-wrap, and `justify-between` governs wrapped alignment.
- Expected: intentional vertical/multi-column stack at a defined breakpoint, brand above nav, consistent left alignment, predictable spacing 320-1440px+.
- Acceptance: at 375px the brand block and nav are vertically stacked and left-aligned (nav left edge === brand left edge within 2px); transition happens at one declared breakpoint; no element's right edge exceeds the 1160px container minus px-6 at 320/375/768/1024/1440px.

#### footer-newsletter-02 — Footer nav links ~20px tap targets
- Severity: **medium**
- File: `src/components/site-footer.tsx:29-61`
- Current: nav `flex flex-col gap-2 text-sm`; 11 bare-text Links + cookie button at ~20px height, 8px apart.
- Expected: each link >=44px tall with adequate spacing.
- Acceptance: every interactive element inside the footer `<nav>` reports bounding-box height >= 44px at 390px; vertical gap between adjacent boxes >= 8px.

#### footer-newsletter-03 — Footer social links sub-44px with tight spacing
- Severity: **medium**
- File: `src/components/site-footer.tsx:15-27`
- Current: `flex flex-wrap gap-3` anchors, 14px text, no padding, ~20px tall, 12px apart; short labels (e.g. RSS) give a tiny hit area.
- Expected: each social link >=44px tall (ideally 44x44) with adequate spacing.
- Acceptance: each social anchor reports height >= 44px (and width >= 44px or a clearly larger padded hit area) at 390px; adjacent boxes do not overlap.

#### footer-newsletter-04 — CookieSettingsButton too small and inconsistent within footer nav
- Severity: **medium**
- File: `src/components/site-footer.tsx:60`; `src/components/cookie-consent.tsx:227-238`
- Current: button is `hover:text-text text-left text-sm` with no padding/min-height; a `<button>` mixed among `<Link>` anchors, so any anchor-only sizing fix misses it.
- Expected: matches sizing/spacing of sibling footer links; >=44px tall.
- Acceptance: the cookie-settings button reports height >= 44px at 390px and its row height matches sibling footer Links within 2px.

#### footer-newsletter-05 — Newsletter form loses layout height on success/error (jump)
- Severity: **low**
- File: `src/components/home/newsletter-form.tsx:35-49`
- Current: `done`/`not_configured` early-return a single `<p>`, collapsing the input+button height; `error` instead appends a `w-full` message inside the form — opposite-direction, inconsistent.
- Expected: feedback states occupy comparable vertical space; no noticeable jump.
- Acceptance: the newsletter card's height after a successful submit differs from idle by < ~16px at 375px and 1024px.

#### footer-newsletter-07 — Newsletter card gradient hardcoded for dark theme
- Severity: **low**
- File: `src/components/home/newsletter-band.tsx:31-35`
- Current: inline gradient uses hardcoded `rgba(240,192,64,0.14)` (dark `--accent`), not a theme token; on `.theme-light` it reads as a muddy tint and contrast shifts.
- Expected: gradient uses theme tokens so it renders correctly in both themes.
- Acceptance: with `.theme-light`, the card background derives its accent tint from `--accent` (not a fixed rgba) and eyebrow/title/body retain >=4.5:1 contrast.

#### footer-newsletter-08 — Newsletter proof items: tight wrap + literal checkmark glyph alignment
- Severity: **low**
- File: `src/components/home/newsletter-band.tsx:41-50`
- Current: `flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm` with a literal U+2713 ✓ glyph (not an SVG icon); narrow widths wrap densely; glyph baseline alignment varies by platform.
- Expected: items wrap with comfortable spacing at the smallest viewports; checkmark aligns consistently across browsers.
- Acceptance: at 320px the list wraps without item overflow, rows stay vertically centered, and the ✓ baseline aligns with its label (no >2px offset) in Chrome/Firefox/WebKit.

#### footer-newsletter-09 — Long UK submit label can crowd/overflow the button at narrow widths
- Severity: **low**
- File: `src/components/home/newsletter-form.tsx:81-99`; `src/lib/i18n.ts:314`
- Current: button `inline-flex px-5 py-3` + ArrowRight; UK label `Підписатися — без спаму` is longer than EN; inside `flex max-w-md flex-wrap gap-2` with input `basis-56`, at the shared-row threshold the label can force the row wider / clip; no wrap/truncate guard.
- Expected: input and button wrap/size gracefully at all widths in UK without clipping/overflow.
- Acceptance: on `/uk` at 320/360px, the full label is visible (not clipped), no horizontal scroll, and input+button fit one row or wrap to two full-width rows.

#### footer-newsletter-10 — Footer copyright/tagline lack explicit overflow handling for long localized strings
- Severity: **low**
- File: `src/components/site-footer.tsx:12-14,63-65`
- Current: brand block `min-w-0`, tagline `max-w-md`, copyright `<p>` has no max-width/break utility; no explicit `overflow-wrap`/`break-words`; longest UK strings at 320px can overflow at the `·` joins.
- Expected: all footer text wraps within the container at 320px in either locale.
- Acceptance: at 320px on `/en` and `/uk`, tagline and copyright wrap inside the px-6 container and document does not scroll horizontally.

---

## Theme: Cross-browser (global CSS & shared concerns)

### global-css-01 — Dead band 900-1024px (news layout desktop while header mobile)
- Severity: **high**
- File: `src/app/globals.css:420-431`; `src/components/site-header-chrome.tsx:96,165`; `src/components/news/news-feed.tsx:138,177`; `src/components/news/news-sidebar.tsx:224,232`
- Current: layout + `.desktop-only`/`.mobile-only` flip at 900px; header at lg/1024px; 900-1023px shows desktop sidebar + hides mobile Filters button while header is still hamburger. (Root-cause duplicate of header-topbar-02 / filters-drawer-01 / mobile-menu-08 — fix once via global fix #1.)
- Expected: header chrome and page layout switch at the same single breakpoint.
- Acceptance: at 900/960/1023px on `/en/news`, EITHER desktop sidebar + Primary nav both visible, OR mobile Filters button + hamburger both visible — never desktop sidebar with hamburger.

### global-css-02 — `--header-h` 76px vs 60px header (sidebar offset/max-height off ~16px)
- Severity: **medium**
- File: `src/app/globals.css:37`; `src/components/site-header-chrome.tsx:74-76`; `src/components/news/news-sidebar.tsx:224`
- (Root-cause duplicate of header-topbar-03 / filters-drawer-02 / crossbrowser-features-03 — fix once via global fix #2.)
- Acceptance: `--header-h` === header offsetHeight (60px); at >=900px after scrolling, sidebar top === header bottom (±1px).

### global-css-03 — Undefined `--radius` → cookie-consent banner renders square
- Severity: **low**
- File: `src/components/cookie-consent.tsx:137`; `src/app/globals.css:31-32`
- Current: `rounded-[var(--radius)]` but `--radius` is never declared (only `--radius-card`/`--radius-pill` exist); `var()` has no fallback so border-radius is invalid → square corners.
- Expected: banner uses a defined radius token and renders rounded.
- Acceptance: banner computed `border-top-left-radius > 0px` (e.g. 14px). Fix: use `rounded-card` (wrong token name).

### global-css-04 — No global overflow-x guard on html/body
- Severity: **low**
- File: `src/app/globals.css:69-122`; `src/app/layout.tsx:31,38`
- Current: no `overflow-x:hidden`/`max-width:100%` on html/body/base; any overflowing child can produce a document-level horizontal scrollbar. (Backstop for the content-templates/feed-cards/home overflow items — covered by global fix #5.)
- Expected: page never scrolls horizontally 320-1440px+; child overflow contained, not panning the document.
- Acceptance: at 320/360/768/900/1024/1440px, `document.documentElement.scrollWidth <= window.innerWidth` on `/en`, `/en/news`, and a story page.

### global-css-05 — Variable webfonts swap with no metric overrides (FOUT/CLS, worst on serif headings)
- Severity: **medium**
- File: `src/app/globals.css:1-3,16-17,77-84`
- Current: Inter Variable + Fraunces Variable via @fontsource ship `font-display:swap` with no `size-adjust`/`ascent-override`/fallback metric matching; h1-h3 use Fraunces with Georgia fallback (very different metrics) → reflow on swap.
- Expected: minimal/no layout shift on swap; metric-matched fallbacks (or preloaded fonts).
- Acceptance: with network throttled, the home hero h1 (`#hero-title`) bounding box does not change by more than ~2px between fallback render and webfont render (measure around `document.fonts.ready`); font-swap CLS ~0.

### global-css-06 — Hero jump-link offset 80px is a third magic number (60/76/80)
- Severity: **low**
- File: `src/components/home/top-of-week.tsx:37`; `src/components/home/home-hero.tsx:68-73`; `src/app/globals.css:37,119-121`
- (Root-cause duplicate of home-landing-03 — fix via global fix #2: replace `scroll-mt-20` with `scroll-mt-[var(--header-h)]`.)
- Acceptance: after clicking the hero `#week` link, `#week` top === header height (within ~4px); `scroll-margin-top` derives from `var(--header-h)`.

### global-css-07 — overscroll-behavior/dvh only on desktop sidebar; needs graceful degradation
- Severity: **low**
- File: `src/components/news/news-sidebar.tsx:224`; `src/app/globals.css:380-393`
- Current: sidebar uses `100dvh` + `overscroll-y-contain`; on browsers lacking dvh the calc is invalid → no max-height cap → sidebar grows with content; scrollbar styling split across Firefox/WebKit properties.
- Expected: sidebar caps height via a `vh` fallback and stays independently scrollable where dvh is unsupported; containment degrades gracefully.
- Acceptance: in a WebKit build without dvh, the sidebar has a finite max-height (scrolls internally); a `vh` fallback precedes the dvh value.

### crossbrowser-features-05 — Mobile drawer & header menu lack scroll-lock + overscroll-contain (iOS scroll-chaining)
- Severity: **high**
- File: `src/components/news/news-sidebar.tsx:230-262`; `src/components/site-header-chrome.tsx:173-178`
- Current: desktop aside has `overscroll-y-contain`, but the mobile drawer panel (`overflow-y-auto` only) and backdrop have neither overscroll-contain nor body-scroll-lock; the header menu renders in-flow with no overlay; on iOS/Android the page scroll-chains behind the open overlay. (Covered by global fixes #3 and #4.)
- Expected: while the drawer or header menu is open, the page does not scroll; over-scroll within the panel does not chain to the body on any engine.
- Acceptance: with drawer (and separately the menu) open, programmatic window scroll does not change `window.scrollY`; the panel scrolls internally; verified in Chromium and WebKit; `overscroll-behavior:contain` present on the scrollable panel.

### crossbrowser-features-07 — Custom scrollbar diverges across engines
- Severity: **low**
- File: `src/app/globals.css:380-393`
- Current: `.sidebar-scroll` sets both `scrollbar-width/color` (Firefox/Chrome 121+) and `::-webkit-scrollbar*` (WebKit/Chromium); thickness/appearance differ across the three engines (cosmetic, degrades to default).
- Expected: thin brand-colored scrollbar appears consistently, or degrades to platform default with no layout shift.
- Acceptance: `.sidebar-scroll` renders a thin track in Chromium/WebKit/Firefox with no horizontal layout shift; screenshot diff shows no overflow/clipping difference from scrollbar width.

### crossbrowser-features-08 — `:has()` in base layer drops the label-cursor rule below engine floors
- Severity: **low**
- File: `src/app/globals.css:99-110`
- Current: `:where(label:has(input[type=checkbox]), ...)` sets cursor:pointer; on Firefox <121 the unsupported `:has()` arg drops, removing the pointer cursor on label-wrapped inputs (forgiving `:where()` keeps the bare-input cursor rules, so degradation is mild and cosmetic).
- Expected: pointer cursor on labels where `:has()` is supported; default cursor (no functional loss) elsewhere.
- Acceptance: on `:has()`-supporting engines, hovering a filter label shows cursor:pointer; on a forced no-`:has()` path controls remain clickable with only the cursor differing.

---

## Theme: Test coverage

> All test-coverage items below describe MISSING tests, not separate runtime defects. They become trivially satisfiable once the corresponding code fix and the responsive/cross-browser matrices (test-infra-01/02) land. Each acceptance criterion below should be a test that currently FAILS (encoding the bug) and passes after the fix.

### test-infra-01 — Playwright runs only chromium (no Firefox/WebKit)
- Severity: **medium**
- File: `playwright.config.ts:21-26`; `package.json:27`; `.github/workflows/e2e.yml:32`
- Current: single `{name:'chromium'}` project; CI installs chromium only; app relies on color-mix/backdrop-blur/100dvh/`:has()`/overscroll/smooth-scroll/scrollbar features.
- Expected: matrix includes chromium + firefox + webkit; CI installs all three.
- Acceptance: config exposes `chromium`/`firefox`/`webkit` projects; `npx playwright test --list` schedules each spec under all three (count == specs*3 for the desktop tier); CI runs `playwright install --with-deps`.

### test-infra-02 — Only one viewport (1280x720) is tested
- Severity: **medium**
- File: `playwright.config.ts:15-26`; `e2e/helpers/news-page.ts:4-9`
- Current: fixed `{1280,720}` viewport; all specs use `NEWS_DESKTOP_VIEWPORT`; no boundary (640/768/900/1024) crossed.
- Expected: a viewport matrix covering phone/tablet/large-desktop and the layout/header boundaries.
- Acceptance: named viewport projects/fixtures cover >=320,375,390,768,834,900,1024,1280,1440; `--list` shows specs across phone/tablet/desktop tiers; at least one spec asserts behavior at 375, 768, and 1440.

### test-infra-03 — No test for the 900-1024px sidebar/header mismatch
- Severity: **medium**
- File: `src/app/globals.css:420-431`; `src/components/site-header-chrome.tsx:96-182`; `e2e/news-sidebar.spec.ts:4-8`
- Acceptance: a spec at 960x800 asserts `getByTestId('news-sidebar')` and `nav[aria-label="Primary"]` have the SAME visibility (`expect(sidebarVisible).toBe(primaryNavVisible)`), so "desktop sidebar + hamburger header" fails. After unification, assert sidebar-visible iff Primary-nav-visible at 768/834/900/960/1023/1024.

### test-infra-04 — No test for header search box colliding with nav at narrowed desktop widths
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:88-94,96-163`
- Acceptance: a spec over [1024,1100,1160,1280,1440] asserts (when both `role=search` input and `nav[aria-label="Primary"]` are visible) `searchBox.x + searchBox.width <= navBox.x` (no horizontal overlap) and search input clientWidth > 0.

### test-infra-05 — No test that header nav items stay on one row
- Severity: **low**
- File: `src/components/site-header-chrome.tsx:96-163`
- Acceptance: a spec at [1024,1100,1280] asserts every direct child of `nav[aria-label="Primary"]` shares the same `boundingBox().y` (tolerance <=2px) and each child's right edge <= header container right edge.

### test-infra-06 — No test that the mobile menu is an overlay
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:185-251`
- Acceptance: a spec at 390x844 opens the menu and asserts `nav[aria-label="Mobile"]` computed position in {fixed,absolute} AND a backdrop element exists behind it; the first post-card center point hit-tests to the menu/backdrop (not the post-card) while the menu is open.

### test-infra-07 — No test for duplicate Subscribe buttons with menu open at >=640px
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:167-172,241-248`
- Acceptance: a spec at 768x1024 (and 640x900) opens the menu and asserts visible Subscribe link count === 1 (currently 2).

### test-infra-08 — No test for outside-click/Escape close + body-scroll-lock on the mobile menu
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:31,173-182,185-251`
- Acceptance: specs at 390x844: (a) Escape closes the menu; (b) outside-click closes it; (c) while open, `window.scrollTo`/wheel leaves `document.body` scrollTop at 0 (or body has `overflow:hidden`). All three currently fail.

### test-infra-09 — No test that the mobile Filters drawer is fullscreen multi-column
- Severity: **medium**
- File: `src/components/news/news-sidebar.tsx:230-264`; `e2e/news-sidebar.spec.ts:4-8,79-86`
- Note: the "fullscreen multi-column" target (filters-drawer-03) is a design preference, not a current-code bug — gate this test on that design decision.
- Acceptance: a spec at 390x844 (and 768x1024) opens the drawer via the Filters button and asserts dialog width >= ~0.95*viewport AND its FilterGroup `<section>` elements occupy >=2 distinct x-columns.

### test-infra-10 — No mobile/tablet smoke for the hamburger path / mobile search
- Severity: **medium**
- File: `e2e/smoke.spec.ts:5-27`; `src/components/site-header-chrome.tsx:165-193`
- Acceptance: a spec at 375x812 asserts `nav[aria-label="Primary"]` hidden, hamburger visible, clicking it shows `nav[aria-label="Mobile"]` containing a `role=search` input and Home/News/About links; clicking News navigates to `/uk/news`.

### test-infra-11 — Drawer modal lifecycle/scroll-lock untested at mobile
- Severity: **low**
- File: `src/components/news/news-sidebar.tsx:211-218,230-264`; `e2e/news-sidebar.spec.ts:1-87`
- Acceptance: a spec at 390x844: open via Filters → dialog visible; Escape → hidden; reopen, backdrop click → hidden; reopen, Apply → hidden; while open assert body scroll locked (scrollTop stays 0 on scroll attempt).

### test-infra-12 — No cross-browser graceful-degradation assertions (color-mix/backdrop/dvh/`:has()`)
- Severity: **medium**
- File: `src/components/site-header-chrome.tsx:74`; `src/components/news/news-sidebar.tsx:224`; `src/app/globals.css:104-105,381-391`
- Depends on test-infra-01 projects existing.
- Acceptance: a spec (runs under all projects) asserts `getComputedStyle(header).backgroundColor` alpha > 0 and `parseFloat(getComputedStyle(sidebar).maxHeight)` is finite and > 0; confirm pass on chromium/firefox/webkit.

### test-infra-13 — `--header-h` vs actual header height not asserted
- Severity: **medium**
- File: `src/app/globals.css:37`; `src/components/site-header-chrome.tsx:76`; `src/components/news/news-sidebar.tsx:224`
- Acceptance: a spec asserts `parseFloat(getComputedStyle(documentElement).getPropertyValue('--header-h'))` === header `boundingBox().height` within ±1px (currently 76 vs 60, fails) at 1280.