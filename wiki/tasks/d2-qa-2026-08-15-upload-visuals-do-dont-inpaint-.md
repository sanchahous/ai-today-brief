# d2-qa-2026-08-15-upload-visuals-do-dont-inpaint-

Summary: Статусний фрагмент d2-qa-2026-08-15-upload-visuals-do-dont-inpaint-. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: d2-qa-2026-08-15-upload-visuals-do-dont-inpaint-

## Status

### now.md

```verbatim
- **D2 — QA радить, не ремонтує (2026-08-15).** Після upload Visuals показує do/dont:
  впечений текст → inpaint/crop, не перегенеровувати; геометрія → той самий промпт;
  хибна теза → інший концепт. Авто-repair лишається лише на новинах. Вага гейта без змін.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) D2,
  `src/lib/weekly-digest/post-upload-qa.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
