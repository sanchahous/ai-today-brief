# ATB-66

Summary: Статусний фрагмент ATB-66. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: atb-66

## Status

### now.md

```verbatim
- **ATB-66: конфігурований порт e2e через `PORT` (2026-10-02), [PR #401](https://github.com/sanchahous/ai-today-brief/pull/401).** `playwright.config.ts` і `scripts/e2e-affected.ts` беруть `http://127.0.0.1:${PORT}` (default 3000); consent storage і `header-layout` теж узгоджені з `baseURL` (`consentStorageState` у `scripts/e2e-server-url.ts`, відносний `/uk/news`). `E2E_BASE_URL` вимикає вбудований `webServer`. Документація — [ops/e2e-local](ops/e2e-local.md). (source: ATB-66; review fix T1-f1)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
