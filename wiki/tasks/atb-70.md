# ATB-70

Summary: Статусний фрагмент ATB-70 — включення scripts/e2e-affected.test.mjs у гейт pr:check.
Sources: завдання ATB-70; [PR #416](https://github.com/sanchahous/ai-today-brief/pull/416)
Last updated: 2026-10-04

---

Task: atb-70

## Status

```verbatim
- **ATB-70: включено `scripts/e2e-affected.test.mjs` у перевірку `pr:check` (2026-10-04), [PR #416](https://github.com/sanchahous/ai-today-brief/pull/416).** Тест відмови від виконання broad-змін при запущеному сервері без використання системних команд завершення процесів (exit 1, zero spawnSync) додано до виклику `node --test` у скрипті `pr:check` в `package.json`.
```

## Log

- 2026-10-04 — додано `scripts/e2e-affected.test.mjs` до виклику `node --test` у складі `npm run pr:check` (`package.json`), щоб зберегти перевірку безпечного завершення процесів на гейті перед здачею. (source: [PR #416](https://github.com/sanchahous/ai-today-brief/pull/416))

## Next

Наступна задача епіку — AH-4.5 (Гейт News vertical slice).
