# AH-5.2

Summary: Реалізація статті збережена у робочому дереві; перевірки заблоковані забороною запуску дочірніх процесів. Браузерні докази ще не отримані.
Sources: src/app/[lang]/news/[category]/[item]/page.tsx; src/components/story-body.tsx; src/lib/story-sections.ts; локальні перевірки 2026-10-04; PR #419; історичний перенос ATB-67
Last updated: 2026-10-04

---

Task: ah-5.2

## Status

BLOCKED — `npm run pr:check` завершується з кодом 1 на `design:raw:check`:
`Error: spawn EPERM`, `ensureServiceIsRunning` у `esbuild`. Цільовий Vitest також
не стартує: `externalize-deps` → `optimizeSafeRealPathSync` → `spawn EPERM`.
Це не результат тестів застосунку; зелений гейт не заявляється.
(source: локальні запуски 2026-10-04, `ah52-gate.log`, `ah52-unit.log` у системному TEMP)

PR: https://github.com/sanchahous/ai-today-brief/pull/419

## Зміни

- Шапка використовує редактора з `site.ts`, impact лише з payload, hero з розмірами
  1280×720 без Reveal та VideoFacade; metadata, JSON-LD, ISR і редиректи не змінені.
  (source: `src/app/[lang]/news/[category]/[item]/page.tsx`)
- Панель поширення стоїть перед текстом на mobile та sticky на desktop; міра тіла
  обмежена 70ch. Related обмежено трьома матеріалами, newsletter використовує inline form.
  Збереження не додано відповідно до відкладеного D6.
  (source: `src/components/article.module.css`; `src/components/item-share-bar.tsx`;
  [ADR D6](../decisions/2026-09-29-after-hours-rollout-and-foundations.md))
- Вибір секцій винесено в `selectStorySections`; відсутні поля й порожні текстові
  значення не створюють секцій. Concept links використовують Tag; порядок payload
  збережено. Додано EN/UK тести відсутності заголовків і порядку блоків.
  (source: `src/lib/story-sections.ts`; `src/components/story-body.test.ts`)
- Markdown отримав opt-in відображення простих pipe-таблиць із локальним scroll;
  plain-text проєкція для SEO лишається попередньою. Код має фокусовану область scroll.
  (source: `src/lib/markdown.ts`; `src/components/markdown-body.tsx`)

## AC і докази

| Критерій | Стан |
|---|---|
| SEO-diff 0 / OG | Metadata та schema не редаговані; live compare і відповідь OG ще не перевірені |
| Відсутнє поле → немає секції | Код і unit-тести додані; запуск Vitest заблокований до виконання тестів |
| LCP / CLS / 60–75 символів | 16:9, явні розміри, preload лише hero та 70ch реалізовані; браузерних вимірів немає |
| Таблиці / код на 360 | Локальні scroll regions реалізовані; перевірка браузером не виконана |
| Матриця 3 категорій EN/UK | Ще потрібно додати статті до gating fixture та виконати Night/Day, 360/390/768/1024/1440, text-200, reflow-320 |
| Engagement / dwell 30 с | Tracker і hook не змінювалися; їхній цільовий test run не стартував |
| AI disclosure | Збережений `/[lang]/ai-disclosure`, збільшена touch target inline link; браузерної перевірки немає |
| §0.1 / інваріанти | Нових залежностей, URL, схем БД, форматних фактів і повного build немає; CI, Preview і візуальні докази ще відсутні |

(source: diff робочого дерева та локальні перевірки 2026-10-04)

## Перевірки

- `npm run typecheck` — PASS, exit 0.
- `npx --no-install vitest run src/components/story-body.test.ts src/components/item-engagement-tracker.test.ts src/hooks/use-engaged-dwell.test.ts src/lib/markdown.test.ts` — BLOCKED, exit 1, `spawn EPERM` до старту тестів.
- `PORT=3100 npm run pr:check` — BLOCKED, exit 1, `spawn EPERM` на `design:raw:check`; решта кроків не виконувалась.
- `git diff --check` — PASS.
- Prettier для змінених файлів — PASS; повний diff переглянуто, остаточне приймання потребує виконання тестів.

(source: локальні команди 2026-10-04)

## Log

- 2026-10-04: збережено реалізацію й докази блокування для [PR #419](https://github.com/sanchahous/ai-today-brief/pull/419). Спільні статусні файли не змінені. (source: робоче дерево)

## Handoff / наступний крок

Відновити цю саму задачу в середовищі, де доступний spawn для Vite/esbuild.
Повторити цільові тести та `pr:check`, усунути виявлені проблеми, доповнити gating
матрицю трьома реальними статтями різних категорій EN/UK, перевірити SEO/OG,
copy/share, video facade, dwell, LCP/CLS і знімки Night/Day 1440/390.
Не позначати задачу завершеною й не мерджити за цим звітом. Сервери не запускалися;
commit/push не виконувалися. (source: локальна сесія 2026-10-04)

### epic-5.3

```verbatim
| AH-5.2 | Стаття | L | агент | AH-5.1 | route `article` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
