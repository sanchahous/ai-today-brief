# social-provider-ladder-bounded-end-to-end-2026-0

Summary: Статусний фрагмент social-provider-ladder-bounded-end-to-end-2026-0. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: social-provider-ladder-bounded-end-to-end-2026-0

## Status

### now.md

```verbatim
- **Social provider ladder bounded end-to-end (2026-08-17), гілка
  `codex/social-bounded-reasoning`.** Другий production recovery
  `1d255a95-d410-479e-9a6b-06d703dbee0d` лишався на Telegram без channel checkpoint понад
  13 хв. 180 s ceiling був per-model, тоді як кожен writer/critic call міг послідовно спробувати
  три моделі, а repair — три rounds. Social call тепер має максимум дві моделі, 60 s/model,
  30 s first token, 20 s idle, low reasoning і короткий role-specific output budget. Editorial
  master не змінений.
  (source: production Actions run `32057477211`, `src/lib/social/llm-router.ts`,
  `.github/workflows/weekly-master-cli-worker.yml`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
