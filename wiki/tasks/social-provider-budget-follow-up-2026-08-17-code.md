# social-provider-budget-follow-up-2026-08-17-code

Summary: Статусний фрагмент social-provider-budget-follow-up-2026-08-17-code. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: social-provider-budget-follow-up-2026-08-17-code

## Status

### now.md

```verbatim
- **Social provider budget follow-up (2026-08-17), гілка
  `codex/social-provider-budget`.** Перший live recovery на approval-ready boundary лишався на
  Telegram без checkpoint понад 12 хв: social call успадкував 720 s editorial-master ceiling,
  а adapter міг аудіювати до дев'яти кандидатів. Для `social_copy` ceiling тепер 180 s / first
  token 45 s / idle 30 s; кожен із максимум трьох repair rounds аудіює один найкращий candidate.
  Інші job types не змінені.
  (source: production job `ee0d727e-6e43-48be-b147-d759c25717a7`, Actions run `32054964740`,
  `.github/workflows/weekly-master-cli-worker.yml`, `src/lib/weekly-digest/social-adapter.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
