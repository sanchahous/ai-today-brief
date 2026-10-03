# AH-1.6

Summary: Статусний фрагмент AH-1.6. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-1.6

## Status

### now.md

```verbatim
- **AH-1.6 (простір, форма, глибина, шари, рух, фокус, брейкпоінти) — змерджено, PR #381 (`55b78dc`, 2026-09-30); візуальний підпис власника отримано.**
  Токени в `tokens.ts` і `globals.css` під drift-гейтом; реєстр усіх токенів — `design-system-tokens` §7
  (відсутній запис валить `pr:check`). `--header-h` лишається 60px до AH-3.3. Візуально змінилося:
  радіус `md` 6→8px, тіні (`--shadow-1` / `--shadow-pop`), фокус (`--focus`, відступ 3px), кільце в
  полях розсилки й hero-search. Нові gate-и: `e2e/focus-visible.spec.ts`, docs-аудит токенів.
  AH-1.4 (кольори категорій) інтегровано через PR #382: `--cat-*` / `--art-*` внесено в реєстр §7.1.1
  після злиття гілок. Поточна задача фази 2 — у блоці стану вище; відкриті UK AC AH-1.5 збережено в її validation.
  (source: `src/lib/design-system/tokens.ts`, `scripts/check-design-tokens.ts`, `e2e/focus-visible.spec.ts`;
  повний Chromium-набір 192 passed / 0 failed 2026-09-30)
```

### epic-5.3

```verbatim
| AH-1.6 | ✅ Простір, форма, глибина, шари, брейкпоінти, motion-токени, фокус: змерджено в [PR #381](https://github.com/sanchahous/ai-today-brief/pull/381) (`55b78dc`, підпис власника отримано 2026-09-30); `--header-h` лишається 60px до AH-3.3 | — | — | D5 ✅ | G09 (простір, форма, глибина, рух), B13 (токени й контракт e2e) |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
