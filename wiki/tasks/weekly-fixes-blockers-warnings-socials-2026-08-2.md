# weekly-fixes-blockers-warnings-socials-2026-08-2

Summary: Статусний фрагмент weekly-fixes-blockers-warnings-socials-2026-08-2. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: weekly-fixes-blockers-warnings-socials-2026-08-2

## Status

### now.md

```verbatim
- **Weekly Fixes & blockers + warnings не тримають socials (2026-08-28), гілка
  `feat/weekly-fixes-blockers-tab`.** Жовті картки Master quality (`story_length`,
  `trust_attribution`, article трохи понад 3 000 слів) більше не є pipeline-гейтом:
  persist після `editorial_master` ставить Visuals/Social/PDF, якщо немає
  `issues[].blocker === true`; Approve quality — фінальне рішення і теж ставить ту
  саму чергу. Нова вкладка **Fixes & blockers** (одразу після Overview) має одну
  machine-кнопку; **Fix remaining issues** / retry / resume / regenerate прибрані з
  Research і з таблиці jobs. Coded blockers і Ship не ослаблені.
  (source: owner session 2026-08-28; [weekly-digest](pipeline/weekly-digest.md);
  [weekly-admin-runbook](ops/weekly-admin-runbook.md))
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
