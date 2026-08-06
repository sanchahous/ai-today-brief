# Weekly Digest — Content Studio v2

Summary: як працює weekly-дайджест у проді: оркестрація, ревізії, артефакти, вартісні
гейтами, admin UX і поточний статус розкатки.
Sources: `.env.example`, PR #160–#163, #167–#175, #177, `src/lib/weekly-digest/**`,
`supabase/migrations/20260804090000_weekly_digest_revision_stability.sql`,
live check Supabase 2026-08-04, editorial-voice overhaul (гілка `feat/weekly-editorial-voice`, 2026-08-06)
Last updated: 2026-08-06

---

## Що це

Щотижневий курований випуск (EN/UK) з мультиформатними артефактами: article, story images,
cover, PDF, social copy, video manifest → Remotion/YouTube. Редакція йде через
`/admin/weekly/[id]` (Overview / Stories / Research / Article / Visuals / Social / PDF /
Video / Release).

Відбір кандидатів — окрема сторінка [weekly-editorial-selection](weekly-editorial-selection.md).
Межа відео-рендеру — [video-boundary](video-boundary.md).

## Feature flag

`WEEKLY_CONTENT_STUDIO_V2` ∈ `{off, shadow, production}` (source: `.env.example`).

| Режим | Поведінка |
|---|---|
| `off` | Content Studio jobs / master start кидають помилку; UI показує, що studio вимкнено |
| `shadow` | Повний pipeline на історичних/тест-випусках без публічної доставки `(assumption: перевірити на shadow-ранні)` |
| `production` | Бойовий шлях |

Станом на **2026-08-04** у `.env.example` стоїть **`off`**. Перед `production` потрібні три
історичні випуски у `shadow` + вартісні метрики з `/admin/costs`.
(source: `.env.example`, [open-questions](../open-questions.md) #4)

## Пайплайн генерації

Черга `weekly_digest_generation_jobs` + claim RPC. Типовий порядок:

1. `research_pack` (top-3) → owner approve
2. `editorial_master` (OpenRouter writer models / Gemini / опційно Claude CLI через GitHub Actions)
3. `story_image` (після bilingual `article`) → `cover`
4. `social_copy` / `pdf` / `video_manifest` (manifest → зовнішній Remotion)
5. import `video_final` + captions + thumbnail

Hard spend-cap weekly master: `WEEKLY_MASTER_MAX_SPEND_USD` (default $4,
`generation-worker.ts`) + kill-switch режиму `off` (source: PR #163, `.env.example`).
Витрати пишуться в `generation_cost_events`, UI — `/admin/costs` (source: PR #169).

Картинки weekly/story: Cloudflare **FLUX.2 klein** (`@cf/black-forest-labs/flux-2-klein-9b`),
політика промпту `story-specific-editorial-v5-no-text` (без впеченого тексту в кадрі).
(source: PR #169–#175, `pipeline/card-image.ts`, `generation-worker.ts`)

### Evidence grounding (writer + critic)

Structured claims (`summary_en` + `facts_en`) залишаються обов’язковими, але **не єдиним**
джерелом правди. Research pack зберігає excerpt першоджерела до **12 000** символів
(`WEEKLY_RESEARCH_EXCERPT_MAX_CHARS`); writer і незалежний critic отримують claims **плюс**
`primarySourceExcerpt` / corroborating excerpts. Деталь, яка є в excerpt, але відсутня в
numbered claims, **не** має валитись як `UNSUPPORTED_*`.
(source: `editorial-llm.ts`, `research.ts`, `content-studio.ts`)

Studio version **`weekly-content-studio-v2.1`** + research schema **`weekly-research-v3`** +
master prompt **`weekly-master-v5`**: після деплою **Start / retry Content Studio** ставить
нові `research_pack` jobs (нові idempotency keys) → треба знову Approve Top 3 → тоді master.
(source: `WEEKLY_CONTENT_STUDIO_VERSION`, `WEEKLY_RESEARCH_SCHEMA_VERSION`,
`WEEKLY_MASTER_SPEC_VERSION`)

## Editorial voice overhaul (2026-08-06)

Власник забракував якість усього згенерованого контенту як «машинну» (сухий compliance-регістр,
абстрактні заголовки, службові мітки типу «Практичний сценарій:» просто в тілі статті). Перша
з семи запланованих PR цього перегляду landed тут: **`src/lib/weekly-digest/editorial-voice.ts`**
— єдине джерело редакційного голосу (позитивна модель стилю, few-shot контраст-пари «погано →
добре», список заборонених фраз/кальок, специфікація блоку «Погляд редакції»). Споживається
`editorial-llm.ts` (`englishPrompt`/`ukrainianPrompt`) і `content-studio.ts` (`detectTemplateLeaks`
— детермінований, безкоштовний гейт до критика).

Що змінилось у схемі історії (`WeeklyMasterStory`): додано `editorsView` (маркована editorial-
спекуляція, обов'язкова для трьох головних історій, 60–110 слів) і `discussionQuestion`
(дискусійне питання наприкінці); аудиторія промпту змінена з «product, technology and business
leaders» на «software builders, AI practitioners and the technically curious». `hook` лишився в
схемі, але не рендериться (як і раніше). Персистяться в
`weekly_digest_revision_items.source_snapshot.content_studio.{editors_view_en,editors_view_uk,
discussion_en,discussion_uk}` — без нової міграції.

**PR2 (2026-08-06):** рендеринг нової анатомії на сайті. `src/lib/digests.ts` читає
`content_studio.{editors_view_*,discussion_*,limitation_*}` (`contentStudioFrame`) →
`WeeklyDigestItemView.{editorsView,discussionQuestion,limitation}`. `weekly-story.tsx`: тіло —
чиста розповідь; `limitation` — приглушений рядок під takeaway-боксом; «Погляд редакції» —
окремий блок з пунктирною рамкою і явним дисклеймером (`copy.editorsViewNote`); `discussionQuestion`
— завершальне питання перед джерелами. Усі три блоки умовні (`{item.x ? … : null}`) — старі
випуски без цих полів рендеряться як раніше, без порожньої розмітки; перевірено вживу на
єдиному опублікованому випуску (`ai-weekly-2026-06-29`, старий формат) — 200 OK, без regressions.
PDF (`pdf.ts`) отримав `limitation`-панель тим самим шляхом (generation-worker.ts читає
`source_snapshot.content_studio` при білді `WeeklyPdfInput`); `editorsView`/`discussionQuestion`
у PDF свідомо не додані — окреме дизайн-рішення власника, не автоматичний перенос.
(source: `src/lib/digests.ts`, `src/components/weekly/weekly-story.tsx`,
`src/components/weekly/copy.ts`, `src/lib/weekly-digest/pdf.ts`, live check localhost 2026-08-06)

`detectTemplateLeaks` блокує точну реєстр-помилку зі знайденого прикладу (`ai-weekly-2026-07-27`):
речення в `body`, що відкриваються міткою поля («Practical scenario:», «Обмеження полягає в
тому», «Висновок для рішення:») замість того, щоб бути суцільною розповіддю. Версія майстер-
промпту `weekly-master-v5` (bump з v4) форсує реген існуючих чернеток при наступному Start/retry.

Верифікація перед продакшн-рол-аутом: shadow-прогін через `WEEKLY_CONTENT_STUDIO_V2=shadow` на
історичному випуску; критик-рубрика (нові виміри `engagement`/`voice`, PR3) ще не landed — до
того часу `editorialQualityFailures` продовжує оцінювати старими вимірами, а `detectTemplateLeaks`
вже ловить найгрубіші case'и незалежно від критика.
(source: `editorial-voice.ts`, `editorial-llm.ts`, `content-studio.ts`, `generation-worker.ts`,
owner session 2026-08-06)

## Імутабельні ревізії (критично)

Кожне реальне редагування створює **нову** `weekly_digest_revisions` (+ items). Артефакти
переносяться (carry-forward), лише якщо `weekly_digest_artifact_input_hash` збігається.

**Інцидент 2026-08-04:** хеш вмикав volatile `item.id` / `revision_id`, тому кожен Save
скидав approved-артефакти в «missing/stale». Фікс (prod уже застосовано; git — PR **#177**):

- schema `weekly-artifact-input-v2` — ідентифікація історій лише через `brief_item_id`
- no-op Save при тому самому `content_hash` (без нової ревізії й без скидання апрувів)
- cancel orphaned jobs на superseded revision
- `revert_weekly_digest_revision` + UI «Editorial versions» на Overview
- `story_image` claim більше не вимагає `video_script`
- owner override (AAL2) може покрити trial blockers video-final / captions / thumbnail

(source: `supabase/migrations/20260804090000_weekly_digest_revision_stability.sql`, PR #177,
live check 2026-08-04)

## Поточний редакційний стан (live)

`ai-weekly-2026-07-27` (`in_review`): `artifact_stale = 0`. Залишилися реальні blockers —
апрув PDF, відсутній video pipeline (override-eligible), ~6 social variants на editor approve.
(source: Supabase `weekly_digest_preflight` live check 2026-08-04)

## Admin UX нотатки (серп 2026)

- Jobs на Overview згруповані по табах workspace (PR #170)
- Немає 5s auto-`router.refresh` blink під час queued jobs (PR #173)
- Preview URL version-bust після regen visuals (PR #172)
- Restore earlier version — Overview → Editorial versions (PR #177)
  - **Release preflight blockers** (Overview + Release): згруповані по секціях релізного
  шляху (Stories → Research → Article → Visuals → Social → PDF → Video), з `Step N of 8`,
  нумерацією всередині секції і лінком на вкладку. Приклад: `content_quality_report` —
  Research step 2 → апрув Top 3 packs → Start Content Studio → Master quality → Approve.
  (source: `src/lib/weekly-digest/preflight.ts`, `weekly-workspace.tsx`)
- **Research next-step UX:** якщо packs `ready` але ще не approved, UI показує amber
  «Next action: approve the three packs» і **не** крутить spinner так, ніби master
  зараз стартує. Overview має короткий Editor playbook. Повний гайд —
  [weekly-admin-runbook](../ops/weekly-admin-runbook.md).
  (source: `weekly-workspace.tsx`, 2026-08-04)
- **Social tab** (серп 2026): ілюстрації каналу показуються з `asset_urls` (не лише alt
  text / JSON); Destination URL автозаповнюється з clean weekly URL; Save & approve
  вимкнений при quality blockers (наприклад `schedule_past` — треба майбутній Kyiv
  час); помилки Save йдуть у `?tab=social&save_error=…` замість opaque server error;
  Save більше не стирає writer / hook / platformFit у `quality_report`.
  (source: `weekly-workspace.tsx`, `saveWeeklySocialAction`, `updateVariantAction`)

## Fluid CPU / вартість (2026-08-04)

`/api/internal/weekly/generate` (Supabase `pg_cron`, кожні 5 хв, 24/7) до фіксу тягнув
`sharp`/`pdfkit`/`pdfjs-dist`/`@napi-rs/canvas` на **верхньому рівні** `generation-worker.ts` —
навіть коли черга порожня. Це головний внесок у Vercel **Fluid Active CPU 3h58m/4h** на Hobby
(live check дешборду 2026-08-04, проєкт `ai-today-brief` = 99.8% витрати акаунта). Фікс: ці
залежності тепер завантажуються лінива (`import()`) лише всередині job-хендлера, який їх
реально використовує (source: `generation-worker.ts`, гілка `fix/vercel-fluid-cpu-cost`).

`finish_weekly_digest_generation_job` робив `output = p_output` (перезапис) замість мержу —
це стирало mid-attempt checkpoint `editorial_master` (`saveMasterCheckpoint`) на кожній
невдалій спробі, тож retry завжди перегенеровував повний EN+UK текст замість повторного
використання. Фікс — migration `20260804180000_weekly_digest_generation_job_output_merge.sql`
(вже застосована у прод-Supabase).

Таб-навігація `/admin/weekly/[id]` і список видань `/admin/weekly` юзали звичайний Next.js
`<Link>` з дефолтним prefetch; ~9 таб-лінків одразу у вʼюпорті на кожному завантаженні, кожен
самостійно префетчить той самий важкий force-dynamic route у проді. Додано `prefetch={false}`
в обох місцях — це був топ-1 route за invocation count у Vercel Observability (1.9K/12год).

pdfkit `Helvetica.afm` ENOENT (окрема підозра з тієї ж інвентаризації) виявився вже
полагодженим PR #152 (коміт `4710bb1`, 24.07: `font: INTER_FONT` у конструкторі
`PDFDocument`) — дій не потрібно. Content-hash caching для retry image/pdf-джобів
розглянуто й відхилено: живого бага немає, `retryableGenerationFailure` вже коректно не
ретраїть детерміновані помилки (наприклад, page-count contract violation у `generatePdf`).

## Related pages

- [editorial-voice](editorial-voice.md) — house style, exemplars, banned-phrase gate
- [weekly-editorial-selection](weekly-editorial-selection.md)
- [video-boundary](video-boundary.md)
- [weekly-admin-runbook](../ops/weekly-admin-runbook.md)
- [card-images](../marketing/card-images.md)
- [open-questions](../open-questions.md)
- [now](../now.md)
