# AH-4.5

Summary: Підготовлено acceptance E2E та QA-матрицю; виправлено скидання URL-page, селектор Topics і замалі посилання редактора та реклами. Повторні браузерні перевірки та pr:check заблоковані Windows EPERM; G4 не підписаний.
Sources: [картка AH-4.5](../product/after-hours-redesign-epic.md#ah-45--гейт-news-vertical-slice), [gap-plan §7](../audits/2026-09-26-design-system-gap-plan.md#7-acceptance-tasks), `e2e/news-feed-interaction.spec.ts`, `e2e/fixtures/a11y-gating.json`, локальні перевірки 2026-10-04, [PR #415](https://github.com/sanchahous/ai-today-brief/pull/415)
Last updated: 2026-10-04

---

Task: ah-4.5

## Status

### Repair T1-f2 — 2026-10-04

**BLOCKED для runtime-перевірки; виправлення збережені.** Pre-push хабу виявив
цілі менші за 44 px у News: посилання редактора 135×16 та реклами 156×38.
Вісім UK-сценаріїв (Night/Day, 360/390/768/reflow-320) падали; у пакеті наведено
122 passed і 1 skipped. Посилання редактора було inline без мінімальної висоти,
а висота реклами залежала лише від тексту й padding.
(source: пакет T1-f2 2026-10-04)

`Byline` тепер використовує inline-flex з вертикальним вирівнюванням тексту;
обидва посилання мають `min-h-[var(--touch-target-min)]` з наявного токена 44 px.
Мінімум застосовано до обох мов та всіх ширин; наявна QA-матриця перевіряє їх
без нових виключень чи послаблення assertions. URL, текст, SEO, аналітика й motion
не змінювалися.
(source: `src/components/byline.tsx`, `src/components/home/sponsor-card.tsx`,
`src/app/globals.css`, `e2e/helpers/inspect-page.ts`)

Перевірки repair:

- До і після виправлення: `PORT=3100 node node_modules/@playwright/test/cli.js test e2e/a11y-layout-matrix.spec.ts --project=chromium --grep "news-uk uk day 390"`
  — exit 1, `Error: spawn EPERM` до запуску сценарію.
- `PORT=3100 npm run pr:check` — exit 1: `design:raw:check` PASS; Vitest/Vite config load
  падає через `spawn EPERM` у `windowsSafeRealPathSync`. Наступні кроки не виконані.
- `node node_modules/typescript/bin/tsc --noEmit` — exit 0.
- `node node_modules/eslint/bin/eslint.js src/components/byline.tsx src/components/home/sponsor-card.tsx` — exit 0.
- `npm run wiki:check` — exit 1: sync PASS (0 errors / 0 warnings), запуск sync-тестів
  заблокований `spawn EPERM`; `node wiki/_tools/wiki-lint.mjs --strict` окремо — exit 0.
- `git diff --check` — exit 0; весь diff переглянуто, виправлення обмежене двома компонентами
  й цим фрагментом; спільні статусні файли не змінено.

(source: `artifacts/_local/ah-4.5/f2-reproduce.log`, `artifacts/_local/ah-4.5/f2-e2e.log`,
`artifacts/_local/ah-4.5/f2-pr-check.log`, `artifacts/_local/ah-4.5/f2-wiki-check.log`,
`artifacts/_local/ah-4.5/f2-wiki-lint.log`; локальні перевірки 2026-10-04)

Хабу: повторити QA-матрицю на свіжому мінімальному білді PORT=3100, потім acceptance,
Firefox/WebKit quick, SEO compare та повний гейт і CI. Поточне середовище не дозволяє
підтвердити runtime-результат; G4 і датоване рішення власника go лишаються відкритими.
Наступна задача — отримати зелені автоматичні докази й рішення G4 перед фазою 5.
(source: [картка AH-4.5](../product/after-hours-redesign-epic.md#ah-45--гейт-news-vertical-slice),
[PR #415](https://github.com/sanchahous/ai-today-brief/pull/415))

### Repair T1-f1 — 2026-10-04

**BLOCKED для runtime-перевірки; виправлення збережені.** Pre-push хабу мав 24 passed / 9 failed:
чотири topic-сценарії, чотири page 2 → Back та межі пагінації.
Звіти topic-тестів показують strict mode violation: `hasText: Topics/Теми` знаходив також
Hot topics/Популярні теми. Усі topic-селектори тепер знаходять section за точним accessible heading.
(source: пакет T1-f1 2026-10-04; `test-results/news-feed-interaction-News-56e42--OR-within-the-topics-facet-chromium/error-context.md`, `e2e/news-feed-interaction.spec.ts`)

Причина втрати page: mount-ефект читав URL, а наступний sync-ефект одразу викликав
`setPage(initialPage)` з серверним значенням 1. Sync тепер працює лише коли серверні props
справді змінилися; початковий URL-state зберігається при reload і remount після Back.
Наявний `key={query}` на search-маршруті збережений. Сценарій №5 додатково робить reload на page 2
і звіряє URL, current page та впорядковані посилання перед відкриттям статті.
(source: `src/components/news/news-feed.tsx`, `src/app/[lang]/news/search/page.tsx`, `e2e/news-feed-interaction.spec.ts`)

Перевірки repair:

- До і після виправлення: `node node_modules/@playwright/test/cli.js test e2e/news-feed-interaction.spec.ts --project=chromium`
  — exit 1, `Error: spawn EPERM`; браузерні сценарії в агентському середовищі не стартували.
- `npm run pr:check` — exit 1: `design:raw:check` PASS, потім Vitest/Vite config load
  на `ci:check` падає з `spawn EPERM`. Результат решти гейту невідомий.
- `node node_modules/typescript/bin/tsc --noEmit` — exit 0 на фінальному repair.
- `node node_modules/eslint/bin/eslint.js src/components/news/news-feed.tsx e2e/news-feed-interaction.spec.ts`
  — exit 0, без діагностик.
- `git diff --check` — exit 0; повний repair diff переглянуто, стороннє форматування прибрано.

(source: `artifacts/_local/ah-4.5/repair-reproduce.log`, `artifacts/_local/ah-4.5/repair-e2e.log`, `artifacts/_local/ah-4.5/repair-pr-check.log`, `artifacts/_local/ah-4.5/repair-typecheck.log`, `artifacts/_local/ah-4.5/repair-lint.log`; локальний прогін 2026-10-04)

Хабу: перевірити виправлення на свіжому мінімальному білді цієї копії, PORT=3100.
Потрібні той самий Chromium-прогін, search regression, Firefox/WebKit, QA і SEO compare,
повний pr:check та CI. До підтвердження цих результатів green не заявляється; людський go
також відсутній. Після автоматики — рішення власника з датою, потім відкриття фази 5.
(source: пакет T1-f1; [PR #415](https://github.com/sanchahous/ai-today-brief/pull/415))

### Initial attempt — 2026-10-04

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
У початковій спробі продуктовий код, SEO, аналітика, motion, ISR і токени не змінювалися;
repair T1-f1 змінює лише guard синхронізації NewsFeed, описаний вище.
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

- 2026-10-04 — T1-f2: додано мінімальну висоту з токена 44 px для посилань редактора
  й реклами; QA до/після та pr:check заблоковані spawn EPERM.
  (source: `src/components/byline.tsx`, `src/components/home/sponsor-card.tsx`,
  [PR #415](https://github.com/sanchahous/ai-today-brief/pull/415), локальні перевірки 2026-10-04)
- 2026-10-04 — T1-f1: точний heading Topics замість broad text; sync server props не скидає
  page після URL hydration; E2E page 2 доповнено reload. Runtime-перевірка заблокована EPERM.
  (source: `src/components/news/news-feed.tsx`, `e2e/news-feed-interaction.spec.ts`, [PR #415](https://github.com/sanchahous/ai-today-brief/pull/415))
- 2026-10-04 — Підготовлено 8 acceptance E2E × 2 мови × 2 теми та boundaries; додано News
  до QA fixture. Автоматичний гейт заблокований `spawn EPERM`; green і людський go не заявляються.
  (source: [PR #415](https://github.com/sanchahous/ai-today-brief/pull/415), локальні перевірки 2026-10-04)

### epic-5.3

```verbatim
| AH-4.5 | Гейт News vertical slice (без usability-сесій, D12) | S | власник + агент | AH-4.3, AH-4.4, AH-0.5 | G14 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
