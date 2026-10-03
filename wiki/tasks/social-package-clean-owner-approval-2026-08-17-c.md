# social-package-clean-owner-approval-2026-08-17-c

Summary: Статусний фрагмент social-package-clean-owner-approval-2026-08-17-c. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: social-package-clean-owner-approval-2026-08-17-c

## Status

### now.md

```verbatim
- **Social package clean і готовий до owner approval (2026-08-17), гілка
  `codex/clean-social-job-history`.** Final linked recovery
  `df663262-1481-4f31-af0b-35d21e42caa7` / Actions `32065312557` завершився `succeeded`: package
  та всі шість posts мають `in_review`, нуль blockers, versioned generated reviews збігаються з
  current content hashes. Старі failed attempts більше не заповнюють активну Social-вкладку:
  поточний/останній run лишається видимим, а superseded історія згорнута в нейтральний
  diagnostics block. Інші workspace tabs не змінені.
  (source: production DB live check 2026-08-17, Actions run `32065312557`,
  `src/components/admin/weekly-generation-jobs-live.tsx`,
  `src/lib/weekly-digest/generation-job-visibility.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
