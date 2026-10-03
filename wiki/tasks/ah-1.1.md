# AH-1.1

Summary: Статусний фрагмент AH-1.1. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-1.1

## Status

### now.md

```verbatim
- **Епік реалізації редизайну After Hours готовий до виконання (2026-09-29), PR
  [#370](https://github.com/sanchahous/ai-today-brief/pull/370).** [product/after-hours-redesign-epic](product/after-hours-redesign-epic.md):
  54 сабтаски (після ADR — 56) у 8 фазах (контракти → foundations → бібліотека → chrome → News slice → шаблони →
  рух → валідація) з гейтами G0–G7 і acceptance criteria. Епік звірено з PR #369 (`main` @
  `3f47256`): AH-1.1 (токени 2.0) і AH-2.1 (каталог `/ds-catalog`) уже виконані, ще 9 задач —
  частково, їхній залишок описано в картках. Відкритими лишаються, зокрема, атрибут `data-theme`,
  шрифти `next/font/local`, кольори категорій із БД (8 `.theme-light .cat-*`-хаків), брейкпоінти
  960 px і бренд-знак. У тому ж PR — hotfix B8: з `/news` прибрано захардкожений «Recent
  highlights» (`news.summaryTitle` / `news.weekSummary`, EN і UK) з неперевіреними твердженнями
  про релізи й «70%+» економії. **Рішення власника 2026-09-29:** D1 — foundations глобально, шаблони по
  одному після пілота News; D3 — `next/font/local`; D4 — Georgia для українських заголовків на
  запуск; D5 — брейкпоінти прототипу, header і фільтри перемикаються на 960 px; D12 —
  usability-сесії пропущено (#369). Решту рішень ухвалено того ж дня — див. пункт вище.
  (source: [after-hours-redesign-epic](product/after-hours-redesign-epic.md) §2, §4; grep `src/` 2026-09-29 після rebase на `3f47256`)
```

### handoff

```verbatim
- **G0 і фаза 0 завершені:** #373–#376 інтегровані, GA4/Tag Assistant/CWV baseline вже прийняті. AH-1.1 / AH-2.1 — #369; AH-1.3 — #378; AH-1.7 — #377; AH-1.4 — #382; AH-1.2 — #384; AH-1.6 — #381, його окремий підпис отримано. Не дублювати й не просити G0 повторно. (source: [епік §5.3](after-hours-redesign-epic.md#53-зведена-таблиця-задач); [baseline](../analytics/2026-09-29-redesign-baseline.md))
```

### epic-5.3

```verbatim
| AH-1.1 | ✅ Токени 2.0 — одне джерело правди (#369) | — | — | — | G09, G10, B1, B2 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
