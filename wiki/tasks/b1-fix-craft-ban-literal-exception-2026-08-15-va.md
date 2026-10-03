# b1-fix-craft-ban-literal-exception-2026-08-15-va

Summary: Статусний фрагмент b1-fix-craft-ban-literal-exception-2026-08-15-va. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: b1-fix-craft-ban-literal-exception-2026-08-15-va

## Status

### now.md

```verbatim
- **B1-fix craft-ban literal exception (2026-08-15).** `validateMetaphorPitch` більше не
  відхиляє pitch за словом зі списку craft-cliché, якщо це слово вже є в новині
  (`storyContext` / `mechanism` / entities). Голий `terminal` дозволений і коли джерело каже
  `command line` / `CLI` — інакше story про командний рядок неможливо було описати, усі три
  лінзи падали в fallback. `terminal window` і `glowing brain` лишаються забороненими навіть
  на CLI-новині. Наступне за планом — B2 (не добивати кількість трьома однаковими фолбеками).
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) B1-fix,
  `pipeline/card-image.ts`, `experiments/jury-blockers/2026-08-digest-843975a8.md`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
