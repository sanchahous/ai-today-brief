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

## Перша спроба (2026-08-24) і чому вона не спрацювала

Першим фіксом був заголовок `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`
для `/:lang(en|uk)/news` через `headers()` у `next.config.ts` (PR #324). **Він не працює.**
Перевірка на проді після деплою: `/en/news` і далі віддає `private, no-cache, no-store` та
`X-Vercel-Cache: MISS`. Next перекриває кастомний `Cache-Control` власним для динамічно
відрендереного маршруту, і документація про можливість задати цей заголовок для «інших відповідей»
цього випадку не рятує. Правило прибрано як мертве (source: live check заголовків прода
2026-08-24 після мержу #324).

Урок ширший за один заголовок: **кеш не можна прикрутити ззовні до динамічного маршруту** — треба
прибирати причину динамічності.

## Що зроблено насправді (2026-08-24)

1. **`/[lang]/news` більше не читає `searchParams` і став prerendered.** Build-маркер змінився з
   `ƒ (Dynamic)` на `● (SSG)`, відповідь тепер `Cache-Control: s-maxage=3600,
   stale-while-revalidate=31532400` з `x-nextjs-prerender: 1`, а prerendered HTML зберігає повну
   стрічку — 13 `<article>` і 100 посилань на матеріали (source: production build + live check
   локального `next start` 2026-08-24; `src/app/[lang]/news/page.tsx`).
2. **Пошук переїхав на власний динамічний маршрут `/[lang]/news/search`.** Він лишається
   `noindex, follow` з канонікалом на `/[lang]/news`, віддає ті самі server-side результати через
   `searchNewsItems` і не потребує кешу: краулери туди не ходять, а людський пошуковий трафік —
   мала частка від трафіку хабу (source: `src/app/[lang]/news/search/page.tsx`).
3. **Усі 9 внутрішніх посилань `?q=` переведено на новий маршрут**, включно з JSON-LD
   `SearchAction`, а старі зовнішні посилання ловить 308-редірект `/[lang]/news?q=…` →
   `/[lang]/news/search` (source: `next.config.ts`; `src/app/[lang]/page.tsx`;
   `src/components/header-search-field.tsx` та ще п'ять місць).
4. **Коротша драбина `srcSet`** — `deviceSizes` і `imageSizes` замість дефолтних 16 варіантів.
   На `/en/news` 40 КБ з 343 КБ припадало саме на `srcSet`. Рунг 1200 залишено навмисно: heroes
   оголошують слот 1160 px, і без нього 1x-кандидат стрибнув би на 1920, тобто на **більший** файл
   (source: вимір `grep -o 'srcSet=…'` 2026-08-24; `next.config.ts`).
5. **`sitemap.xml` — revalidate 1 год → 6 год.** Файл має 1316 URL і важить 943 043 Б; щогодинна
   перегенерація коштувала ~22 МБ origin transfer на добу. `news-sitemap.xml` лишається на годині,
   бо цього потребує Google News (source: live check 2026-08-24; `src/app/sitemap.ts`).

## Три способи, що НЕ спрацювали, і чому

Перш ніж розділяти маршрути, перепробувано три способи лишити `?q=` на `/[lang]/news` і все одно
мати статику. Жоден не працює в production-білді, тож не варто заходити на це коло вдруге
(source: діагностика на локальному production-білді 2026-08-24):

| Спроба | Результат |
|---|---|
| `useSearchParams` у компоненті всередині `<Suspense>`, fallback — той самий `<NewsFeed>` | children **взагалі не монтуються**: React лишає гідратований інстанс fallback |
| те саме, але fallback — інший компонент | працює в dev, у prod-білді параметри порожні |
| React-контекст: provider + ізольований reader у `<Suspense>` | reader бачить `q=cursor`, до стрічки значення не доходить |
| читання `window.location.search` в ефекті + патч History | ефект доведено виконується (History пропатчено), оновлення стану не доїжджає до рендера |

Штатний механізм Next 16 для «кешована оболонка + параметри запиту» — **Cache Components**
(`cacheComponents` + `use cache`), див. `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`.
Це окрема міграція на весь застосунок, а не патч одного маршруту.

## Що свідомо НЕ зроблено

`/[lang]/news` віддає клієнту **100** матеріалів, щоб `NewsFeed` робив фільтр, фасети,
сортування й пагінацію без мережі, хоча показує 12 за раз (source: `src/lib/news.ts`
`getNewsPageData`, `limit = 100`; `src/components/news/news-feed.tsx`, `PAGE_SIZE = 12`).

Скорочення до 40 матеріалів заміряно: `/en/news` 330 786 → 261 029 Б (**−21%**), `/uk/news`
377 180 → 287 766 Б (**−24%**). Після переходу на статику це не потрібно — origin віддає сторінку
раз на годину замість кожного запиту — і не варте помітно вужчого клієнтського пошуку по стрічці
(source: вимір на локальному production-білді 2026-08-24).

Ще одна свідома дрібниця: `?page=` на статичному хабі більше не відновлює сторінку після
перезавантаження. Це ніколи не було краулабельним видом — `Pagination` малює `<button>`, а не
`<a>`, тож жодне посилання на другу сторінку не існує (source: `src/components/pagination.tsx`).

## Підтверджено на проді (2026-08-24, після мержу #325)

| Перевірка | Результат |
|---|---|
| `/en/news` перший запит | `X-Vercel-Cache: PRERENDER`, `Cache-Control: public, max-age=0, must-revalidate` |
| `/en/news` повторний запит | `X-Vercel-Cache: HIT` |
| `/uk/news` | `X-Vercel-Cache: PRERENDER` |
| `/en/news?q=cursor` | `308` → `/en/news/search?q=cursor` |
| `/en/news/search?q=cursor` | 200, `<meta name="robots" content="noindex, follow">`, канонікал на `/en/news`, 17 різних cursor-матеріалів у результатах |
| вміст хабу | 13 `<article>`, 100 посилань на матеріали, 330 569 Б |
| клік по trending-посиланню на хабі | soft-nav на `/en/news/search?q=Claude`, 80 результатів |

Це те саме місце, де провалилась перша спроба, тому перевірено окремо і саме на живому Vercel, а
не лише на локальному білді. Ключова відмінність від стану до #325: заголовок більше не
`private, no-cache, no-store`, і сторінка не доходить до origin на кожен запит
(source: live check прода 2026-08-24 після деплою #325).

`X-Robots-Tag` на `/news/search` навмисно немає: маршрут динамічний, тож `noindex` ставить
власна `generateMetadata` тегом у HTML, а не правило в `next.config.ts`.

## Чого перевірка не покрила

Vercel MCP на плані Hobby не дає ані агрегатів runtime-логів (403), ані Web Analytics (404), тому
розкладу трансферу по маршрутах від самого Vercel немає — висновок побудований на заголовках
кешу й розмірах відповідей (source: live check MCP 2026-08-24). Скільки саме ГБ це віддає за
місяць, буде видно лише на наступному циклі білінгу.

## Related pages

- [vercel-image-quota](vercel-image-quota.md)
- [owner-checklist](owner-checklist.md)
