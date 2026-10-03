# social-package-2026-08-17-codex-fix-social-linke

Summary: Статусний фрагмент social-package-2026-08-17-codex-fix-social-linke. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: social-package-2026-08-17-codex-fix-social-linke

## Status

### now.md

```verbatim
- **Social package падає після успішних шести каналів (2026-08-17), гілка
  `codex/fix-social-linkedin-document`.** Production `social_copy` job пройшов writer/critic
  для всіх шести каналів і зберіг 8 Instagram slides, але впав на старті LinkedIn document із
  `Cannot read properties of undefined (reading 'map')`. Причина: approved `article` artifact
  нормалізований (`editor_note`, `key_takeaways`) і не несе `stories`, а builder очікував
  `bundle.en.stories`. Патч відновлює stories із active revision і приймає обидві форми
  artifact; regression test відтворює production-shaped дані. Після мержу створити linked retry
  для terminal job — не шість окремих channel jobs.
  (source: production `weekly_digest_generation_jobs` / `weekly_digest_artifacts` live check
  2026-08-17; `src/lib/weekly-digest/generation-worker.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
