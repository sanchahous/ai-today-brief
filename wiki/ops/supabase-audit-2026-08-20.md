# Supabase-аудит 2026-08-20 — що виправлено одразу, що лишається на потім

Summary: після egress-інциденту (490% квоти Free-плану, [fix/social-card-egress → #302](https://github.com/sanchahous/ai-today-brief/pull/302),
див. [vercel-image-quota.md](./vercel-image-quota.md) для спорідненого інциденту з тим самим
object-vs-render розрізненням) провели ширший аудит Supabase-проєкту
`mdiqfatpqczwqghwttpm` (ai-news-scrapper, sanchahous's Org). Два безпечні SQL-фікси
застосовано одразу; решта — нижче, з причиною, чому не зроблено просто зараз.
Sources: `mcp_supabase get_advisors` (security + performance), edge-логи (24h),
`pg_proc`/`pg_get_functiondef`, `storage.objects`, `storage.buckets`, `cron.job`,
`auth.users`, `social_admins` — усе живий стан на 2026-08-20.
Last updated: 2026-08-20

---

## Виправлено одразу

Обидва — SQL-мігрції через Supabase MCP, підтверджено запитом після застосування.

1. **`replace_llm_provider_models` без фіксованого `search_path`.**
   Єдина функція в проєкті без цього — теоретичний ризик підміни схеми.
   Мігрція: `fix_replace_llm_provider_models_search_path`.

2. **`REVOKE EXECUTE ... FROM anon, authenticated`** на трьох функціях керування
   секретами LLM-провайдерів (`read_llm_provider_secret`, `store_llm_provider_secret`,
   `delete_llm_provider_secret`). Лінтер позначав їх як «доступні анонімним
   користувачам» — на практиці кожна вже мала `if auth.jwt() ->> 'role' <> 'service_role'
   then raise exception`, тобто виклик і так падав. Revoke прибирає сам GRANT на рівні
   PostgREST — другий шар захисту, незалежний від перевірки в тілі функції.
   Мігрція: `revoke_public_execute_on_llm_provider_secret_rpcs`.

Ширший контекст (чому решта SECURITY DEFINER-попереджень лінтера — хибна тривога,
не діра): 4 CMS-функції (`create_weekly_digest_revision`, `revert_weekly_digest_revision`,
`queue_weekly_digest_generation_job`, `retry_weekly_digest_generation_job`) перевіряють
`has_social_role(array['owner','editor'])` проти таблиці `social_admins` (зараз 1 рядок,
`auth.users` теж 1 акаунт — публічної реєстрації немає). 3 пошукові функції
(`get_concept_items`, `search_brief_items`, `search_facets`) навмисно публічні й
фільтрують лише `status = 'published'`.

## Залишається відкритим

| # | Пункт | Чому не зараз |
|---|---|---|
| 1 | **Leaked Password Protection вимкнений** (Auth advisor, WARN) | Це перемикач у Dashboard → Authentication → Policies, не SQL — власник має клацнути сам. |
| 2 | **`pg_trgm`, `pg_net` у схемі `public`** (WARN, cosmetic) | `pg_net` викликається з pg_cron джобів як `net.http_post(...)` — перенесення схеми екстеншена ризикує зламати ці виклики без ретельної перевірки. Не чіпати одним рядком. |
| 3 | **Storage Image Transformations quota** | Наш egress-фікс навмисно переніс більше трафіку на `/storage/v1/render/image/...`. Dashboard показує цю метрику як "Unavailable in plan" (не рахується на Free) — це саме той пункт, який був відмічений у [vercel-image-quota.md § Що лишається відкритим](./vercel-image-quota.md#що-лишається-відкритим) як `needs verification`. Перевірити ще не встигли, а тепер на ній трохи більше навантаження. **Раз на тиждень зазирати в Usage Dashboard.** |
| 4 | **`articles` росте без обмеження** | 43 MB / 136.8 MB бази, ~183 рядки/день, немає видимої retention-політики (скрапер тримає все назавжди). До ліміту Free (500 MB) — оцінково більше року за поточним темпом. Не терміново, але єдине місце, де варто колись подумати про архівацію старих статей. |
| 5 | **Storage ~235 MB / 1 GB (23%)** | `card-images` 134 MB (546 обʼєктів) + `weekly-digest-private` 94 MB (657 обʼєктів) + `social-assets` 13 MB. Росте повільно з кожною новою статтею/weekly-ревізією. Не терміново. |
| 6 | **98 performance-нотаток лінтера** (42 unindexed FK, 25 unused index, 18 multiple permissive policies, 13 auth_rls_initplan) | Стандартний шум для проєкту, що росте. При 136 MB бази й найбільшій таблиці 15.7k рядків — жодна ще не відчутна. Варто одним заходом почистити, коли зʼявиться час, не раніше. |
| 7 | **RLS enabled, без policy** на 8 таблицях (`articles`, `subscribers`, `item_events`, `item_metrics`, `newsletter_sends`, `sponsors`, `weekly_digest_generation_attempts`, `weekly_digest_generation_events`) | Не діра — повна заборона anon/authenticated, доступ лише через service_role-бекенд. Підтверджено як задум, просто фіксується тут щоб наступного разу не перевіряти заново. |

## pg_cron — для довідки

5 активних джобів, усі легкі й ідемпотентні (перевіряють «чи є що робити» і виходять,
якщо нема):

| Розклад | Джоб |
|---|---|
| `*/5 * * * *` | `social_publish_due` |
| `*/30 * * * *` | `social_compose` |
| `*/5 * * * *` | `weekly_generate` |
| `*/5 * * * *` | `weekly_release_due` |
| `* * * * *` | `reap_stale_weekly_digest_generation_attempts` (пряма SQL-функція, без HTTP) |

## Related pages

- [ops/vercel-image-quota](./vercel-image-quota.md) — попередній інцидент з тим самим object-vs-render розрізненням
- [ops/social-cms-runbook](./social-cms-runbook.md)
