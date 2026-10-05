# AH-5.11

Summary: Три робочі простори утиліт перенесені на `ToolWorkspaceTemplate` з Field family, станами draft/ready/copied/export-error і server-rendered каталогами правил. T1-f1: виправлено axe `link-in-text-block` на citation links і фокус на першому невалідному полі.
Sources: [PR #431](https://github.com/sanchahous/ai-today-brief/pull/431); локальні перевірки 2026-10-05
Last updated: 2026-10-05

---

Task: ah-5.11

## Status

DONE — три утиліти (`prompt-optimizer`, `settings-builder`, `claude-md-generator`) використовують `ToolWorkspaceTemplate`, Field family, read-only output і copy лише після валідного результату. T1-f1 repair: citation links з underline (як `markdown-body`), `focusFirstInvalid` через `useEffect` після `aria-invalid`, e2e-селектори scoped до output panel. (source: локальні перевірки 2026-10-05; [PR #431](https://github.com/sanchahous/ai-today-brief/pull/431))

PR: https://github.com/sanchahous/ai-today-brief/pull/431

## AC verification

- [x] **Network-assertion:** `e2e/tools-workspace.spec.ts` — 0 запитів із введеним текстом і 0 сторонніх доменів поза аналітикою для кожної утиліти під час lint/build/generate.
- [x] **Каталоги в HTML без JS:** fetch-тест у `e2e/tools-workspace.spec.ts` перевіряє `prompt-rules` + rule id і `settings-catalog` + hook recipe id у сирому HTML.
- [x] **`tool-telemetry.ts` counts/enums-only:** логіка не змінювалась; `src/lib/tool-telemetry.test.ts` зелений. WebApplication JSON-LD збережено в `page.tsx` кожної утиліти.
- [x] **Помилки прив'язані до полів:** `Textarea`/`TextInput` з `aria-describedby` + `FieldError role="alert"`; `focusFirstInvalid` після commit через `useEffect` (e2e-тест для prompt optimizer).

## Checks

- `PORT=3100 npm run pr:check` — зелений (T1-f1 repair, 2026-10-05).
- Цільові: `npx playwright test e2e/tools-workspace.spec.ts` (5/5), `npx playwright test e2e/a11y-layout-matrix.spec.ts -g "tools-"` (84/84 chromium).

## Handoff

Оркестратор: commit усі зміни разом із цим файлом, push до `feat/ah-5.11-tool-workspaces`, оновити draft PR #431. Pre-push a11y-matrix падав на `link-in-text-block` через `text-accent hover:underline` на citation links у server catalogs — потрібен постійний underline (`markdown-body` pattern). `focusFirstInvalid` синхронно в submit handler не працює до React commit; використовуй `useEffect` на error state (як `ds-catalog/field-catalog.tsx`).

## Log

- 2026-10-05: реалізовано AH-5.11 — `ToolWorkspaceTemplate` для трьох утиліт, `tool-workspace-output.tsx`, Field family inputs, build/generate gates, server catalogs у `catalogSlot`, `e2e/tools-workspace.spec.ts`, i18n EN/UK. (source: локальний diff)
- 2026-10-05 (T1-f1): citation link underline у `rule-catalog.tsx`, `settings-catalog.tsx`, client finding cards; `useEffect` focus fix; e2e locator scoping для output panel і field alert.

## Історичний запис

### epic-5.3

```verbatim
| AH-5.11 | Три робочі простори утиліт | M | агент | AH-5.10 | routes `tool`, `settings`, `instructions` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
