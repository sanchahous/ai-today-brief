# malformed-social-writer-response-falls-through-i

Summary: Статусний фрагмент malformed-social-writer-response-falls-through-i. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: malformed-social-writer-response-falls-through-i

## Status

### now.md

```verbatim
- **Malformed Social writer response falls through in-provider (2026-08-17), гілка
  `codex/social-candidate-fallback`.** Production run `32061374498` підтвердив здоровий routing:
  OpenAI mini writer 6 s, Terra critic 13 s. Другий repair writer повернув JSON без двох
  `<CANDIDATE>`; check стояв після provider cascade і завершив job. Candidate contract тепер є
  частиною response validator, тому malformed model response переходить на наступну модель.
  (source: production Actions run `32061374498`,
  `src/lib/weekly-digest/social-adapter.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
