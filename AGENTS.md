<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Agent contract (Codex / Cursor / Copilot)

The full contract is in [`CLAUDE.md`](CLAUDE.md) — read it once per session. Short version:

- **Business facts** → [`wiki/overview.md`](wiki/overview.md). **Current state** → [`wiki/now.md`](wiki/now.md).
  **Map of everything** → [`wiki/index.md`](wiki/index.md). Read the first two before your first
  substantive response.
- **Engineering rules** → `.cursor/rules/00-core.mdc` (+ `pr-gate.mdc`, `sonar-code-quality.mdc`).
- **Four zones:** `raw/` immutable inputs · `wiki/` curated knowledge · `artifacts/` deliverables ·
  code in `src/` `pipeline/` `supabase/` `e2e/` `scripts/`.
- **Never** modify `raw/`. **Never** push to `main`. **Never** put business facts in `CLAUDE.md`.
- Before any push: `npm run pr:check` (includes `wiki:check` — project↔wiki sync). After any wiki
  change: update `wiki/index.md` **and** append to `wiki/log.md`. Watched code zones are listed in
  `wiki/_meta/project-sync.json`.
- Every factual claim in `wiki/` carries `(source: …)` or a link to the page that holds it.
