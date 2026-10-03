# AH-3.3

Summary: Статусний фрагмент AH-3.3. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-3.3

## Status

### epic-5.3

```verbatim
| AH-3.3 | EditorialHeader | L | агент | AH-3.1, AH-3.2, AH-2.4, AH-1.6 | B13, «dead band» |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

## Log

- 2026-10-03: pre-push відхилив [PR #406](https://github.com/sanchahous/ai-today-brief/pull/406), бо `theme-toggle` на 320px виходив за в’юпорт (правий край ~336px). Верхній ряд header тепер стискається як у прототипі: нижче `phone` (47.5rem) ховається дескриптор, знак і wordmark менші, gap дій 0; wordmark має `min-w-0` і обрізається, щоб пошук, тема й меню лишались у в’юпорті. Висота `<header>` дорівнює токену `--header-h` (рамка всередині боксу). E2E теми шукає видимий перемикач у header, не в Primary nav. Наступна задача епіку — AH-3.4 (вже в [#395](https://github.com/sanchahous/ai-today-brief/pull/395)).
- 2026-10-03: повторний pre-push [PR #406](https://github.com/sanchahous/ai-today-brief/pull/406) впав на `e2e/news-filters-drawer.spec.ts` (960 і 1023): спека ще чекала сайдбар новин від Tailwind `lg` (1024), хоча AH-3.3 уже перемикає header і `.news-layout` разом на 960px. Межа тепер `NAV_COMPACT_LAST` (959) / `NAV_WIDE_FIRST` (960); 1024 лишається широким. Smoke шукає «Головна» на wordmark, не в Primary. Спільні списки не редагувались. PR: pending.
