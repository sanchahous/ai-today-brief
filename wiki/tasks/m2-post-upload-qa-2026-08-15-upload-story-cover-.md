# m2-post-upload-qa-2026-08-15-upload-story-cover-

Summary: Статусний фрагмент m2-post-upload-qa-2026-08-15-upload-story-cover-. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: m2-post-upload-qa-2026-08-15-upload-story-cover-

## Status

### now.md

```verbatim
- **M2 — post-upload QA попереджає, не блокує (2026-08-15).** Після upload story/cover
  `after()` ганяє image-only critic (без headline/scene) і пише `metadata.post_upload_qa`.
  Visuals: «QA чисто» або жовтий рядок + Ігнорувати / Замінити файл.
  `contentSimCleared` для ручних файлів лишається `undefined` — `simulation_not_passed` не
  спрацьовує. `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) M2,
  `src/lib/weekly-digest/post-upload-qa.ts`, `src/app/admin/(cms)/weekly/actions.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
