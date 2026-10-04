# AH-4.4

Summary: Статусний фрагмент AH-4.4 — сторінка пошуку `/[lang]/news/search`. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: [епік AH-4.4](../product/after-hours-redesign-epic.md#ah-44--сторінка-пошуку-langnewssearch); [PR #412](https://github.com/sanchahous/ai-today-brief/pull/412)
Last updated: 2026-10-04

---

Task: ah-4.4

## Status

### Repair 2026-10-04

Виправлення review у [PR #412](https://github.com/sanchahous/ai-today-brief/pull/412)
готове; завершення задачі **BLOCKED** перевірками середовища. Видалено всі команди
завершення процесів із `e2e:affected`: за broad-зміни та доступного сервера команда
завершується з кодом 1 до rebuild. Регресійні тести з підміною системних викликів
для Windows і Linux перевіряють відсутність будь-яких процесних команд у цій гілці.
(source: `scripts/e2e-affected.ts`; `scripts/e2e-affected.test.mjs`)

Окремі перевірки документації пройшли: `wiki-project-sync` — 0 errors / 0 warnings,
`wiki-lint --strict` — 0 errors / 21 existing warnings, `wiki-tasks --check` — passed.
(source: локальний прогін 2026-10-04, `node wiki/_tools/wiki-project-sync.mjs`,
`node wiki/_tools/wiki-lint.mjs --strict`, `node wiki/_tools/wiki-tasks.mjs --check`)

AC картки збережені в реалізації: robots `noindex,follow`, canonical на `/news`,
екранування `q`, idle та EN/UK search-маршрути у gating-конфігурації. Повторний
runtime-доказ SEO compare, E2E для `q` та QA-матриці цього виправлення не отримано:
Playwright завершується з `spawn EPERM`; `pr:check` також зупиняється на запуску
Vitest через `spawn EPERM`. Definition of Done §0.1 ще не підтверджено.
(source: `src/app/[lang]/news/search/page.tsx`; `e2e/news-search.spec.ts`;
`e2e/fixtures/a11y-gating.json`; локальний прогін 2026-10-04,
`artifacts/_local/t1-f5-pr-check.log`, `artifacts/_local/t1-f5-route-qa.log`)

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

- 2026-10-04 (T1-f5, [PR #412](https://github.com/sanchahous/ai-today-brief/pull/412)): видалено небезпечне завершення PID через `netstat`/`taskkill` і `sh`/`lsof`/`kill`; broad-прогін відмовляється перебудовувати білд за доступного сервера. `node scripts/e2e-affected.test.mjs` — 2/2 passed; `npm run typecheck` — passed; `npm run lint` — 0 errors, 9 existing warnings; `git diff --check` — passed. `npm run pr:check`, `npm run e2e:check`, `npm run wiki:check` і Playwright — BLOCKED через `spawn EPERM` (Vitest/esbuild/Node test runner/Playwright). Перед завершенням потрібен повторний прогін у середовищі, що дозволяє дочірні процеси; наступна задача — AH-4.5. (source: локальний прогін 2026-10-04, `artifacts/_local/t1-f5-*.log`; `scripts/e2e-affected.test.mjs`; [локальні E2E](../ops/e2e-local.md))
- 2026-10-03 (T1-f1): review fixes — `a11y-gating.json` додано `/en|uk/news/search?q=mcp` і `?q=`; `NewsSearchForm` controlled input + URL sync (popular chip, Back/Forward); E2E popular-query/back; a11y для gating (footer/header 44px, sidebar h2, sponsor лише на hub, skip-link/search input min-height); a11y-matrix harness (reducedMotion, hydration wait, axe excludes). `npm run pr:check` зелений.
- 2026-10-03 (T1): реалізовано AH-4.4 — сторінка `/[lang]/news/search` за прототипом `home.js` `searchPage`; компоненти `NewsSearchForm`, `NewsSearchIdle`; i18n `news.searchPage.*`; E2E news-search. Наступна задача — AH-4.5.
