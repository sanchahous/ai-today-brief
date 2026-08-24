# Vercel Fast Origin Transfer — інцидент 2026-08-24

Summary: 24 серпня Vercel попередив про 100% безкоштовного ліміту Fast Origin Transfer (10 ГБ)
з погрозою авто-паузи проєкту. Корінь — `/[lang]/news` рендериться динамічно на кожен запит і
ніколи не кешується на CDN. Попередження про Image Optimization у тому ж листі — залишок
вигорілої до 14.08 квоти, він не росте.
Sources: листи Vercel 2026-08-24; live check заголовків і розмірів `aitodaybrief.com` 2026-08-24;
`next.config.ts`; `src/app/[lang]/news/page.tsx`; `src/app/sitemap.ts`;
`node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`
Last updated: 2026-08-24

---

## Три листи, дві різні речі

Vercel надіслав три попередження одночасно, і вони не рівноцінні
(source: листи Vercel 2026-08-24):

| Ресурс | Стан | Наслідок за словами Vercel |
|---|---|---|
| Fast Origin Transfer (10 ГБ) | 100% | **projects will be automatically paused** |
| Image Optimization – Transformations (5 000) | 100% | transformations will error, **paused не буде** |
| Image Optimization – Cache Writes (100 000) | 75% | — |

Ризик зупинки сайту дає **лише перший рядок**.

## Image Optimization — фантом, робити нічого не треба

Оптимізатор Vercel уже обійдено 14.08 власним loader'ом після попереднього інциденту —
див. [vercel-image-quota](vercel-image-quota.md). Live check 2026-08-24: HTML `/en` і `/en/news`
містять **нуль** входжень `/_next/image`. Тобто квота вигоріла до 14.08 у поточному біл-циклі і
більше не зростає; «additional image transformations will error» безпечне, бо трансформацій ми не
робимо (source: live check 2026-08-24; `src/lib/image-loader.ts`).

## Корінь Fast Origin Transfer

`src/app/[lang]/news/page.tsx` робить `await searchParams` на верхньому рівні сторінки — для
`q`, `category` і `page`. У Next 16 `searchParams` належить до runtime APIs: сторінка стає
динамічною на кожен запит, а `export const revalidate = 3600` при цьому мовчки ігнорується
(source: `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`).

Виміряно наживо 2026-08-24 (source: live check заголовків `x-vercel-cache` і `content-length`):

| Маршрут | Розмір | CDN |
|---|---:|---|
| **`/en/news`** | **343 108 Б** | **MISS**, `private, no-cache, no-store` |
| **`/uk/news`** | **389 502 Б** | **MISS**, `private, no-cache, no-store` |
| `/en` | 224 932 Б | HIT |
| `/uk` | 242 607 Б | HIT |
| `/en/category/agents-and-mcp` | 249 678 Б | HIT |
| `/en/concepts` | 170 895 Б | HIT |
| `/en/digests` | 129 012 Б | HIT |
| item-сторінка | 146 258 Б | HIT |
| `/en/about` | 78 885 Б | HIT |

Дві **найважчі** сторінки сайту виявились єдиними, що б'ють в origin на кожен запит. 10 ГБ ділені
на ~365 КБ дають ~28 000 запитів за цикл, тобто ~1 200 на добу на дві сторінки — реалістично для
Googlebot плюс GPTBot, PerplexityBot і ClaudeBot, яких robots.txt пускає навмисно заради AEO
(source: `.cursor/rules/00-core.mdc`, секція SEO/AEO).

## Що зроблено 2026-08-24

1. **CDN-кеш для `/:lang(en|uk)/news`** — `public, s-maxage=300, stale-while-revalidate=3600` через
   `headers()` у `next.config.ts`. Сторінка публічна і залежить тільки від URL, тому спільний кеш
   безпечний. П'ять хвилин обрано свідомо: `revalidatePath` з publish-флоу **не** чистить
   динамічний маршрут, тому редакційна затримка після публікації дорівнює s-maxage
   (source: `next.config.ts`; `src/lib/revalidate-site.ts`).
2. **Коротша драбина `srcSet`** — `deviceSizes` і `imageSizes` замість дефолтних 16 варіантів.
   На `/en/news` 40 КБ з 343 КБ припадало саме на `srcSet`. Рунг 1200 залишено навмисно: heroes
   оголошують слот 1160 px, і без нього 1x-кандидат стрибнув би на 1920, тобто на **більший** файл
   (source: вимір `grep -o 'srcSet=...'` 2026-08-24; `next.config.ts`).
3. **`sitemap.xml` — revalidate 1 год → 6 год.** Файл має 1316 URL і важить 943 043 Б; щогодинна
   перегенерація коштувала ~22 МБ origin transfer на добу. `news-sitemap.xml` лишається на годині,
   бо цього потребує Google News (source: live check 2026-08-24; `src/app/sitemap.ts`).

## Що свідомо НЕ зроблено

`/[lang]/news` віддає клієнту **100** матеріалів, щоб `NewsFeed` робив фільтр, фасети,
сортування й пагінацію без мережі, хоча показує 12 за раз (source: `src/lib/news.ts`
`getNewsPageData`, `limit = 100`; `src/components/news/news-feed.tsx`, `PAGE_SIZE = 12`).

Порізати цей payload — це зміна UX-архітектури пошуку, а **не** економія на білінгу: після пункту 1
origin віддає сторінку кілька разів на годину замість кожного запиту, тож її розмір майже перестає
впливати на Fast Origin Transfer. Задача лишається вартою уваги як **CWV/page-weight**, бо органіка
і так є вузьким місцем — див. [2026-07-01-seo-organic](../audits/2026-07-01-seo-organic.md).

## Чого перевірка не покрила

Vercel MCP на плані Hobby не дає ані агрегатів runtime-логів (403), ані Web Analytics (404), тому
розкладу трансферу по маршрутах від самого Vercel немає — висновок побудований на заголовках
кешу й розмірах відповідей (source: live check MCP 2026-08-24). Після деплою треба переконатися,
що `/en/news` справді віддає `x-vercel-cache: HIT`: кастомний `Cache-Control` має перекрити той,
що Next ставить для динамічного маршруту, і це підтверджується лише на живому проді.

## Related pages

- [vercel-image-quota](vercel-image-quota.md)
- [owner-checklist](owner-checklist.md)
