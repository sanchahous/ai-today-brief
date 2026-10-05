# AH-5.11

Summary: Три робочі простори утиліт перенесені на `ToolWorkspaceTemplate` з Field family, станами draft/ready/copied/export-error і server-rendered каталогами правил.
Sources: [PR #431](https://github.com/sanchahous/ai-today-brief/pull/431); локальні перевірки 2026-10-05
Last updated: 2026-10-05

---

Task: ah-5.11

## Status

DONE — три утиліти (`prompt-optimizer`, `settings-builder`, `claude-md-generator`) використовують `ToolWorkspaceTemplate`, Field family, read-only output і copy лише після валідного результату. (source: локальні перевірки 2026-10-05; [PR #431](https://github.com/sanchahous/ai-today-brief/pull/431))

PR: https://github.com/sanchahous/ai-today-brief/pull/431

## AC verification

- [x] **Network-assertion:** `e2e/tools-workspace.spec.ts` — 0 запитів із введеним текстом і 0 сторонніх доменів поза аналітикою для кожної утиліти під час lint/build/generate.
- [x] **Каталоги в HTML без JS:** fetch-тест у `e2e/tools-workspace.spec.ts` перевіряє `prompt-rules` + rule id і `settings-catalog` + hook recipe id у сирому HTML.
- [x] **`tool-telemetry.ts` counts/enums-only:** логіка не змінювалась; `src/lib/tool-telemetry.test.ts` зелений. WebApplication JSON-LD збережено в `page.tsx` кожної утиліти.
- [x] **Помилки прив'язані до полів:** `Textarea`/`TextInput` з `aria-describedby` + `FieldError role="alert"`; `focusFirstInvalid` на submit без валідного вводу (e2e-тест для prompt optimizer).

## Checks

- `PORT=3100 npm run pr:check` — зелений (оркестратор/агент, 2026-10-05).

## Handoff

Оркестратор: commit усі зміни разом із цим файлом, push до `feat/ah-5.11-tool-workspaces`, оновити draft PR #431. Нові маршрути додані в `e2e/fixtures/a11y-gating.json` (6 entries EN/UK). Якщо a11y-matrix падає — перевірити `min-h-[44px]` на submit/copy кнопках і контраст на `bg-stage` у workbench panels.

## Log

- 2026-10-05: реалізовано AH-5.11 — `ToolWorkspaceTemplate` для трьох утиліт, `tool-workspace-output.tsx`, Field family inputs, build/generate gates, server catalogs у `catalogSlot`, `e2e/tools-workspace.spec.ts`, i18n EN/UK. (source: локальний diff)

## Історичний запис

### epic-5.3

```verbatim
| AH-5.11 | Три робочі простори утиліт | M | агент | AH-5.10 | routes `tool`, `settings`, `instructions` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
