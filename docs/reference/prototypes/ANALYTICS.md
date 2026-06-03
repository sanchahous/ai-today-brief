# Analytics & performance criteria — AI News Scrapper prototype

The prototype is fully instrumented for **Google Analytics 4**. To go live you
add **one value** — your Measurement ID — and data starts flowing. Nothing else
to wire.

---

## 1. Turn it on (1 step)

```bash
# .env.local (or your host's env settings)
VITE_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
```

(Or hardcode `FALLBACK_MEASUREMENT_ID` in `analytics.ts`.)

Until an ID is present, every event is **logged to the console** (dev) and
nothing is sent — so the instrumentation is verifiable without an account.
`gtag.js` is loaded lazily and only when an ID exists, so it costs nothing in
the meantime.

What you get for free once the ID is set:

- **Consent Mode v2** defaults (analytics granted, ads denied) — swap in a real
  CMP via `updateConsent()`.
- **SPA page_view** on every in-app navigation (manual, `send_page_view` off).
- **User properties** on every event: `lang`, `theme`, and each experiment
  bucket (`exp_*`) — so any metric is segmentable out of the box.

---

## 2. What we measure and why

Events were chosen to answer four product questions. Each is a GA4 custom event;
register the ones you want as **Key events** (conversions) in the GA UI.

### A. Product quality (does the core loop work?)

| Event                  | Params                                         | Signal                                                               |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| `page_view`            | `page`, `entry`, `query`, `category`           | Traffic, entry paths, section reach                                  |
| `search`               | `query`, `results`, `source`                   | Search usage & demand; `source` = hero/header/mobile/popular/see_all |
| `search_no_results`    | `query`                                        | **Search-quality gap** — content/relevance gaps to fix               |
| `select_search_result` | `query`, `position`, `post_id`                 | Result relevance (click position)                                    |
| `post_expand`          | `post_id`, `category`                          | **Core content engagement** (read intent)                            |
| `scroll_depth`         | `page`, `percent` (25/50/75/100)               | Page consumption depth                                               |
| `web_vitals`           | `metric_name`, `metric_value`, `metric_rating` | Field performance (see §3)                                           |

### B. User behaviour (how do they navigate & refine?)

| Event                          | Params                  | Signal                        |
| ------------------------------ | ----------------------- | ----------------------------- |
| `filter_category`              | `category`, `enabled`   | Which topics people filter to |
| `filter_date`                  | `range`                 | Recency preference            |
| `sort_change`                  | `sort`                  | Preferred ordering            |
| `paginate`                     | `to_page`, `page_count` | Depth of browsing             |
| `filters_reset`                | —                       | Filter friction / dead-ends   |
| `trending_topic_click`         | `topic`, `placement`    | Discovery via topic hubs      |
| `lang_switch` / `theme_toggle` | `to_lang` / `to_theme`  | Audience & UX preference      |

### C. Trust & commercial value (will it monetise & retain?)

| Event                  | Params              | Signal                                    |
| ---------------------- | ------------------- | ----------------------------------------- |
| `newsletter_subscribe` | `placement`         | **List growth** — primary revenue driver  |
| `sponsor_click`        | `brand`             | Sponsorship performance / inventory value |
| `save_toggle`          | `post_id`, `saved`  | Save intent → retention                   |
| `saved_open`           | `count`             | Return-visit / library usage              |
| `share`                | `post_id`, `method` | Word-of-mouth / virality                  |
| `faq_open`             | `question_index`    | Trust questions that matter most          |

### D. A/B testing (built in)

`experiments.ts` buckets each visitor once (persisted), publishes the bucket as
a GA4 user property (`exp_<key>`), so **every metric above can be sliced by
variant**. To run a test: add an experiment to `EXPERIMENTS`, branch on
`getVariant('key')` in the UI, compare the funnel in GA by `exp_key`.

Suggested first experiments (already declared): `hero_cta`,
`newsletter_placement`.

### Recommended Key events (conversions) & North-Star

- **North-Star:** weekly engaged readers = sessions with ≥1 `post_expand` or
  `scroll_depth ≥ 75`.
- **Key events:** `newsletter_subscribe` (primary), `post_expand`,
  `select_search_result`, `sponsor_click`, `save_toggle`.
- **Guardrails:** `search_no_results` rate, `web_vitals` "poor" rate,
  `filters_reset` rate.

---

## 3. Lighthouse / Core Web Vitals — implementation criteria

Targets the prototype is built to (mobile, throttled — the stricter bar):

| Category           | Target |
| ------------------ | ------ |
| **Performance**    | ≥ 90   |
| **Accessibility**  | ≥ 95   |
| **Best Practices** | ≥ 95   |
| **SEO**            | 100    |

Core Web Vitals budgets (the `web_vitals` events report these from the field):

| Metric                              | Good     | Budget used here |
| ----------------------------------- | -------- | ---------------- |
| **LCP** (Largest Contentful Paint)  | ≤ 2.5 s  | ≤ 2.0 s          |
| **INP** (Interaction to Next Paint) | ≤ 200 ms | ≤ 200 ms         |
| **CLS** (Cumulative Layout Shift)   | ≤ 0.1    | ≤ 0.05           |
| **FCP**                             | ≤ 1.8 s  | ≤ 1.5 s          |
| **TTFB**                            | ≤ 0.8 s  | ≤ 0.8 s          |

How the build meets them:

- **LCP** — the hero is text + CSS (no hero image/web-font blocking); fonts use
  `display=swap`; no render-blocking JS beyond the app bundle.
- **CLS** — fixed header height, reserved search slot (no nav shift on the
  scroll hand-off), aspect-ratio media, skeletons that match final layout.
- **INP** — interactions are state toggles; scroll/observers are passive;
  search is debounced; animations are transform/opacity only.
- **Mobile cost** — the blurred animated hero orbs are **desktop-only**;
  motion respects `prefers-reduced-motion`.
- **Bundle** — per-app vendor chunk; analytics/`gtag.js` loaded lazily and only
  when an ID is set; icons are inline SVG (no icon-font/library).
- **A11y/SEO** — landmarks, skip link, visible focus, labelled controls,
  JSON-LD (Organization / ItemList / FAQ / Breadcrumb), per-view `<head>` meta.

### How to verify

```bash
npm run build && npm run preview      # serve the production bundle
# Chrome DevTools → Lighthouse → Mobile → Analyze (run against the preview URL)
# or:
npx lighthouse <preview-url>/apps/ai-news-scrapper/prototypes/ \
  --preset=desktop --view
```

> Note: the floating **Prototype** toolbar and the feature-spotlight outlines
> are demo scaffolding — exclude them when judging production performance.

---

## Files

```
analytics.ts     GA4 loader + track() / page_view / user properties / consent
experiments.ts   A/B bucketing → GA4 user properties (exp_*)
webVitals.ts     LCP / CLS / INP / FCP / TTFB → web_vitals events
```
