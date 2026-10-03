# v5-1-concept-collapse-repair-2026-08-12-producti

Summary: Статусний фрагмент v5-1-concept-collapse-repair-2026-08-12-producti. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: v5-1-concept-collapse-repair-2026-08-12-producti

## Status

### now.md

```verbatim
- **v5.1 concept-collapse repair (2026-08-12):** production review Story 2/3/5 показав, що
  різні jury motifs відкидалися через semantic token mismatch, після чого fallback-и виглядали як
  один motif. Critic replacement також копіювався в усі три prompts. Тепер structural gates
  відділені від paid vision semantic review, а rejected critic direction використовується лише як
  jury feedback. (source: worker logs, Supabase artifact metadata 2026-08-12, `pipeline/card-image.ts`,
  `src/lib/content-sim/adapters/weekly-image.ts`, `generation-worker.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
