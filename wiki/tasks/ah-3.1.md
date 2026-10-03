# AH-3.1

Summary: Статусний фрагмент AH-3.1. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-3.1

## Status

### now.md

```verbatim
- **ATB-22 (AH-3.1), ATB-23 (AH-3.2) і ATB-27 (AH-3.6) ще в waiting/approval** на запитах merge, відкритих до ATB-64. Нова політика їх не знімає, доки хаб не перечитає конфіг і ці запити не закриті. (source: дошка оркестратора 2026-10-02)
```

### now.md

```verbatim
- **AH-3.1 відкрито в [#393](https://github.com/sanchahous/ai-today-brief/pull/393)** на `feat/ah-3.1-brand-mark`: After Hours brand mark (пластина + вкладені A-лінії + celadon-крапка) у `src/lib/brand-mark.ts`; `BrandMark` у header і footer на токенах; `BrandBloom` видалено; `npm run icons:generate` оновлює `icon.svg`, `favicon.ico`, `apple-icon.png`; `logo.png` 512×512 на тому ж SVG; аватар редактора в byline і author — `bg-accent-fill`. AH-3.7/AH-3.8 мерджаться з AH-3.1 в один день (D7). (source: PR #393)
```

### handoff

```verbatim
- **AH-3.1 відкрито в [#393](https://github.com/sanchahous/ai-today-brief/pull/393)** на `feat/ah-3.1-brand-mark`: After Hours brand mark (пластина + A-лінії + celadon-крапка) у `brand-mark.ts`, `BrandMark` у header/footer, favicon/apple-icon/logo.png через `icons:generate`, аватар редактора на токенах. AH-3.7/AH-3.8 мерджаться з AH-3.1 в один день (D7). (source: PR #393)
```

### handoff

```verbatim
- **ATB-22 (AH-3.1), ATB-23 (AH-3.2) і ATB-27 (AH-3.6) ще стоять у waiting/approval** на запитах merge, відкритих до зміни політики. Нова політика їх сама не знімає: живий `orc serve` тримає старий конфіг до рестарту, а стадія approval не перечитує правила. (source: дошка оркестратора 2026-10-02)
```

### epic-5.3

```verbatim
| AH-3.1 | ◐ Бренд-знак на сайті: favicon, іконки, `logo.png`, manifest, `BrandMark` у [#393](https://github.com/sanchahous/ai-today-brief/pull/393) | M | агент + власник | D7 ✅, AH-1.1 ✅ | B11 (сайт) |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
