# Log — журнал операцій

Summary: append-only журнал усіх операцій над базою знань. Нові записи додаються **зверху**,
під заголовком. Старі записи ніколи не редагуються і не видаляються — помилку виправляє новий
запис із поміткою «коригує запис від …».
Sources: самозаписи агента
Last updated: 2026-08-04

**Формат запису:**

```markdown
## YYYY-MM-DD — короткий заголовок

**Джерело:** raw/… | live check | рішення власника | нове
**Змінено:**
- `wiki/path.md` — що саме
**Нотатка:** одне речення, якщо потрібне.
```

---

## 2026-08-04 — Dependabot #164 → #179 (safe patch/minor)

**Джерело:** live check #178/#179 CI; Playwright run 30899512987 (339 passed)

**Змінено:**

- `wiki/now.md` — #164 закрито, #179 змерджено; `main` = deps bump без pdfkit

**Нотатка:** recreate #164 не знадобився — Dependabot закрив групу після pdfkit ignore і відкрив #179 (12 updates).

---

## 2026-08-04 — Dependabot інфра (automerge + secrets + pdfkit ignore)

**Джерело:** live check PR #164 CI / `gh api .../dependabot/secrets`; план safe deps infra

**Змінено:**

- `.github/workflows/dependabot-automerge.yml` — прибрано `gh pr review --approve` (GITHUB_TOKEN не апрувить)
- `.github/dependabot.yml` — ignore `pdfkit` minor/major (окремий PR після PDF smoke)
- Dependabot secrets — `SCRAPPER_BASE_URL` + `SCRAPPER_BASE_ANON_KEY` (e2e на Dependabot PR)
- `wiki/ops/owner-checklist.md`, `wiki/now.md` — стан secrets / #164

**Нотатка:** без Dependabot copies e2e #164 падав на порожніх `NEXT_PUBLIC_SUPABASE_*`.

---

## 2026-08-04 — wiki:sync гейт (код ↔ специфікація)

**Джерело:** запит власника; live check після #177 wiki refresh

**Змінено:**

- `wiki/_meta/project-sync.json` — контракт watchers/facts/counts/index
- `wiki/_tools/lib/project-sync.mjs` + `wiki-project-sync.mjs` + `*.test.mjs`
- `package.json` — `wiki:sync`, `wiki:sync:test`, `wiki:check`; `pr:check` включає `wiki:check`
- `.cursor/rules/pr-gate.mdc`, `CLAUDE.md`, `wiki/architecture/agentic-workflow.md` — опис гейту
- `wiki/pipeline/weekly-digest.md` — формулювання `default $4` під fact-check

**Нотатка:** зміна коду під watcher без оновлення listed wiki-сторінок тепер валить `pr:check`.

---

## 2026-08-04 — актуалізація wiki під main + weekly stability

**Джерело:** live check `git log` / `gh pr list` / Supabase preflight 2026-08-04; PR #166–#177

**Змінено:**

- `wiki/now.md` — повне оновлення: `main`=#176, відкриті #177/#164, закрита docs→wiki,
  активна редакція `ai-weekly-2026-07-27`, owner/code next steps
- `wiki/pipeline/weekly-digest.md` — **нова** сторінка Content Studio v2 + revision stability
- `wiki/marketing/card-images.md` — FLUX.2 klein, no-text policy, multipart Node, costs
- `wiki/overview.md` §4 — FLUX.2, spend-cap, `generation_cost_events` / `/admin/costs`
- `wiki/open-questions.md` #2/#4 — ledger існує; критерій shadow→production ще відкритий
- `wiki/index.md` — `weekly-digest` ✅; ~62 міграції; дати live check

**Нотатка:** `now.md` від 2026-08-03 був застарілий (ще описував docs→wiki як активну роботу).

---

## 2026-08-03 — fix: Last updated + дрібні шляхи після ревʼю #166

**Джерело:** ревʼю PR #166

**Змінено:**

- усі 33 мігровані сторінки — `Last updated` перештамповано з contentful `git log --follow`
  (міграційні коміти пропущені); `Sources:` → `none (analysis)`
- `wiki/architecture/prototype-to-production.md` — історичний шлях `docs/STARTUP-PLAN.md` відновлено
- `wiki/strategy/master-roadmap.md`, marketing/pipeline посилання — старі імена файлів → поточні wiki-шляхи
- `wiki/ops/mcp.md` — лінк на reddit-compliance спростити до `./`
- коментарі e2e/sonar workflows: `docs/` → `wiki/`

**Нотатка:** виправляє п. 1–5 ревʼю #166 до мержу.

---

## 2026-08-03 — міграція docs/** → wiki/** · raw/ · artifacts/


**Джерело:** [ADR 2026-08-02](decisions/2026-08-02-knowledge-base-restructure.md) кроки 2–8;
гілка `chore/migrate-docs-to-wiki`

**Змінено:**

- `raw/db/2025-07a-supabase-mvp-migration.sql` — `git mv` з `docs/07a — Supabase MVP migration.sql`
- `raw/reference/prototypes/**` — `git mv` з `docs/reference/prototypes/`
- `artifacts/brand-kit/**` — `git mv` з `docs/marketing/brand-kit/`
- `artifacts/card-samples/**` — локальний (gitignore) переніс із `docs/marketing/card-samples/`
- 33 markdown-сторінки перенесено з `docs/` у тематичні розділи `wiki/` (strategy, architecture,
  pipeline, analytics, marketing, product, ops, audits) зі збереженням історії (`git mv`)
- шапки `Summary` / `Sources` / `Last updated` додано всім мігрованим сторінкам
- посилання `docs/…` переписано в `wiki/` · `raw/` · `artifacts/` у коді, конфігах і ядрі wiki
- `tsconfig.json`, `eslint.config.mjs`, `.vercelignore`, `sonar-project.properties`,
  `.gitignore`, `.cursor/rules/{00-core,pr-gate}.mdc`, workflows e2e/sonar — прибрано / оновлено
  згадки `docs/`
- `wiki/index.md`, `wiki/now.md`, `wiki/overview.md` — статуси ✅ після міграції
- `wiki/decisions/2026-08-02-knowledge-base-restructure.md` — статус: кроки 1–8 виконано
- папку `docs/` видалено (`git ls-files docs` → 0)

**Нотатка:** історичні згадки `docs/` у тексті ADR (команди `git mv`) залишено навмисно як
документацію плану. Зовнішні URL на `docs.claude.com` / `platform.claude.com` не чіпались.

---

## 2026-08-02 — bootstrap agentic-архітектури бази знань

**Джерело:** `WorkShop 23-25_07 Prompts. Personal.pdf` (поза репозиторієм, у Downloads власника) +
інвентаризація репозиторію (live check)

**Змінено:**

- `CLAUDE.md` — переписано з опису продукту на **системний контекст поведінки**: два режими
  (engineer / wiki-curator), мовна політика, карта зон, 10 жорстких правил, ingest workflow,
  question answering, lint, page format, citation rules, MCP-екосистема, сумісність із Knowledge
  Work Plugins. Бізнес-факти винесено звідси у `wiki/overview.md`.
- `AGENTS.md` — додано «Agent contract» для Codex/Cursor/Copilot поверх наявного
  `nextjs-agent-rules` блоку (блок збережено дослівно).
- `raw/` — створено скелет: `exports/`, `research/`, `scrapes/`, `db/`, `reference/`, `_local/` + `README.md`.
- `artifacts/` — створено з `README.md` і `_local/`.
- `wiki/index.md` — створено головний зміст + мапу міграції `docs/** → wiki/**`.
- `wiki/overview.md` — створено; зібрано бізнес-контекст, ринок, бюджетні обмеження, 8 жорстких
  обмежень, вузьке місце й розділ «Що НЕ спрацювало» (10 позицій) — усе з посиланнями на джерела.
- `wiki/now.md` — створено; стан `main` (`c4abe06`), відкритий PR #157, 5 останніх PR, 5 блокерів
  на власникові, 3 найближчі дії в коді.
- `wiki/log.md` — створено (цей файл).
- `wiki/open-questions.md` — створено; 7 відкритих питань, зокрема конфлікт GA4-property.
- `wiki/_meta/page-template.md` — створено шаблон сторінки.
- `wiki/architecture/agentic-workflow.md` — створено; опис самої системи.
- `wiki/ops/mcp.md` — створено; налаштування chrome-devtools / apify / supabase / ahrefs / vercel.
- `wiki/decisions/2026-08-02-knowledge-base-restructure.md` — створено ADR + покроковий план міграції.
- `wiki/_tools/wiki-lint.mjs` + `npm run wiki:lint` — лінтер формату сторінок, посилань і сирітства.
- `README.md` — переписано з дефолтного `create-next-app` на реальний вступ: чотири зони,
  команди, правило «ніколи не пушити в `main`».
- `.mcp.json` — створено (chrome-devtools + apify), обидва opt-in.
- `package.json` — додано скрипт `wiki:lint` (не входить у `pr:check`, щоб не міняти гейт).
- `.gitignore` — додано `raw/_local/*`, `artifacts/_local/*` із винятком для `.gitkeep`.
- `eslint.config.mjs`, `.prettierignore`, `.vercelignore`, `sonar-project.properties` — `raw/`,
  `wiki/`, `artifacts/` додано до ignore-списків (шар знань не проходить через code-гейти).
- `.github/workflows/e2e.yml`, `.github/workflows/sonarqube.yml` — `wiki/**`, `raw/**`,
  `artifacts/**` додано в `paths-ignore` (зміни в базі знань не запускають Playwright і Sonar).

**Нотатка:** фізичне перенесення 40+ файлів `docs/**` у `wiki/**` **не виконано** — це окремий
PR за планом у
[decisions/2026-08-02-knowledge-base-restructure](decisions/2026-08-02-knowledge-base-restructure.md),
щоб не змішувати створення каркасу з масовим `git mv` і переписуванням посилань.
Вихідний PDF воркшопу навмисно не скопійовано в `raw/research/` — рішення за власником
(файл особистий, репозиторій має remote на GitHub).
