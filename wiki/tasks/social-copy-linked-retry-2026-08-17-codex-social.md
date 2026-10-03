# social-copy-linked-retry-2026-08-17-codex-social

Summary: Статусний фрагмент social-copy-linked-retry-2026-08-17-codex-social. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: social-copy-linked-retry-2026-08-17-codex-social

## Status

### now.md

```verbatim
- **`social_copy` відновлюється поетапно через linked retry (2026-08-17), гілка
  `codex/social-step-checkpoints`.** Legacy job уже зберігав шість channel adaptations, але
  child читав лише власний `output`, тому ручний retry повторював усі writer/critic calls.
  Versioned state тепер проходить `retry_of_job_id` chain і зберігає окремо channel results,
  кожен Instagram slide, LinkedIn document, draft package та кожен post/generated review.
  Source hash не дає відновити copy на іншу approved revision; expiring signed URLs
  перевидаються без повторного render. Read-only prod query підтвердив legacy output keys і
  наявні durable social/artifact tables; нова міграція не потрібна. Тести: targeted 39/39,
  typecheck і scoped ESLint зелені. Два наступні live retries дійшли до LinkedIn render і
  впали на `8 pages; expected 7`: production standfirst має 1018 символів, а старий тест — 101.
  У цій самій гілці fixed-layout regions тепер мають bounded height/ellipsis, sources показують
  compact host із повним clickable URL, а production-sized regression підтверджує рівно 7
  сторінок. Цільові worker/PDF тести: 25/25.
  (source: `src/lib/weekly-digest/social-checkpoint.ts`,
  `src/lib/weekly-digest/generation-worker.ts`, `src/lib/weekly-digest/generation-control.ts`,
  `src/lib/weekly-digest/linkedin-document.ts`, прод-Supabase `mdiqfatpqczwqghwttpm` live check
  2026-08-17, Actions runs `32043513443` / `32044207908`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
