# cancel-future-posts-today-multi-select-2026-08-2

Summary: Статусний фрагмент cancel-future-posts-today-multi-select-2026-08-2. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: cancel-future-posts-today-multi-select-2026-08-2

## Status

### now.md

```verbatim
- **Cancel future posts зі списку Today, з multi-select (2026-08-21).**
  На `/admin` черга за замовчуванням показує **Daily**. Weekly (і інші kind)
  ховаються, доки не обереш фільтр; **Select all** діє лише на видимі картки.
  Confirm називає kind і окремо попереджає, якщо в виділенні є weekly digest.
  (source: `src/components/admin/package-queue-list.tsx`,
  `src/lib/social/package-queue.ts`, [social-cms-runbook](ops/social-cms-runbook.md))
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
