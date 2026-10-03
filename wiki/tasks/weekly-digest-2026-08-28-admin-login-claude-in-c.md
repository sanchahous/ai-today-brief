# weekly-digest-2026-08-28-admin-login-claude-in-c

Summary: Статусний фрагмент weekly-digest-2026-08-28-admin-login-claude-in-c. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: weekly-digest-2026-08-28-admin-login-claude-in-c

## Status

### now.md

```verbatim
- **Адмінка «зависає» на Weekly Digest — знайдено і виправлено (2026-08-28).** Власник
  повідомив: сайт і адмінка дуже довго вантажаться, терміново. Публічний сайт і
  `/admin/login` виявились швидкими ззовні; причину знайдено лише зайшовши в адмінку під
  реальною авторизованою сесією власника (Claude in Chrome) і покликавши по вкладках
  `/admin/weekly/[id]` — клік на Weekly Digest заморозив рендерер на 30+ секунд. Причина:
  6 із 9 вкладок (Research/Article/Visuals/Social/PDF/Video) віддавали ~1.3 МБ RSC-payload
  замість ~80 КБ, бо `GenerationJobsSection` передавала в `WeeklyGenerationJobsLive` **весь**
  нефільтрований jobs/attempts/events випуску, а не тільки job-типи цієї вкладки; той самий
  необмежений набір ще й опитувався кожні 5 секунд назавжди, навіть на давно опублікованих
  випусках. Фікс: фільтрація за job_type і на сервері (`weekly-workspace.tsx`), і в
  `generation-status` API, плюс адаптивний polling — 5с тільки поки щось активне, інакше 30с.
  (source: live check під owner-сесією 2026-08-28;
  [weekly-digest § Generation jobs panel](pipeline/weekly-digest.md#generation-jobs-panel-13-мб-нефільтрований-payload-на-6-вкладках-безумовний-5s-poll-2026-08-28))
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
