# AH-1.3

Summary: Статусний фрагмент AH-1.3. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-1.3

## Status

### now.md

```verbatim
- **AH-1.3 інтегровано через [PR #378](https://github.com/sanchahous/ai-today-brief/pull/378)
  2026-09-30; актуальний `origin/main` після #380 — `3d0cb2b`.**
  Pre-paint синхронізує `.theme-light`, `data-theme`, `color-scheme` і `theme-color`;
  `localStorage` та GA4 лишають `light`/`dark`. Перемикач EN/UK описує наступну тему,
  має 44×44 px і синхронізує desktop/mobile контролі. SEO compare: 58 URL,
  0 errors / 0 warnings; галерея до/після — `artifacts/after-hours/qa/ah-1.3-review.html`.
  Деталі перевірок і межі legacy QA — [AH-1.3 validation](product/after-hours-ah-1-3-validation.md).
  Фаза 0 завершена: #376 змержено в `69bcd1c`; merge #378 підтверджено GitHub.
  AH-1.4 реалізовано в PR #382; наступна після її інтеграції — AH-1.2;
  G1 чекає решти foundations і підпису власника.
  (source: `src/app/layout.tsx`, `src/lib/theme.ts`, `src/components/theme-toggle.tsx`;
  `artifacts/_local/ah-1.3-seo-local-fresh.log`; `git fetch origin`, `gh pr view 378` 2026-09-30)
```

### epic-5.3

```verbatim
| AH-1.3 | ◐ Контракт Night/Day інтегровано в main через [#378](https://github.com/sanchahous/ai-today-brief/pull/378); legacy no-JS/full-page QA AC лишаються задокументованими ([QA](after-hours-ah-1-3-validation.md)) | S | агент | D2 ✅ | B12 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
