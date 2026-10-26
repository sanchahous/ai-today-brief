# Vercel Fluid Active CPU — ліміт Hobby, жовтень 2026

Summary: команда `sanchahous-projects` вичерпала 4 год Fluid Active CPU на Hobby. Спайку не було — стабільні ~0,18 год/добу, тобто ~5,5 год/міс. Два джерела: холості pg_cron-опитування Vercel кожні 5 хв і site-wide `revalidateTag('public-content')` на кожну публікацію, після якого боти перегенеровують кожну статтю.
Sources: лист Vercel 2026-10-26; `vercel usage --breakdown daily` live check 2026-10-26; `vercel logs requests --since 1h` (741 запит) 2026-10-26; Supabase `cron.job` / `cron.job_run_details` live check 2026-10-26; `node_modules/next/dist/docs/01-app/02-guides/how-revalidation-works.md`; `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`
Last updated: 2026-10-26

---

## Симптом

26.10.2026 Vercel повідомив: безкоштовна команда використала 100% включених 4 год Fluid Active CPU, далі можлива авто-пауза проєктів. (source: лист Vercel 2026-10-26)

## Що показали дані

- Денне споживання з 26.08 по 26.09: **0,10–0,38 год CPU/добу**, медіана ~0,18. Це ~5,5 год за 30 днів при ліміті 4 год, тому ліміт закінчується приблизно на 20-й день циклу. Після 26.09 `vercel usage` не повертає інфраструктурних рядків для команди. (source: `vercel usage --breakdown daily` live check 2026-10-26; план Hobby — [vercel-origin-transfer](vercel-origin-transfer.md))
- Function invocations — 4–12 тис./добу при 5–15 тис. CDN-запитів; ISR writes — **17–52 тис./добу**. Більшість запитів доходить до функції, а не до CDN-кешу. (source: той самий live check)
- Observability-запити і логи довші за 1 год на Hobby недоступні. Тому розподіл CPU по маршрутах нижче — оцінка за годинною вибіркою, а не виміряна величина. (source: помилки Vercel API 402/400 2026-10-26)

### Джерело 1 — холості cron-опитування

`pg_cron` у Supabase кожні 5 хв робить `net.http_post` на `/api/internal/social/publish-due`, `/api/internal/weekly/generate` і `/api/internal/weekly/release-due`, а `social_compose_review` — кожні 30 хв. За добу це **864** виклики трьох 5-хвилинних задач, кожен — Node cold start функції. На момент перевірки жодна з трьох черг не мала роботи: усі соцканали вимкнені, а generation і release черги порожні. (source: `cron.job_run_details` live check 2026-10-26; read-only перевірка предикатів 2026-10-26)

Оцінка: ~20–25% CPU (assumption: ~150 мс CPU на cold start × ~860 викликів/добу).

### Джерело 2 — site-wide purge на кожну публікацію

Усі anon PostgREST читання мають один тег `public-content` (`src/lib/supabase-anon-fetch.ts`, `src/lib/public-content-cache.ts`). Auto-publish і daily visual finalizer (через `/api/revalidate`), Telegram publish і editor-take викликали `revalidateTag('public-content', 'max')`. Це позначає stale **кожну** сторінку, що читала дані. Перший хіт бота (Amazonbot, ClaudeBot, Semrush, Exa, facebookexternalhit…) на будь-яку стару статтю запускав фонову перегенерацію. У вибірці 64 з 113 хітів статей мали `STALE`. (source: `vercel logs requests` 2026-10-26)

Оцінка: ~50–60% CPU (assumption, вибірка 1 год).

## Що змінено

1. **Гейт cron-опитувань.** `public.internal_poll_has_work(job)` — дешевий надмножинний предикат claim-RPC кожного воркера. Три 5-хвилинні jobs викликають `net.http_post … where public.internal_poll_has_work('<job>')`. Предикат соцпостів враховує kill switch, увімкнений канал, акаунт і бюджет X — без них «due» рядки вимкнених каналів тримали б гейт відкритим. `social_compose_review` не змінено. (source: `supabase/migrations/20261026120000_gate_idle_vercel_cron_polls.sql`)
2. **Публікація без site-wide purge.** `revalidateSiteSurfaces()` і `/api/revalidate` роблять лише `revalidatePath` для хабів (home, news, категорії, digests, concepts, sitemap, rss) і переданих шляхів. Свіжі дані на цих шляхах гарантують soft tags: Data Cache і `unstable_cache` перевіряють soft tags маршруту (`_N_T_/…`) і після `revalidatePath` віддають свіжі дані. Editor-take ревалідує лише свої дві сторінки статті. `revalidatePublicContentTag()` лишився для тижневого релізу та явного `{ "purgeAll": true }` на `/api/revalidate`. (source: `src/lib/revalidate-site.ts`, `src/app/api/revalidate/route.ts`, `src/app/api/telegram/route.ts`; Next docs `revalidatePath.md`)

Компроміс: блок «related stories» на старих статтях може бути застарілим до 24 год (TTL сторінки статті) — замість повного перерендеру каталогу на кожну публікацію.

## Що перевірити після деплою

- Supabase: `select jobname, count(*) from cron.job_run_details …` має лишитись ~288/добу на job, але `net._http_response` — лише коли була робота.
- Vercel: `vercel usage --breakdown daily` — Fluid Active CPU і ISR writes мають помітно впасти; `vercel logs requests` — частка `STALE` на `/[lang]/news/[category]/[item]` має впасти.

## Related pages

- [vercel-origin-transfer](vercel-origin-transfer.md)
- [vercel-image-quota](vercel-image-quota.md)
- [social-cms-runbook](social-cms-runbook.md)
- [weekly-admin-runbook](weekly-admin-runbook.md)
- [github-actions-cost](github-actions-cost.md)
