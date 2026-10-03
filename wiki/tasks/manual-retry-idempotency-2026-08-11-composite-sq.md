# manual-retry-idempotency-2026-08-11-composite-sq

Summary: Статусний фрагмент manual-retry-idempotency-2026-08-11-composite-sq. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: manual-retry-idempotency-2026-08-11-composite-sq

## Status

### now.md

```verbatim
- **Manual retry idempotency (2026-08-11):** аварійний composite SQL-виклик manual-retry RPC
  повторно обчислив volatile function для кожної з 32 колонок job і створив 32 children одного
  terminal `story_image`. 31 duplicate child скасовано (22 до dispatch, 9 GitHub runs після
  dispatch), один канонічний retry продовжив роботу. Production migration `20260811185251`
  серіалізує retry по source-row lock, повертає вже live/succeeded child і додає partial unique
  index для активного child; повторний клік/виклик більше не створює паралельні копії. (source:
  owner incident report і production Supabase/GitHub snapshot 2026-08-11,
  `supabase/migrations/20260811185251_weekly_manual_retry_idempotency.sql`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
