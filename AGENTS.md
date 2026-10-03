<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

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
- Before any push: `npm run pr:check` (includes `wiki:check` — project↔wiki sync). A task's
  status, log line and "next task" go only in `wiki/tasks/<id>.md`. Do not edit `wiki/now.md`,
  the `Sources:` line or handoff cell in `wiki/index.md`, the open-PR list in
  `wiki/product/after-hours-epic-handoff.md`, epic §5.3, or the top of `wiki/log.md` for that
  status. Rollup: `npm run wiki:tasks` (prints, does not write). A new wiki page still gets one
  index row; raw-source ingest still appends to `wiki/log.md`. Watched code zones are listed in
  `wiki/_meta/project-sync.json` — a watcher that lists `now.md` is satisfied by the task fragment.
- Every factual claim in `wiki/` carries `(source: …)` or a link to the page that holds it.
