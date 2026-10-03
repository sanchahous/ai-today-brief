# m1-weekly-story-cover-flux-2026-08-15-weekly-sto

Summary: Статусний фрагмент m1-weekly-story-cover-flux-2026-08-15-weekly-sto. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: m1-weekly-story-cover-flux-2026-08-15-weekly-sto

## Status

### now.md

```verbatim
- **M1 — weekly story/cover більше не рендерять FLUX (2026-08-15).** Дефолт
  `WEEKLY_STORY_IMAGE_MODE=prompt_only`: `story_image` без `source_url` і `cover` пишуть
  `story_prompt_set` (essence + концепти + `prompt-export`) і завершуються
  `succeeded` + `needs_owner_review`. Гілка `source_url` лишається ingest. `render`
  повертає старий FLUX + vision loop. `story_image` лишається на GitHub Actions.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін. Картинки **новин** далі на авто-FLUX.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) M1,
  `src/lib/weekly-digest/story-prompt-job.ts`, `src/lib/weekly-digest/generation-worker.ts`,
  `.env.example`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
