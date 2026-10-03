# AH-4.4

Summary: Статусний фрагмент AH-4.4 — сторінка пошуку `/[lang]/news/search`. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: [епік AH-4.4](../product/after-hours-redesign-epic.md#ah-44--сторінка-пошуку-langnewssearch); [PR #412](https://github.com/sanchahous/ai-today-brief/pull/412)
Last updated: 2026-10-03

---

Task: ah-4.4

## Status

### now-status

```verbatim
- **AH-4.4 відкрито в [#412](https://github.com/sanchahous/ai-today-brief/pull/412)** на `feat/ah-4.4-news-search`: сторінка `/[lang]/news/search` — breadcrumb, H1 за `q`, велике поле пошуку, discovery з Relevance, idle з популярними запитами (trending), empty → Concepts; `noindex,follow`, canonical на `/news`. E2E `news-search.spec.ts`. **Наступна задача епіку — AH-4.5.** (source: PR #412; [епік §5.3 AH-4.4](../product/after-hours-redesign-epic.md#ah-44--сторінка-пошуку-langnewssearch))
```

### epic-5.3

```verbatim
| AH-4.4 | Сторінка `/[lang]/news/search` | S | агент | AH-4.3, AH-3.2 | — |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

### log

```verbatim
## 2026-10-03 — AH-4.4: сторінка пошуку `/[lang]/news/search` ([PR #412](https://github.com/sanchahous/ai-today-brief/pull/412))

- **Маршрут:** breadcrumb Головна › Новини › Пошук; H1 «Результати для “q”» / idle; велике поле `NewsSearchForm`; discovery через `NewsFeed` (`feedContext="search"`); idle — популярні запити з trending; empty — перехід до Concepts.
- **SEO:** `force-dynamic`, `noindex,follow`, canonical на `/news` без змін.
- **Тести:** `e2e/news-search.spec.ts` — екранування `q`, idle без стрічки, robots/canonical.
- **Наступна задача епіку:** AH-4.5 (Гейт News vertical slice).
(source: PR #412; [епік AH-4.4](../product/after-hours-redesign-epic.md#ah-44--сторінка-пошуку-langnewssearch))
```

### handoff-next-task

```verbatim
- **AH-4.4 відкрито в [#412](https://github.com/sanchahous/ai-today-brief/pull/412)** на `feat/ah-4.4-news-search`: сторінка `/[lang]/news/search` (breadcrumb, H1, велике поле, discovery, idle, empty → Concepts). **Наступна задача епіку — AH-4.5 (Гейт News vertical slice).** (source: PR #412; [епік §5.3 AH-4.4](../product/after-hours-redesign-epic.md#ah-44--сторінка-пошуку-langnewssearch))
```

## Log

- 2026-10-03 (T1-f1): review fixes — `a11y-gating.json` додано `/en|uk/news/search?q=mcp` і `?q=`; `NewsSearchForm` controlled input + URL sync (popular chip, Back/Forward); E2E popular-query/back; a11y для gating (footer/header 44px, sidebar h2, sponsor лише на hub, skip-link/search input min-height); a11y-matrix harness (reducedMotion, hydration wait, axe excludes). `npm run pr:check` зелений.
- 2026-10-03 (T1): реалізовано AH-4.4 — сторінка `/[lang]/news/search` за прототипом `home.js` `searchPage`; компоненти `NewsSearchForm`, `NewsSearchIdle`; i18n `news.searchPage.*`; E2E news-search. Наступна задача — AH-4.5.
