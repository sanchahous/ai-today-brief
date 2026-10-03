# async-story-image-recovery-2026-08-11-production

Summary: Статусний фрагмент async-story-image-recovery-2026-08-11-production. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: async-story-image-recovery-2026-08-11-production

## Status

### now.md

```verbatim
- **Async story-image recovery (2026-08-11):** production v4 jobs підтвердили архітектурний
  конфлікт: Vercel poller запускав лише одну image job кожні 5 хв, а послідовні art-director
  calls/retry тричі досягли platform timeout рівно 300 с. `story_image` перенесено у fenced
  GitHub Actions backend; admin dispatch-ить її одразу, safety poll — batch до 10, різні stories
  мають per-job concurrency. Production rollout виявив ще один edge case: deploy не застосував DB
  migration, а ручний Regenerate створив нові jobs поруч зі старими retry/stale rows. Виправлена
  migration атомарно залишає одну winner-job на `revision_item_id`, скасовує старі як superseded,
  переводить winners без обриву живого lease і повертає їм durable attempts. Production migration
  `20260811183201` застосована; safety poll о 21:35 запустив рівно сім незалежних Actions workers
  на актуальні regenerate jobs, старі дублікати не dispatch-ились. (source: Vercel production
  runtime logs, Supabase queue snapshot і GitHub Actions runs `31523472069`…`31523483477`
  2026-08-11,
  `src/lib/weekly-digest/generation-control.ts`, `.github/workflows/weekly-master-cli-worker.yml`,
  `supabase/migrations/20260811183201_weekly_story_image_async_worker.sql`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
