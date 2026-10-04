# AH-4.5

Summary: Підготовлено обов'язкові E2E для восьми acceptance tasks News slice й розширено QA-матрицю. Автоматичний прогін заблокований Windows EPERM; G4 не підписаний.
Sources: [картка AH-4.5](../product/after-hours-redesign-epic.md#ah-45--гейт-news-vertical-slice), [gap-plan §7](../audits/2026-09-26-design-system-gap-plan.md#7-acceptance-tasks), `e2e/news-feed-interaction.spec.ts`, `e2e/fixtures/a11y-gating.json`, локальні перевірки 2026-10-04, [PR #415](https://github.com/sanchahous/ai-today-brief/pull/415)
Last updated: 2026-10-04

---

Task: ah-4.5

## Status

**BLOCKED — 2026-10-04.** Код тестів підготовлено; проходження acceptance tasks, QA-матриці,
SEO compare та браузерів не підтверджене. `npm run pr:check` завершується з exit 1 на
`design:raw:check`: `tsx/esbuild` не може запустити дочірній процес (`spawn EPERM`,
Windows, Node v22.22.3). Залежності не перевстановлювалися; правила гейтів не послаблювалися.
(source: `artifacts/_local/ah-4.5/pr-check.log`, локальний прогін 2026-10-04)

PR: https://github.com/sanchahous/ai-today-brief/pull/415

## Changes and acceptance evidence

`e2e/news-feed-interaction.spec.ts` замінює умовні перевірки на вісім обов'язкових сценаріїв,
кожен у EN/UK і Night/Day; окремо перевіряє межі пагінації. Дані не підміняються.
Порожній результат за тиждень/місяць дозволений лише там, де перевіряється стан;
сценарії topics, page 2 та пошуку вимагають реальних результатів.
(source: `e2e/news-feed-interaction.spec.ts`)

| Acceptance task | Підготовлена перевірка | Результат |
|---|---|---|
| 1. Filter і sort на першому екрані | `toBeInViewport`, 360/390/768/1024/1440 | Не запущено |
| 2. Agents & MCP за 7 днів | Категорія, week, дати, chips, Back/Forward | Не запущено |
| 3. Topic + category | Обов'язковий topic, AND між фасетами, другий topic, OR-примітка | Не запущено |
| 4. Один filter, потім Reset all | Прибрати date-chip зі збереженням category/topic; скинути URL і результати | Не запущено |
| 5. Page 2 → story → Back | URL із category/sort/page, current page, той самий впорядкований набір посилань | Не запущено |
| 6. Reload і copied URL | Той самий набір посилань, count, chips і sort | Не запущено |
| 7. Newest / Relevance | Дати за спаданням, Relevance лише з query, Back; немає engagement-sort | Не запущено |
| 8. Keyboard-only mobile drawer | Tab/Space/Enter, category/topic/week, reset, focus trap, Escape і повернення фокусу | Не запущено |

Межі: завелика page → остання сторінка без Next; зміна sort → page 1 без Previous;
0, від'ємна й нечислова page → page 1.
QA fixture доповнено `/en/news` та `/uk/news`; наявні EN/UK search results/idle й каталог
збережені. Глобальна оболонка перевіряється на цих маршрутах існуючим AH-0.5 інспектором.
Продуктовий код, SEO, аналітика, motion, ISR і токени не змінені.
(source: `e2e/news-feed-interaction.spec.ts`, `e2e/fixtures/a11y-gating.json`, `e2e/a11y-layout-matrix.spec.ts`)

## Checks

- `npm run pr:check` — **exit 1**, `spawn EPERM` на першому кроці; решта гейту не виконана.
- `node node_modules/typescript/bin/tsc --noEmit` — **exit 0** після виправлення типізації option у нових тестах.
- `node node_modules/eslint/bin/eslint.js e2e/news-feed-interaction.spec.ts` — **exit 0**, без діагностик на фінальному коді; TypeScript також повторно пройшов після фінальних доповнень.
- `node node_modules/@playwright/test/cli.js test e2e/news-feed-interaction.spec.ts --list` — **exit 1**, доступ до `E:\temp\playwright-transform-cache\…newspage.map` заборонено (`EPERM`). Це збій виявлення тестів, а не результат браузерного прогону.
- Форматування змінених E2E/JSON — Prettier, exit 0.
- `git diff --check` — **exit 0**; повний diff переглянуто проти AC.
- Chromium QA, Firefox/WebKit quick, acceptance E2E та SEO compare — **не виконані**, сервер не запускався; `.next` на старті відсутній.
- CI й Preview — **очікують хаб**, доступ до зовнішніх акаунтів не використовувався.

(source: локальні перевірки 2026-10-04; `artifacts/_local/ah-4.5/{pr-check,typecheck,lint,test-list}.log`)

## Human gate and handoff

G4 лишається відкритим: **рішення власника «go» з датою потрібне після зеленого прогону**.
Підпис не вигадувався. За контрактом ATB-67 рутинний журнал міститься тут;
`wiki/log.md`, now/index/handoff і §5.3 не змінювалися.
(source: [епік §0.1 і AH-4.5](../product/after-hours-redesign-epic.md), [PR #415](https://github.com/sanchahous/ai-today-brief/pull/415))

Хабу: усунути обмеження запуску дочірніх процесів і доступу до Playwright cache, повернути
цю саму задачу на runtime-перевірку. Потрібні `PORT=3100 npm run pr:check`, acceptance на
трьох рушіях, Chromium QA news/search (повна матриця), Firefox/WebKit quick news/search
(390/1440 та drawer/header interaction), SEO compare EN/UK news/search за AH-0.4.
Не запускати повний SSG; використовувати мінімальний build із гейту.
Після автоматики власник має відповісти: «Чи даєте go для News slice і відкриття фази 5;
яка дата рішення?» Наступна фаза не відкрита.
(source: [картка AH-4.5](../product/after-hours-redesign-epic.md#ah-45--гейт-news-vertical-slice), поточний пакет задачі 2026-10-04)

## Log

- 2026-10-04 — Підготовлено 8 acceptance E2E × 2 мови × 2 теми та boundaries; додано News
  до QA fixture. Автоматичний гейт заблокований `spawn EPERM`; green і людський go не заявляються.
  (source: [PR #415](https://github.com/sanchahous/ai-today-brief/pull/415), локальні перевірки 2026-10-04)

### epic-5.3

```verbatim
| AH-4.5 | Гейт News vertical slice (без usability-сесій, D12) | S | власник + агент | AH-4.3, AH-4.4, AH-0.5 | G14 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
