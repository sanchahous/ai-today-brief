# social-copy-bounded-repair-quality-2026-08-28-fe

Summary: Статусний фрагмент social-copy-bounded-repair-quality-2026-08-28-fe. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: social-copy-bounded-repair-quality-2026-08-28-fe

## Status

### now.md

```verbatim
- **Social copy: після bounded repair немає термінального quality-гейти (2026-08-28), гілка
  `feat/social-copy-no-quality-blockers`.** Власник: «ніяких блокерів». Linked retry
  `a59e5332` знову впав на Telegram (1789 символів, немає `**bold**`, `platform_fit` 2/100)
  і обрізав решту каналів. Тепер Telegram механічно отримує bold + стискання до 900–1600,
  а все, що лишилось після 3 раундів ремонту, іде в `warnings`; job `succeeded`, пости
  `in_review`. Якщо на поточній ревізії немає 3 approved story image — Instagram
  пропускається, інші канали все одно зберігаються. Ship / coded article blockers не змінювались.
  (source: owner session 2026-08-28; [weekly-digest](pipeline/weekly-digest.md))
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
