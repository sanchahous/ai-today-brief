# start-retry-content-studio-succeeded-2026-08-16-

Summary: Статусний фрагмент start-retry-content-studio-succeeded-2026-08-16-. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: start-retry-content-studio-succeeded-2026-08-16-

## Status

### now.md

```verbatim
- **Кнопка Start / retry Content Studio знову ставить паки після succeeded (2026-08-16),
  гілка `fix/weekly-content-studio-retry`.** Живий клік 16.08 12:46 UTC на
  `ai-weekly-2026-08-09` rev.3 записав `generation_queued`, але RPC повернув уже
  `succeeded`/`waiting` рядки: ключ
  `weekly-content-studio-v2.1:{digest}:{rev}:research:{item}` незмінний, а
  `queue_weekly_digest_generation_job` скидає лише `failed`/`cancelled`. Кнопка тепер
  викликає `retryWeeklyContentStudio`: нові jobs з `:retry:{uuid}`, in-flight слоти
  пропускає, waiting `editorial_master` не дублює. Composer лишає стабільний ключ.
  Після деплою натиснути кнопку на rev.3 — **не** Rebuild selection. Треба знову
  Approve трьох паків.
  (source: прод `weekly_digest_generation_jobs` live check 2026-08-16 12:46 UTC,
  `src/lib/weekly-digest/orchestrator.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
