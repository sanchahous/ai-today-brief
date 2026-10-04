# AH-5.6

Summary: Архів `/[lang]/digests` — hero, now-playing, порівняння форматів, таби з URL-state, календар, хронологія з довантаженням, JSON-LD і NewsletterForm.
Sources: `artifacts/after-hours/editions.js`, `artifacts/after-hours/seo.js`, [PR #424](https://github.com/sanchahous/ai-today-brief/pull/424)
Last updated: 2026-10-04

---

Task: ah-5.6

## Status

### epic-5.3

```verbatim
| AH-5.6 | Архів Digests | M | агент | AH-5.1, AH-2.6 | route `digests` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

Реалізовано на гілці `feat/ah-5.6-digests-archive`, PR [#424](https://github.com/sanchahous/ai-today-brief/pull/424).

Маршрут лишається ISR `3600`; `searchParams` на сервері не читаються. Таби All / Daily / Weekly синхронізуються з `?type=` через `history.pushState` і Back/Forward. Hero «Контекст щодня. Перспектива щотижня.»; now-playing з останнього daily (топ-3, хвилини, кількість) і weekly sleeve. Таблиця порівняння форматів без непідтвердженого розкладу (I-6). Календар місяця — `<table>`, понеділок першим, `Intl` для днів/місяців, `aria-current="date"`. «Показати ранніші випуски» — fetch `/api/digests/archive` зі збереженням scroll position. JSON-LD: `CollectionPage` + `ItemList` + `BreadcrumbList`. `HubViewTracker` без змін. `NewsletterForm` у band.

Наступна задача епіку — AH-5.7 (хаб категорії).

## Log

- 2026-10-04: зібрано архів digests за карткою AH-5.6. `npm run pr:check` (PORT=3100).
