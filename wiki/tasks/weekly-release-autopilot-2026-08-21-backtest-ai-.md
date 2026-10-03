# weekly-release-autopilot-2026-08-21-backtest-ai-

Summary: Статусний фрагмент weekly-release-autopilot-2026-08-21-backtest-ai-. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: weekly-release-autopilot-2026-08-21-backtest-ai-

## Status

### now.md

```verbatim
- **Weekly release autopilot (2026-08-21).** Backtest `ai-weekly-2026-08-09` показав:
  сайт вийшов на день +5, соц на +9, не через visuals, а через ~28 Approve і
  роз’їзд контрактів. Пайплайн тепер **machine-attest** артефакти з `gates_passed`
  (packs / quality лише без blocker / article / pdf / social / script / manifest);
  Approve з blocking `language_mechanics` заборонений; `suggestedFix` застосовується
  до quality; meta ≤160 на записі. Owner path: Hallucination board → 8 uploadів →
  shooting+YouTube → Ship. Соцслоти від `release_at`, не «наступний понеділок».
  GEO на сторінці: `NewsArticle` + FAQ + таблиця метрик.
  Review-pass того ж дня: attest-гейти SQL = гейтам owner-RPC (article теж перевіряє
  quality report), соц-attest ідемпотентний і не чіпає `publish_enabled`, Ship —
  атомарний RPC `ship_weekly_digest`, збої attest видимі в timeline (`attest_failed`),
  board `canShip` рахується за required-слотами preflight.
  (source: [audits/2026-08-21-weekly-digest-release-backtest](audits/2026-08-21-weekly-digest-release-backtest.md),
  [weekly-admin-runbook](ops/weekly-admin-runbook.md))
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
