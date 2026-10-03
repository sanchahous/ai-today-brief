# social-critic-flags-score-boundary-2026-08-17-co

Summary: Статусний фрагмент social-critic-flags-score-boundary-2026-08-17-co. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: social-critic-flags-score-boundary-2026-08-17-co

## Status

### now.md

```verbatim
- **Social critic flags поважають score boundary (2026-08-17), гілка
  `codex/social-critic-threshold`.** Production recovery зберіг Telegram і X checkpoints, але
  Threads тричі ремонтувався й завершився лише з `critic_flag`, без `critic_score` або
  `platform_fit`: будь-яке critic-зауваження помилково блокувало навіть dimension score 85+.
  Passing factual/platform flags тепер warnings; blocking і repair лишаються тільки для score
  нижче 85. Terminal quality exhaustion має code `quality_gate` і точні blocker messages.
  (source: production job `dc11b12f-58db-4944-8284-e3d646153e4c`, Actions run `32062624113`,
  `src/lib/weekly-digest/social-adapter.ts`, `src/lib/weekly-digest/generation-control.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
