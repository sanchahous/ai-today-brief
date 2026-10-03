# social-router-reliability-follow-up-2026-08-17-c

Summary: Статусний фрагмент social-router-reliability-follow-up-2026-08-17-c. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: social-router-reliability-follow-up-2026-08-17-c

## Status

### now.md

```verbatim
- **Social router reliability follow-up (2026-08-17), гілка
  `codex/social-router-reliable-fallback`.** Bounded run `32059830080` швидко показав точний
  routing failure: default registry chain помилково виконувався як owner override з
  `deepseek-v4-pro`, потім social DeepSeek не дав first token за 30 s, а Qwen повернув HTTP 429;
  OpenAI mini був поза cap=2. Router тепер визнає лише реально збережений role chain і ставить
  current OpenAI mini writer lane першою, з bounded provider tail. Live probe з production DB і
  prompt 63 147 chars завершився через 1 507 ms (`first_token=921 ms`, no fallback). Повне
  social-provider exhaustion тепер retryable `provider_exhausted`, а не terminal `unknown`.
  (source: production Actions run `32059830080`, `src/lib/social/llm-router.ts`,
  `src/lib/weekly-digest/generation-control.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
