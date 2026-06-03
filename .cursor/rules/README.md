# Cursor Rules — AI Today Brief

Unified ruleset in `.cursor/rules/*.mdc` for the standalone Next.js 16 repo.

| File | Scope | Applied |
|---|---|---|
| `00-core.mdc` | All code (app + pipeline) | Always (`alwaysApply: true`) |
| `pr-gate.mdc` | Run `npm run pr:check` before push / PR; never push to `main` | Always |
| `sonar-code-quality.mdc` | Sonar-driven patterns (complexity, regex/ReDoS, SQL `WHERE`, DOM, dead code) | Always |
| `sonar-debug.mdc` | SonarCloud CI / quality-gate debugging | On request (`alwaysApply: false`) |

Ported from the portfolio monorepo and adapted to **Next.js 16 + Tailwind v4 + Supabase**. `sonar-code-quality.mdc` is kept **verbatim** (stack-agnostic, hard-won from real Sonar fixes).

## Editing

- **Descriptive over aspirational.** If a rule names a file/helper/pattern, it must already exist (or be in a clearly-marked "when you add X…" note).
- The **Forbidden Without Explicit Discussion** section is the most load-bearing — every rejected dependency is added there.
- Keep it crisp: Cursor/Claude read `00-core.mdc` every turn.
- `CLAUDE.md` (repo root) points here and imports `AGENTS.md` (the Next 16 breaking-change notice).
