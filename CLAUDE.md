# AI Today Brief

Standalone **Next.js 16 (App Router)** product on Vercel — a daily curated **AI/engineering brief** (EN primary, UK secondary) plus evergreen technical concept hubs. Strategy: **brief-led product, authority-built architecture** (topical authority + AEO on a defensible dev niche). Data + the `fetch→rank→summarize→publish` pipeline on **Supabase**; payments via **LemonSqueezy** (Stripe is UA-blocked).

**Engineering rules live in `.cursor/rules/` — read `00-core.mdc` first** (plus `pr-gate.mdc`, `sonar-code-quality.mdc`).

**Build context:** `docs/07 — MVP Dev Handoff`, `docs/08 — Prototype to Production Plan`, `docs/STARTUP-PLAN.md`. **Design reference:** `docs/reference/prototypes/`. **SEO/GEO skill pool:** `.agents/skills/` (geo-content-optimizer, schema-markup-generator, technical-seo-checker, keyword-research, internal-linking-optimizer, …). **GA4/GSC setup (property IDs, key events, two-properties trap):** `docs/ANALYTICS.md` — keep it current when touching analytics.

**Before any push:** run `npm run pr:check` (typecheck + lint + build) on a **feature branch** — never push to `main` (see `pr-gate.mdc`). For UI regressions: `npm run e2e:install` once, then `npm run build && npm run e2e`.

@AGENTS.md
