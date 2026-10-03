# rebuild-selection-2026-08-16-overview-owner-only

Summary: Статусний фрагмент rebuild-selection-2026-08-16-overview-owner-only. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: rebuild-selection-2026-08-16-overview-owner-only

## Status

### now.md

```verbatim
- **Кнопка «Rebuild selection» (2026-08-16).** Overview → owner-only перезбір відбору
  поточним селектором по тому самому тижню + seed історій з денних айтемів; нова активна
  ревізія через новий RPC `rebuild_weekly_digest_selection` (міграція `20260816120000`,
  **застосована до прода 2026-08-16**, `service_role` only, перевірена викликом у транзакції
  з відкатом). Руйнівна за задумом: `in_review` + скидання всіх апрувів; стара ревізія
  лишається і відновлюється через Restore. Перевірено наскрізь на **тестовому** випуску
  `ai-weekly-test-2026-07-24` (34 кандидати → 24 eligible → 7, ревізія 3, 4 нові / 4 вибули,
  усі 5 полів заповнені у всіх 7 історіях). Прод-випуск `6cbcf0b3` **не чіпав** — його
  перезбирає власник кнопкою.
  (source: `src/lib/weekly-digest/rebuild-selection.ts`,
  `supabase/migrations/20260816120000_weekly_rebuild_selection.sql`, live run 2026-08-16)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
