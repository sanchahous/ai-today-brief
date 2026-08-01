# Ретро-дедуп опублікованих новин + опівнічний автопост брифів

> **Складено 2026-07-30.** Design-доk двох операційних задач для щоденного брифа. Grounded у
> `pipeline/{run-daily,db,config,embeddings,schedule,verify}.ts`, `src/app/api/telegram/route.ts`,
> `supabase/migrations/{018,020,026,031,039}*`, `src/lib/{news,home,briefs,items,indexnow}.ts`.
> Це план — код ще не написано; PR лише фіксує узгоджений підхід перед імплементацією.

---

## Context

Дві операційні прогалини щоденного брифа:

1. **Контекстні дублі в архіві.** Конвеєрний семантичний дедуп ріже кандидатів лише на дистанції ≤0.12 (`pipeline/config.ts:139`, свідомо ослаблено з 0.20, щоб не вбивати нові новини). Тому та сама подія, переказана іншими словами, проскакує в наступні випуски — опубліковані near-dupes живуть у смузі 0.12–0.25. Потрібна періодична джоба, що знаходить такі пари в архіві й лишає тільки першу запощену.
2. **Непереглянуті драфти.** Драфт висить у `status='draft'` безкінечно, поки власник не натисне 🚀 у Telegram — програмного шляху публікації нема (`handlePublish` — приватна функція вебхука). Потрібен опівнічний (Київ) автопост: авто-тріаж pending-айтемів фільтром, навченим на історії рішень власника (`item_reviews`), і публікація.

**Рішення власника (зафіксовані):** дублі — через `canonical_item_id` (308-редірект, патерн міграції 031), НЕ hard delete; застосування — автоматичне зі звітом у Telegram; айтеми з ⚠️ «джерело не підтверджує» — завжди авто-reject; строгість фільтра — калібрувати під історичну частку схвалень власника.

**Ключова інфраструктура вже є:** `brief_item_embeddings` (pgvector 768, HNSW, title-only, пишуться одразу після створення драфта — `run-daily.ts:581`), `item_reviews` (append-only лог approve/reject з причинами, пишеться в `route.ts:239/:355`), `canonical_item_id` + редірект (`src/lib/items.ts:199-212`, sitemap-виключення), GH Actions як ранер `npx tsx pipeline/*` з failure-alert патерном, `POST /api/revalidate` (Bearer `REVALIDATE_SECRET`, `{paths}`), `submitToIndexNow` у `src/lib/indexnow.ts` (pipeline-скрипти вміють імпортувати `@/lib/*` — прецедент `pipeline/scripts/indexnow-backfill.ts:12`).

---

## 1. Міграції (спершу, до коду)

### `supabase/migrations/20260730100000_find_duplicate_item_pairs.sql`
1. **Новий RPC** `find_duplicate_item_pairs(max_distance float8 default 0.30, window_days int default 45, recent_days int default 3, max_pairs int default 200)` → `table(earlier_id uuid, later_id uuid, distance float8, same_article boolean)`. Self-join `brief_item_embeddings` × `brief_items` × `briefs`:
   - обидві сторони: `b.status='published' and bi.review_status='approved' and bi.canonical_item_id is null and b.date >= current_date - window_days`;
   - тільки крос-бриф пари (`brief_id <> brief_id`; той самий день/різні edition — включно);
   - впорядкування пари row-value порівнянням `(date, edition, rank, id)` — `earlier` = кандидат у canonical (дух міграції 031);
   - `recent_days`: у стедді-стейті розглядаємо лише пари, де *пізніша* сторона опублікована за останні 3 дні (обмежує повторні LLM-питання без таблиці «бачених» пар); `recent_days=0` = backfill;
   - `same_article := earlier.article_id = later.article_id` (скрипт зливає без LLM);
   - `order by distance limit max_pairs`. `language sql stable`, `set search_path = public, extensions`, `revoke execute from public, anon, authenticated` (конвенції 026/039). 45-денне вікно ≈ ≤250k відстаней за один statement — ок без HNSW.
2. **`pipeline_runs` stage CHECK** += `'dedup_scan','auto_publish'` (drop/re-add за зразком 028).
3. **`item_reviews` action CHECK** += `'redone'` (defensive drop через `do $$`-пошук імені, як 020:68-81) — розблоковує закриття аудит-діри 🔁 redo.

### `supabase/migrations/20260730100500_public_reads_exclude_canonical.sql`
Перестворити три SECURITY DEFINER RPC з фільтром `and bi.canonical_item_id is null`:
- `search_brief_items` (тіло з 019) — додати фільтр;
- `search_facets` (тіло з 014) — додати фільтр **і** відсутній `review_status='approved'` (фікс наявного розбігу фасетів зі списком; змінить публічні лічильники — зазначити в PR);
- `get_concept_items` (тіло з 023) — додати фільтр. Гранти перевиставити явно.

**RLS `public_read_brief_items` НЕ чіпати** — сторінка айтема мусить читати злитий рядок, щоб віддати редірект (`items.ts:175-212`).

---

## 2. Задача 1 — `dedup-scan`

**Файли:** логіка `pipeline/dedup-scan.ts` (+ `.test.ts`), тонкий ранер `pipeline/scripts/dedup-scan.ts` (спліт як у weekly-digest).

Флоу ранера:
1. `loadPipelineConfig()`; прапори `--dry-run`, `--backfill` (→ `recent_days=0`), `--window-days` (45), `--max-distance` (0.30), `--max-pairs` (200).
2. Типізована обгортка `findDuplicateItemPairs` у `pipeline/db.ts` (патерн `matchRelevantItem` з `as any`-кастом, db.ts:700-716). 0 пар → лог stage `dedup_scan` `skipped`, вихід без Telegram-шуму.
3. Один batched select деталей пар: `id, slug, category_slug, title_en, summary_en, rank, brief_id, briefs(date, edition, slug)`.
4. **LLM-підтвердження**: чанки ≤40 пар, JSON-відповідь `{results:[{pair, same_event, confidence}]}` через спільний `generateJsonWithFallback` (див. §4). У промпті: обидва `title_en`+`summary_en`, дати, категорія, дистанція як хінт; явне розрізнення «та сама подія (анонс/реліз/інцидент) ≠ та сама тема/продукт». Зливаємо при `same_event && confidence ≥ 0.7`; `same_article`-пари — без питань.
5. **Кластеризація** (чиста, тестована): union-find по підтверджених парах; canonical кластера = мінімум за `(date, edition, rank, id)`.
6. **Запис** (пропускається на dry-run): `update brief_items set canonical_item_id=<primary> where id=<dupe> and canonical_item_id is null` — ідемпотентно, не перенаправляє вже злите.
7. **Пост-дії**: `POST ${SITE_URL}/api/revalidate` (Bearer `REVALIDATE_SECRET`) — 8 стандартних шляхів (як `revalidateSite()`, route.ts:168) + `/{en,uk}/news/{cat}/{slug}` кожного дубля; Telegram-звіт через `pipeline/telegram.ts sendMessage` (тільки якщо merges>0): `«пізніший» (дата) → «перший» (дата)` + лінк canonical, обрізання під 4096; лог `pipeline_runs` stage `dedup_scan`, meta `{pairs_candidate, pairs_confirmed, clusters, merged, merged_ids:[[dupe,primary],…], model}` — `merged_ids` = запис для відкату (`set canonical_item_id=null`).
8. Fail-closed: падіння LLM → нічого не зливаємо, ненульовий вихід тільки на жорстких помилках.

**Фільтри canonical у публічних вибірках (той самий PR)** — додати `.is('canonical_item_id', null)`:
- `src/lib/news.ts` `getNewsPageData` (:158-166) — перевірено, фільтра нема; RSS фіксується транзитивно;
- `src/lib/home.ts` `getHomeData` (:130-138);
- `src/lib/briefs.ts` `loadPackSections` (:132-136);
- `src/lib/items.ts` `getAdjacentStories` (:340-345), `getRelatedStories` (:381-389).
Сторінки айтема/sitemap/SSG вже обробляють canonical (`items.ts:199-212, :471, :521, :539`).

---

## 3. Задача 2 — `auto-publish`

**Файли:** логіка `pipeline/auto-publish.ts` (+ `.test.ts`), ранер `pipeline/scripts/auto-publish.ts`; `editMessageText` додати в `pipeline/telegram.ts` (семантика як `sendMessage`: лог + boolean, не кидає).

1. **Вибір цілі — тижневе вікно:** `briefs where status='draft' and date >= todayKyiv − 7 днів and date < todayKyiv` (`getPipelineDateKyiv()`, `pipeline/schedule.ts:25-32`), order date asc, edition asc — тобто джоба обробляє **не лише вчорашній драфт, а весь накопичений пул драфтів за останній тиждень**, від найстарішого до найновішого (кран стріляє після 00:00 Київ в обох DST-режимах, тож `date < today` = вчора і раніше). Кожен драфт обробляється незалежно (per-draft try/catch, окремий тріаж + публікація + Telegram-підсумок), тож один поганий пак не блокує решту; опубліковані брифи лягають на сайті під своїми оригінальними датами. Драфти **старші за 7 днів не чіпаються** (новини мертві) — якщо такі є, джоба лише згадує їх рядком у Telegram-підсумку («N застарілих драфтів поза вікном — без змін»). **Якщо вибірка порожня (власник усе опублікував вручну, драфтів нема) — джоба нічого не робить: тихий exit 0, без Telegram-повідомлень, без LLM-викликів; лише лог `pipeline_runs` stage `auto_publish` `skipped` для спостережуваності.** Dispatch-inputs: `--date` переозначує cutoff, `--window-days` (default 7) — розмір вікна. Гілки по кожному драфту: 0 pending + ≥1 approved → одразу публікація (власник вирішив, забув 🚀); 0/0 → тихий no-op; є pending → тріаж.
2. **Жорстке правило (до судді):** pending з `review_comment`, що містить `джерело не підтверджує` (маркер `autoReviewComment`, db.ts:388) → авто-reject, коментар = `<оригінальне попередження> | авто-відхилено: факт-чек не підтверджено`.
3. **Профіль смаку** з `item_reviews` (виключаючи `reviewer like 'auto:%'` — захист від самонавчання): частка схвалень `p = approved/(approved+rejected)` (загальна + по категоріях батча) + останні 40 approved (`title_en`, категорія) і 40 rejected (`title_en`, категорія, `comment` — причини відмов = головний сигнал).
4. **Суддя:** один batched JSON-виклик (`generateJsonWithFallback`): профіль + приклади + pending-айтеми (`ref, category, title_en, summary_en, why_matters_en`) → `{results:[{ref, verdict, confidence, reason}]}`. Промпт декларує історичну селективність власника і вимагає її емуляції.
5. **Калібрування «як моя статистика»** (чиста функція `calibrateVerdicts`): скор `s = approve ? confidence : 1-confidence`; ціль `k = round(p × N)`; фінал = top-k за `s`, розширення айтемами з `s ≥ 0.85` (CEIL), виключення з `s < 0.35` (FLOOR — квота не набивається сміттям). Константи — експортовані named consts.
6. **Застосування** (дзеркало вебхука, route.ts:224-247/:340-364): update `brief_items` з гардом `.eq('review_status','pending')` (`reviewed_by='auto:<model>'`, для reject `review_comment='авто: '+reason`); insert `item_reviews` (`action`, `comment`, `reviewer='auto:<model>'`, снапшот) тільки якщо update спрацював; редагування карток по `review_msg_id`: `decorateCard(buildAutoCardText(item), banner)` — `buildAutoCardText` реплікує контракт `buildCardText` (route.ts:466-483), банери `🤖 АВТО-СХВАЛЕНО / АВТО-ВІДХИЛЕНО` — чисті хелпери в `pipeline/auto-publish.ts`.
7. **Публікація** (репліка `handlePublish`, route.ts:413-458): гард approved ≥ 1, інакше лишити драфт + Telegram-нотатка «нічого не схвалено»; `update briefs set status='published', published_at=now() where id=? and status='draft'`; revalidate ті ж 8 шляхів; IndexNow — відтворити список URL з `pingIndexNow` (route.ts:185-206: головна, sitemaps, `/{lang}`, `/{lang}/news`, бриф, approved+canonical-null айтеми) через `submitToIndexNow` з `@/lib/indexnow`; Telegram-підсумок `🤖 Опівнічна авто-публікація` (✅/❌ лічильники, з них hard-rule, лінк); лог `pipeline_runs` stage `auto_publish` з meta.
8. **Відмови:** суддя недоступний (Gemini+OpenRouter) → не вгадувати: якщо є власницькі approved — опублікувати approved-only, pending лишити pending (RLS ховає їх з паблік) + Telegram-попередження; якщо 0 approved — нічого + алерт. Ніколи не авто-reject через інфраструктурний збій. Telegram/revalidate/IndexNow — best-effort. Гонка з власником о 00:04 — ті самі `pending`/`draft`-гарди, перший запис виграє.

**Бонус (той самий PR, ~6 рядків):** `handleRedo` (route.ts:388) перед delete вставляє `item_reviews` рядок `action='redone'` зі снапшотом — закриває діру навчальних даних.

---

## 4. Спільний рефактор

- `pipeline/llm-json.ts` (новий): винести `generateJsonWithFallback` з `pipeline/verify.ts:45-79` (verify.ts ре-імпортує) — одна Gemini→OpenRouter JSON-смуга на verify + обидві нові фічі. `/* v8 ignore */` на IO.
- `pipeline/log.ts`: розширити union `PipelineStage` (`dedup_scan`, `auto_publish`).
- `package.json`: скрипти `"dedup:scan"`, `"auto:publish"`.
- `vitest.config.ts`: додати обидва ранери в coverage `exclude` (прецедент — :46 `indexnow-backfill.ts`).

## 5. Workflows (`.github/workflows/`)

**`auto-publish.yml`:** cron `5 22 * * *` — 00:05 Київ узимку (EET) / 01:05 улітку (EEST): строго після півночі Києва в обох режимах, тож `getPipelineDateKyiv()` вже перекотився і вікно `[today−7, today)` покриває вчорашній драфт + накопичені за тиждень (коментар з DST-поясненням у YAML — конвенція репо). `workflow_dispatch` inputs: `dry_run`, `date`, `window_days` (default 7). `timeout-minutes: 15`, `concurrency` без cancel, checkout+node22+`npm ci`+`npx tsx pipeline/scripts/auto-publish.ts $ARGS` (bash-ARGS патерн pipeline.yml:79-87), failure-alert curl-блок з pipeline.yml:110-124 («⚠️ Auto-publish FAILED — чернетка не опублікована»). Env: стандартний пайплайн-набір + `REVALIDATE_SECRET`, `INDEXNOW_KEY`.

**`dedup-scan.yml`:** cron `35 22 * * *` (00:35/01:35 Київ — після автопосту, щоб свіжоопублікований пак сканувався тієї ж ночі). Inputs: `dry_run`, `backfill`, `window_days`. Той самий скелет; env без `INDEXNOW_KEY`, з `REVALIDATE_SECRET`.

**Нові GH-секрети:** `REVALIDATE_SECRET`, `INDEXNOW_KEY` (уже існують у Vercel env).

## 6. Тести (vitest, colocated)

- `pipeline/dedup-scan.test.ts`: union-find (транзитивність A~B~C), вибір canonical за `(date, edition, rank, id)` вкл. same-day/різні edition, білдер промпта + чанкування по 40, парсер вердиктів (галюциновані індекси відкидаються, поріг 0.7, авто-merge `same_article`), форматер звіту (обрізання, dry-run мітка).
- `pipeline/auto-publish.test.ts`: детектор hard-rule на повному форматі `autoReviewComment`, математика `p` (виключення `auto:%`, гард на 0 історії — пінити поведінку: без калібрування, тільки суддя), `calibrateVerdicts` (top-k, FLOOR, CEIL, краї N=1/k=0/усі-вище-CEIL), білдер профілю (капи 40+40, причини у промпті), предикат тижневого вікна (вчора → так; 6 днів тому → так; 8 днів тому → ні; сьогодні → ні), парсер відповіді судді (malformed JSON → кидає → fail-closed), банери + `buildAutoCardText` проти контракту вебхука.
- Тест на `redone`-вставку в `src/lib/telegram-webhook.test.ts`-стилі, якщо бонус їде.

## 7. Порядок виконання і верифікація

1. Feature branch; застосувати обидві міграції; SQL-перевірка: `select * from find_duplicate_item_pairs(0.30, 45, 0, 50)` повертає правдоподібні пари; пошук/концепт-хаб працюють.
2. Код + тести; `npm run pr:check`.
3. **Дедуп dry-run:** dispatch `dry_run=true, backfill=true, window_days=60` → перевірити звіт руками на 3-5 парах на живому сайті; за потреби стиснути `--max-distance` до 0.25.
4. **Дедуп live backfill:** dispatch `dry_run=false, backfill=true` → URL дубля 308-редіректить, зник з `/en/news`, RSS, sitemap, пошуку; `merged_ids` у `pipeline_runs`; реверс-тест одного злиття (`canonical_item_id=null` + revalidate).
5. **Автопост dry-run:** прямо на поточному накопиченому пулі драфтів dispatch `dry_run=true` → лог: усі цілі за тиждень, вердикти, калібрований результат, план публікації по кожному драфту; звірити reasons зі своїм смаком. Перший live-запуск розгребе цей пул.
6. **Автопост live:** дочекатися крону 22:05 UTC на реальному непереглянутому вечорі; вранці перевірити: картки з 🤖-банерами, `item_reviews` з `reviewer='auto:…'`, бриф на сайті, IndexNow-лог, підсумок у Telegram.

## 8. Ризики

| Ризик | Мітигація |
|---|---|
| LLM хибно зливає дві різні історії про один продукт | Промпт «подія ≠ тема», confidence ≥ 0.7, звіт з обома заголовками, `merged_ids` → відкат однією SQL |
| Title-only ембединги пропускають переангльовані дублі | Прийнятно: скан адитивний; не розширювати смугу за 0.35 (вибух хибних сусідів) |
| Canonical-фільтр ховає рядки, потрібні редіректу | Фільтри тільки в лістингових вибірках і definer-RPC; RLS і `getNewsItem` не чіпаються |
| Суддя дрейфує / вчиться на собі | Калібрування на `p`, виключення `auto:%` з профілю, всі рішення видимі як редаговані картки вранці |
| Збій судді опівночі | Fail-closed на рішеннях, fail-open на публікації власницьких approved; алерт |
| Крон пізній/подвійний | Предикат `date < today` незалежний від часу; concurrency-групи; всі записи ідемпотентні |
| `search_facets` змінить публічні лічильники | Це фікс коректності — окремо зазначити в PR |
| Код раніше міграції | Порядок §7 (міграції першими); `logStage` і так non-fatal |

## Список файлів

| Файл | Зміна |
|---|---|
| `supabase/migrations/20260730100000_find_duplicate_item_pairs.sql` | новий RPC + stage CHECK + action CHECK |
| `supabase/migrations/20260730100500_public_reads_exclude_canonical.sql` | 3 RPC з canonical-фільтром (+approved у facets) |
| `pipeline/llm-json.ts` (new) | спільний `generateJsonWithFallback` |
| `pipeline/dedup-scan.ts` + `.test.ts` (new) | кластеризація, промпти, парсери, оркестрація |
| `pipeline/scripts/dedup-scan.ts` (new) | ранер |
| `pipeline/auto-publish.ts` + `.test.ts` (new) | тріаж, профіль, калібрування, публікація |
| `pipeline/scripts/auto-publish.ts` (new) | ранер |
| `pipeline/db.ts` | обгортка `findDuplicateItemPairs` |
| `pipeline/telegram.ts` | `editMessageText` |
| `pipeline/log.ts` | stages `dedup_scan`, `auto_publish` |
| `pipeline/verify.ts` | ре-імпорт з `llm-json.ts` |
| `src/lib/news.ts`, `home.ts`, `briefs.ts`, `items.ts` | `.is('canonical_item_id', null)` у 5 вибірках |
| `src/app/api/telegram/route.ts` | бонус: `redone`-аудит у `handleRedo` |
| `.github/workflows/auto-publish.yml`, `dedup-scan.yml` (new) | крони 22:05 / 22:35 UTC |
| `vitest.config.ts`, `package.json` | exclude ранерів; npm-скрипти |
