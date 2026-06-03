# AI News Scrapper — UI/UX Prototype

Commercial-ready, click-through prototype of the **full MVP screen set** for the
AI News Scrapper, built to drop straight into implementation. Self-contained on
mock data — **no Supabase, no API keys, no backend** — so it renders anywhere.

## What's inside

A lightweight in-prototype router (`routes.ts` + `ProtoContext`) gives every
screen a shareable hash permalink (`#/uk/news/<slug>`) and per-page SEO
(`usePageMeta`: canonical, OpenGraph, hreflang) + JSON-LD.

| Group       | Screens (files)                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| **Product** | Home (`HomePrototype`), All news (`AllNewsPrototype`), Story permalink (`ItemPage`, `NewsArticle`), Daily brief (`BriefPage`, `CollectionPage`), Category hub (`CategoryPage`), Concept hub (`ConceptPage`), Search (`SearchPage`) |
| **Trust**   | Subscribe landing (`SubscribePage`) + subscribe modal, About / methodology (`AboutPage`), Advertise / media kit (`AdvertisePage`) |
| **Legal**   | Privacy / Terms / AI-disclosure (`LegalPage` + `legalContent.ts`, template copy with "needs a lawyer" flags), 404 (`NotFoundPage`) |
| **System**  | Live-status dashboard (`DashboardPage`: CWV / Supabase / health + data sources)                                  |

Shared building blocks: `StoryBody` (deep-dive analysis), `PostFeed` (paginated
feed), `PageShell` (document pages), `features.tsx` (F1–F6 + `SubscribeModal`,
`CookieConsent` CMP, `AiDisclosureNote`), `config.ts` (brand/domain in one place).

Use the floating **Prototype** toolbar (bottom-centre) to jump between screens
(grouped picker), replay the loading/skeleton state, spotlight features, reset
cookie consent and toggle the EU/UA demo region.

## How to view (local)

Fastest — a dedicated dev server that opens **just this prototype** (standalone
`vite.config.ts`, port 5180, HMR, mock data, no backend):

```bash
npm install
npm run prototype          # auto-opens http://localhost:5180/
```

Static build / preview (runs anywhere, still mock data):

```bash
npm run prototype:build    # → apps/ai-news-scrapper/prototypes/dist (gitignored)
npm run prototype:preview  # serves the build on http://localhost:5180/
```

It's also reachable from the full portfolio dev server:
`npm run dev` → http://localhost:3000/apps/ai-news-scrapper/prototypes/

## Analytics & performance

The prototype is fully instrumented for **Google Analytics 4**. To go live, set
one env var and data starts flowing — nothing else to wire:

```bash
# .env.local (or your host's env settings)
VITE_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
```

Until an ID is present, events log to the console only and `gtag.js` is never
loaded. The full event catalogue (product quality / behaviour / trust), the
A/B-testing scaffolding, and the Lighthouse + Core Web Vitals criteria the build
targets are documented in **[`ANALYTICS.md`](./ANALYTICS.md)**.

## Design decisions

- **Consistency with production** — reuses the live app's tokens (Fraunces /
  Inter, dark editorial palette, the category-coloured banner-motif system) so
  the prototype and the shipped app read as one product. Data shapes in
  `data.ts` mirror `src/lib/supabase.ts` (`Category` / `BriefItem`), making the
  real data layer a swap rather than a rewrite.
- **Posts** show a **category-icon thumbnail** collapsed and expand to the full
  **category banner** + deep-dive analysis (`PostCard.tsx`).
- **Motion** via `framer-motion` + IntersectionObserver scroll-reveal, all
  gated behind `prefers-reduced-motion`.
- **Accessibility** — skip-link, landmarks, visible focus, `aria-*` on
  expanders / dialogs / pagination, `aria-live` result counts, keyboard-safe
  controls.
- **Responsive** — mobile-first grids; the filter sidebar becomes a drawer
  under 900 px and search surfaces above the feed on mobile.
- **Bilingual** — every string is publish-ready in Ukrainian (default) and
  English (`copy.ts` + `data.ts`). Toggle in the header.

## Provisioned for the next phase

Reachable, real affordances are already wired in the UI so the build-out has a
clear target:

- **Weekly video reviews** — teaser block on Home + a video badge/flag on posts.
- **Social repost** — per-post Share menu (X / LinkedIn / copy link).
- **Comments** — per-post comment control with live counts (disabled, "soon").
- **Save to favourites** — per-post bookmark toggle.

## Additional features (research-backed)

A second round added six features chosen to strengthen the project across three
axes — **value**, **SEO**, and **commercialisation**. They're deliberately
mutually reinforcing: F4 feeds internal linking (SEO) _and_ discovery (value);
F5 drives return visits (value) which grow the list (commercial); F1+F2 are the
revenue engine; F3+F6 are the search/AI-visibility engine.

Toggle **"Підсвітити фічі / Highlight features"** in the prototype toolbar to
outline and tag each one (`Feature · F#`) in place. Implemented in
`features.tsx`; every block is marked with a `// FEATURE F#` comment.

| #      | Feature                                                                                                                                    | Axis                   | Why (with evidence)                                                                                                                                                                                                                                                                                     | Where                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **F1** | **Email digest subscription** (single field, subscriber-count social proof, referral hook)                                                 | Commercial · Retention | The email list is the monetisable asset — sponsorship revenue scales with it. State-of-Newsletters 2025: subscriptions flat, **sponsorships now the primary revenue model**. Conversion best practice = one field + social proof; **referrals convert ~32% at ~$0.17/sub** vs $1–3 from other channels. | Home band + inline card in the news feed     |
| **F2** | **Native sponsor slot** (clearly disclosed "Sponsored" + "why am I seeing this?")                                                          | Commercial             | Sponsorship is the dominant model for AI newsletters — **The Rundown reported $10M+ in 2025**, with deep-dive placements selling at **3–6× the primary rate**. Native + disclosed protects the reading experience.                                                                                      | Week block on Home, woven into the news feed |
| **F3** | **SEO FAQ + `FAQPage` JSON-LD** (accessible accordion)                                                                                     | SEO / AEO              | Answer-led content targets long-tail/conversational queries and gives **AI/answer engines (GEO/AEO)** clean Q&A to parse. `FAQPage` is one of the schema types still recommended in 2026.                                                                                                               | Bottom of Home                               |
| **F4** | **Trending topics** (weighted tag cloud → concept hubs, momentum cues)                                                                     | SEO · Value            | Builds the **hub-and-spoke internal-linking** structure SEO rewards (topical authority) and links into the existing `/concepts/:slug` pages; doubles as a fast discovery path for readers.                                                                                                              | Home section + news sidebar                  |
| **F5** | **Saved stories** (bookmarks drawer)                                                                                                       | Value / Retention      | Activates the save affordance the cards already expose and turns it into a **return-visit loop** — more sessions, a bigger list (feeds F1).                                                                                                                                                             | Header button + slide-over, shared state     |
| **F6** | **Structured data + E-E-A-T** (Organization / ItemList / BreadcrumbList JSON-LD, breadcrumbs, author + freshness + "sources cited" byline) | SEO / Trust            | Clean JSON-LD is a **direct channel to rich results and AI search**; visible author, freshness date and source disclosure are core **E-E-A-T** signals Google's framework rewards.                                                                                                                      | Both pages (JSON-LD injected to `<head>`)    |

Research sources:
[State of Newsletters 2025](https://www.wellput.io/newslettersponsorshipinsider/the-newsletter-market-is-maturing),
[beehiiv — newsletter sponsorship cost](https://www.beehiiv.com/blog/newsletter-sponsorship-cost),
[Structured data for SEO 2026](https://www.gwcontent.com/blogs/news/structured-data-for-seo),
[Topic clusters & pillar pages](https://searchengineland.com/guide/topic-clusters),
[SEO breadcrumbs](https://searchengineland.com/guide/seo-breadcrumbs),
[Newsletter signup conversion](https://claspo.io/blog/double-your-newsletter-signup-form-conversions-with-3-proven-strategies/).

## File map

```
ProtoContext.tsx   lang / theme / page / loading / saved / feature-spotlight state
hooks.ts           useReveal (scroll-reveal) + useJsonLd (structured data)
data.ts            categories + posts + trending topics + sponsor + FAQ (EN/UA)
copy.ts            UI strings + SEO copy (EN/UA)
icons.tsx          self-contained inline SVG icon set
ui.tsx             Reveal, Badge, CategoryThumb/Banner, SearchBlock, Pagination, skeletons
PostCard.tsx       feed unit: thumbnail → banner expand + action bar
Sidebar.tsx        filters / sort / search + trending (desktop rail + mobile drawer)
features.tsx       F1–F6: newsletter, sponsor, FAQ, trending, saved, structured data
Shell.tsx          header + nav (+ saved) + footer chrome
PrototypeApp.tsx   harness + prototype toolbar (page / loading / feature spotlight)
```
