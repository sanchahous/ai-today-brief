# social-approval-boundary-owner-review-2026-08-17

Summary: Статусний фрагмент social-approval-boundary-owner-review-2026-08-17. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: social-approval-boundary-owner-review-2026-08-17

## Status

### now.md

```verbatim
- **Social approval boundary ремонтує канал до owner review (2026-08-17), гілка
  `codex/social-approval-ready`.** Production package був `in_review`, хоча всі 6 posts мали
  3–12 blocking checks: worker зберігав audit, але безумовно піднімав `draft → in_review`.
  Додатково critic бачив Instagram/Threads без нативних markers і приймав all-zero template як
  аудит. Тепер bounded candidate/repair loop зберігає тільки blocker-free adaptations, checkpoint
  відкидає старі blocked results, writer/critic мають той самий approved fact snapshot, а post
  repair версіонується in place. UI показує clean readiness; legacy details згорнуті в amber.
  Final production recovery `df663262…` / Actions `32065312557` пройшов `succeeded`; package і
  всі шість posts — clean `in_review`, без автоматичного approve.
  (source: `src/lib/weekly-digest/social-adapter.ts`,
  `src/lib/weekly-digest/social-checkpoint.ts`, `src/lib/weekly-digest/generation-worker.ts`,
  `src/components/admin/weekly-workspace.tsx`, production `social_posts` live check 2026-08-17)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
