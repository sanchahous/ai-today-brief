# AH-5.3

Summary: Головна `/[lang]` зібрана блоками After Hours з лічильниками лише з опублікованих даних. Непідтверджені «70+» і «120+» прибрано. Спонсорський слот лишається вільним місцем, як і раніше в коді, доки немає оплаченого розміщення.
Sources: [епік §5.3](../product/after-hours-redesign-epic.md#ah-53--головна-lang); [after-hours-redesign](../product/after-hours-redesign.md) §3; `artifacts/after-hours/home.js`; [PR #421](https://github.com/sanchahous/ai-today-brief/pull/421)
Last updated: 2026-10-04

---

Task: ah-5.3

## Status

### epic-5.3

```verbatim
| AH-5.3 | Головна | L | агент + власник | AH-5.1, AH-4.2 | route `home`, B9, B10 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

Реалізовано на гілці `feat/ah-5.3-home`, PR [#421](https://github.com/sanchahous/ai-today-brief/pull/421).

Порядок блоків: masthead (пошук як SearchDialog, популярні запити з trending) → dateline останнього daily → lead (top-of-week #1, статичний знак) і rail з 3 матеріалів того дня → до 5 концептів із реальними slug → «Головне за тиждень» → смуга часток у останніх 100 і bento `TOP_CATEGORY_SLUGS` → velvet тижневика лише якщо є опублікований випуск → гарячі теми в `/news/search?q=` → Concepts / Guides / Toolbox → вільний спонсорський слот із «Чому я це бачу?» → NewsletterForm → FAQ (FAQPage JSON-LD на місці).

Числа: рубрики з каталогу; матеріали за 7 днів до дати останнього випуску — з `brief_items`; частки рубрик — з останніх 100 матеріалів; факти тижневика (історії, хвилини з summary+why, джерела, № як порядковий номер опублікованих нетестових випусків) — з ревізії. «70+» і «120+» не показуються: окремого підтвердженого підрахунку джерел немає (source: картка AH-5.3, I-6).

Події `hero_cta_click`, `weekly_top_click`, `digest_card_click`, `category_hub_click` лишаються з параметрами з `src/lib/analytics-events.ts`. JSON-LD головної: WebSite + SearchAction, Organization, ItemList, FAQPage.

Нескінченні орби й золоті `rgba(240,192,64,…)` прибрано з hero і velvet. Лабораторний LCP на Vercel Preview цим прогоном не вимірювався — прев’ю з’являється після публікації гілки.

Наступна задача епіку — AH-5.4 (Daily `/[lang]/[brief]`).

## Log

- 2026-10-04: зібрано головну за порядком блоків AH-5.3. Прибрано непідтверджені «70+» / «120+» і нескінченні орби. Статистика винесена в `src/lib/home-stats.ts` з unit-тестами. Спонсор — вільне місце (оплаченого слота в даних немає). `npm run pr:check` зелений; Playwright `smoke.spec.ts`, `layout-regression.spec.ts`, `sponsor-spacing.spec.ts` — 144 passed на порту 3102. Лабораторний LCP на Preview не вимірювався. Наступна задача — AH-5.4.
