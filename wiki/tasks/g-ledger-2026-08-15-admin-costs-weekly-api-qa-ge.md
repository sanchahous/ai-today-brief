# g-ledger-2026-08-15-admin-costs-weekly-api-qa-ge

Summary: Статусний фрагмент g-ledger-2026-08-15-admin-costs-weekly-api-qa-ge. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: g-ledger-2026-08-15-admin-costs-weekly-api-qa-ge

## Status

### now.md

```verbatim
- **G — бюджет ілюстрацій з ledger (2026-08-15).** `/admin/costs` ділить новини / weekly API /
  промпти+QA з `generation_cost_events`, не з лімітів політики. Weekly image API має бути $0
  у `prompt_only`. `CONTENT_SIM_MAX_IMAGE_SPEND_USD=0.2` не піднімається. `WEEKLY_CONTENT_STUDIO_V2=off`
  без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) G,
  `src/lib/generation-costs.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
