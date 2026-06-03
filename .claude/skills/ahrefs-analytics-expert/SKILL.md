---
name: ahrefs-analytics-expert
description: Analyze SEO exports from Ahrefs, Semrush, and Google Search Console (CSV/API). Use when the user uploads or pastes GSC/Ahrefs/Semrush data, asks for keyword gaps, backlink audits, cannibalization, or ranking deltas from third-party SEO tools.
---

# Ahrefs / Semrush / GSC analytics

Custom gatekeeper skill for this pool. Source skills in the same pool: `seo-audit`, `analytics-tracking`, `campaign-analytics`, `site-architecture`, `marketing-context`.

## When to use

- User provides Ahrefs/Semrush/GSC exports (CSV, sheets, screenshots)
- Compare periods, find cannibalization, prioritize fixes from tool data
- Bridge tool metrics to actionable dev/marketing tasks

## Workflow

1. **Identify source** — Ahrefs (Site Audit, Keywords, Backlinks), Semrush (Position Tracking, Audit), or GSC (Performance, Coverage, Core Web Vitals).
2. **Normalize columns** — Map to a common schema: URL, query, clicks, impressions, position, volume, difficulty, referring domains, status code.
3. **Cross-skill routing**
   - Technical crawl / index / CWV → invoke `seo-audit`, `site-architecture`
   - Schema / rich results → invoke `schema-markup`
   - Landing / funnel / PPC → invoke `page-cro`, `paid-ads`, `marketing-demand-acquisition`
   - Content gaps at scale → invoke `programmatic-seo`, `content-strategy`
4. **Output** — Prioritized table: issue, evidence (metric), owner (eng vs marketing), suggested skill/command, effort (S/M/L).

## Export handling

| Tool | Typical files | Focus |
|------|---------------|--------|
| GSC | Queries, Pages, Coverage, CWV | Indexing, queries, CTR, CWV regressions |
| Ahrefs | Site Audit, Organic keywords, Backlinks | Technical issues, keyword gaps, link profile |
| Semrush | Position Tracking, Site Audit | SERP movement, competitor gaps |

Do not invent metrics missing from the export. State assumptions when joining files (date range, property, country).

## Scripts

Prefer pool skills' bundled Python tools when present (`seo-audit`, `site-architecture`). Run from the skill directory that owns the script.
