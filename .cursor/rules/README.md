# Cursor Rules — AI Today Brief

Unified ruleset in `.cursor/rules/*.mdc` for the standalone Next.js 16 repo.

| File | Scope | Applied |
|---|---|---|
| `00-core.mdc` | All code (app + pipeline) | Always |
| `pr-gate.mdc` | `npm run pr:check` before push / PR; never push to `main` | Always |
| `sonar-code-quality.mdc` | Sonar-driven patterns (complexity, regex/ReDoS, SQL `WHERE`, DOM) | Always |
| `sonar-debug.mdc` | SonarCloud CI / 70% vs 80% coverage gates | On request |

## Cursor skills (from [portfolio](https://github.com/sanchahous/portfolio))

| Skill | Use when |
|---|---|
| `.cursor/skills/auditing-performance` | CWV, bundle, runtime audits |
| `.cursor/skills/seo-geo` | SEO + GEO / AI citation optimization |
| `.cursor/skills/ui-ux-pro-max` | UI/UX patterns, design-system lookup |

SEO/GEO skill pool also lives under `.agents/skills/` (Ahrefs-style workflows). Prefer `.cursor/skills` for Cursor-native discovery.

## Editing

- Rules ported from portfolio and adapted to **Next.js 16 + Tailwind v4 + Supabase**.
- `sonar-code-quality.mdc` is stack-agnostic (hard-won Sonar fixes).
- `CLAUDE.md` points here and imports `AGENTS.md`.
