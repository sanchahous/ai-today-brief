# A11y: стрибок заголовків на порожньому пошуку

Summary: Порожній стан стрічки новин рендерив `h3` одразу під `h1` сторінки пошуку на вузьких екранах (h2 сайдбару там сховані) — 20 кейсів a11y-матриці падали з `heading skips: 1`; тепер заголовок порожнього стану `h2`, вигляд не змінився.
Sources: `e2e/a11y-layout-matrix.spec.ts`; `e2e/news-search.spec.ts`; артефакти падіння прогону PR [#474](https://github.com/sanchahous/ai-today-brief/pull/474) (`test-results/…/error-context.md`, 2026-10-29); live check локального build:ci 2026-10-29
Last updated: 2026-10-29

---

Task: a11y-search-empty-heading
Tracking: знайдено під час перевірки PR #474 (`check:affected`)

## Status

DONE (agent). PR: див. гілку `claude/quirky-satoshi-2d0ad8` → `next`.

### now.md

```verbatim
- **A11y-фікс: порожній пошук більше не стрибає h1 → h3 (2026-10-29).** `EmptyState` отримав `headingLevel`, стрічка новин передає `h2` (порожній стан замінює h2-картки). Регресійний тест на запит без збігів у `e2e/news-search.spec.ts`.
```

## Діагноз

- На `next` з живими даними `q=mcp` повертає історії (h2-картки), і всі 56 кейсів `news-search-q*` / `tools-settings-builder*` проходять (live check 2026-10-29). Тобто дефект залежить від результатів.
- Прогін PR #474 ішов у worktree без `.env.local` → пошук порожній → `EmptyState` з `h3` («Зв'язку не знайдено.») стояв під `h1`. На 1024/1440 сайдбар з h2 видно, тому ці кейси проходили; на 360/390/768/text-200/reflow-320 — ні (source: `error-context.md` падіння, 2026-10-29).
- Той самий стрибок відтворено з живими даними на `/en/news/search?q=zzqqxx` (390px): `H1 → H3`.
- `tools-settings-builder-uk uk day text-200` впав **не** через заголовки: `console: Failed to load resource: net::ERR_ADDRESS_IN_USE` — вичерпання локальних портів Windows під навантаженням 426 тестів. Заголовки там послідовні (h1 → h2 → h3 → h2 → h2 → h3 → h4 → h3); 15/15 повторів зелені.

## Changes

- `src/components/ui/empty-state.tsx`: проп `headingLevel?: 'h2' | 'h3'` (дефолт `h3`, решта викликів без змін); розмір і далі задає клас.
- `src/components/news/news-feed.tsx`: `EmptyState` у стрічці — `headingLevel="h2"`.
- `e2e/news-search.spec.ts`: тест «no-match query keeps headings sequential on a narrow screen» — детермінований, не залежить від того, що знайде `q=mcp`.
- `e2e/a11y-layout-matrix.spec.ts`: `ERR_ADDRESS_IN_USE` доданий до транзієнтних мережевих помилок поряд з `ERR_NO_BUFFER_SPACE` (той самий клас — сокети Windows).

## Checks

```
npm run pr:check — PASS (exit 0)
check:affected (scripts з PR #474, --files <5 змінених>) — e2e-map, design-raw, typecheck, lint, unit (12/12), build — PASS
e2e:affected — 495 passed, 1 skipped, 1 failed: news-feed-interaction «5: page 2 → article» з net::ERR_ADDRESS_IN_USE на page.goto; окремий перезапуск — 1 passed
  news-search-q en 14/14, news-search-q-uk 14/14, tools-settings-builder-uk uk day text-200 ✓, no-match regression ✓
no-match regression проти старого build — FAIL (heading level=3), тобто тест ловить дефект
```

Пастка під час перевірки: `TaskStop` над `npm run start` лишив дочірній `next-server` на порту, і Playwright (`reuseExistingServer`) тестував старий build. Перед прогоном — переконатися, що порт вільний.

## Handoff

`PostFeed` (сторінка категорії) теж використовує `EmptyState` з дефолтним `h3`; чи є там h2 перед ним, не перевірено — кандидат на ту саму правку, якщо матриця колись покаже порожню категорію.

## Log

- 2026-10-29: a11y — заголовок порожнього стану стрічки новин h3 → h2; регресійний e2e; ERR_ADDRESS_IN_USE як транзієнтна помилка в a11y-матриці.
