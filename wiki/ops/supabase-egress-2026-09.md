# Supabase uncached egress — інцидент 2026-09-02

Summary: Free-план org-wide вичерпав uncached egress (15 GB / 5 GB). Data API і Storage
віддають **402**. Причина — три повні `next build` проти прод PostgREST за одну годину,
не читачі в браузері. Фікс: Next Data Cache на anon REST GET, `cachePublicRead` на
listing/item читаннях, мінімальний prerender у e2e.
Sources: Supabase Usage Dashboard (цикл 21 Aug 2026 – 21 Sep 2026); `edge_logs` через
MCP `query_logs` 2026-09-01T10:00Z–2026-09-02T10:00Z; `src/lib/supabase.ts`,
`src/lib/public-content-cache.ts`, `.github/workflows/e2e.yml`.
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
   `getSupabaseAdmin()` / service_role — без змін.
2. **`cachePublicRead`**: React `cache` (один render) + `unstable_cache` (білд / ISR)
   на `getNewsItem`, sitemap entries, home/news/category hub, related-by-category,
   adjacent-by-brief. Publish і editor-take викликають `revalidateTag('public-content', 'max')`.
3. **E2E**: `E2E_MINIMAL_PRERENDER=1` у `.github/workflows/e2e.yml` і
   `scripts/e2e-affected.ts` лишає `generateStaticParams` на 8 шляхів. Production Vercel
   цей прапорець **не** ставить — індексовані item-сторінки далі prerender.
   (source: `src/lib/public-content-cache.ts`, `src/lib/items.ts`)

## Що цей фікс не робить

Поточний цикл уже 300%. Код зупиняє **наступний** спайк. Data API лишається 402, поки
не буде Pro або 21.09. Weekly `ai-weekly-2026-08-23` не можна дотиснути через
`/api/internal/weekly/release-due`, доки REST знову 200.
(source: owner session 2026-09-02)

## Related pages

- [ops/vercel-image-quota](vercel-image-quota.md) — попередній 402 на картинках
- [ops/supabase-audit-2026-08-20](supabase-audit-2026-08-20.md) — аудит після серпневого egress
- [ops/github-actions-cost](github-actions-cost.md) — чому e2e взагалі білдить повний сайт
- [now](../now.md)
