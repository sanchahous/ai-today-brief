# f3-rerank-openrouter-2026-08-15-job-llm-model-ra

Summary: Статусний фрагмент f3-rerank-openrouter-2026-08-15-job-llm-model-ra. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: f3-rerank-openrouter-2026-08-15-job-llm-model-ra

## Status

### now.md

```verbatim
- **F3 — добовий rerank OpenRouter (2026-08-15).** Job раз на добу пише `llm_model_rank_audit`
  і оновлює чергу `openrouter` топ-3 `weekly.master_writer`, якщо якість не впала >5 пунктів.
  Live-каталог на кожен виклик не ходиться. `/admin/providers` показує latest pick на роль.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) F3,
  `pipeline/providers/model-rerank.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
