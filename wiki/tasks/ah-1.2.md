# AH-1.2

Summary: Статусний фрагмент AH-1.2. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-1.2

## Status

### now.md

```verbatim
- **AH-1.2 (контраст-гейт 2.0) — реалізовано, PR #384 (2026-09-30), без видимих змін.**
  222 пари замість 158, 0 провалів, найнижчі категорії Night 6,41:1 / Day 5,22:1; сім токенів прототипу
  (`--accent-hover`, `--accent-fill`, `--accent-fill-hover`, `--velvet-deep`, `--on-velvet`, `--selection-bg`,
  `--selection-text`) додано для пар; будь-яка пара нижче порогу валить `pr:check`. Гейт G1 чекає відкритих AC AH-1.5 і підпису власника.
  (source: `scripts/check-design-tokens.ts`; `npm run tokens:check` 2026-09-30)
```

### epic-5.3

```verbatim
| AH-1.2 | ✅ Контраст-гейт 2.0: 222 пари, 0 провалів, мінімум категорій 6,41 / 5,22; реалізовано в [PR #384](https://github.com/sanchahous/ai-today-brief/pull/384), без видимих змін | — | — | AH-1.4 ✅ | G09 (UI-пари) |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
