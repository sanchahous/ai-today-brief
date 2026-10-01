# AH-2.3: поля — реалізація й докази

Summary: Field, Textarea, SegmentedControl і Switch, рестайл Input/Select/Checkbox/Radio та локалізація наявного SearchInput. Каталог показує двомовну матрицю станів; окремий візуальний підпис і full-page legacy DoD лишаються відкритими.
Sources: `src/components/ui/`; `src/lib/ui/field-a11y.ts`; `src/app/ds-catalog/field-catalog.tsx`; `e2e/fields.spec.ts`; `artifacts/after-hours/qa/ah-2.3-evidence.json`; `artifacts/after-hours/qa/capture-catalog-ah-2.3.mjs`; GitHub checks PR #387 2026-10-01; live production HTTP 2026-10-01.
Last updated: 2026-10-01

---

## Стан

Реалізовано в [PR #388](https://github.com/sanchahous/ai-today-brief/pull/388) на гілці `feat/ah-2.3-fields` від `origin/main` `c03a4dd` (merge AH-2.2 / #387). Combobox і SearchInput не дубльовано: SearchInput лишився в `input.tsx`, отримав `lang` для placeholder і назви кнопки очищення. (source: [PR #388](https://github.com/sanchahous/ai-today-brief/pull/388); картка [AH-2.3](after-hours-redesign-epic.md#ah-23--поля-field-input-searchinput-textarea-select-checkbox-radio-segmentedcontrol-switch))

#387 змерджено в `c03a4dd`. Playwright ревізії `9e65c3b` ([run 36837592359](https://github.com/sanchahous/ai-today-brief/actions/runs/36837592359)) і push на main ([run 36837852364](https://github.com/sanchahous/ai-today-brief/actions/runs/36837852364)) завершились success. Sonar, dependencies, migration drift і Vercel на PR були success ще до завершення Playwright. Це не візуальний підпис #387 і не закриває UK/CLS/H1/legacy AC чи G1. (source: `gh pr view 387`; `gh run view` 2026-10-01)

## Реалізація

`Field` складає Label, Hint і ErrorText. Hint лишається видимим разом із помилкою; обидва id входять в `aria-describedby`. Межа контрола — `--line-strong`, фокус — `--focus` 2px / offset 3px. Textarea, Select і TextInput ділять цю рамку. Select не ховає видимий `label` на вузькій ширині. На News сортування й далі має зовнішній sr-only label — це споживач до AH-4.3, не новий прихований підпис компонента. (source: `field.tsx`; `input.tsx`; `textarea.tsx`; `select.tsx`; `src/components/news/news-feed.tsx`)

SegmentedControl і RadioGroup — `radiogroup` з нативними radio і стрілками. Switch — `role="switch"` і `aria-checked`; Space перемикає. Checkbox має рядок із гліфом категорії та `Intl.NumberFormat(lang)` для лічильника. Цілі checkbox/radio/switch — мітка не нижче `--touch-target-min`; текстові поля — `--control-md` (44px); сегменти й кнопка очищення піднімаються до 44px на coarse pointer і нижче 60rem. (source: `segmented.tsx`; `radio.tsx`; `switch.tsx`; `checkbox.tsx`; `fields.module.css`)

Каталог `/ds-catalog` показує EN/UK і стани default / focus / invalid / disabled / read-only для Input, Textarea, Select, Search, Checkbox, Radio, SegmentedControl і Switch. Приклад форми після submit фокусує перше поле з `aria-invalid`. Нових кольорових токенів і залежностей немає; контраст-гейт лишається 222 пари. (source: `src/app/ds-catalog/field-catalog.tsx`; `src/lib/design-system/tokens.ts`)

## Перевірки

- Проти локального `next dev` на `localhost:3107`: Chromium `e2e/fields.spec.ts` — 30 passed. Firefox і WebKit — keyboard, focus-invalid і axe на 390 для EN/UK Night/Day — passed. Scoped axe каталогу 0, горизонтального overflow 0, тексту нижче 12px 0. (source: прогін 2026-10-01; `e2e/fields.spec.ts`)
- Unit `field-a11y` passed. `npm run pr:check` — EXIT=0 (231 test files, verify-logic-lcov 15 files, wiki-lint 0 errors, build:ci). (source: `artifacts/_local/ah-2.3-pr-check.log`)

## Візуальний review

[Локальна галерея](../../artifacts/after-hours/qa/ah-2.3-review.html): 8 знімків каталогу. PNG у git-ignored `artifacts/_local/ah-2-3-catalog`, SHA-256 у manifest і [evidence receipt](../../artifacts/after-hours/qa/ah-2.3-evidence.json). Окремий підпис очікується. Публічний report на 140 сценаріїв для рестайлу Select на News у цій задачі не знімався; legacy axe/clipping і G1 не вважаються закритими. (source: `capture-catalog-ah-2.3.mjs`; manifest 2026-10-01)

## Production freshness

Перевірка production 2026-10-01 після merge #387, до цього PR: RSS newest `Wed, 30 Sep 2026`; `news-sitemap.xml` publication_date `2026-10-01`; `/en/news` Updated September 30, 2026. Це той самий baseline, не старіший знімок. (source: live HTTP `https://aitodaybrief.com/rss.xml`, `news-sitemap.xml`, `/en/news` 2026-10-01)

Наступна задача за нумерацією епіку — **AH-2.4** (оверлеї). AH-2.2 уже в main, тож залежність AH-2.4 від неї виконана. (source: [епік §5.3](after-hours-redesign-epic.md#53-зведена-таблиця-задач))

## Related pages

- [after-hours-redesign-epic](after-hours-redesign-epic.md) — картка й AC
- [after-hours-epic-handoff](after-hours-epic-handoff.md) — актуальний порядок
- [after-hours-ah-2-2-validation](after-hours-ah-2-2-validation.md) — попередня задача, змерджена в #387
