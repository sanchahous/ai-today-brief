# Mission: Responsive & Cross-Browser Hardening (Header · Mobile menu · Filters + systemic roots)

> **Status:** Operator-framed spec for autonomous implementation. Source: 88-defect whole-site audit (this is the focused mission-#2 subset).
> **Scope this mission:** 52 in-scope defects — 7 high, 29 medium, 16 low.
> **Deferred to a later mission:** per-page polish of home-landing, content-templates, feed-cards, footer-newsletter (35 defects). Do NOT touch those surfaces beyond what the global root fixes naturally repair.

## Goal

Eliminate the responsive and cross-browser breakage in the site **chrome** — the header/nav, the mobile menu, and the filters drawer — by fixing the two systemic root causes and rebuilding the overlay/menu behaviour on a single reusable primitive. Add automated responsive + cross-browser regression coverage so this can never silently regress.

## Role split (read carefully)

- **You (the orchestrator team)** implement all fixes below **and** write the responsive + cross-browser test matrix (see "Test coverage" + the matrix at the end).
- **The operator (human-gated)** owns: scope-gating via kanban comments, the final PASS/FAIL judgment, and the eventual push/PR. **Do not push or open a PR.**

## Do the global root fixes FIRST — they collapse most individual items

1. **Unify the breakpoint system.** Layout flips at custom `min-width:900px` (`globals.css:420-431`); header flips at Tailwind `lg`/1024px (`site-header-chrome.tsx:96,165,186`). Pick ONE desktop/mobile threshold and make both sources read it (align the `globals.css` `@media` to 1024px, or register a shared breakpoint token / Tailwind screen). Kills the 900–1023px dead band.
2. **Fix `--header-h`.** Token is 76px (`globals.css:37`) but the header is `h-[60px]` (`site-header-chrome.tsx:76`). Set it to the real height **and** make it the single source of truth: drive the header with `h-[var(--header-h)]`, and change the hero anchor from `scroll-mt-20` to `scroll-mt-[var(--header-h)]`.
3. **Build ONE reusable overlay/drawer primitive** and use it for BOTH the header mobile menu and the filters drawer: `position:fixed` full-viewport layer; dimmed **opaque-backed** backdrop; outside/backdrop-click close; Escape close; `role="dialog"` + `aria-modal="true"` + `aria-controls` on the trigger; focus-in on open + Tab focus-trap + focus-return on close; route-change auto-close; **opaque** panel background (`var(--bg)` alpha 1, not the translucent header surface).
4. **Add a body-scroll-lock utility** (toggle `overflow:hidden` on body; iOS `position:fixed` + restore scroll; compensate scrollbar width) and wire it into the overlay primitive. None exists today.
5. **Add a root overflow-x guard + base text-wrapping** in `@layer base`: `overflow-x:clip` + `max-width:100%` on `html`/`body`, and `overflow-wrap:anywhere`/`break-words` on prose containers, titles, summaries, links, and inline code. Keep intentional inner `overflow-x-auto` regions.
6. **Cross-browser fallback policy:** for every `color-mix(in srgb,…)`, `backdrop-filter`, and `100dvh`, declare a solid/`vh` fallback FIRST and layer the modern value behind `@supports`.

## Non-goals (scope guard — the operator will reject drift)

- Do NOT redesign the brand, typography, colours, or content. This is layout/behaviour correctness only.
- Do NOT modify the data pipeline (`pipeline/**`), content, or Supabase wiring.
- Do NOT restyle home, article/category/concept templates, feed cards, or the footer beyond what the global root fixes (overflow guard, breakpoint, header-h) naturally repair. Those are a separate mission.
- Do NOT push, open a PR, or merge. Do NOT change secrets/config/CI.
- Keep `npm run pr:check` green (coverage ≥70% on logic, typecheck, lint, `next build`).

## Budget

- max_turns: 100 (UI work; split children rather than overrun)
- max_wall_time_minutes: 40 per child
- max_retries: 1

## Worker routing

- planner / implementer / judge: gpt-5.5 (codex)
- reviewer: gemini-flash
- decomposer aux: flash-lite

## Required evidence (per child + epic)

changed files · commands run · test results (`pr:check` + new e2e matrix) · reviewer verdict · judge verdict · receipt at `operator/receipts/`.

## Human-approval gates

push to remote · open PR · any change outside the worktree · touching secrets/CI.

---

## In-scope defects (52)

> Severity is the audit's automatic rating; `filters-drawer-03` is marked REQUIRED because it is your explicit request (fullscreen, compact multi-column filters), not optional polish.

### Global CSS, tokens & breakpoint system (ROOT CAUSES) (7)

#### global-css-01 — Dead breakpoint band 900–1024px: news layout goes desktop (2-col + sticky filter sidebar) while the header is still in mobile/hamburger mode
- **Severity:** HIGH · _responsive_
- **Location:** `src/app/globals.css:420-431`, `src/components/site-header-chrome.tsx:96,165`, `src/components/news/news-feed.tsx:138,177`, `src/components/news/news-sidebar.tsx:224,232`
- **Current:** globals.css flips .news-layout to 2 columns and .desktop-only/.mobile-only at min-width:900px, so from 900px up the page shows the desktop sticky filter sidebar AND hides the mobile 'Filters' drawer button. The header (site-header-chrome.tsx) uses Tailwind lg (1024px): full <nav> is lg:flex and the hamburger cluster is lg:hidden. Between 900px and 1023px the body is in desktop mode but the header is still in mobile/hamburger mode — two different layout philosophies on screen simultaneously.
- **Expected:** The header chrome and the page/layout should switch desktop<->mobile at the same single breakpoint, so there is no width range where the header is 'mobile' but the content grid is 'desktop' (or vice-versa).
- **Acceptance:** At viewport widths 900px, 960px and 1023px the news page (/en/news) shows EITHER the desktop sticky sidebar (data-testid=news-sidebar visible) together with the desktop <nav aria-label="Primary"> visible, OR the mobile Filters button visible together with the hamburger button visible — never the desktop sidebar visible while the hamburger menu button is also visible.
- **Direction:** Unify on one breakpoint: change globals.css .news-layout/.desktop-only/.mobile-only @media from 900px to 1024px (or add a Tailwind lg screen alias and drop the custom queries) so header and layout flip together.

#### global-css-02 — --header-h token (76px) does not match the real header height (60px); desktop sticky sidebar top offset and max-height are wrong by ~16px
- **Severity:** MEDIUM · _responsive_
- **Location:** `src/app/globals.css:37`, `src/components/site-header-chrome.tsx:74-76`, `src/components/news/news-sidebar.tsx:224`
- **Current:** :root sets --header-h:76px, but the rendered header inner row is h-[60px] (site-header-chrome.tsx:76) with no extra vertical padding on the bar. The desktop filter sidebar is sticky top-[var(--header-h)] with max-h:calc(100dvh - var(--header-h) - 1rem) (news-sidebar.tsx:224). Because the token is 16px taller than the real header, the sticky sidebar starts 16px lower than the header's bottom edge (leaving a gap / first filter group can slip under the blurred sticky header) and reserves 16px too much height in the max-h calc.
- **Expected:** --header-h must equal the actual sticky header height (60px) so the sidebar's sticky top aligns flush to the header bottom and the max-height fills exactly the remaining viewport.
- **Acceptance:** getComputedStyle(document.documentElement).getPropertyValue('--header-h') equals the header's offsetHeight (currently 60px); and at >=900px after scrolling, news-sidebar's getBoundingClientRect().top equals the header's getBoundingClientRect().bottom (±1px).
- **Direction:** Set --header-h:60px (single source of truth), or drive the header height from the token (h-[var(--header-h)]) instead of a hard-coded 60px.

#### global-css-05 — Variable webfonts load with font-display:swap and no metric overrides → FOUT layout shift, worst on serif headings (Fraunces vs Georgia)
- **Severity:** MEDIUM · _crossbrowser_
- **Location:** `src/app/globals.css:1-3,16-17,77-84`
- **Current:** Inter Variable and Fraunces Variable are imported via @fontsource (globals.css:1-3) and both ship font-display:swap with no size-adjust/ascent-override/@font-face fallback-metric matching. Headings h1–h3 use var(--font-serif)=Fraunces with fallback Georgia (globals.css:80-84); Fraunces and Georgia have very different metrics, so when the webfont swaps in, headings reflow/jump (CLS). This is most visible on slower connections and differs across browsers' swap timing.
- **Expected:** Font swap should cause minimal/no layout shift; fallback fonts should be metric-matched to the webfonts (or fonts preloaded) so headline boxes do not resize on swap.
- **Acceptance:** With network throttled, the home hero h1 (#hero-title) bounding-box height/width does not change by more than ~2px between the fallback render and the webfont render (measure before/after document.fonts.ready); ideally CLS contribution from font swap ~0.
- **Direction:** Add an @font-face fallback with size-adjust/ascent-override tuned to Fraunces/Inter (or use next/font local with adjustFontFallback), and consider preloading the primary weights.

#### global-css-03 — Undefined CSS variable --radius used for cookie-consent banner radius → corners render square (var() resolves to nothing)
- **Severity:** LOW · _both_
- **Location:** `src/components/cookie-consent.tsx:137`, `src/app/globals.css:31-32`
- **Current:** cookie-consent.tsx:137 sets rounded-[var(--radius)], but --radius is never declared anywhere. globals.css @theme inline only defines --radius-card (14px) and --radius-pill (999px). With --radius undefined, border-radius:var(--radius) has no fallback, so the property is invalid and the banner renders with square (0px) corners in every browser, inconsistent with the rounded-card surfaces around it.
- **Expected:** The cookie-consent banner should use a defined radius token (e.g. var(--radius-card)) and render with rounded corners matching other cards.
- **Acceptance:** The cookie-consent banner element has a computed border-top-left-radius > 0px (e.g. 14px), not 0px.
- **Direction:** Replace rounded-[var(--radius)] with rounded-card (or define --radius in :root) — this is purely the wrong token name.

#### global-css-04 — No global overflow-x guard on html/body; horizontal scroll can appear when any descendant overflows (no clamp to viewport)
- **Severity:** LOW · _responsive_
- **Location:** `src/app/globals.css:69-122`, `src/app/layout.tsx:31,38`
- **Current:** Neither html (layout.tsx:31, class h-full) nor body (layout.tsx:38, flex min-h-full flex-col) nor globals.css @layer base body sets overflow-x:hidden or max-width:100%. There is no safety net, so any single overflowing child (e.g. a long unbroken token, a wide table/code block such as the overflow-x-auto blocks in story-body.tsx/markdown-body.tsx if their parent miscalculates, or a fixed-width element at <=320px) produces a document-level horizontal scrollbar and the whole page can be panned sideways on mobile.
- **Expected:** The page should never scroll horizontally at supported widths (320px–1440px+); accidental child overflow should be contained rather than panning the entire document.
- **Acceptance:** At viewport widths 320, 360, 768, 900, 1024 and 1440px, document.documentElement.scrollWidth <= window.innerWidth (no horizontal scrollbar) on /en, /en/news and a story page.
- **Direction:** Add overflow-x:clip (or hidden) + max-width:100% on body in @layer base as a defensive clamp; keep intentional inner overflow-x-auto regions intact.

#### global-css-06 — Hero jump-link offset (scroll-mt-20 = 80px) is yet another hard-coded header height, inconsistent with both the real 60px header and the --header-h token (76px)
- **Severity:** LOW · _responsive_
- **Location:** `src/components/home/top-of-week.tsx:37`, `src/components/home/home-hero.tsx:68-73`, `src/app/globals.css:37,119-121`
- **Current:** The hero 'Top of the week' anchor (#week) target sets scroll-mt-20 (80px) (top-of-week.tsx:37). Combined with scroll-behavior:smooth (globals.css:119-121), clicking the hero link (home-hero.tsx:69) scrolls so the section sits 80px from the top — but the sticky header is only 60px tall and the --header-h token says 76px. Three different magic numbers (60 / 76 / 80) describe the same header offset, so the gap above the landed section is ~20px larger than it should be and will drift if the header height changes.
- **Expected:** Anchor scroll-margin should equal the sticky header height and be derived from the single --header-h token, leaving the section flush below the header.
- **Acceptance:** After clicking the hero #week link, the #week section's getBoundingClientRect().top equals the header height (within ~4px), not ~80px; scroll-margin-top derives from var(--header-h).
- **Direction:** Replace scroll-mt-20 with scroll-mt-[var(--header-h)] (after fixing --header-h to 60px) so all three values collapse to one token.

#### global-css-07 — overscroll-behavior and dvh used only on the desktop sidebar; older Safari (<16) and Firefox lacking dvh/overscroll fall back to imperfect but non-broken behavior — needs graceful-degradation confirmation
- **Severity:** LOW · _crossbrowser_
- **Location:** `src/components/news/news-sidebar.tsx:224`, `src/app/globals.css:380-393`
- **Current:** The desktop sidebar uses max-h:calc(100dvh - …) and overscroll-y-contain (news-sidebar.tsx:224). 100dvh is unsupported on Safari <16.4 and older Chromium/Firefox (treated as invalid → the whole max-height declaration is dropped, so the sidebar gets NO max-height and won't scroll independently, it grows with content). overscroll-behavior is unsupported on Safari <16, so scroll chaining from the sidebar to the page is not prevented there. Custom scrollbar styling (globals.css:380-393) mixes scrollbar-width (Firefox) and ::-webkit-scrollbar (Chrome/Safari) — fine, but no single source of truth and Firefox ignores the webkit rules and vice-versa.
- **Expected:** On browsers without dvh the sidebar should still cap its height (via a vh/calc fallback) and remain independently scrollable; scroll-containment absence should degrade gracefully.
- **Acceptance:** In a WebKit build without dvh support, the news-sidebar element still has a finite max-height (sidebar scrolls internally rather than expanding the page); a CSS fallback max-height using vh precedes the dvh value.
- **Direction:** Provide a stacked fallback: max-height:calc(100vh - …) immediately before the calc(100dvh - …) line so non-dvh browsers still get a capped, scrollable sidebar.

### Header & nav (2)

#### header-topbar-02 — Dead band 900-1023px: custom 900px layout switches to desktop while the header is still in <1024 hamburger mode
- **Severity:** MEDIUM · _responsive_
- **Location:** `src/components/site-header-chrome.tsx:96,165`, `src/app/globals.css:420-431`
- **Current:** globals.css flips .desktop-only to display:block and .mobile-only to display:none at min-width:900px (lines 420-431), and .news-layout becomes 2-column there. But the header keeps the full nav hidden until lg (1024) (line 96 'lg:flex') and shows the hamburger cluster until 1024 (line 165 'lg:hidden'). So from 900-1023px the desktop filter sidebar is visible while the header still shows only a hamburger — two different mental models of 'desktop vs mobile' on screen at once.
- **Expected:** A single, consistent breakpoint should govern when the UI is in 'desktop' vs 'mobile' mode across header and layout; there should be no width band where the desktop sidebar shows but the header is in hamburger mode.
- **Acceptance:** At viewport 960px, assert that EITHER the primary nav (<nav aria-label='Primary'>) is visible AND the hamburger button is hidden, OR vice versa — never the combination where the desktop sidebar (.desktop-only / [data-testid='news-sidebar']) is visible while the hamburger button is also visible.
- **Direction:** Unify the header lg breakpoint and the globals.css 900px breakpoint to one shared value (e.g. align both to 1024 via a custom media token).

#### header-topbar-03 — --header-h is 76px but the actual header is 60px, throwing off sticky offset and max-height of the desktop filter sidebar by 16px
- **Severity:** MEDIUM · _both_
- **Location:** `src/app/globals.css:37`, `src/components/site-header-chrome.tsx:76`, `src/components/news/news-sidebar.tsx:224`
- **Current:** globals.css sets --header-h: 76px (line 37) while the rendered header row is h-[60px] (site-header-chrome.tsx line 76). news-sidebar.tsx line 224 positions the sticky desktop sidebar at top-[var(--header-h)] and sizes it max-h-[calc(100dvh-var(--header-h)-1rem)]. Because the variable overstates the real header by 16px, the sticky sidebar starts 16px lower than the header's bottom edge (leaving a gap / mis-pinned scroll) and its max-height is 16px shorter than the true available space.
- **Expected:** --header-h must equal the real header height so the sticky sidebar pins flush under the header and its max-height exactly fills the remaining viewport.
- **Acceptance:** Assert getComputedStyle(document.documentElement).getPropertyValue('--header-h') trimmed equals the rendered <header> offsetHeight + 'px' (60px). At a desktop width, assert the sticky [data-testid='news-sidebar'] top equals the header's bottom (within 1px) when scrolled.
- **Direction:** Set --header-h: 60px (or derive it from the header) so it matches h-[60px].

### Mobile menu (11)

#### mobile-menu-01 — Mobile menu renders in-flow inside header (border-t panel), not as a fixed overlay — page content shows through below it with no backdrop
- **Severity:** HIGH · _responsive_
- **Location:** `src/components/site-header-chrome.tsx:185-251`
- **Current:** When menuOpen is true, the <nav aria-label="Mobile"> is appended as a normal flow child of the header's max-w-[1160px] container with className 'border-border border-t py-3 lg:hidden'. It has no position:fixed/absolute, no full-viewport overlay, and no backdrop element. The page body below remains fully visible and interactive; the menu visually blends into the article/list content beneath it. The sibling filters drawer (src/components/news/news-sidebar.tsx:230-232) instead uses 'fixed inset-0 z-[120] ... bg-black/55'.
- **Expected:** The open mobile menu should present as a distinct layer over the page: either a fixed full-screen/anchored overlay with a dimmed/blurred backdrop separating it from page content, matching the established drawer pattern, so the menu reads as a separate surface rather than blending with content beneath.
- **Acceptance:** With the viewport at 375px and the menu open, a Playwright test asserts the menu container's computed position is 'fixed' (or it is wrapped by a fixed full-viewport overlay element) AND that a backdrop element with a non-transparent background exists covering the viewport behind the menu; clicking page content directly below the menu does not activate that content while the menu is open.
- **Direction:** Reuse the news-sidebar drawer pattern: render the menu inside a fixed inset-0 overlay with a dimmed backdrop instead of an in-flow border-t panel.

#### mobile-menu-02 — No outside-click / backdrop-click handler to close the mobile menu
- **Severity:** HIGH · _responsive_
- **Location:** `src/components/site-header-chrome.tsx:31, 173-181, 185-251`
- **Current:** menuOpen is toggled only by the hamburger button (line 177) and cleared by per-link onClick handlers (e.g. lines 195-205, 214, 236, 244). There is no document mousedown listener and no backdrop element, so tapping anywhere outside the menu (on page content or empty header space) does not close it. This is inconsistent with catsOpen (lines 37-51, document mousedown + Escape), HeaderSearchField (src/components/header-search-field.tsx:28-41), and the filters drawer backdrop onClick (src/components/news/news-sidebar.tsx:233-235), all of which close on outside interaction.
- **Expected:** Tapping outside the open menu (on the backdrop or page content) should close it, matching every other dismissible surface in the app.
- **Acceptance:** With the menu open at 375px, a Playwright test taps a point outside the menu bounds (e.g. on the page body) and asserts the menu is no longer in the DOM / aria-expanded on the hamburger button becomes false.
- **Direction:** Add a backdrop element whose onClick closes the menu (or a document mousedown listener gated on menuOpen), mirroring catsOpen/news-sidebar.

#### mobile-menu-03 — No Escape-key handler to close the mobile menu
- **Severity:** MEDIUM · _a11y_
- **Location:** `src/components/site-header-chrome.tsx:37-51, 185-251`
- **Current:** There is no keydown/Escape listener tied to menuOpen. The catsOpen useEffect (lines 37-51) registers an Escape handler, the search field does too (src/components/header-search-field.tsx:32-34), and the filters drawer does (src/components/news/news-sidebar.tsx:211-218) — but the mobile menu has none, so a keyboard user cannot dismiss it with Escape.
- **Expected:** Pressing Escape while the mobile menu is open should close it and return focus to the hamburger toggle.
- **Acceptance:** With the menu open, a Playwright test dispatches a keydown Escape and asserts the menu is removed and aria-expanded on the toggle is false; additionally document.activeElement is the hamburger button.
- **Direction:** Add a menuOpen-gated useEffect registering a keydown listener that closes on e.key === 'Escape' (clone the catsOpen effect).

#### mobile-menu-04 — No body-scroll-lock while the mobile menu is open
- **Severity:** MEDIUM · _responsive_
- **Location:** `src/components/site-header-chrome.tsx:185-251`
- **Current:** Opening the menu does not set any overflow:hidden / position:fixed on document.body or html. A repo-wide search found no body-scroll-lock implementation anywhere in src. Because the menu is in-flow and the body scrolls freely, the page behind scrolls under/with the menu; on iOS Safari the menu (anchored to the sticky header) and the address-bar resize make this especially jittery, and scroll can bleed to the underlying list.
- **Expected:** While the menu is open, background page scrolling should be locked so only the menu surface is interactive/scrollable; unlocking on close restores prior scroll position.
- **Acceptance:** With the menu open at 375px, a Playwright test asserts document.body (or documentElement) has overflow:hidden (or position:fixed lock) computed; after closing, overflow returns to its prior value and window.scrollY is unchanged from before opening.
- **Direction:** On menuOpen, toggle document.body overflow:hidden in a useEffect with cleanup (consider iOS position:fixed + top offset to preserve scroll).

#### mobile-menu-05 — Two 'Subscribe' buttons visible simultaneously at 640px-1023px when the menu is open
- **Severity:** MEDIUM · _responsive_
- **Location:** `src/components/site-header-chrome.tsx:167-172, 241-248`
- **Current:** The top mobile cluster renders a Subscribe link hidden below sm but shown at >=640px via 'hidden ... sm:inline-flex' (lines 167-172). The open menu's footer renders a second Subscribe link unconditionally (lines 241-248). Between 640px and 1023px (sm visible, still lg:hidden) both are on screen at once when the menu is open, duplicating the primary CTA.
- **Expected:** Only one Subscribe CTA should be visible at any viewport while the menu is open; the duplicate should be suppressed.
- **Acceptance:** At viewport width 768px with the menu open, a Playwright test asserts exactly one visible element linking to /{lang}/subscribe within the header (count of visible subscribe links === 1).
- **Direction:** Hide the top-bar sm:inline-flex Subscribe while menuOpen, or drop the in-menu Subscribe at >=sm; pick one source of the CTA per breakpoint.

#### mobile-menu-06 — Menu does not close on route change / logo navigation — only specific link onClicks close it
- **Severity:** MEDIUM · _responsive_
- **Location:** `src/components/site-header-chrome.tsx:30-31, 77-86, 185-251`
- **Current:** Closing relies on per-link onClick={() => setMenuOpen(false)} calls. There is no useEffect keyed on pathname to close the menu on navigation. Navigations that bypass those handlers leave the menu open: the brand/logo Link (lines 77-86) has no close handler, and browser back/forward, programmatic navigation, or any future link added without the handler will not close it. pathname is already available (line 30) but unused for this.
- **Expected:** Any route change should auto-close the mobile menu, regardless of how navigation occurred.
- **Acceptance:** With the menu open at 375px, a Playwright test clicks the brand/logo link, waits for the URL to change to /{lang}, and asserts the menu is closed (not in DOM, aria-expanded false).
- **Direction:** Add a useEffect(() => setMenuOpen(false), [pathname]) so navigation always dismisses the menu.

#### mobile-menu-07 — Menu panel is not a dialog and has no aria-modal / focus trap / focus return
- **Severity:** MEDIUM · _a11y_
- **Location:** `src/components/site-header-chrome.tsx:173-181, 185-186`
- **Current:** The menu is a bare <nav aria-label="Mobile"> (line 186) with no role=dialog, no aria-modal=true, no aria-controls linking the toggle (lines 173-181) to the panel, and no focus management: focus is not moved into the panel on open, is not trapped within it, and is not returned to the hamburger on close. The filters drawer (src/components/news/news-sidebar.tsx:238-240) does set role=dialog and aria-modal=true. Because the menu is also in-flow (see mobile-menu-01), screen-reader and keyboard focus can wander into the still-present page content behind it.
- **Expected:** When acting as an overlay menu, it should expose a modal semantic, trap Tab focus within the open panel, move focus to the first focusable element (or the close control) on open, and restore focus to the toggle on close; the toggle should reference the panel via aria-controls.
- **Acceptance:** With the menu open at 375px, a Playwright test asserts the panel has role/aria-modal indicating a modal surface, that repeated Tab presses cycle only through elements inside the panel (focus never lands on background page content), and that on close document.activeElement is the hamburger toggle.
- **Direction:** Promote the overlay menu to role=dialog aria-modal=true with aria-controls on the toggle, and add focus trap + focus-return (reuse the drawer pattern).

#### mobile-menu-08 — Menu active across 900-1023px where desktop layout/sidebar is already showing — overlay band overlap
- **Severity:** MEDIUM · _both_
- **Location:** `src/components/site-header-chrome.tsx:165, 186`, `src/components/news/news-sidebar.tsx:222-228`
- **Current:** The mobile cluster and menu are gated by lg:hidden = <1024px (lines 165, 186), but globals.css custom media queries flip .desktop-only/.mobile-only and .news-layout to 2-col at 900px. So in the 900-1023px band the hamburger + mobile menu are still active while the desktop filter sidebar (news-sidebar.tsx:222-228 .desktop-only sticky aside) is simultaneously rendered. Opening the in-flow menu in this band pushes the page down and coexists with desktop chrome, producing the 'layout breaks when narrowed' overlap.
- **Expected:** The breakpoint at which the mobile menu activates should match the breakpoint at which the layout switches to its mobile form, so the mobile menu is never shown alongside desktop-only layout chrome.
- **Acceptance:** A Playwright test at 960px asserts that the hamburger toggle and the desktop filter sidebar (data-testid="news-sidebar") are not both visible at the same time (exactly one navigation paradigm is active).
- **Direction:** Unify the breakpoint: align the header's lg:hidden/lg:flex switch with the 900px custom media query (or move layout to Tailwind lg) so they flip together.

#### mobile-menu-09 — In-flow menu inherits the semi-transparent backdrop-blur header background, so page content shows through the open menu
- **Severity:** LOW · _crossbrowser_
- **Location:** `src/components/site-header-chrome.tsx:74, 185-186`
- **Current:** The <header> background is 'bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-[10px]' (line 74). The menu panel (line 186) sets no opaque background of its own, so it sits on the 88%-opacity translucent header surface. Page content scrolled behind the sticky header is visible through the menu. Where backdrop-filter is unsupported or disabled (older/locked-down WebKit, Firefox with backdrop-filter off), only the 88% color-mix tint remains and bleed-through worsens; color-mix() itself lacks support on Safari <16.2 / Firefox <113, degrading the tint further.
- **Expected:** The open menu surface should be fully opaque (or backed by an opaque overlay) so underlying page content never shows through, regardless of backdrop-filter or color-mix support.
- **Acceptance:** With the menu open at 375px, a visual/Playwright test samples pixels in the menu's empty gaps and asserts they match the opaque surface token color (no detectable content bleed-through); the menu container's background-color alpha is 1.
- **Direction:** Give the menu/overlay its own solid bg (var(--bg) at full opacity) rather than relying on the translucent header background.

#### mobile-menu-10 — Categories disclosure uses native <details>/<summary>; summary tap target and styling are inconsistent and below 44px
- **Severity:** LOW · _both_
- **Location:** `src/components/site-header-chrome.tsx:207-228`
- **Current:** The in-menu Categories group is a native <details> with <summary className="text-text py-2 text-base font-medium"> (lines 207-208). py-2 (~8px top/bottom) over a ~24px line gives roughly a 40px tap target, under the 44px guideline. Native summary also renders a default disclosure triangle whose appearance and position differ across Chrome/Firefox/Safari (and is styled away inconsistently here), unlike the custom catsOpen button used on desktop (lines 100-116) which has explicit aria-expanded and a rotating chevron. Mixing native disclosure here with a scripted dropdown on desktop yields divergent affordances and cross-browser marker rendering.
- **Expected:** The categories toggle should present a consistent, >=44px tap target with a cross-browser-consistent disclosure indicator.
- **Acceptance:** A Playwright test asserts the summary/toggle element's bounding box height is >= 44px at 375px, and a visual test confirms the disclosure indicator renders identically (no UA default marker leaking) across engines.
- **Direction:** Increase summary vertical padding to reach >=44px and normalize the marker (list-style:none / summary::-webkit-details-marker hidden) or replace <details> with the same button+chevron used on desktop.

#### mobile-menu-11 — Language toggle in the open menu is a small inline text link below the 44px tap target
- **Severity:** LOW · _responsive_
- **Location:** `src/components/site-header-chrome.tsx:229-240`
- **Current:** The footer language switch (lines 230-240) is a bare inline Link with class 'text-accent font-semibold no-underline' and no padding/min-size; its hit area is just the 'EN'/'UA' text glyphs (~20px tall, ~24px wide), well under 44px. Adjacent nav links use py-3 (line 270) and the Subscribe CTA uses px-4 py-2 (line 243), so this control is an outlier that is hard to tap.
- **Expected:** The language toggle should have a touch-friendly hit area (>=44x44px) consistent with the other interactive rows in the menu.
- **Acceptance:** A Playwright test asserts the language toggle link's bounding box is at least 44px in both dimensions at 375px viewport.
- **Direction:** Add padding/min-height (e.g. inline-flex with py-2 px-2 min-h-11) to the language toggle link in the menu footer.

### Filters drawer + desktop sidebar (10)

#### filters-drawer-01 — Desktop filter sidebar appears at 900-1023px while header is still in hamburger mode (breakpoint mismatch)
- **Severity:** HIGH · _responsive_
- **Location:** `src/app/globals.css:420-431`, `src/components/news/news-sidebar.tsx:222-228`, `src/components/site-header-chrome.tsx:96-182`
- **Viewports:** 900-1023px
- **Current:** globals.css flips .news-layout to 2 columns and .desktop-only to display:block / .mobile-only to display:none at min-width:900px. The header switches from the hamburger cluster (lg:hidden) to the full desktop nav (lg:flex) only at 1024px. So in the 900-1023px band the page shows the desktop sticky filter sidebar AND the full 2-column news layout, while the header is still showing the compact mobile hamburger + theme toggle (no nav, no search above md until 768). The desktop sidebar and the mobile 'Filters' drawer trigger swap at 900, decoupled from the header's 1024 swap.
- **Expected:** The filter layout breakpoint should be aligned with the header navigation breakpoint (1024px / lg) so the desktop sidebar only appears once the full desktop chrome is active, and the mobile 'Filters' drawer trigger remains available through the entire range the header is in hamburger mode.
- **Acceptance:** At viewport width 960px, [data-testid="news-sidebar"] (desktop aside) must NOT be visible while the header hamburger button (aria-label menu) IS visible; conversely the mobile 'Filters' trigger button must be visible. At 1024px the desktop aside becomes visible and the mobile trigger is hidden, in lockstep with the header nav appearing.
- **Direction:** Unify the layout media query and .desktop-only/.mobile-only flip to 1024px to match the header's lg breakpoint (or move the header to 900px), so sidebar visibility and header mode switch at the same width.

#### filters-drawer-04 — Open mobile filters drawer does not lock body scroll (background scrolls behind overlay)
- **Severity:** HIGH · _responsive_
- **Location:** `src/components/news/news-sidebar.tsx:211-218`, `src/components/news/news-sidebar.tsx:230-242`
- **Viewports:** <900px (mobile drawer)
- **Current:** The drawer adds only an Escape key handler (useEffect lines 211-218). There is no body-scroll-lock effect anywhere (grep for overflow-hidden/scroll-lock on body/document returns none). With the fixed inset-0 overlay open, scrolling/touch-dragging over the dim backdrop scrolls the underlying news feed, and on iOS the page rubber-bands behind the modal.
- **Expected:** While the drawer (role=dialog aria-modal=true) is open, the underlying page must not scroll; body scroll is locked and restored on close.
- **Acceptance:** Open the drawer at 390px, record window.scrollY, perform a wheel/touch scroll over the backdrop, then assert window.scrollY is unchanged; after closing, body overflow returns to its prior value and scrolling works again.
- **Direction:** Add a useEffect that sets document.body style overflow:hidden (and compensates for scrollbar width) while drawerOpen, cleaning up on close — mirror this for the header menu too.

#### filters-drawer-02 — Desktop sticky sidebar offset wrong: top-[var(--header-h)]=76px but real header is 60px
- **Severity:** MEDIUM · _responsive_
- **Location:** `src/components/news/news-sidebar.tsx:224`, `src/app/globals.css:37`, `src/components/site-header-chrome.tsx:74-76`
- **Viewports:** >=1024px
- **Current:** The desktop aside uses sticky top-[var(--header-h)] and max-h-[calc(100dvh-var(--header-h)-1rem)] with --header-h:76px (globals.css :root). The actual sticky header is h-[60px] (site-header-chrome.tsx line 76). The sticky sidebar therefore parks 16px below the bottom of the real header, leaving a 16px gap, and its max-height is computed 16px too short so the available scroll area is wrong.
- **Expected:** --header-h must equal the rendered header height (60px) so the sticky sidebar sits flush under the header and its max-height calc exactly fills the remaining viewport.
- **Acceptance:** At >=1024px when scrolled, the bounding top of [data-testid="news-sidebar"] equals the bounding bottom of the sticky header (delta <= 1px), and the aside's max-height equals window.innerHeight minus header height minus 16px.
- **Direction:** Set --header-h to 60px (or derive it from the header) so it matches h-[60px].

#### filters-drawer-05 — Mobile drawer scroll container missing overscroll containment (scroll chaining to body)
- **Severity:** MEDIUM · _both_
- **Location:** `src/components/news/news-sidebar.tsx:237-242`, `src/components/news/news-sidebar.tsx:224`
- **Viewports:** <900px (mobile drawer)
- **Browsers:** iOS Safari < 16 (no overscroll-behavior support)
- **Current:** The desktop aside uses overscroll-y-contain (line 224) but the mobile drawer panel (overflow-y-auto on line 241) does NOT. When the filter list is scrolled to its top/bottom inside the drawer, further touch scrolling chains to the underlying page (and combined with the missing scroll-lock from filters-drawer-04 the feed scrolls). overscroll-behavior is unsupported on iOS Safari < 16, so it cannot be the sole defense, but its absence here is an inconsistency vs the desktop aside.
- **Expected:** The drawer's scrollable panel should use overscroll-contain so reaching its scroll boundary does not chain-scroll the page (in addition to the body lock).
- **Acceptance:** The drawer panel element (role=dialog) has computed overscroll-behavior-y: contain, matching the desktop aside.
- **Direction:** Add overscroll-y-contain to the drawer panel; do not rely on it alone for iOS — pair with the body-scroll-lock from filters-drawer-04.

#### filters-drawer-06 — Mobile 'Filters' drawer trigger button hidden in 900-1023px band, leaving filters inaccessible if sidebar mis-shows
- **Severity:** MEDIUM · _responsive_
- **Location:** `src/components/news/news-feed.tsx:174-184`, `src/app/globals.css:428-430`
- **Viewports:** 900-1023px
- **Current:** The 'Filters' trigger button uses class mobile-only, which becomes display:none !important at >=900px (globals.css 428-430). It is the only entry point to the filters drawer. Because it flips off at 900px (tied to the same mismatched breakpoint as filters-drawer-01), the drawer cannot be opened from 900px upward even though within 900-1023px the page is in an awkward in-between state.
- **Expected:** Whenever the desktop sticky sidebar is not the active filter UI, the mobile 'Filters' trigger must be present; the trigger and the sidebar must be mutually exclusive across all widths with no gap or overlap.
- **Acceptance:** Across 320-1440px, exactly one of {desktop aside [data-testid=news-sidebar], mobile Filters trigger button} is visible at every width — never zero, never both.
- **Direction:** Tie the trigger's visibility breakpoint to the same unified breakpoint as the sidebar (filters-drawer-01) so they swap atomically.

#### filters-drawer-11 — Drawer focus not trapped / not moved into dialog; aria-modal dialog is keyboard-leaky
- **Severity:** MEDIUM · _a11y_
- **Location:** `src/components/news/news-sidebar.tsx:237-262`, `src/components/news/news-feed.tsx:174-184`
- **Viewports:** <900px (mobile drawer)
- **Current:** The drawer is role=dialog aria-modal=true but nothing moves focus into it on open, nothing traps Tab within it, and nothing returns focus to the trigger on close. Tabbing from the open drawer lands on the still-interactive background controls (the results-bar sort select and feed links remain in the tab order and are not inert/aria-hidden). Only Escape and backdrop-click close it.
- **Expected:** On open, focus moves to the dialog (e.g. the close button or first control); Tab/Shift+Tab cycle within the dialog; background is inert; on close focus returns to the Filters trigger.
- **Acceptance:** After opening the drawer, document.activeElement is inside the dialog; pressing Tab repeatedly never lands on an element outside the dialog; after closing, focus is on the Filters trigger button.
- **Direction:** Add a focus trap (move focus in on open, cycle within, restore on close) and mark background content inert/aria-hidden while open.

#### filters-drawer-03 — Mobile filters drawer is a narrow single-column right drawer, not the requested fullscreen compact multi-column layout
- **Severity:** REQUIRED (explicit user request) · _responsive_
- **Location:** `src/components/news/news-sidebar.tsx:230-264`, `src/components/news/news-sidebar.tsx:87-198`
- **Viewports:** <900px (mobile drawer)
- **Current:** The drawer panel is w-[min(340px,88vw)] anchored to the right (justify-end) and renders SidebarControls as a single tall vertical stack (FilterGroup sections each mb-6, sort/categories/date stacked). On a 360-414px phone this is a cramped ~300-340px column requiring long vertical scrolling through Sort, Categories, Date, Reset, Trending one under another.
- **Expected:** On mobile the drawer should open fullscreen (inset-0, full width/height) and lay the filter groups out compactly across the available width (e.g. a 2-column grid of filter groups, or category list in 2 columns) so most filters are visible without long scrolling.
- **Acceptance:** With the drawer open at 390px width, the dialog panel width equals viewport width (>= 95vw) and height equals viewport height; and the filter groups are arranged in more than one column (e.g. the categories list or the group container has computed grid-template-columns with 2+ tracks).
- **Direction:** Make the panel inset-0 full-screen on mobile and give SidebarControls (or a drawer-specific variant) a responsive multi-column grid for the filter groups.

#### filters-drawer-07 — Duplicate sort control: top-bar <select> and drawer radio group can desync visually / redundant on mobile
- **Severity:** LOW · _responsive_
- **Location:** `src/components/news/news-feed.tsx:159-173`, `src/components/news/news-sidebar.tsx:89-107`
- **Viewports:** <900px
- **Current:** On mobile the results bar always shows a sort <select> (lines 163-173, no responsive hiding) AND the filters drawer renders a full Sort radio group (SidebarControls lines 89-107). Both bind to filters.sort, so the mobile user gets two separate Sort UIs (one in the bar, one in the drawer). This is redundant and, in a compact fullscreen drawer redesign, wastes space.
- **Expected:** Sort should be presented once per context — either keep the compact top-bar select and drop Sort from the mobile drawer, or vice versa — to avoid duplicated controls.
- **Acceptance:** On a 390px viewport with the drawer open, there is exactly one visible control that sets the sort mode (count of visible sort inputs/selects bound to sort === 1).
- **Direction:** Render the Sort group in the drawer only when the top-bar select is hidden, or hide the top-bar select on mobile.

#### filters-drawer-09 — Sidebar height uses 100dvh which is unsupported on iOS Safari < 15.4 (sticky aside max-height invalid)
- **Severity:** LOW · _crossbrowser_
- **Location:** `src/components/news/news-sidebar.tsx:224`
- **Viewports:** >=1024px
- **Browsers:** iOS Safari < 15.4, older Chrome/Firefox
- **Current:** The desktop aside max-height is calc(100dvh - var(--header-h) - 1rem). dvh units are unsupported on iOS Safari < 15.4 and older Chrome/Firefox; in those engines the entire calc() is invalid and the max-height declaration is dropped, so the sticky sidebar has no height cap and a long filter list (categories + trending) overflows past the viewport with no internal scroll, breaking the sticky behavior.
- **Expected:** The sidebar should have a valid max-height fallback (e.g. 100vh) for engines without dvh so it always caps and scrolls internally.
- **Acceptance:** In a WebKit build without dvh support (or simulated), the aside still has a numeric computed max-height (> 0, <= viewport height) and overflow-y scrolls internally rather than the whole list extending below the fold.
- **Direction:** Provide a vh fallback before the dvh value (e.g. max-h with 100vh then override with 100dvh under @supports), or use a JS-set height.

#### filters-drawer-10 — Custom scrollbar styling is WebKit/Firefox-only; sidebar scrollbar inconsistent across browsers
- **Severity:** LOW · _crossbrowser_
- **Location:** `src/app/globals.css:380-393`
- **Browsers:** Firefox vs Chrome/Safari differ
- **Current:** .sidebar-scroll uses both scrollbar-width:thin / scrollbar-color (Firefox) and ::-webkit-scrollbar rules (Chrome/Safari). These are complementary, but the mobile drawer panel (news-sidebar.tsx line 241) uses overflow-y-auto WITHOUT the .sidebar-scroll class, so the drawer's scrollbar is the default chrome — inconsistent with the desktop aside, and on desktop WebKit the 6px thin styling appears while Firefox gets 'thin' native, two visibly different treatments for what should be the same component.
- **Expected:** The drawer and the desktop sidebar should present a consistent scrollbar treatment; styling should degrade gracefully where unsupported.
- **Acceptance:** The mobile drawer scroll panel carries the same scrollbar styling class as the desktop aside (both have class sidebar-scroll), and a visual test of the scrollbar region matches between the two.
- **Direction:** Apply .sidebar-scroll to the drawer panel as well; accept native scrollbar as the graceful fallback elsewhere.

### Cross-browser feature fallbacks (9)

#### crossbrowser-features-03 — Desktop sidebar max-h uses 100dvh combined with a WRONG --header-h (76px var vs 60px real header) — sticky offset/height diverges, worst on iOS Safari dynamic toolbar
- **Severity:** HIGH · _both_
- **Location:** `D:/domains/ai-today-brief/src/components/news/news-sidebar.tsx:224`, `D:/domains/ai-today-brief/src/app/globals.css:37`, `D:/domains/ai-today-brief/src/components/site-header-chrome.tsx:76`
- **Current:** The sticky aside is `top-[var(--header-h)] max-h-[calc(100dvh-var(--header-h)-1rem)]`. `--header-h` is 76px (globals.css :root) but the actual rendered header is `h-[60px]` (site-header-chrome.tsx). So the sticky top is pushed 16px too far down AND 16px too much is subtracted from the max-height. `100dvh` itself is fine on the 2026 baseline (Chrome/FF/Safari all support dvh) but on iOS Safari the dynamic viewport unit resolves against the shrinking/growing toolbar, while the subtracted header constant is a fixed wrong 76px — so on iOS the sidebar's usable height and sticky gap are off by a different amount than on desktop Chrome, making the bottom of a long filter list clipped or a dead gap appear at the top inconsistently across engines.
- **Expected:** --header-h must equal the real header height (60px) so the sticky top and the dvh-based max-height calc line up; the sidebar should sit flush under the header and use the full remaining viewport height on every engine.
- **Acceptance:** --header-h resolves to 60px (matching the h-[60px] header); the sticky aside's top equals the header's bottom (gap == 0px within 1px) and its max-height == viewport height minus header minus 1rem, verified equal (within tolerance) in both Chromium and WebKit at the same viewport.
- **Direction:** Set --header-h to 60px (or derive it from the header), so the dvh calc and top offset use the true header height.

#### crossbrowser-features-05 — Mobile filter drawer & header mobile menu lack body-scroll-lock and overscroll-contain — iOS Safari/Chrome scroll-chain the page body behind the open overlay
- **Severity:** HIGH · _both_
- **Location:** `D:/domains/ai-today-brief/src/components/news/news-sidebar.tsx:230-262`, `D:/domains/ai-today-brief/src/components/site-header-chrome.tsx:173-178`
- **Current:** The desktop sidebar correctly uses `overscroll-y-contain` (news-sidebar.tsx:224), but the MOBILE drawer panel (line 241, `overflow-y-auto` only) and its backdrop (line 232) have neither overscroll-contain nor any body-scroll-lock. No code anywhere sets body/documentElement overflow when the drawer or the header mobile menu opens (grep for body.style/overflow-hidden in news/* returns nothing). On iOS Safari and Android Chrome, scrolling past the end of the drawer (or touching the dimmed backdrop) scrolls the underlying page — scroll chaining — and on iOS the elastic rubber-band reveals page content behind the overlay. The header mobile menu is even worse: per the seed report it renders in-flow with no overlay at all, so there is nothing to contain.
- **Expected:** While the mobile filter drawer or header mobile menu is open, the underlying page must not scroll; over-scrolling within the panel must not chain to the body on any engine.
- **Acceptance:** With the drawer (and separately the header menu) open, programmatically scrolling the window does not change window.scrollY; the panel itself scrolls internally; verified in both Chromium and WebKit. overscroll-behavior:contain is present on the scrollable panel.
- **Direction:** Lock body scroll (e.g. position:fixed or overflow:hidden on <body>) while the overlay is open and add overscroll-behavior:contain to the scrollable drawer panel.

#### crossbrowser-features-01 — Sticky header uses backdrop-blur + color-mix translucent bg with NO opaque fallback — header turns see-through where either feature degrades, nav overlaps scrolled content
- **Severity:** MEDIUM · _crossbrowser_
- **Location:** `D:/domains/ai-today-brief/src/components/site-header-chrome.tsx:74`
- **Current:** The only header background is `bg-[color-mix(in_srgb,var(--bg)_88%,transparent)]` paired with `backdrop-blur-[10px]`. The intended legibility depends on the blur compositing the content behind it. There is no solid-color fallback declared before the translucent one. If backdrop-filter is unavailable or disabled (older/!flagged Firefox, Safari low-power / Reduce Transparency accessibility setting, GPU-blocked contexts) the header is just an 88%-opacity tint with no blur; if color-mix itself is unsupported (engines older than the 2023 baseline) the whole background declaration is dropped and the header becomes fully transparent. Because the header is `sticky` and content scrolls under it, nav links/search collide visually with page text underneath.
- **Expected:** Header should remain legible with an opaque or near-opaque solid fallback when backdrop-filter and/or color-mix are unavailable, with the blur as a progressive enhancement (e.g. a plain solid var(--bg) declared first, then the color-mix/backdrop-filter as enhancement, ideally guarded by @supports).
- **Acceptance:** With backdrop-filter disabled (emulate via DevTools or a @supports-not path) and/or color-mix unsupported, the computed header background-color has alpha >= ~0.95 (effectively opaque) so text scrolled beneath it is not visible through the header. A visual test asserts no page body text bleeds through the header band while scrolled.
- **Direction:** Declare a solid var(--bg) background first as fallback, then layer color-mix + backdrop-filter behind @supports (backdrop-filter) / @supports (background: color-mix(...)).

#### crossbrowser-features-02 — input[type=search] has no appearance reset — iOS Safari/WebKit add native rounded styling + a clear (x) button absent in Chrome/Firefox
- **Severity:** MEDIUM · _crossbrowser_
- **Location:** `D:/domains/ai-today-brief/src/components/header-search-field.tsx:66-78`, `D:/domains/ai-today-brief/src/components/home/hero-search.tsx:73-86`
- **Current:** Both search inputs use `type="search"` with custom border-radius / padding classes but never reset `-webkit-appearance`/`appearance`. On iOS Safari and desktop Safari, type=search controls get a native inner appearance and a native clear (x) button (::-webkit-search-cancel-button) once text is entered. The app already provides its own clear-after-submit logic and a magnifier icon, so on Safari users see a SECOND native clear affordance and the native control box can override the intended rounded-pill/rounded-lg geometry and intrinsic width. Chrome shows the cancel button too but Firefox shows none — so the control is visually inconsistent across all three engines.
- **Expected:** The search inputs should look identical across Chrome/Firefox/Safari: one consistent rounded control, no surprise native clear button, padding/width controlled by the app.
- **Acceptance:** In WebKit (Safari/iOS), with a non-empty value, no native ::-webkit-search-cancel-button is rendered (or it is intentionally styled), and the input's computed border-radius/padding match the design tokens (rounded-pill on hero, rounded-lg in header). A cross-browser screenshot diff of the focused, filled search box shows no engine-specific clear icon.
- **Direction:** Add `appearance: none; -webkit-appearance: none;` to the search inputs and explicitly hide/style `::-webkit-search-cancel-button` and `::-webkit-search-decoration`.

#### crossbrowser-features-04 — Native checkbox/radio rely solely on accent-color (+ inline per-category accentColor) with no custom-control fallback — brand color and visibility lost where accent-color is dropped
- **Severity:** MEDIUM · _crossbrowser_
- **Location:** `D:/domains/ai-today-brief/src/components/news/news-sidebar.tsx:94-124`, `D:/domains/ai-today-brief/src/app/globals.css:103-110`
- **Current:** Filter radios/checkboxes are native inputs styled only via Tailwind `accent-accent` and, for category checkboxes, an inline `style={{ accentColor: color }}`. accent-color is supported on the 2026 baseline (Safari 15.4+, Firefox 92+, Chrome 93+) but degrades to the OS default control color on any engine/version below that floor, and a per-platform native control look (size, checkmark style, focus ring) still differs substantially between iOS Safari, macOS Safari, Firefox and Chrome even when supported. The `size-4` (16px) native control is also at the low end of comfortable hit targets on touch. There is no appearance:none custom control, so the brand/category coloring is purely best-effort and the control rendering is not consistent cross-browser.
- **Expected:** Checked-state coloring should reflect the accent / per-category color consistently, and the control should be a comfortable touch target and visually consistent across the supported engines.
- **Acceptance:** For a checked category checkbox, the rendered check indicator color matches the category color (within tolerance) in Chromium AND WebKit; the interactive control box is >= 16px and the checked/unchecked states are visually distinguishable in a screenshot diff across engines. (If a fallback is added, assert custom control renders when appearance:none is honored.)
- **Direction:** Keep accent-color as the happy path but add an @supports-not(accent-color) custom appearance:none fallback (and bump touch size), or render fully custom controls.

#### crossbrowser-features-06 — color-mix used with raw author color strings (inline style) and untested second-color var — silent drop on unsupported engines, no fallback color
- **Severity:** MEDIUM · _crossbrowser_
- **Location:** `D:/domains/ai-today-brief/src/components/facts-visual.tsx:23,44`, `D:/domains/ai-today-brief/src/components/story-body.tsx:69`, `D:/domains/ai-today-brief/src/app/globals.css:268-396`
- **Current:** color-mix(in srgb, …) drives bar fills, stat-number colors, story-body left borders and the entire category-chip color system (~40 declarations in globals.css plus inline styles built from runtime `color` strings). color-mix(in srgb) is on the 2026 baseline (Chrome 111+, Firefox 113+, Safari 16.2+), but every usage is a single declaration with NO preceding fallback. On any engine below the floor the property is invalid and dropped: facts-visual bars/numbers fall back to no/inherited color (low-contrast or invisible against surface), story-body left border disappears, and category chips lose their tint entirely — degrading silently rather than gracefully. Inline `color-mix(in srgb, ${color} 75%, var(--text))` also depends on `color` being a syntactically valid <color>; a malformed CMS color makes the whole declaration invalid with no fallback.
- **Expected:** Each color-mix usage should have a plain solid-color fallback declared first so that, on engines without color-mix (or with a bad input color), the element still has a sensible visible color.
- **Acceptance:** With color-mix forced unsupported (e.g. test against a build path or @supports-not), facts-visual bars, stat numbers, story-body borders and category chips all retain a visible color with adequate contrast (>= 3:1 for the bar/border, >= 4.5:1 for text). No element collapses to transparent/inherited.
- **Direction:** Declare a static fallback color (e.g. var(--accent) or the raw category color) before each color-mix declaration, and guard inline usages with a validated color.

#### crossbrowser-features-07 — Custom scrollbar styled only via WebKit pseudo-elements + Firefox scrollbar-width — Chrome/Safari and Firefox diverge, no shared thin-scrollbar baseline
- **Severity:** LOW · _crossbrowser_
- **Location:** `D:/domains/ai-today-brief/src/app/globals.css:380-393`
- **Current:** .sidebar-scroll sets BOTH the standard `scrollbar-width:thin; scrollbar-color:...` (Firefox 64+, Chrome 121+) and the legacy `::-webkit-scrollbar*` pseudo-elements (WebKit/Chromium). On Chrome 121+ both rule sets apply and the standard properties win for width while webkit colors may still partially apply, giving slightly different metrics than Safari (which honors only the webkit pseudo-elements) and Firefox (which honors only the standard ones, and ignores the 6px width — only thin/auto). Net: scrollbar thickness/appearance differs across the three engines. This is cosmetic and degrades gracefully (a default scrollbar everywhere), hence low.
- **Expected:** A thin, brand-colored scrollbar should appear consistently, or at minimum degrade to the platform default without layout shift, on all three engines.
- **Acceptance:** The .sidebar-scroll scrollbar renders as a thin track in Chromium, WebKit and Firefox without causing horizontal layout shift; a screenshot diff shows no overflow/clipping difference attributable to scrollbar width across engines.
- **Direction:** Accept the dual approach but verify widths are visually close, or standardize on scrollbar-width/scrollbar-color now that Chromium supports them, keeping webkit rules only as a Safari fallback.

#### crossbrowser-features-08 — :has() and :where() used in base layer — :has() below 2022/2023 engine floors silently disables checkbox/radio cursor rule (graceful), but worth a documented floor
- **Severity:** LOW · _crossbrowser_
- **Location:** `D:/domains/ai-today-brief/src/app/globals.css:99-110`
- **Current:** globals.css uses `:where(label:has(input[type=checkbox]), label:has(input[type=radio]), …)` to set cursor:pointer, and `:where(...)` for the focus-visible/cursor base rules. :has() floor is Chrome 105 / Safari 15.4 / Firefox 121 — on the 2026 baseline this is fine, but Firefox only shipped :has() unflagged at v121, so any FF below that drops the entire grouped selector (because an unsupported :has() inside the list invalidates that compound), removing the pointer cursor on label-wrapped checkboxes/radios. Because the inputs themselves are also listed and these are cursor-only/affordance rules, the degradation is cosmetic. :where() has zero specificity and is broadly supported; the risk is purely the :has() inside it.
- **Expected:** Checkbox/radio label hover cursor should be pointer; absence on very old Firefox is acceptable as long as it degrades to the default cursor with no functional loss.
- **Acceptance:** On engines supporting :has() (2026 baseline) hovering a filter label shows cursor:pointer; on a forced no-:has() path the controls remain clickable with only the cursor differing (no layout/interaction breakage).
- **Direction:** Document the :has() floor; optionally split the input-only cursor rule out of the :has() group so the affordance survives where :has() is unsupported.

#### crossbrowser-features-10 — 100dvh used for desktop max-height while no svh/lvh anywhere — iOS Safari dynamic toolbar makes dvh the right unit, but the single dvh site is the mis-offset sidebar; verify mobile drawer height too
- **Severity:** LOW · _crossbrowser_
- **Location:** `D:/domains/ai-today-brief/src/components/news/news-sidebar.tsx:224,241`
- **Current:** `100dvh` appears exactly once (desktop sidebar max-h calc). dvh is supported on the 2026 baseline (Safari 15.4+, Chrome 108+, FF 101+). The mobile filter drawer panel instead uses `h-full` inside a `fixed inset-0` parent (line 232/241) — `fixed inset-0` resolves to the layout viewport, which on iOS Safari does NOT account for the dynamic toolbar, so the drawer's bottom (and its Apply button at line 255) can sit under the Safari toolbar / be partially obscured, unlike on desktop where inset-0 == full height. There is no svh/lvh/dvh applied to the mobile overlay to correct this.
- **Expected:** The mobile drawer should fill the visible viewport on iOS Safari with its Apply button reachable above the browser toolbar; the desktop dvh calc should use the corrected header height (see finding 03).
- **Acceptance:** On iOS Safari (or emulated dynamic-toolbar viewport), the open filter drawer's Apply button is fully visible and tappable above the browser chrome; the panel height equals the visible viewport (within tolerance). On desktop the dvh calc bounds the sidebar to the viewport.
- **Direction:** Use dvh (or 100% of a dvh-sized fixed container) for the mobile drawer height so the Apply button clears the iOS toolbar; reuse the corrected --header-h for the desktop calc.

### Test coverage (Hermes implements these) (13)

#### test-infra-01 — Playwright runs a single project (chromium) — no Firefox/WebKit cross-browser coverage
- **Severity:** MEDIUM · _crossbrowser_
- **Location:** `D:/domains/ai-today-brief/playwright.config.ts:21-26`, `D:/domains/ai-today-brief/package.json:27`, `D:/domains/ai-today-brief/.github/workflows/e2e.yml:32`
- **Viewports:** all
- **Browsers:** Firefox, Safari/WebKit (incl. iOS Safari engine)
- **Current:** projects[] contains only { name: 'chromium', use: devices['Desktop Chrome'] }. e2e:install and the CI workflow install only chromium. The codebase relies on color-mix(in srgb), backdrop-blur, 100dvh, :has(), overscroll-y-contain, scroll-behavior:smooth and ::-webkit-scrollbar/scrollbar-width — features with materially different support in Firefox and Safari/WebKit — yet none of these engines are ever run.
- **Expected:** The project matrix includes chromium, firefox and webkit (Desktop Chrome, Desktop Firefox, Desktop Safari devices) so engine-specific regressions in the listed CSS features surface in CI.
- **Acceptance:** playwright.config.ts exposes projects named 'chromium', 'firefox' and 'webkit'; running `npx playwright test --list` reports each existing spec scheduled under all three engines (test count == specs * 3 for the desktop tier). CI installs all three (`npx playwright install --with-deps`).
- **Direction:** Add firefox/webkit projects using devices['Desktop Firefox'] and devices['Desktop Safari']; change e2e:install and e2e.yml to `playwright install --with-deps` (no engine arg).

#### test-infra-02 — Only one viewport (1280x720) is ever tested — no responsive matrix
- **Severity:** MEDIUM · _responsive_
- **Location:** `D:/domains/ai-today-brief/playwright.config.ts:15-26`, `D:/domains/ai-today-brief/e2e/helpers/news-page.ts:4-9`
- **Viewports:** 320-1440+ (untested except 1280)
- **Browsers:** all
- **Current:** use.viewport is fixed at {width:1280,height:720} and every spec calls page.setViewportSize(NEWS_DESKTOP_VIEWPORT) where the constant is 1280x720. No phone (320/375/390), no tablet (768/834), no large desktop (1440) is exercised. The app's layout switches at custom 640px/900px media queries (globals.css:414-431) and the header switches at Tailwind 768px/1024px — none of these boundaries are crossed by any test.
- **Expected:** A viewport matrix covering at least 375 (phone), 390 (phone), 768 (tablet/header boundary), 834 (tablet), 900 (layout boundary), 1024 (header boundary), 1280 and 1440 is available so flows can be asserted at and around every breakpoint.
- **Acceptance:** playwright.config.ts (or a shared fixtures module) defines named device/viewport projects covering >=320,375,390,768,834,900,1024,1280,1440; `npx playwright test --list` shows responsive specs scheduled across the phone/tablet/desktop tiers, and at least one spec asserts behavior at 375, 768 and 1440.
- **Direction:** Define viewport-named projects (e.g. mobile-375, tablet-768, desktop-1440) and/or a parametrized fixture; replace the single NEWS_DESKTOP_VIEWPORT constant with a tiered map.

#### test-infra-03 — No test asserts the desktop sidebar/header breakpoint mismatch in the 900-1024px band
- **Severity:** MEDIUM · _responsive_
- **Location:** `D:/domains/ai-today-brief/src/app/globals.css:420-431`, `D:/domains/ai-today-brief/src/components/site-header-chrome.tsx:96-182`, `D:/domains/ai-today-brief/e2e/news-sidebar.spec.ts:4-8`
- **Viewports:** 900-1023px
- **Browsers:** all
- **Current:** globals.css flips .desktop-only sidebar to display:block at min-width:900px, but the header keeps the hamburger cluster (lg:hidden) and hides the desktop nav (lg:flex) until 1024px. So between 900-1023px the desktop filter sidebar is shown WHILE the header is in mobile/hamburger mode — a known inconsistency with no test. The existing sidebar spec only runs at 1280.
- **Expected:** A test pins the contract at this band: either both header desktop-nav and sidebar appear together, or neither — the band must not show a desktop sidebar with a hamburger header.
- **Acceptance:** Add a spec at viewport 960x800 asserting that the desktop sidebar (getByTestId('news-sidebar')) and the desktop nav (nav[aria-label="Primary"]) have the SAME visibility — i.e. expect(sidebarVisible).toBe(primaryNavVisible) — so the 'desktop sidebar + hamburger header' state fails.
- **Direction:** After breakpoints are unified to one value, assert sidebar-visible iff Primary-nav-visible at 768/834/900/960/1023/1024.

#### test-infra-04 — No test detects header search box colliding/overlapping nav at narrowed desktop widths
- **Severity:** MEDIUM · _responsive_
- **Location:** `D:/domains/ai-today-brief/src/components/site-header-chrome.tsx:88-94, 96-163`
- **Viewports:** 1024-1160px
- **Browsers:** all
- **Current:** The search wrapper (flex-1, md:flex from 768) and the desktop nav (lg:flex from 1024) coexist between 1024 and ~1100px where horizontal space is tight; reported bug #1 is the search box overlapping nav items. No spec measures geometry between search and nav, so the collision is invisible to CI.
- **Expected:** At every desktop width where both the search field and Primary nav are visible, their bounding boxes must not overlap horizontally.
- **Acceptance:** Add a spec parameterized over [1024,1100,1160,1280,1440] that, when both role=search input and nav[aria-label="Primary"] are visible, asserts searchBox.x + searchBox.width <= navBox.x (no horizontal overlap) and that the search input's clientWidth > 0 (not collapsed).
- **Direction:** Assert non-overlap of the search field box and the Primary nav box across the desktop width range.

#### test-infra-06 — No test asserts the mobile menu is an overlay (it currently renders in-flow with no backdrop)
- **Severity:** MEDIUM · _responsive_
- **Location:** `D:/domains/ai-today-brief/src/components/site-header-chrome.tsx:185-251`
- **Viewports:** <1024px
- **Browsers:** all
- **Current:** The menuOpen block is a nav rendered with border-t inside the header div, in normal flow (no fixed/absolute, no backdrop, no blur). Reported bug #3: page content shows below it and visually blends. No spec asserts overlay semantics, so the in-flow rendering passes silently.
- **Expected:** When the mobile menu is open it overlays page content (fixed/absolute positioning, a dimmed/blurred backdrop) rather than pushing/coexisting with the feed in flow.
- **Acceptance:** Add a spec at viewport 390x844 that opens the menu (click button[aria-label] hamburger) and asserts the opened nav[aria-label="Mobile"] has computed position in {fixed, absolute} AND that a backdrop element behind it exists; additionally assert the first post-card center point hit-tests to the menu/backdrop, not the post-card, while the menu is open.
- **Direction:** Assert position:fixed/absolute on the open menu and presence of an intercepting backdrop via elementFromPoint over feed content.

#### test-infra-07 — No test catches the duplicate Subscribe buttons when the mobile menu is open at >=640px
- **Severity:** MEDIUM · _responsive_
- **Location:** `D:/domains/ai-today-brief/src/components/site-header-chrome.tsx:167-172, 241-248`
- **Viewports:** 640-1023px
- **Browsers:** all
- **Current:** The top-bar Subscribe (line 167) is hidden below sm but shown sm:inline-flex (>=640px); the in-menu Subscribe (line 241) is always rendered when menuOpen. Reported bug #4: at >=640px with the menu open there are TWO visible Subscribe controls. No spec counts visible Subscribe links.
- **Expected:** At any single viewport with the mobile menu open there is exactly one visible Subscribe call-to-action.
- **Acceptance:** Add a spec at viewport 768x1024 (and 640x900) that opens the mobile menu and asserts page.getByRole('link', { name: <subscribe label> }).filter visible count === 1 (currently 2).
- **Direction:** Assert exactly one visible Subscribe link with the menu open at 640 and 768.

#### test-infra-08 — No test asserts outside-click / Escape closes the mobile menu, nor body-scroll-lock
- **Severity:** MEDIUM · _responsive_
- **Location:** `D:/domains/ai-today-brief/src/components/site-header-chrome.tsx:31, 173-182, 185-251`
- **Viewports:** <1024px
- **Browsers:** all
- **Current:** menuOpen has no Escape handler and no outside-click handler (unlike catsOpen at :37-51, the search field at header-search-field.tsx:28-41, and the filters drawer at news-sidebar.tsx:211-218) and no body-scroll-lock. Reported bug #5. No spec exercises closing the menu by any means other than the toggle, and none checks scroll lock.
- **Expected:** Pressing Escape, or clicking/tapping outside the open menu, closes it; while open, the body does not scroll.
- **Acceptance:** Add specs at 390x844: (a) open menu, press Escape -> nav[aria-label="Mobile"] not visible; (b) open menu, click at a point outside the menu -> menu not visible; (c) open menu, attempt window.scrollTo / wheel -> document.body scrollTop stays 0 (or body has overflow:hidden). All three currently fail.
- **Direction:** Three assertions: Escape closes, outside-click closes, body is scroll-locked while open.

#### test-infra-09 — No test asserts the mobile FILTERS drawer is fullscreen with a compact multi-column layout
- **Severity:** MEDIUM · _responsive_
- **Location:** `D:/domains/ai-today-brief/src/components/news/news-sidebar.tsx:230-264`, `D:/domains/ai-today-brief/e2e/news-sidebar.spec.ts:4-8, 79-86`
- **Viewports:** <900px
- **Browsers:** all
- **Current:** The drawer is a narrow right panel w-[min(340px,88vw)] (line 241), one tall single-column stack. Reported bug #6 wants it fullscreen with filter groups laid out compactly across the width (multi-column). The only drawer-related spec (news-sidebar.spec.ts) runs against the DESKTOP sidebar at 1280 and never opens the mobile drawer at all.
- **Expected:** On phone/tablet the opened filters drawer fills (or nearly fills) the viewport width and arranges its filter groups in more than one column rather than a single narrow stack.
- **Acceptance:** Add a spec at 390x844 (and 768x1024) that clicks the mobile-only Filters button (news-feed.tsx:174) to open role=dialog[aria-modal], then asserts the dialog boundingBox().width >= ~0.95*viewportWidth AND that its filter sections (the FilterGroup <section> elements) occupy >=2 distinct x-columns (e.g. at least two sections share a row: differing x, overlapping y).
- **Direction:** Assert near-full-width dialog plus >=2 column layout of the FilterGroup sections at phone and tablet widths.

#### test-infra-10 — Mobile/tablet smoke is missing — no spec verifies the hamburger menu path or mobile search render
- **Severity:** MEDIUM · _responsive_
- **Location:** `D:/domains/ai-today-brief/e2e/smoke.spec.ts:5-27`, `D:/domains/ai-today-brief/src/components/site-header-chrome.tsx:165-193`
- **Viewports:** <768px
- **Browsers:** all
- **Current:** smoke.spec.ts only checks the desktop Primary nav at 1280. There is no smoke test that, on a phone viewport, the desktop nav is hidden, the hamburger button is visible, opening it reveals the Mobile nav with the in-menu search field (md:hidden block at site-header-chrome.tsx:187-193), and the navigation links are reachable.
- **Expected:** A mobile smoke flow confirms the header collapses to the hamburger, the menu opens, mobile search renders, and the same nav destinations (Home/News/About) are reachable as on desktop.
- **Acceptance:** Add a spec at 375x812 asserting nav[aria-label="Primary"] is hidden, the hamburger button is visible, clicking it shows nav[aria-label="Mobile"] containing a role=search input and links for Home/News/About; clicking News navigates to /uk/news.
- **Direction:** Mirror the desktop smoke nav assertions on a phone viewport via the hamburger path.

#### test-infra-12 — No cross-browser graceful-degradation assertions for color-mix/backdrop-blur/100dvh/:has()
- **Severity:** MEDIUM · _crossbrowser_
- **Location:** `D:/domains/ai-today-brief/src/components/site-header-chrome.tsx:74`, `D:/domains/ai-today-brief/src/components/news/news-sidebar.tsx:224`, `D:/domains/ai-today-brief/src/app/globals.css:104-105, 381-391`
- **Viewports:** all
- **Browsers:** Firefox, Safari/WebKit
- **Current:** The sticky header background uses color-mix(in srgb, var(--bg) 88%, transparent) + backdrop-blur (site-header-chrome.tsx:74); the sidebar uses max-h calc(100dvh - ...) (news-sidebar.tsx:224); globals.css uses label:has(...) (104-105) and ::-webkit-scrollbar (381-391). Once firefox/webkit projects exist (test-infra-01), these need explicit assertions that the header stays opaque/legible and the sidebar height is finite even where a feature degrades.
- **Expected:** On every engine in the matrix, the sticky header remains a legible (non-transparent) bar and the sidebar's resolved max-height is a finite positive pixel value (not 'none'), regardless of color-mix/backdrop/dvh support.
- **Acceptance:** Add a cross-browser spec (runs under all projects) asserting: getComputedStyle(header).backgroundColor has alpha > 0 (header not see-through), and parseFloat(getComputedStyle(sidebar).maxHeight) is finite and > 0; run and confirm pass on chromium, firefox and webkit projects.
- **Direction:** Assert opaque header background-color and finite sidebar max-height under all three engine projects.

#### test-infra-13 — --header-h (76px) vs actual header height (60px) offset is not asserted anywhere
- **Severity:** MEDIUM · _responsive_
- **Location:** `D:/domains/ai-today-brief/src/app/globals.css:37`, `D:/domains/ai-today-brief/src/components/site-header-chrome.tsx:76`, `D:/domains/ai-today-brief/src/components/news/news-sidebar.tsx:224`
- **Viewports:** >=900px
- **Browsers:** all
- **Current:** --header-h is 76px (globals.css:37) but the header row is h-[60px] (site-header-chrome.tsx:76). The sticky sidebar uses top-[var(--header-h)] and max-h calc with it (news-sidebar.tsx:224), so the sidebar's sticky offset is ~16px off from the real header bottom. No test ties --header-h to the rendered header height.
- **Expected:** The CSS variable --header-h equals the header's actual rendered height so the sticky sidebar's top offset aligns with the header bottom.
- **Acceptance:** Add a spec asserting that parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) equals the header element's boundingBox().height within +/-1px (currently 76 vs 60, fails), at desktop viewport 1280.
- **Direction:** Assert --header-h == measured header height; this both encodes and guards the fix.

#### test-infra-05 — No test asserts header nav items stay on one row without wrapping/colliding
- **Severity:** LOW · _responsive_
- **Location:** `D:/domains/ai-today-brief/src/components/site-header-chrome.tsx:96-163`
- **Viewports:** 1024-1160px
- **Browsers:** all
- **Current:** Reported bug #2 is nav menu items breaking/colliding. The header row is h-[60px] with no wrap guard; nav links + divider + Subscribe + lang + theme can wrap or overflow at tight desktop widths. No spec checks that nav children share a single row or fit within the header height.
- **Expected:** All Primary nav children render on a single horizontal line within the 60px header band, with no item overflowing the header's right edge.
- **Acceptance:** Add a spec at [1024,1100,1280] asserting every direct child link/button of nav[aria-label="Primary"] has the same boundingBox().y (single row, tolerance <=2px) and that each child's right edge <= header container right edge (no horizontal overflow / clipping).
- **Direction:** Assert uniform top offset of nav children and containment within the header box across narrow desktop widths.

#### test-infra-11 — Drawer/sidebar duality is asserted only at desktop — mobile drawer Escape & scroll-lock untested
- **Severity:** LOW · _responsive_
- **Location:** `D:/domains/ai-today-brief/src/components/news/news-sidebar.tsx:211-218, 230-264`, `D:/domains/ai-today-brief/e2e/news-sidebar.spec.ts:1-87`
- **Viewports:** <900px
- **Browsers:** all
- **Current:** The drawer has an Escape handler (lines 211-218) and a backdrop click-to-close (lines 233-235) but no body-scroll-lock, and none of this is tested — the spec file targets the desktop sidebar container instead. The drawer's modal behavior (open via Filters button, close via Escape, close via backdrop, Apply button) has zero coverage.
- **Expected:** The mobile filters drawer's modal lifecycle (open, Escape-close, backdrop-close, Apply-close, body locked while open) is verified at a phone viewport.
- **Acceptance:** Add a spec at 390x844: open drawer via Filters button -> role=dialog visible; press Escape -> hidden; reopen, click backdrop (the bg-black/55 wrapper) -> hidden; reopen, click Apply -> hidden; while open assert body scroll is locked (body scrollTop stays 0 on scroll attempt).
- **Direction:** Cover the drawer modal lifecycle and scroll-lock at a phone width as a counterpart to the desktop sidebar spec.

---

## Test coverage — implement this matrix (you write these)

The repo currently runs **chromium only at 1280×720** — blind to every defect above. Add a Playwright responsive + cross-browser matrix covering the in-scope surfaces (header collisions, mobile-menu overlay/backdrop/outside-click/scroll-lock/duplicate-subscribe, filters fullscreen + multi-column + scroll-lock, the 900–1023px band, `--header-h` correctness, cross-browser fallbacks). Tests for the DEFERRED surfaces are out of scope this mission.

## Proposed Playwright responsive viewport x browser matrix

### Engine projects (test-infra-01)
| Project | Device base | Engine |
|---|---|---|
| `chromium` | Desktop Chrome | Blink |
| `firefox` | Desktop Firefox | Gecko |
| `webkit` | Desktop Safari | WebKit (proxies iOS/macOS Safari behavior) |

### Viewport tiers (test-infra-02)
| Tier | Width x Height | Why this width (boundary it guards) |
|---|---|---|
| phone-320 | 320 x 568 | Smallest supported floor — overflow-wrap, tap targets, hero/H1 wrap |
| phone-375 | 375 x 812 | iPhone baseline — mobile menu/drawer flows, card tap targets |
| phone-390 | 390 x 844 | Modern phone — drawer modal lifecycle, scroll-lock |
| tablet-768 | 768 x 1024 | Tailwind md / search-field appears — duplicate Subscribe, mobile chrome |
| tablet-834 | 834 x 1112 | iPad — hero orb blur perf (WebKit) |
| layout-900 | 900 x 1000 | Custom layout flip — the dead-band contract |
| layout-960 | 960 x 800 | Mid dead-band — sidebar vs hamburger mutual exclusion |
| header-1024 | 1024 x 800 | Tailwind lg / header nav flip — lockstep with sidebar |
| desktop-1280 | 1280 x 720 | Existing baseline — desktop sidebar, search-vs-nav collision |
| desktop-1440 | 1440 x 900 | Large desktop — containment / no horizontal scroll |

> Full cartesian = 3 engines x 10 viewports. Run the **full matrix in CI scheduled/nightly**; on PRs run a **reduced grid**: chromium across all viewports + firefox/webkit at {375, 768, 1024, 1280} to keep PR time bounded while still exercising every engine at the key boundaries.

### Flow coverage map

| Flow | Viewports | Engines | Covers (defect IDs) |
|---|---|---|---|
| **Breakpoint dead-band** — sidebar/nav/Filters-trigger mutual exclusion | 768, 834, 900, 960, 1023, 1024 | chromium (geometry) | header-topbar-02, mobile-menu-08, filters-drawer-01/06, global-css-01, test-infra-03 |
| **--header-h sticky offset** — token == header height; sidebar pins flush; max-height finite | 1280 + scrolled | chromium, webkit (dvh) | header-topbar-03, filters-drawer-02, global-css-02, crossbrowser-features-03, filters-drawer-09, global-css-07, test-infra-13 |
| **Mobile menu overlay & dismissal** — fixed+backdrop, outside-click, Escape, route-change close, scroll-lock, focus trap, single Subscribe | 375, 390, 768 (Subscribe), 640 | chromium, webkit | mobile-menu-01..09, test-infra-06/07/08/10 |
| **Filters drawer modal** — fullscreen/multi-col, Escape/backdrop/Apply close, scroll-lock, overscroll-contain, focus trap, iOS Apply reachable | 375, 390, 768 | chromium, webkit | filters-drawer-03/04/05/10/11, crossbrowser-features-05/10, test-infra-09/11 |
| **Horizontal-overflow guard** — no doc-level horizontal scroll with long URLs/tokens | 320, 360, 768, 900, 1024, 1440 | chromium, firefox, webkit | global-css-04, home-landing-02/04, content-templates-01..08, feed-cards-02 |
| **Hero search dropdown** — anchored to input, within content padding, not clipped | 360, 480, 768, 1024 | chromium, webkit | home-landing-01 |
| **Hero jump link** — #week lands below header at correct offset | 375, 768, 1280 | chromium, webkit (no-smooth path) | home-landing-03/08, global-css-06 |
| **Feed card tap targets & layout** — actions >=44px, hover-lift not sticky on touch, share popover contained, skeleton parity, thumbnail hit area | 320, 375, 480 | chromium (coarse-pointer emu), webkit | feed-cards-01/03/05/06/07/08/09 |
| **Footer touch targets & stack** — links/social/cookie >=44px, intentional stack, no overflow | 320, 375, 768, 1024, 1440 | chromium | footer-newsletter-01/02/03/04/10 |
| **Newsletter form** — height-stable states, UK label fit, theme-aware gradient, proof-item alignment | 320, 360 (+ /uk, .theme-light) | chromium, firefox, webkit | footer-newsletter-05/07/08/09 |
| **Header search input chrome** — appearance reset, no native cancel button, consistent radius | 375, 1280 | chromium, firefox, webkit | crossbrowser-features-02 |
| **Header opacity / nav layout** — opaque background fallback, nav single-row, search-vs-nav non-overlap | 1024, 1100, 1160, 1280, 1440 | chromium, firefox, webkit (degraded backdrop) | crossbrowser-features-01, test-infra-04/05 |
| **Cross-browser graceful degradation** — header alpha>0, sidebar max-height finite, color-mix fallbacks, accent-color, scrollbar, `:has()` | 1024, 1280 | chromium, firefox, webkit | crossbrowser-features-04/06/07/08, content-templates-10, global-css-03/05, test-infra-12 |
| **Mobile smoke (i18n)** — hamburger path reaches Home/News/About on both locales | 375 (/en, /uk) | chromium, webkit | test-infra-10 |
| **Content perf** — hero orb blur scroll fps on tablet | 834 | webkit | home-landing-09 |

### Notes for implementers
- Use `page.emulateMedia`/coarse-pointer and a `(hover: hover)` check for the card-hover-lift test (feed-cards-08).
- For cross-browser degradation tests (crossbrowser-features-01/06, global-css-07), prefer asserting against a forced `@supports-not` build path or feature-flagged stylesheet rather than relying on the live engine's actual support, since 2026-baseline Firefox/WebKit support most features.
- Replace the single `NEWS_DESKTOP_VIEWPORT` constant with a tiered viewport map and parametrize specs over it (`e2e/helpers/news-page.ts`).
- Geometry assertions (overlap, single-row, offset) only need chromium; degradation and native-control assertions need all three engines.
