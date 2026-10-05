# AH-5.10

Summary: Реалізовано Toolbox-хаб (bench-hero, лічильники з масивів правил, картки інструментів із прев'ю, кроки, порівняльна таблиця, FAQ) та ToolWorkspaceTemplate. Лічильники правил і цитат підтверджено unit-тестами; маршрут додано в a11y-gating; pr:check зелений.
Sources: перенос зі спільних списків, ATB-67, PR #405; локальні перевірки 2026-10-05; [PR #428](https://github.com/sanchahous/ai-today-brief/pull/428)
Last updated: 2026-10-05

---

Task: ah-5.10

## Status

DONE — реалізація хабу інструментів `/[lang]/tools` та `ToolWorkspaceTemplate` завершена. (source: локальні перевірки 2026-10-05; [PR #428](https://github.com/sanchahous/ai-today-brief/pull/428))

PR: https://github.com/sanchahous/ai-today-brief/pull/428

## AC verification

- [x] **Лічильники правил і цитат дорівнюють довжинам масивів у коді (unit-тест):**
  - `src/lib/prompt-lint-rules.ts`: експортовано `PROMPT_LINT_RULES` (13) та `PROMPT_LINT_CITATIONS` (2).
  - `src/lib/settings-builder-rules.ts`: експортовано `SETTINGS_BUILDER_RULES` (25) та `SETTINGS_BUILDER_CITATIONS` (5).
  - `src/lib/claude-md-rules.ts`: створено `CLAUDE_MD_RULES` (10) та `CLAUDE_MD_CITATIONS` (5).
  - `src/content/tools.ts`: `rulesCount` і `citationsCount` для кожного інструмента обчислюються як `.length` відповідних масивів у коді. Загальні лічильники на панелі hero — сума по трьох інструментах (48 правил, 12 цитат).
  - `src/content/tools.test.ts` перевіряє строгу рівність лічильників довжинам масивів. (source: `src/content/tools.test.ts`, `src/lib/claude-md-rules.test.ts`)
- [x] **CollectionPage + ItemList JSON-LD без регресій; маршрут у gating-режимі:**
  - `src/app/[lang]/tools/page.tsx` містить `@graph` з `CollectionPage`, `ItemList` (включаючи `ListItem` для кожного інструмента), та `BreadcrumbList`. Базові типи з baseline `CollectionPage` та `Organization` збережено без регресій.
  - `e2e/fixtures/a11y-gating.json` доповнено маршрутами `tools` (`/en/tools`) та `tools-uk` (`/uk/tools`). (source: `src/app/[lang]/tools/page.tsx`, `e2e/fixtures/a11y-gating.json`)

## Handoff

Реалізовано хаб `/[lang]/tools` з After Hours естетикою: bench-hero з privacy promise, bench-panel із 4 фактами з коду, сітка карток із прев'ю, секція «Як працює кожна утиліта» (3 кроки), таблиця вибору інструментів та FAQ з посиланням на `mailto:${CONTACT_EMAIL}`. Створено `ToolWorkspaceTemplate` (із аліасом `LocalToolShell`) для наступної задачі AH-5.11 (робочі простори окремих утиліт).

## Log

- 2026-10-05: реалізовано AH-5.10; експортовано масиви правил і цитат; додано `claude-md-rules.ts`; оновлено `tools.ts`, `i18n.ts`, `tool-card.tsx`, `tool-workspace.tsx`, `tools/page.tsx`; додано маршрути в `a11y-gating.json`. (source: локальний diff)

## Історичний запис

### epic-5.3

```verbatim
| AH-5.10 | Toolbox-хаб і ToolWorkspaceTemplate | M | агент | AH-5.1, AH-2.3 | route `tools` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
