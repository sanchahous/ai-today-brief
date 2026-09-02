# Supabase uncached egress — інцидент 2026-09-02

Summary: Free-план org-wide вичерпав uncached egress (15 GB / 5 GB). Data API і Storage
віддавали **402**. Причина — три повні `next build` проти прод PostgREST за одну годину,
не читачі в браузері. Орг на **Pro** з 2026-09-02 ~12:11 UTC — REST знову 200. Код: Next
Data Cache на anon GET, `cachePublicRead`, e2e prerender cap, і SSG disk-memo між
11 воркерами (`withBuildMemo`).
Sources: Supabase Usage Dashboard (цикл 21 Aug 2026 – 21 Sep 2026); `edge_logs` через
MCP `query_logs` 2026-09-01T10:00Z–2026-09-02T13:10Z; `src/lib/supabase.ts`,
`src/lib/public-content-cache.ts`, `src/lib/public-content-build-memo.ts`.
Last updated: 2026-09-02

---

## Що зламалось

На проді `mdiqfatpqczwqghwttpm` (орг на **Free**):

| Метрика (цикл 21.08–21.09.2026) | Використано | Ліміт |
|---|---:|---:|
| Uncached egress | **15.004 GB (300%)** | 5 GB |
| Cached egress | 0.906 GB | 5 GB |
| Database | 0.178 GB | 0.5 GB |
| Storage | 0.268 GB | 1 GB |

Усі сервіси з Data API / Storage — **402 `exceed_egress_quota`**. Postgres MCP `execute_sql`
ще працює. Квоту циклу відкотити не можна: Pro (~$25, 250 GB) або чекати **21 Sep 2026**.
(source: owner screenshot Usage Dashboard 2026-09-02)

Інші проєкти оргу (`cockpit`, `ai-today-brief-staging`) уже INACTIVE — пауза їх не рятує.

## Хто палив

Вікно `2026-09-01T11:00Z` (~14:00 Київ): **~17.7k** `GET /rest/v1/brief_items`.

| Джерело | User-Agent | Обсяг |
|---|---|---:|
| GitHub Actions (Microsoft Boydton / Des Moines / San Jose) | `node` | ~9 027 |
| Vercel build (Amazon Ashburn) | `node` | ~5 723 |
| Локальний `next build` / e2e (Ivano-Frankivsk) | `node` | ~2 992 |

Усі з **anon JWT**, не `service_role`. Решта доби — десятки запитів/годину. Cloudflare:
34 802 DYNAMIC vs 2 077 HIT — JSON PostgREST не кешується на CDN.
(source: Supabase `edge_logs` 2026-09-01…02)

Це повтор патерну серпня 2026 (картинки на `/_next/image` → Storage render). Тоді фікс
переніс **байти картинок**; цей інцидент — **uncached REST JSON** під час SSG.
(source: [vercel-image-quota](vercel-image-quota.md), [supabase-audit-2026-08-20](supabase-audit-2026-08-20.md))

## Чому один білд множить запити

`generateStaticParams` тягне всі опубліковані `brief_items`. Кожна item-сторінка ще раз
б'є PostgREST: `generateMetadata` + page + `opengraph-image` + related + adjacent +
категорії в хедері. supabase-js за замовчуванням шле GET як `cache: 'no-store'`, тож
Next Data Cache їх не бачить. Три повні прод-білди в одну годину (Vercel + e2e.yml +
локальний `pr:check` / Playwright) вичерпують 5 GB.

## Фікс у коді

1. **Anon client** (`getSupabase`): `global.fetch` для `GET /rest/v1/` ставить
   `next.revalidate = 3600` і tag `public-content`, прибирає `cache: 'no-store'`.
   `getSupabaseAdmin()` / service_role — без змін. Next 16 **не** кладе в Data Cache
   fetch з `Authorization` (supabase-js шле anon JWT) — тож цей шар на SSG слабкий.
2. **`cachePublicRead`**: React `cache` (один render) + `unstable_cache` (ISR) +
   `withBuildMemo` під час `NEXT_PHASE=phase-production-build` (in-process Promise
   + JSON під `.next/cache/atb-public-content`, sha256 від `{key, args}`). Так 11
   SSG-воркерів ділять `getCategories` / related / adjacent / home-news хаби.
   Runtime ISR **не** читає цей диск — `revalidateTag('public-content', 'max')` лишається
   чесним. Vitest обходить обгортку. `getPublishedCategoryCounts` не обгорнутий
   (повертає `Map`, не JSON); він живе всередині `loadHomeData`, який уже JSON-safe.
3. **E2E / preview / local pr:check**: `E2E_MINIMAL_PRERENDER=1` (або `VERCEL_ENV=preview`)
   лишає `generateStaticParams` на 8 шляхів (item + brief + category + concept). Production Vercel (`VERCEL_ENV=production`)
   цей cap **не** ставить — індексовані item-сторінки далі prerender. Не Promote preview
   на прод: merge в `main` стартує новий production build.
4. **Wiki/pipeline-only деплой**: `vercel.json` `ignoreCommand` (`scripts/vercel-should-build.mjs`)
   пропускає Vercel SSG, якщо в коміті немає site-файлів. E2e на `push` у `main` так само
   пропускає docs-only (раніше завжди білдив).
   (source: `src/lib/public-content-cache.ts`, `src/lib/public-content-build-memo.ts`,
   `src/lib/items.ts`, `scripts/ssg-build-scope.mjs`)

## Вимірювання після PR #348 (без disk-memo)

Прод-деплой `074121c` завершився **2026-09-02T12:21:52Z** (Vercel `8Rjx2ydjaZLhLHYREh4mr2FJiFUR`).
Вікно `12:18–12:23 UTC`, усі відповіді **200** (402 зник після апгрейду на Pro ~12:11 UTC).

| Джерело | `brief_items` | Нотатка |
|---|---:|---|
| Vercel Ashburn | **3247** | повний SSG, −43% vs 5723 |
| GitHub e2e на main | **146** | `E2E_MINIMAL_PRERENDER`, ~60× вниз від 9027 |
| Локальний білд | 0 | SSG не запускали |

У тому ж Vercel SSG: `categories` **2063**, `articles` **2012**, `briefs` **532**.
`unstable_cache` не шариться між 11 воркерами; React `cache()` — лише на один request.
Унікальні `getNewsItem` (~688 × 2 мови) все одно б'ють PostgREST; зайве — повтор
listing-запитів (`getCategories` ≈ один header fetch на кожну згенеровану сторінку).
(source: Supabase `edge_logs` 2026-09-02T12:18Z–12:23Z; owner session 2026-09-02)

## Вимірювання після PR #350 (disk-memo)

Прод-деплой `dd49672` (#350, squash) завершився **2026-09-02T13:08:05Z**
(Vercel `7gEmfbYHEad43K7JuWcxBeFbCjBH`). Вікно `13:04–13:10 UTC`, усі **200**.

| Таблиця | #348 Ashburn | #350 Ashburn | Δ |
|---|---:|---:|---|
| `categories` | 2063 | **30** | −99% |
| `brief_items` | 3247 | **1471** | −55% |
| `articles` | 2012 | **1168** | −42% |
| `briefs` | 532 | **235** | −56% |

`categories` тепер десятки (shared listing). `brief_items` ≈ унікальні item (~688 × 2 мови)
плюс `generateStaticParams` / related — не 11× повтор. `articles` лишається окремим
per-item lookup всередині `getNewsItem`; це вже не listing-stampede.
GitHub e2e в цьому ж вікні лише стартував (Des Moines: `brief_items` 21) — cap з #348.
(source: Supabase `edge_logs` 2026-09-02T13:04Z–13:10Z; Vercel production deploy `dd49672`)

## Що цей фікс не робить

Квоту вже спаленого циклу (15.004 / 5 GB на Free) відкотити не можна — далі ліміт Pro
(250 GB) до **21 Sep 2026**. Даунгрейд на Free **до** ресету знову дасть 402.
Після ресету Free тримається запобіжниками: один повний SSG = лише production Vercel;
preview / e2e / `pr:check` — 8 item-шляхів; docs-only коміти Vercel пропускає.
Не Promote preview-білд на прод.
Weekly `ai-weekly-2026-08-23` після REST 200 все одно потребує
`/api/internal/weekly/release-due` → `promoteWeeklyDigestPublicAssets` →
`finish_weekly_digest_release(true)`, не голий SQL-finish.
(source: owner session 2026-09-02; Supabase billing FAQ)

## Related pages

- [ops/vercel-image-quota](vercel-image-quota.md) — попередній 402 на картинках
- [ops/supabase-audit-2026-08-20](supabase-audit-2026-08-20.md) — аудит після серпневого egress
- [ops/github-actions-cost](github-actions-cost.md) — чому e2e взагалі білдить повний сайт
- [now](../now.md)
