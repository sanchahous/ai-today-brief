# AH-1.4: кольори й гліфи категорій — докази

Summary: дев'ять категорій використовують тематичні токени й гліфи After Hours; PR #382 очікує окремого візуального підпису власника перед merge. Наступна задача після інтеграції — AH-1.2.
Sources: `src/lib/category-meta.ts`; `src/lib/design-system/tokens.ts`; `src/app/globals.css`; `src/components/icons.tsx`; `src/components/category-presentation.test.ts`; `src/lib/design-system/category-colour-consumers.test.ts`; `e2e/category-colours.spec.ts`; `artifacts/_local/ah-1.4-seo-local.log`; production before manifest; live git/PR/CI checks 2026-09-30.
Last updated: 2026-09-30

---

## Реалізація

`CategoryMeta.tokenKey` покриває дев'ять seeded slug-ів; `optimization → cost`.
`categoryColor` повертає `var(--cat-<key>)`, `categoryArtColor` — `var(--art-<key>)`.
DB color використовується лише для невідомої рубрики; без нього — нейтральний
`--muted` / `--art-neutral`. Невідомі й prototype-like slug-и (`__proto__`,
`constructor`) мають нейтральну metadata. (source: `src/lib/category-meta.ts`;
`src/lib/category-meta.test.ts`)

`tokens.ts` **2.1.0**: додано Night/Day `--cat-*`, незмінні Night `--art-*` і
темну art-сцену. CSS drift перевіряє всі ролі в обох темах. Дев'ять GLYPHS
із прототипу перенесено в `icons.tsx`; SVG мають `aria-hidden` і `focusable=false`.
(source: `src/lib/design-system/tokens.ts`; `scripts/check-design-tokens.ts`;
`artifacts/after-hours/app.js`; `src/components/category-presentation.test.ts`)

Мігрували badge, category header/grid/thumb/banner/mix bar, sidebar/header,
post/article/story/facts, FilterChip, daily/subscribe/related і search preview.
Пошуковий API тепер також повертає slug; `RelatedStory` переносить slug явно.
Тест AST блокує прямі DB-colour reads у public JSX поза resolver або відомим
компонентом зі slug. OG/PDF/duotone зберігають попередній контракт.
(source: `src/components/**`; `src/app/api/search/route.ts`; `src/lib/items.ts`;
`src/lib/design-system/category-colour-consumers.test.ts`)

Усі вісім Day `.cat-*` overrides прибрано. Текст бере токен без color-mix;
декоративні тла використовують 6% tint на opaque `--surface`, щоб вкладення
плашок не знижувало контраст. Початковий browser gate знайшов 3.85:1 на Day
badge зі старим 16% tint; виправлено до фінальних прогонів.
(source: `src/app/globals.css`; `artifacts/_local/ah-1.4-category-smoke-retry.log`;
`artifacts/_local/ah-1.4-category-smoke-fixed.log`)

## Перевірки й review

- 54 категорійні пари: дев'ять кольорів × bg/surface/raised × Night/Day,
  мінімум **5.2238:1**, без провалів. Вони вже входять у Vitest/pr:check;
  AH-1.2 доповнює решту матриці. (source: `scripts/check-design-tokens.ts`;
  `src/lib/design-system/tokens.test.ts`; `npm run tokens:check` 2026-09-30)
- SEO compare local і Preview: **58 URL, 0 errors, 0 warnings** у кожному прогоні;
  Preview повторно віддає news з cache HIT в EN/UK.
  (source: `artifacts/_local/ah-1.4-seo-local-final.log`;
  `artifacts/_local/ah-1.4-seo-preview-final.log`)
- Ratchet після prune: **30** кольорових входжень (було 42), **4** довільні
  z-index, **0** сирих тіней і шрифтів <12 px.
  (source: `scripts/raw-design-values.baseline.json`; `npm run design:raw:prune` 2026-09-30)
- `pr:check` після інтеграції main `3d0cb2b` (#380, AH-4.1): **2112 unit-тестів,
  229 файлів**; pre-push **304 passed / 5 skipped**. Category/catalog/admin
  і theme у Chromium/Firefox/WebKit: **488 passed / 52 skipped** на Next 16.3.6.
  Пропуски включають візуальні snapshots і CDP text-200 поза Chromium.
  (source: `artifacts/_local/ah-1.4-pr-check-main-sync.log`;
  `artifacts/_local/ah-1.4-push-main-sync.log`;
  `artifacts/_local/ah-1.4-crossbrowser-final.log`; `artifacts/_local/ah-1.4-theme-final.log`)
- Посилений category-тест очікує картки на news/category: повторно **307 passed /
  32 skipped** у трьох engines; UI не змінювався після знімків.
  (source: `artifacts/_local/ah-1.4-category-hydrated-final.log`; `e2e/category-colours.spec.ts`)
- [PR #382](https://github.com/sanchahous/ai-today-brief/pull/382) відкрито як draft.
  Зміни #379 (Next 16.3.6) і #380 з main враховано; обидві історії wiki/log збережено.
  [Перевірений Preview](https://ai-today-brief-hd2ce58ep-sanchahous-projects.vercel.app)
  відповідає site commit `91b90c2`; gallery/QA/wiki наступного коміту не змінюють site code.
  (source: `gh pr view 382`; `git merge origin/main`; Vercel deployment
  `dpl_9HVLHXKQXxEpZEXrNSMsah8dMBDx` 2026-09-30)

32 PNG «до» — production, `artifacts/_local/ah-1-4-before/`.
Manifest SHA-256: `7B1EFACD144D5F9DC0171BC738B88356AD896B9F3B552925CD663AA01EB324E1`.
`gitSha 7240652` — checkout під час capture до merge tooling PR, а не доказ
production deploy SHA; provenance не змінено.
(source: production before manifest; повідомлення власника 2026-09-30)

32 PNG «після» з фінального Preview: `artifacts/_local/ah-1-4-preview-final/`.
Маршрути зафіксовано через `--route-manifest` із manifest «до», включно з тією
самою статтею. [Галерея](../../artifacts/after-hours/qa/ah-1.4-review.html)
завантажує **64 PNG у 32 парах**; відкривати з локального checkout.
SHA-256 фінального manifest і QA reports — у
[receipt](../../artifacts/after-hours/qa/ah-1.4-validation.json).
(source: `artifacts/_local/ah-1.4-preview-capture-final.log`;
`artifacts/_local/ah-1.4-gallery-check.log`; фінальний Preview manifest)

### Full-page legacy QA: порівняння

| Метрика | AH-1.3 | AH-1.4 до sync #380 | AH-1.4 після sync #380 |
|---|---:|---:|---:|
| Сценарії | 812 | 812 | 812 |
| Overflow / текст <12 px | 0 / 0 | 0 / 0 | 0 / 0 |
| Small targets | 11928 | 11947 | 12013 |
| Axe nodes | 2484 | 1400 | 1400 |
| Console errors | 28 | 28 | 28 |
| H1 problems / heading skips | 23 / 313 | 19 / 317 | 19 / 317 |
| Images без alt | 0 | 0 | 0 |
| Clipped / zoom-reflow clipped | 1345 / 416 | 1368 / 416 | 1377 / 424 |

(source: `artifacts/_local/ah-1.3-full-qa.json`;
`artifacts/_local/ah-1.4-full-qa.json`; `artifacts/_local/ah-1.4-full-qa-final.json`;
[receipt](../../artifacts/after-hours/qa/ah-1.4-validation.json))

Зростання zoom-clipping **416 → 424** у повторному прогоні — 8 paragraphs EN
live-search `text-200`, де цього разу завантажилися результати. За межами 28
live-search сценаріїв zoom-clipping лишається **416**, axe — **2460 → 1400**.
Одна UK news 390 Night сцена заміряла loading-контент, тому агрегати targets і
clipping не є доказом виправлення. Дві додаткові clipping-знахідки filtered news
1440 проти AH-1.3 лишаються відкритими. Category contrast gate окремо очікує
картки news/category перед заміром; це не виправляє legacy report чи UI-борг.
(source: порівняння results трьох QA JSON за route/theme/mode 2026-09-30;
`e2e/category-colours.spec.ts`; `e2e/helpers/inspect-page.ts`)

Sonar Scan на `91b90c2` — success. Dashboard quality gate окремо не підтверджено:
`sonar.qualitygate.wait=false`, локального `SONAR_TOKEN` немає, anonymous PR
endpoint повернув 404. Scan success не прирівнюється до dashboard gate.
(source: [run 36749126263](https://github.com/sanchahous/ai-today-brief/actions/runs/36749126263);
`sonar-project.properties`; `artifacts/_local/ah-1.4-sonar-gate.log` 2026-09-30)

CI checkpoint `91b90c2`: E2E, Sonar Scan, clean install, migration drift і Vercel
успішні. Фінальний локальний `pr:check` теж зелений. Після push QA/wiki/test
потрібно звірити checks нового HEAD: цей checkpoint не підтверджує пізніші коміти.
(source: [E2E run 36749126315](https://github.com/sanchahous/ai-today-brief/actions/runs/36749126315);
`gh pr checks 382` 2026-09-30; `artifacts/_local/ah-1.4-pr-check-final.log`)

## Межі приймання

Full-page legacy QA й no-JS Suspense-обмеження AH-1.3 збережено як відкритий борг.
Category gate перевіряє контраст і гліфи змінених поверхонь; це не доказ виконання
zero-violation DoD для цілої сторінки. Візуальний підпис #377 не поширюється на
цей PR; merge AH-1.4 потребує окремого підпису власника.
(source: [AH-1.3 validation](after-hours-ah-1-3-validation.md#межі-qa);
[епік §0.1](after-hours-redesign-epic.md#01-definition-of-done--для-кожного-pr-епіку);
повідомлення власника 2026-09-30)

AH-1.7 / [#377](https://github.com/sanchahous/ai-today-brief/pull/377) змержено
в `e47010500d75f809182305692d7916f169611157`; E2E run
[36732521337](https://github.com/sanchahous/ai-today-brief/actions/runs/36732521337)
перевірено: **completed / success**, head `7240652`.
(source: `gh pr view 377`; `gh run view 36732521337` 2026-09-30)

## Related pages

- [Епік After Hours](after-hours-redesign-epic.md)
- [Handoff](after-hours-epic-handoff.md)
- [Токени](../architecture/design-system-tokens.md)
- [Now](../now.md)
