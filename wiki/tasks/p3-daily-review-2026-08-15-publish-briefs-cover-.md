# p3-daily-review-2026-08-15-publish-briefs-cover-

Summary: Статусний фрагмент p3-daily-review-2026-08-15-publish-briefs-cover-. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: p3-daily-review-2026-08-15-publish-briefs-cover-

## Status

### now.md

```verbatim
- **P3 — промпт обкладинки daily в review-чаті (2026-08-15).** Після publish пайплайн пише
  `briefs.cover_prompt` (один виклик `daily.cover_scene` на випуск: топ-3 заголовки + intro) і
  шле окреме Telegram-повідомлення з Canonical / Midjourney / Negative у `<pre>`. Картинку не
  рендерить. Картинки **новин** лишаються авто-FLUX. `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) P3,
  `pipeline/daily-cover-prompt.ts`, `pipeline/notify.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
