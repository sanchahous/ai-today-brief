# Weekly Digest — Content Studio v2

Summary: як працює weekly-дайджест у проді: оркестрація, ревізії, артефакти, вартісні
гейтами, admin UX і поточний статус розкатки.
Sources: `.env.example`, PR #160–#163, #167–#175, #177, `src/lib/weekly-digest/**`,
`supabase/migrations/20260804090000_weekly_digest_revision_stability.sql`,
`supabase/migrations/20260806150000_weekly_video_script_job.sql`,
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
4. `social_copy` / `pdf` / `video_script` (після approved `article` — окремий job, PR6, той самий
   Claude CLI → OpenRouter → Gemini ladder)
5. `video_manifest` (після approved `video_script` + 3 approved `story_image` + `cover`) →
   зовнішній Remotion
6. import `video_final` + captions + thumbnail

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
master prompt **`weekly-master-v6`**: після деплою **Start / retry Content Studio** ставить
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

**PR3 (2026-08-06):** critic rubric redesign + line-edit pass. Critic dimensions `hook`/`structure`
replaced by **`engagement`**/**`voice`** (still 7 dims total); `criticPrompt` (`editorial-llm.ts`)
now carries a written rubric — 3 anchors per dimension (what 90/75/55 look like) — and requires
quoted offending spans for any score below 80. `generateWeeklyMaster` gained an in-process
**revise loop**: on a gate failure where every issue is prose-level (`reportIsRevisable`,
`content-studio.ts` — excludes grounding/structural codes like `unsupported_claim_id`,
`shorts_contract`, `bilingual_claim_parity`), it sends a targeted `reviseArticlePrompt` ("fix only
these named fields, return everything else byte-for-byte identical") instead of a full EN+UK
regenerate, capped at **2 attempts** before falling through to the existing gate-failure/draft-
revision path. English revise always triggers a Ukrainian re-adapt (never a blind UK line-edit)
so the two locales don't drift out of narrative sync. Cost across every write/critic call in one
`generateWeeklyMaster` invocation (initial + revise attempts) is summed, not just the last —
fixes what would otherwise be a cost-undercounting bug the moment revise fired.

Cross-job retry guidance (`priorMasterRetryGuidance`, `generation-worker.ts`) changed from
"merge every historical critic verdict for this revision, de-duped, keep newest wording" to
**latest report only**. The old version had a one-way ratchet: a code once seen for a
revisionItemId+field was echoed on every subsequent retry forever, even after it was fixed,
because nothing ever removed it once added — the documented mechanism behind "retries get
blander." `WEEKLY_MASTER_SPEC_VERSION` bumped `v5` → `v6` (dimension-set change forces regen).

**Acceptance test — PASSED (2026-08-06, live критик-прогін, `anthropic/claude-sonnet-4.5`
через OpenRouter):** новий критик проти збереженого master `ai-weekly-2026-07-27` (той самий
контент, що й раніше давав 93/100) дав **73/100** — `voice: 68` (< поріг 75), `naturalness: 70`
(< поріг 80). Критик самостійно, без підказки, процитував рівно ті фрази, на які скаржився
власник: `"Обмеження полягає в тому, що цей звіт стосується…"`, `"For product and security
leaders, the tension is clear."`. Якорі рубрики дискримінують за призначенням.

**Знайдено й виправлено живим прогоном:** критик вільно вигадував власні коди issues
(`VOICE_TEMPLATE_LEAK`, `NATURALNESS_CALQUE` тощо), які НЕ співпадали з
`isRevisableIssueCode`'s очікуваним списком (`template_leak:*`, `dimension_low_score:*`) —
це тихо відправляло б чисто-текстові провали в full-regenerate замість targeted revise.
Фікс: `criticPrompt` тепер задає закритий словник із шести кодів для non-factual issues
(`voice_register`, `engagement_structure`, `clarity_unclear`, `trust_attribution`,
`usefulness_generic`, `naturalness_calque`); `REVISABLE_ISSUE_CODES` розширено відповідно.
(source: `src/lib/weekly-digest/editorial-llm.ts`, `src/lib/weekly-digest/content-studio.ts`,
`src/lib/weekly-digest/generation-worker.ts`, live прогін `tmp/pr3-shadow-critic/` 2026-08-06)

**PR4 (2026-08-06):** owner-set editorial angle per Top-3 story — the first human-in-the-loop
point the plan called for (~30–60 хв/випуск). New table
**`weekly_digest_story_directions`** (migration `20260806140000_weekly_digest_story_directions.sql`
— **written, not yet applied to the live DB**; DDL goes through the normal deploy pipeline,
not an ad-hoc call from this session), one row per `(weekly_digest_id, brief_item_id)` — keyed
by `brief_item_id`, not `revision_item_id`, so the angle survives the revision churn a Save
mints (#177/#187 fragility history). Research tab: each Feature card gets a "Кут подачі ·
Editorial angle" textarea (`saveWeeklyStoryDirectionAction`, upsert; empty value deletes the row);
a stats tile shows `N/3` coverage. `masterInputStories` (`generation-worker.ts`) joins directions
by `brief_item_id` and injects `angle` onto `WeeklyMasterInputStory`; `englishPrompt`
(`editorial-llm.ts`) treats a present angle as the owner's **binding editorial direction** for
that story. Reads/writes degrade gracefully (empty map / empty array, not a thrown error) if the
table isn't migrated yet — the admin workspace never 500s over this being optional.

**Scope trim from the written plan:** the plan sketched research-pack-proposed angle *suggestions*
(2–3 AI-generated options to pick from). `buildWeeklyResearchPack` (`research.ts`) is currently
100% deterministic — zero LLM calls, zero failure modes beyond network fetch. Adding suggestion
generation would mean a new paid LLM call inside an otherwise rock-solid stage, for a feature
whose core value (owner can set a binding angle) doesn't require it. Shipped free-text only;
AI-suggested angles are a possible follow-up, not done here.
(source: `supabase/migrations/20260806140000_weekly_digest_story_directions.sql`,
`src/app/admin/(cms)/weekly/actions.ts`, `src/components/admin/weekly-workspace.tsx`,
`src/lib/weekly-digest/generation-worker.ts`, `src/lib/weekly-digest/editorial-llm.ts`)

**PR5 (2026-08-06):** репортажні ілюстрації + вибір варіантів — другий human-in-the-loop пункт.
Новий, повністю окремий шлях у **`pipeline/card-image.ts`**: `weeklyReportageSceneBrief` (арт-
директор-промпт просить документальний, репортажний кадр реальної події — "picture a
photographer standing in the room where this happened" — а не символічну метафору) +
`buildWeeklyPrompt` (документальний стиль, 35mm, один наскрізний акцент) +
`generateWeeklyReportageIllustrations` (3 варіанти на одному сценарії/промпті, різні сіди).
**Daily-пайплайн (`sceneBrief`/`buildPrompt`/`fillCardImages`) не зачеплений** — окремі функції,
спільний лише provider-ladder (`generateImage`) і рефакторений `runArtDirectorLadder`.

Контекст для арт-директора розширено з title+summary до title+summary+перші ~600 симв. body+
editorsView (`generateStoryImage`, generation-worker.ts) — суттєво більше матеріалу, ніж daily-шлях
коли-небудь отримує. Seed більше не містить `job.id` (`digestId:revisionId:itemId:v{n}`) —
регенерація тепер ітеративна, не лотерея. `metadata.prompt_policy` артефактів story_image —
**`weekly-reportage-v1`** (окремий, суворіший за daily's `story-specific-editorial-v5-no-text`;
деталі стилю — [marketing/card-images](../marketing/card-images.md)).

**Фікс мертвого negative prompt на klein:** `buildWeeklyPrompt` вшиває весь avoid-list у
позитивний промпт текстом (не окремим `negative_prompt` полем) — бо `runCloudflareMultipart`
(FLUX.2 klein, дефолтний провайдер) шле лише `prompt`/`width`/`height`, тож окремий
`negativePrompt()` ніколи фізично не долітав до моделі на цьому шляху.

**Зберігання варіантів:** RPC `save_weekly_digest_artifact` **не підтримує кілька одночасних
`is_current` рядків на один `slot_key`** (кожен save демотує попередній) — тож 3 варіанти НЕ
зберігаються як окремі артефакти. Замість цього використано вже наявний генеричний механізм
`content.preview_paths` → `content.preview_urls` (той самий, яким PDF-джоба вже підписує превʼю
сторінок) — 2 альтернативи йдуть туди, основний варіант лишається `storage_path` того самого
`story_image` артефакту. `selectWeeklyArtifactVariantAction` — просто міняє місцями, який
уже завантажений файл є primary (без нового рендеру/аплоуду). Це свідоме відхилення від
початкового формулювання плану («3 артефакти в одному slot») — після прочитання реального SQL
RPC з'ясувалось, що воно було неточним.

Visuals tab: сітка з 2 мініатюр-альтернатив під основним зображенням (клік = «Use this»);
редагована сцена (`scene_override`) + «Regenerate with this scene» перевикористовує вже наявний
`enqueueWeeklyGenerationAction`, нового job type не знадобилось.

**Dry-run виконано (2026-08-06):** 9 klein-рендерів (3 сіди × 3 головні історії
`ai-weekly-2026-07-27`) через реальний Cloudflare Workers AI. Результат — генуїнно
фотореалістичні репортажні кадри (людина за клавіатурою, over-the-shoulder/збоку, монітори з
правдоподібним-але-нечитабельним кодом/UI, жодних «глоу-мізків» чи розбитих замків). Gemini-крок
сценарію відпрацював, не fallback. **Одна помічена проблема:** усі три історії конвергували до
схожої композиції «людина за багатомоніторним столом» — klein тримає репортажний РЕГІСТР добре,
але diversity сцен у межах одного випуску може потребувати уваги (можливо, розширити
`weeklyReportageSceneBrief` прикладами не-«людина за столом» кадрів). Дев'ять зображень
надіслано власнику для остаточної візуальної оцінки.
(source: `pipeline/card-image.ts`, `pipeline/card-image.test.ts`,
`src/lib/weekly-digest/generation-worker.ts`, `src/app/admin/(cms)/weekly/actions.ts`,
`src/components/admin/weekly-workspace.tsx`, migration `20260723095458_weekly_digest_v2.sql`,
live dry-run `tmp/pr5-klein-dryrun/` 2026-08-06
§ `save_weekly_digest_artifact`)

**PR6 (2026-08-06):** відеосценарій виніс з майстер-виклику в окремий job type + manifest v3.
Раніше `video` (title/hook/narration/scenes/shorts) писався **всередині того самого** мега-
виклику, що й 2000–3000-слівна стаття — задокументований корінь «німого слайдшоу» в
`ai-today-brief-video`: LLM вигадував `durationSeconds`, що сумарно дає 360–480с, поки реальний
narration-текст займав лише ~1000 символів (~97с мовлення)
(source: `ai-today-brief-video/wiki/research/2026-08-05-professional-ai-video-guide.md`).

Тепер: `WeeklyMasterBundle` втратив поле `video` повністю (лишились `en`/`uk`/`socialAngles`);
`editorial-llm.ts`'s `englishPrompt`/`parseEnglishPackage` більше не пишуть/парсять відео.
Новий модуль **`src/lib/weekly-digest/video-script-llm.ts`** — окремий LLM-виклик
(той самий provider-ladder Claude CLI → OpenRouter → Gemini, через щойно експортований
`generateFirstAvailable` з `editorial-llm.ts`) з драматургією теленовин: cold open (15–25с) →
anchor bridge (HeyGen-слот) → по одній b-roll сцені на кожну з трьох головних історій
(`revisionItemId` на сцені — заміна старого `index % assets.length`, який показував не ту
ілюстрацію) → radar quick-hits → discussion outro. **WPS-валідатор** (`validateVideoScript`,
`content-studio.ts`): кожна сцена має `durationSeconds ≈ words(voiceover)/2.6 ±20%` —
бʼє саме той баг, що й спричинив слайдшоу; плюс `shorts_count`/`shorts_contract` (3 UK Shorts,
факти лише зі своїх claimIds), `video_duration` (сума 360–480с), `scene_structure` (≥3 b-roll,
по одній на кожну feature-історію), `scene_story_link`, і template-leak-гейт (`bannedPhrasesFor`)
на voiceover/Shorts-полях. `WEEKLY_VIDEO_MANIFEST_VERSION` → `weekly-video-v3`; новий
`WEEKLY_VIDEO_SCRIPT_SCHEMA_VERSION`.

`video_script` — новий queueable job type (був лише artifact type, писався синхронно):
міграція `20260806150000_weekly_video_script_job.sql` розширює job_type CHECK +
`queue_weekly_digest_generation_job` + `claim_weekly_digest_generation_jobs` (claim-гейт:
2 approved article-артефакти, той самий гейт, що вже мав `story_image`/`social_copy`) —
**написана, не застосована до живої БД** (той самий підхід, що й PR4's directions-міграція).
`generateVideoManifest` тепер читає окремо `videoScriptFromArtifacts` (замість вимагати
video_script як частину `masterBundleFromArtifacts`) — фікс побічного багу: `generateSocialCopy`
раніше **не міг стартувати**, доки не існував video_script-артефакт, хоча соцконтенту він
ніколи не був потрібен; `socialAngles` тепер зберігається прямо в article:en-артефакті.
CLI-воркер (`run-weekly-master-cli-worker.ts`) дренує тепер і `editorial_master`, і
`video_script` (обидва — $0 через Claude-підписку). Video-панель адмінки отримала кнопку
«Generate script» (`enqueueWeeklyGenerationAction`, job_type `video_script`) + review-блок
(`ArtifactReview`) — video_manifest не стартує, доки script не Approved (той самий гейт, що
вже існував у claim RPC).

**Не верифіковано наживо** — на відміну від PR3 (critic shadow-run) і PR5 (klein dry-run), ця
зміна не мала окремого live-прогону в межах цієї сесії; покрито юніт-тестами
(`content-studio.test.ts`: 13 тестів на `validateVideoScript`, включно з WPS-мисметчем;
`video-script-llm.test.ts`: 4 тести на generate+retry+throw), typecheck/lint/vitest зелені.
Перед `shadow`-прогоном варто запустити `video_script` на реальному approved-артикулі й
прочитати згенерований сценарій, як це робилось для критика й ілюстрацій.
(source: `src/lib/weekly-digest/video-script-llm.ts`, `src/lib/weekly-digest/content-studio.ts`,
`src/lib/weekly-digest/editorial-llm.ts`, `src/lib/weekly-digest/generation-worker.ts`,
migration `20260806150000_weekly_video_script_job.sql`, `src/components/admin/weekly-workspace.tsx`,
`pipeline/scripts/run-weekly-master-cli-worker.ts`)

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
