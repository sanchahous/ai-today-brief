# On-site SEO audit — 2026-08-21

Summary: повний on-site аудит SEO/AEO (metadata, JSON-LD, sitemaps, feeds, robots, canonical, свіжість) із переліком 11 знайдених прогалин і статусом їх реалізації того ж дня.
Sources: код-ревʼю `src/app/**`, `next.config.ts`, `src/proxy.ts`, `src/app/sitemap.ts` (live check 2026-08-21), [audits/2026-07-01-seo-organic](../audits/2026-07-01-seo-organic.md)
Last updated: 2026-08-21

---

Аудит виконано агентом по всіх маршрутах `src/app/**`. База здорова: кожен індексований
маршрут має `generateMetadata` з title + description + canonical + hreflang (en/uk/x-default),
JSON-LD на всіх типах сторінок, sitemap + news-sitemap + RSS + `llms.txt` + IndexNow.
Знайдено 11 прогалин — усі виправлено в тому ж заході (гілка
`feat/ga4-coverage-and-seo-hardening`).

## Знайдено → виправлено

| # | Знахідка | Фікс |
|---|---|---|
| B1 | Немає og:image/twitter на більшості сторінок (source: код-ревʼю `src/app/**/page.tsx` 2026-08-21) | Спільний хелпер `src/lib/seo.ts` (`socialMeta`) + брендований дефолт `src/app/[lang]/opengraph-image.tsx`; сторінки з власними обкладинками (weekly) зберегли свої images |
| B2 | Хаби залишались stale після публікації; нечесні changeFrequency (source: `src/app/api/telegram/route.ts`, `sitemap.ts` 2026-08-21) | `src/lib/revalidate-site.ts`: публікація інвалідує home/news/digests/concepts/усі категорійні хаби/sitemaps/RSS для обох мов; changeFrequency айтемів → `yearly`, брифів → `weekly`, weekly → `monthly` |
| B3 | Подвійна схема: CollectionPage+TechArticle на концептах, WebApplication+TechArticle на тулзах — два вузли претендують на один URL (source: `concepts/[slug]/page.tsx`, `tools/*/page.tsx`) | Один TechArticle з `articleBody` (концепти); один WebApplication з `dateModified`/`mainEntityOfPage` (тулзи) |
| B4 | Заглушки описів («Name — Brand») на хабах і брифах (source: `generateMetadata` хабів) | Похідні описи: категорії беруть tagline, концепти — перше речення body, брифи — intro або перший item summary (EN+UK) |
| B5 | Збій БД у proxy віддавав hard-503 noindex на живих weekly URL (source: `src/proxy.ts`) | `'unavailable'` тепер падає крізь до ISR-кешу — транзієнтний збій не деіндексує сторінку |
| B6 | RSS лише EN; UK-читачі без фіду (source: `src/app/rss.xml/route.ts`) | Спільний білдер `src/lib/rss-feed.ts`; новий `/rss-uk.xml`; per-lang `<link rel="alternate">` у layout; обидва фіди в llms.txt |
| B7 | Маніфест описував CMS: «AI Today Brief CMS», `start_url: /admin` (source: `src/app/manifest.ts` до фіксу) | Публічний манфест: продуктові назва/description, `start_url: /en` |
| B8 | `/news?page=2` канонізувався до `/news` — пагінація поза індексом (source: `news/page.tsx` generateMetadata) | Self-canonical `?page=N` (page=1 згортається до чистого шляху); `?q=` як і раніше noindex |
| B9 | Тіло концепт-хаба без внутрішніх лінків (source: `concept-hub-body.tsx` — лише `<p>`) | Автолінк згадок інших концептів (`linkConceptMentions`) — лише внутрішні `/{lang}/concepts/{slug}` з наших DB-рядків, 1 лінк/концепт/абзац, найдовша назва має пріоритет |
| B10 | Trust-сторінки без lastmod; weekly dateModified ігнорував пост-реліз правки (source: `sitemap.ts`, `digests.ts`) | Trust-сторінки: lastmod = найсвіжіша дата верифікації гайдів/тулз; weekly: max(revision.created_at, digest.updated_at, artifacts.updated_at) |
| B11 | Немає security headers (source: `next.config.ts` до фіксу) | `next.config.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |

## Що НЕ виправлено (свідомо)

- **CSP** — потребує nonce-ролауту через inline JSON-LD + GA/GTM; зробити окремим заходом,
  бо помилка в CSP ламає весь сайт одразу.
- **rel=prev/next** — Google їх більше не використовує; self-canonical пагінації (B8)
  достатньо.

## Звʼязок з попереднім аудитом

Це продовження [2026-07-01-seo-organic](../audits/2026-07-01-seo-organic.md): той знайшов
причини відсутності органіки (232 «Виявлено — не проіндексовано»), цей закриває технічний
борг on-site шару. Чек-лист indexation лишається відкритим — сторінка
`seo/indexation.md` досі запланована (source: [index](../index.md)).

## Related pages

- [aeo-strategy](aeo-strategy.md) — стратегія AEO/GEO, яку ці фікси обслуговують
- [../analytics/event-taxonomy](../analytics/event-taxonomy.md) — аналітична частина заходу
- [../audits/2026-07-01-seo-organic](../audits/2026-07-01-seo-organic.md) — вихідний аудит органіки
