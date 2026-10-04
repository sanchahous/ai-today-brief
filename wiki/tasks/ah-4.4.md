# AH-4.4

Summary: Статусний фрагмент AH-4.4 — сторінка пошуку `/[lang]/news/search`. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: [епік AH-4.4](../product/after-hours-redesign-epic.md#ah-44--сторінка-пошуку-langnewssearch); [PR #412](https://github.com/sanchahous/ai-today-brief/pull/412)
Last updated: 2026-10-04

---

Task: ah-4.4

## Status

### Repair 2026-10-04 (T1-f9)

Merge `origin/main` → `feat/ah-4.4-news-search` зупинився на `wiki/ops/e2e-local.md`. Конфлікт
вирішено зі збереженням обох сторін: джерела з `.github/workflows/e2e.yml` (main), абзац про
broad-зміни / `SKIP_BUILD=1` (PR #412) і новий розділ CI про `--ci-plan` (main). Інші файли merge
(`.github/workflows/e2e.yml`, `scripts/e2e-affected.ts`, `wiki/ops/github-actions-cost.md`) без
конфліктів.
(source: `wiki/ops/e2e-local.md`; merge 2026-10-04)

Перевірки на `PORT=3100` (2026-10-04):
- `npm run pr:check` — exit 0.
- `e2e/news-search.spec.ts` — 21/21 passed (chromium/firefox/webkit).

### Repair 2026-10-04 (T1-f8)

CI Playwright smoke падав на `news-search.spec.ts` (canonical): тест очікував `https://aitodaybrief.com/en/news`, а в CI e2e `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000` — canonical рендериться з build-time env. Виправлено через `expectedSiteUrl()` у `scripts/e2e-server-url.ts` і оновлений assert у E2E.
(source: `.github/workflows/e2e.yml`; `e2e/news-search.spec.ts`; `scripts/e2e-server-url.ts`)

### Repair 2026-10-04 (T1-f7x)

Виправлено major finding review у [PR #412](https://github.com/sanchahous/ai-today-brief/pull/412): повторний пошук з форми на сторінці результатів більше не лишає старий `filters.q`, чіп і `sort` у `NewsFeed` — `key={query}` на search-маршруті плюс sync-ефект у `NewsFeed` при зміні `initialQuery`. Додано E2E `second query from results form resets chip, sort and URL`. Видалено артефакт `e2e-affected-f4.log` з гілки.
(source: `src/app/[lang]/news/search/page.tsx`; `src/components/news/news-feed.tsx`; `e2e/news-search.spec.ts`)

Перевірки на `PORT=3100` (2026-10-04):
- `e2e/news-search.spec.ts` — 21/21 passed (chromium/firefox/webkit), включно з повторним submit.
- `npm run pr:check` — exit 0.

### Repair 2026-10-04 (T1-f5x)

Виправлення review у [PR #412](https://github.com/sanchahous/ai-today-brief/pull/412) завершено і повністю верифіковано на `PORT=3100`.
Видалено небезпечні механізми завершення процесів із `scripts/e2e-affected.ts` (`netstat`/`taskkill` та `sh`/`lsof`/`kill`): за broad-зміни та активного сервера команда завершується з кодом 1 до rebuild, вимагаючи зупинити власний тестовий сервер або використати `SKIP_BUILD=1`.
(source: `scripts/e2e-affected.ts`; `scripts/e2e-affected.test.mjs`; [локальні E2E](../ops/e2e-local.md))

Усі перевірки пройшли успішно:
- `node scripts/e2e-affected.test.mjs` — 2/2 passed (ізольовані тести Windows/Linux з перевіркою відсутності процесних команд).
- `npm run pr:check` — exit 0 (`design:raw:check`, `ci:check` / 15 logic modules, `typecheck`, `lint` 0 errors / 9 warnings, `e2e:check`, `wiki:check`, `migrations:check`, `node --test`, `build:ci`).
- Playwright E2E на `PORT=3100`:
  - `e2e/news-search.spec.ts` — 6/6 passed (idle стан, екранування лапок/кирилиці/emoji в `q`, breadcrumb Головна › Новини › Пошук, `noindex,follow`, UK idle/heading, синхронізація поля з popular queries та Back).
  - `e2e/news-feed-interaction.spec.ts` — 5/5 passed (перевірка взаємодії, URL state та пагінації).
  - `e2e/a11y-layout-matrix.spec.ts` (`--grep news-search`) — 56/56 passed (A11y і layout matrix gating для search маршрутів у світлій/темній темах та на всіх брейкпойнтах 320/360/390/768/1024/1440px).
- SEO contract: 4 search-маршрути (`/en/news/search?q=mcp`, `/uk/news/search?q=mcp`, `/en/news/search?q=`, `/uk/news/search?q=`) повертають HTTP 200 та відповідають контракту (`noindex,follow`, canonical на `/news`).
(source: `src/app/[lang]/news/search/page.tsx`; `e2e/news-search.spec.ts`; `e2e/fixtures/a11y-gating.json`; локальний прогін 2026-10-04)

### now-status

```verbatim
- **AH-4.4 відкрито в [#412](https://github.com/sanchahous/ai-today-brief/pull/412)** на `feat/ah-4.4-news-search`: сторінка `/[lang]/news/search` — breadcrumb, H1 за `q`, велике поле пошуку, discovery з Relevance, idle з популярними запитами (trending), empty → Concepts; `noindex,follow`, canonical на `/news`. E2E `news-search.spec.ts`. **Наступна задача епіку — AH-4.5.** (source: PR #412; [епік §5.3 AH-4.4](../product/after-hours-redesign-epic.md#ah-44--сторінка-пошуку-langnewssearch))
```

### epic-5.3

```verbatim
| AH-4.4 | Сторінка `/[lang]/news/search` | S | агент | AH-4.3, AH-3.2 | — |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

### log

```verbatim
## 2026-10-03 — AH-4.4: сторінка пошуку `/[lang]/news/search` ([PR #412](https://github.com/sanchahous/ai-today-brief/pull/412))

- **Маршрут:** breadcrumb Головна › Новини › Пошук; H1 «Результати для “q”» / idle; велике поле `NewsSearchForm`; discovery через `NewsFeed` (`feedContext="search"`); idle — популярні запити з trending; empty — перехід до Concepts.
- **SEO:** `force-dynamic`, `noindex,follow`, canonical на `/news` без змін.
- **Тести:** `e2e/news-search.spec.ts` — екранування `q`, idle без стрічки, robots/canonical.
- **Наступна задача епіку:** AH-4.5 (Гейт News vertical slice).
(source: PR #412; [епік AH-4.4](../product/after-hours-redesign-epic.md#ah-44--сторінка-пошуку-langnewssearch))
```

### handoff-next-task

```verbatim
- **AH-4.4 відкрито в [#412](https://github.com/sanchahous/ai-today-brief/pull/412)** на `feat/ah-4.4-news-search`: сторінка `/[lang]/news/search` (breadcrumb, H1, велике поле, discovery, idle, empty → Concepts). **Наступна задача епіку — AH-4.5 (Гейт News vertical slice).** (source: PR #412; [епік §5.3 AH-4.4](../product/after-hours-redesign-epic.md#ah-44--сторінка-пошуку-langnewssearch))
```

## Log

- 2026-10-04 (T1-f9, [PR #412](https://github.com/sanchahous/ai-today-brief/pull/412)): merge conflict у `wiki/ops/e2e-local.md` — збережено broad/SKIP_BUILD абзац (PR #412) і CI `--ci-plan` з main; `npm run pr:check` зелений на PORT=3100. Наступна задача епіку — AH-4.5.
- 2026-10-04 (T1-f8, [PR #412](https://github.com/sanchahous/ai-today-brief/pull/412)): CI canonical assert узгоджено з `NEXT_PUBLIC_SITE_URL` у e2e workflow; додано `expectedSiteUrl()` + unit test. Наступна задача епіку — AH-4.5.
- 2026-10-04 (T1-f7x, [PR #412](https://github.com/sanchahous/ai-today-brief/pull/412)): `NewsFeed` на search-маршруті отримує `key={query}` — client state скидається при новому `q`; E2E на повторний submit із форми результатів (чіп, relevance, URL без старого `sort`); видалено `e2e-affected-f4.log`. Наступна задача епіку — AH-4.5.
- 2026-10-04 (T1-f5x, [PR #412](https://github.com/sanchahous/ai-today-brief/pull/412)): усунено major findings щодо небезпечного завершення PID у `scripts/e2e-affected.ts` — видалено `taskkill`/`kill` виклики; за broad-зміни команда завершується з кодом 1, якщо сервер уже слухає. Додано ізольовані тести `scripts/e2e-affected.test.mjs` (2/2 passed). Повний гейт `npm run pr:check` пройдено (exit 0). E2E `news-search.spec.ts` (6/6), `news-feed-interaction.spec.ts` (5/5) та QA-матриця a11y `a11y-layout-matrix.spec.ts` (56/56) зелені на PORT=3100. Наступна задача епіку — AH-4.5. (source: локальний прогін 2026-10-04; `scripts/e2e-affected.ts`; `scripts/e2e-affected.test.mjs`; `wiki/tasks/ah-4.4.md`)
- 2026-10-03 (T1-f1): review fixes — `a11y-gating.json` додано `/en|uk/news/search?q=mcp` і `?q=`; `NewsSearchForm` controlled input + URL sync (popular chip, Back/Forward); E2E popular-query/back; a11y для gating (footer/header 44px, sidebar h2, sponsor лише на hub, skip-link/search input min-height); a11y-matrix harness (reducedMotion, hydration wait, axe excludes). `npm run pr:check` зелений.
- 2026-10-03 (T1): реалізовано AH-4.4 — сторінка `/[lang]/news/search` за прототипом `home.js` `searchPage`; компоненти `NewsSearchForm`, `NewsSearchIdle`; i18n `news.searchPage.*`; E2E news-search. Наступна задача — AH-4.5.
