# Weekly Digest — Content Studio v2

Summary: як працює weekly-дайджест у проді: оркестрація, ревізії, артефакти, вартісні
гейти, admin UX і поточний статус розкатки.
Sources: `.env.example`, PR #160–#189/#209, `src/lib/weekly-digest/**`,
`supabase/migrations/20260804*`–`20260809*`, live checks 2026-08-04…16,
editorial-voice overhaul, PDF page-cap, admin mobile-responsive,
owner content audit + seed-content 2026-08-16, research corpus corroboration 2026-08-16,
Start / retry Content Studio after succeeded jobs 2026-08-16, social package LinkedIn recovery
2026-08-17, GitHub dispatch 503 recovery 2026-08-17, staged social-copy recovery and
approval-ready Social boundary, clean Social job-history presentation 2026-08-17,
owner PDF layout review 2026-08-18,
Social media contract / Instagram 7-slide renderer / repair CLI 2026-08-18
Last updated: 2026-08-18

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
Ілюстрації дайджесту: `WEEKLY_STORY_IMAGE_MODE=prompt_only` (дефолт) або `render`.

| Режим | Поведінка |
|---|---|
| `off` | Content Studio jobs / master start кидають помилку; UI показує, що studio вимкнено |
| `shadow` | Повний pipeline на історичних/тест-випусках без публічної доставки `(assumption: перевірити на shadow-ранні)` |
| `production` | Бойовий шлях |

Станом на **2026-08-04** у `.env.example` стоїть **`off`**. Перед `production` потрібні три
історичні випуски у `shadow` + вартісні метрики з `/admin/costs`.
(source: `.env.example`, [open-questions](../open-questions.md) #4)

**Review-фікс 2026-08-15 (`feat/weekly-illustration-fixes`):** `resolveWeeklyStoryImageMode`
тепер `.trim().toLowerCase()` перед звіркою з `render` — раніше `RENDER`/пробіли мовчки давали
`prompt_only`. Новий env-кілл-свіч `OPENROUTER_RERANK_APPLY=off` для щоденного rerank-джоба
(F3) — без нього застосування нового ранжування можна лише вимкнути редагуванням коду.
(source: [audits/2026-08-15-illustration-pr-stack-review](../audits/2026-08-15-illustration-pr-stack-review.md),
`.env.example`)

## Seed-контент історій (2026-08-16)

Коли `WEEKLY_CONTENT_STUDIO_V2=off` (поточний дефолт), master-writer не запускається —
і власник редагує рівно те, що записав composer. А composer записував заглушку:
`body = summary`, `takeaway = why_matters`, `practical = null`. У прод-дайджесті
`6cbcf0b3-187d-4d7d-9eb9-66bdff1c72d4` це давало **7/7 історій, де «Повний текст»
дослівно дорівнював «Короткому опису», «Висновок» — «Чому це важливо», а «Практичний
приклад» порожній**: 2 заповнені поля з 5, з них 2 — дублікати.
(source: прод-`weekly_digest_revision_items` live check 2026-08-16)

Причина не в LLM: щоденний айтем **уже** містив потрібний текст, а composer просто не
вибирав ці колонки. `seedStoryContent` тепер мапить їх:

| Поле weekly-історії | Джерело в `brief_items` | Фолбек |
|---|---|---|
| `body_*` | `body_md_*` (Markdown, рендериться `MarkdownBody`) | `deep_dive_*` → `summary_*` |
| `practical_*` | `action_items_*` (до 2) | `when_to_use_*` з двомовним лід-іном → `null` |
| `takeaway_*` | `takeaways_*` (до 3) | `null` |

Модуль **нічого не генерує** — лише переносить уже схвалений людиною текст. Поля без
джерела лишаються `null`, щоб власник дописав їх сам, а не бачив копію сусіднього поля.
На тих самих 7 історіях фікс дає 5/5 заповнених полів без жодного дубля: `body` 271–1324
символи замість 187–308, `practical` 91–199, `takeaway` 163–317.
(source: `src/lib/weekly-digest/seed-content.ts`, `src/lib/social/composer.ts`, live seed
replay проти прод-даних 2026-08-16)

> Фікс застосовується до **нових** дайджестів. Уже створені ревізії імутабельні —
> існуючий випуск треба або перескладати, або дописувати руками.

## Перезбір відбору (2026-08-16)

Відбір історій робився **один раз**, при створенні дайджесту. Випуск, зібраний старим
селектором або до того, як денний бриф того ж тижня пройшов рев'ю, лишався замороженим
назавжди. Кнопка **Rebuild selection** (Overview, лише owner) ганяє поточний селектор по
тому самому тижню і мінтить нову активну ревізію.

- RPC `rebuild_weekly_digest_selection` (міграція `20260816120000`, `service_role` only).
  Ані `initialize_weekly_digest_revision_from_legacy` (працює лише коли `active_revision_id`
  порожній), ані `create_service_weekly_digest_revision` (вимагає готової двомовної статті:
  editor note, key takeaways, непорожні practical/takeaway на **кожній** історії) для цього
  не годяться — перезібраний відбір це seed-стадія.
- Логіка відбору спільна з нічним composer'ом (`selection-snapshot.ts`) — дві копії
  розійшлись би, і кнопка почала б обирати не те, що обирає джоба.
- **Руйнівна за задумом:** статус повертається в `in_review`, усі апрува (research, article,
  зображення, соц) скидаються — інший набір історій їх більше не описує. Попередня ревізія
  лишається в списку і відновлюється через Restore.
- Перевірено наскрізь на тестовому випуску `ai-weekly-test-2026-07-24`: 34 кандидати → 24
  eligible → 7 обраних, ревізія 3, 4 нові історії / 4 вибули, у всіх 7 усі поля різні й
  заповнені (`body` 681–1329 символів, `practical` 144–241).
  (source: live run 2026-08-16, прод-Supabase `mdiqfatpqczwqghwttpm`)

## Пайплайн генерації

Черга `weekly_digest_generation_jobs` + claim RPC. Типовий порядок:

1. `research_pack` (top-3) → owner approve
2. `editorial_master` (OpenRouter writer models / Gemini / опційно Claude CLI через GitHub Actions)
3. незалежні `story_image` (після bilingual `article`) запускаються паралельно → `cover`
4. `social_copy` / `pdf` / `video_script` (після approved `article` — окремий job, PR6, той самий
   Claude CLI → OpenRouter → Gemini ladder)
5. `video_manifest` (після approved `video_script` + 3 approved `story_image` + `cover`) →
   зовнішній Remotion
6. import `video_final` + captions + thumbnail

Hard spend-cap weekly master: `WEEKLY_MASTER_MAX_SPEND_USD` (default $4,
`generation-worker.ts`) + kill-switch режиму `off` (source: PR #163, `.env.example`).
Витрати пишуться в `generation_cost_events`, UI — `/admin/costs` (source: PR #169).

Картинки **новин** на сайті: Cloudflare **FLUX.2 klein** (`@cf/black-forest-labs/flux-2-klein-9b`).
Weekly story/cover за замовчуванням `WEEKLY_STORY_IMAGE_MODE=prompt_only`: worker пише
`story_prompt_set` і не кличе FLUX; `render` повертає старий цикл. Політика планування
концептів — `weekly-semantic-story-v5.1` (без впеченого тексту в кадрі).
(source: PR #169–#175, `.env.example`, `pipeline/card-image.ts`, `generation-worker.ts`)

### Evidence grounding (writer + critic)

Structured claims (`summary_en` + `facts_en`) залишаються обов’язковими, але **не єдиним**
джерелом правди. Research pack зберігає excerpt першоджерела до **12 000** символів
(`WEEKLY_RESEARCH_EXCERPT_MAX_CHARS`); writer і незалежний critic отримують claims **плюс**
`primarySourceExcerpt` / corroborating excerpts. Деталь, яка є в excerpt, але відсутня в
numbered claims, **не** має валитись як `UNSUPPORTED_*`.
(source: `editorial-llm.ts`, `research.ts`, `content-studio.ts`)

### Corpus corroboration in research packs (2026-08-16)

`independent_source_count` на Feature-паку — це не бал селекції v3. Пак фетчить до двох
незалежних сторінок і кладе їх у `corroboratingSources`. До цього фіксу кандидатами були
лише `sources[1+]` і `citation_urls` щоденного айтема. Summarize має право цитувати тільки
URL з промпту, тож набір майже завжди = primary → прапорець `no_independent_corroboration`
на всіх трьох Feature цього тижня, навіть коли в `articles` уже лежала картка моделі.

Тепер `buildWeeklyResearchPack` додає сторінки з ingest-корпусу за вікно тижня ± кілька
днів (`corroborationWindow`), якщо вони:

- інший видавець (не той самий хост і не discussion HN/Reddit/X/Lobsters);
- той самий `cluster_id`, **або** спільний розпізнавальний ідентифікатор (model card
  `org/model`, GitHub `owner/repo`, CVE, slug із цифрою ≥12 символів, наприклад
  `qwen3-8-2-4t-a95b`).

На прод-даних тижня 09–15.08 NVIDIA-блог про Qwen3.8 2.4T знаходить
`huggingface.co/Qwen/Qwen3.8-2.4T-A95B` і ModelScope; звіт HF і ALTK-Evolve лишаються 0 —
у корпусі немає другого видавця, і це чесний нуль. Тред HN у цитатах більше не фетчиться
як «підтвердження».

Після мерджу #268 перезбір паків на rev.3 лишив Qwen на `independent_source_count=0`.
Дві причини, обидві підтверджені наживо 2026-08-16: (1) `select` без `.range()` ріже
PostgREST default **1000** рядків, а у вікні 09–15.08 ± padding було **2440** `articles`
(HF-картка — рядок 1551 за `published_at`); (2) картки HF/ModelScope — JS-оболонки,
`extractMainText` дає 0 символів при HTTP 200, і пак відкидав їх як «немає тексту».
Корпус тепер гортає сторінки по 1000 (до 8), а для **не-primary** сторінки досить
`<title>` + meta description.
(source: `pipeline/story-identity.ts`, `pipeline/page-url.ts`, `src/lib/weekly-digest/research.ts`,
прод-`articles` live check 2026-08-16, rebuild packs rev.3 2026-08-16)

Writer: якщо `corroboratingExcerpts` порожній, кожне число в історії має бути атрибутоване
primary (`according to NVIDIA`, `self-reported`). Це не гейт апруву пака.
(source: `editorial-llm.ts` `storySegmentPrompt`)

Fetch на етапі `prepareArticles` тепер дедупить за канонічним URL (без `www`, UTM, trailing
slash). Це прибирає дубль на кшталт `…/previewing-ultrafast` vs `…/ultrafast/`. Daily rank
з 2026-08-16 додатково клеїть **ownership однієї події** (дві спільні сутності + лексика
угоди) і `storyIdentityKeys`, тож офіційний пост Cursor і TechCrunch close більше не
роз’їжджаються на `mentions_count = 1`. Решта різних URL без identity/ownership лишається
окремими кластерами.
(source: `pipeline/rank.ts`, `pipeline/reader-tools.ts`, `pipeline/fetch.ts`,
[weekly-editorial-selection](weekly-editorial-selection.md))

## Durable generation control plane (implementation 2026-08-09)

`weekly_digest_generation_jobs` is the logical job; each actual worker lease is an append-only
row in `weekly_digest_generation_attempts`, and state transitions/provider calls are stored in
`weekly_digest_generation_events`. A completion/checkpoint is accepted only when its
`attempt_id + lease_token` is still current, so an evicted Vercel process cannot overwrite a
newer retry. The job snapshot contains `current_step`, provider/model, monotonic progress,
heartbeat, next retry, failure code and human-readable status reason.
(source: `supabase/migrations/20260809060929_weekly_generation_control_plane.sql`)

| Job type | Worker | Time budget |
|---|---|---|
| `editorial_master`, `social_copy`, `video_script`, `story_image` | one fenced GitHub Actions run per job | 120 min workflow timeout |
| `research_pack`, `cover`, `pdf`, `social_asset`, `video_manifest` | Vercel | internal 240 s deadline under the 300 s platform cap |

The database `pg_cron` reaper runs each minute with a 90-second stale-heartbeat threshold. The
five-minute internal route claims only short Vercel jobs and dispatches up to ten eligible long jobs
at the start of the request. Queuing a long job from admin also dispatches it immediately. GitHub
receives its exact `job_id`, job type and one-time dispatch token; editorial jobs keep a per-digest
concurrency group, while `story_image` uses per-job concurrency so different stories render in
parallel. A runner cannot drain an unrelated job. Independent research/post-master jobs are queued
in parallel, but the Vercel route deliberately claims one short job per invocation so PDF
rasterization cannot exhaust the lease. Retryable infrastructure failures back off for
1, 5 then 15 minutes; validation, quality and quota failures are terminal and require a linked
manual retry. Legacy counter-only attempts are materialized during migration so historical retry
counts are not rewritten as one fictional run; a stale legacy long job becomes terminal
`legacy_worker_timeout` and receives exactly one linked GitHub recovery job with `Attempt 1/3`.
(source: `.github/workflows/weekly-master-cli-worker.yml`,
`pipeline/scripts/run-weekly-master-cli-worker.ts`, `src/lib/weekly-digest/generation-worker.ts`,
`src/app/api/internal/weekly/generate/route.ts`)

Linked manual retry is idempotent per terminal source: the RPC locks the source row and returns an
existing live or succeeded child instead of inserting another one. A partial unique index also
prevents two active retry children if a caller bypasses the RPC lock. Failed/cancelled child jobs
remain immutable history and can themselves be retried as the next link in the chain. (source:
`supabase/migrations/20260811185251_weekly_manual_retry_idempotency.sql`)

`story_image` moved from Vercel to the long-lived worker after the first v4 production run on
2026-08-11. Three consecutive `/api/internal/weekly/generate` invocations at 20:00, 20:05 and
20:10 Kyiv each hit Vercel's exact 300-second timeout: one image spent 40–137 seconds per sequential
OpenRouter art-direction call, retried rejected metaphors, and never reached FLUX before the whole
request died. The provider's own absolute ceiling was 720 seconds, already longer than the entire
serverless invocation. The migration preserves a live Vercel lease but routes any recovery attempt
to GitHub. If Regenerate already created multiple recoverable rows for one `revision_item_id`, the
live lease or newest request wins and older retry/stale rows are cancelled as
`superseded_by_regeneration`; only the winner receives restored durable attempts. (source: Vercel
production runtime logs and Supabase production queue snapshot 2026-08-11,
`src/app/api/internal/weekly/generate/route.ts`,
`supabase/migrations/20260811183201_weekly_story_image_async_worker.sql`)

Після owner-аудиту Story 2/3/5/6 image quality loop скорочено з пʼяти до **двох** раундів:
initial 3-concept diagnosis і один 3-concept semantic re-plan. Один semantic contract живить
three-seat jury (`literal_context` / `mechanism` / `consequence`); validator вимагає різні subject,
motif, setting і physical action, а не косметичну seed-варіацію однієї сцени. Три FLUX renders і
три vision reviews всередині batch виконуються паралельно; кожен vision бачить metadata власної
концепції. Critiques усіх варіантів агрегуються; якщо всі три
провалюють news/context/mechanism/consequence, repair відкидає метафору, а не продовжує той самий
seed roulette. Обидва результати зберігають три variants, тому пізній repair більше не замінює
першу трійку одним кадром. Opaque tubes/canisters/switchboards/data-flow machinery fail до нового
paid vision, якщо це не буквальний контекст source story; critic окремо вимагає pixel evidence й
headline-substitution test. (source: `src/lib/content-sim/config.ts`,
`src/lib/content-sim/adapters/weekly-image.ts`, `src/lib/content-sim/vision-critic.ts`,
`pipeline/card-image.ts`)

Image/vision spend тепер записується в `generation_cost_events` на кожен provider call одразу,
а не одним aggregate event лише після успішного artifact save. Visuals показує `Current run cost`
і `Story revision spend` із render/vision split; pre-change aggregate rows лишаються видимими як
legacy. Це включає витрати job, який згодом упав або був перерваний після вже успішного provider
call. (source: `src/lib/weekly-digest/generation-worker.ts`,
`src/lib/weekly-digest/admin-data.ts`, `src/components/admin/weekly-workspace.tsx`)

`editorial_master` лишається послідовним усередині segment/checkpoint loop, а `social_copy` —
послідовним по каналах: обидва порядки потрібні для durable resume після timeout. Уже паралельні
без зміни контракту: завантаження даних контексту, research corroboration, PDF story assets і
варіанти cover. Queuing трьох research packs та похідних jobs після master також виконується
паралельно, оскільки їхній фактичний старт усе одно контролюють DB dependency gates.
(source: `src/lib/weekly-digest/orchestrator.ts`, `src/lib/weekly-digest/generation-worker.ts`,
`src/lib/weekly-digest/research.ts`, `src/lib/weekly-digest/pdf.ts`, `src/lib/weekly-digest/visuals.ts`)

The admin workspace polls `/api/admin/weekly/[id]/generation-status` every five seconds without
refreshing the editor. It displays attempt/max, backend/run link, current step/provider/model,
progress, elapsed/deadline ETA, heartbeat, retry timing, terminal reason and a compact event
timeline. Until five comparable successful samples exist, ETA is explicitly labelled as the
configured budget rather than invented precision.
(source: `src/components/admin/weekly-generation-jobs-live.tsx`,
`src/app/api/admin/weekly/[id]/generation-status/route.ts`,
`src/lib/weekly-digest/generation-control.ts`)

### Social package + LinkedIn document recovery (2026-08-17)

Один `social_copy` job генерує пакет для всіх шести каналів, а після канальних writer/critic
calls збирає Instagram carousel і семисторінковий native LinkedIn document. 17.08 production job
зберіг усі вісім Instagram slides, але впав одразу після них на
`Cannot read properties of undefined (reading 'map')`: поточний `article` artifact має
нормалізовані `editor_note` / `key_takeaways` і не містить `stories`, тоді як LinkedIn builder
звертався до `bundle.en.stories.map`.

`masterBundleFromArtifacts` тепер приймає обидві форми: статтєві metadata читає з artifact
(включно зі snake_case полями), а stories безпечно відновлює з active
`weekly_digest_revision_items`. Отже, social prompt і LinkedIn document отримують один повний
master bundle; некоректний artifact дає точну validation-помилку, а не opaque `undefined.map`.
Linked manual retry як і раніше створює окремий job, тому після деплою треба натиснути retry
саме для terminal `social_copy` job.
(source: production `weekly_digest_generation_jobs` / `weekly_digest_artifacts` incident
2026-08-17; `src/lib/weekly-digest/generation-worker.ts`,
`src/lib/weekly-digest/linkedin-document.ts`, `generation-worker.test.ts`)

Два наступні linked jobs (`f39b2429…`, `d716aaef…`) уже пройшли hydration, але terminal-failed
на наступному детермінованому гейті: `LinkedIn document rendered 8 pages; expected 7.` Live
метрики показали production-sized copy, якої не було у фікстурі: standfirst 1018 символів
проти 101 у тесті, takeaways до 205, story fields до 278 і source URL до 130 символів. PDFKit
автоматично створював восьму сторінку при overflow, а фінальний page-count guard правильно
відхиляв файл. Renderer тепер задає bounded/ellipsis regions для cover, Top 3, Radar, next-week
і sources; на sources видно компактний host, але link веде на повний URL. Gate лишається рівно
7 сторінок. Regression test рендерить довгі production-shaped поля і перевіряє фактичну
кількість сторінок через PDF preview.
(source: production jobs `f39b2429-63b1-4e08-82f9-fa496fa34840`,
`d716aaef-f902-430f-b811-1f496852dd0c`, Actions runs `32043513443` / `32044207908`,
read-only production length metrics 2026-08-17; `src/lib/weekly-digest/linkedin-document.ts`,
`linkedin-document.test.ts`)

### Staged social-copy checkpoints across linked retries (2026-08-17)

Старий `social_copy` checkpoint зберігав `tokens` і готові channel adaptations після кожного
writer/critic, але worker читав його лише з `output` поточного job. Manual **Create linked
retry** створює новий рядок через `retry_of_job_id`, тому child не бачив parent output і знову
платив за всі шість каналів. Live read-only SQL підтвердив legacy keys
`socialCopyCheckpointHash` / `tokens` / `adaptations` у recent linked jobs.
(source: прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-17;
`src/lib/weekly-digest/generation-worker.ts`)

Новий versioned `social_copy_checkpoint` обходить linked retry-chain, приймає legacy v1 state,
перевіряє digest/revision + hash approved bilingual source і вибирає найдальший цілісний стан.
Відновлений parent state одразу записується в child. Дорогий результат тепер фіксується до
необов'язкових observability writes; зміна approved article або locale map змінює input hash і
fail-closed забороняє домішувати старий copy до нового випуску.
(source: `src/lib/weekly-digest/social-checkpoint.ts`,
`src/lib/weekly-digest/generation-worker.ts`, `social-checkpoint.test.ts`)

Durable межі тепер окремі: кожен із 6 channel writer+critic results → рівно 7 Instagram
slide artifacts (1080×1350 JPEG) → LinkedIn native-document artifact → `social_packages` draft → кожен
`social_posts` row + immutable `generated` review. Stable artifact/package/post IDs лежать у
checkpoint; при resume storage URLs перевидаються, а готові images/PDF/rows перевикористовуються.
Package і posts переходять із `draft` у `in_review` лише після повного набору шести reviews.
Нових таблиць або RPC не додано: state використовує fenced JSONB `job.output` і наявні durable
artifact/social ledgers.
(source: `src/lib/weekly-digest/generation-worker.ts`,
`src/lib/weekly-digest/generation-control.ts`,
`supabase/migrations/20260809060929_weekly_generation_control_plane.sql`,
прод-Supabase `mdiqfatpqczwqghwttpm` schema check 2026-08-17)

### Approval-ready Social boundary (2026-08-17)

Quality audit раніше був лише діагностикою: worker зберігав adaptation із `blocking[]`, а в кінці
безумовно переводив усі `draft` posts/package у `in_review`. Тому власник отримував шість карток
із червоними blockers замість матеріалу для рішення. Тепер кожен канал має bounded repair:
writer повертає кілька кандидатів, невдалий раунд отримує точні причини для переписування,
максимум три writer rounds. Після live latency check critic аудіює найсильніший deterministic
candidate кожного round, а не всі три: це дає не більше трьох writer/critic pairs на канал.
`social_copy` має окремий **per-model** OpenRouter ceiling 60 s (first token 30 s, idle 20 s),
не більше двох моделей на writer/critic call, 4 096/2 048 output tokens і `reasoning.effort=low`;
це обмежує worst-case provider ladder, а не лише одну його сходинку. Перший 180-секундний
hotfix виявився недостатнім саме тому, що queue могла послідовно витратити цей ceiling тричі.
Після live run `32059830080` router також більше не трактує registry default як owner DB override:
override існує лише за реально збереженого `social.writer` / `social.critic` chain. Writer queue
починається зі швидкої current OpenAI mini lane; DeepSeek/Qwen лишаються bounded fallback після
зафіксованих first-token timeout / HTTP 429. Live probe з production DB і prompt 63 147 chars
пройшов на `~openai/gpt-mini-latest`: first token 921 ms, complete 1 507 ms, без fallback.
Якщо всі social providers усе ж тимчасово недоступні, failure класифікується як retryable
`provider_exhausted`; control plane робить backoff і відновлює вже збережені канали замість
terminal `unknown` та нового ручного кола.
Writer candidate serialization (`2–3` variants через `<CANDIDATE>` або supported separator)
тепер перевіряється всередині provider response validator. Тому malformed repair response
від однієї моделі переходить на наступну модель тієї ж queue, а не завершує весь channel job.
Factual/platform critic зауваження тепер підпорядковуються власним score-порогам: при
`score >= 85` або `platformFitScore >= 85` вони зберігаються як warning, а не blocker; нижче
85 точний flag і score залишаються blocking та запускають repair. Раніше будь-який flag блокував
навіть прохідний score, тому production Threads вичерпав три repair rounds лише з
`critic_flag`, без `critic_score` чи `platform_fit`. Quality exhaustion також отримує явний
`quality_gate` code і зберігає точні blocker messages у terminal diagnostic.
(source: `src/lib/weekly-digest/social-adapter.ts`,
`src/lib/weekly-digest/generation-control.ts`, production run `32062624113`)
Existing legacy posts тепер знаходяться до repair/update branch незалежно від того, чи вже є
`checkpoint.postIds[channel]`. Це дає першому staged recovery замінити старі blocker-filled
`quality_report` clean versioned content, створити matching `generated` review і лише після цього
відкрити package для review. Раніше package/channel fallback lookup стояв після update branch,
тому шість знайдених legacy posts лишалися незмінними й фінальний guard закономірно відмовлявся
показувати їх owner'у, хоча всі 6 clean adaptations уже були checkpointed.
(source: `src/lib/weekly-digest/generation-worker.ts`, production run `32063924268`)
12-хвилинний editorial-master ceiling для інших job types не змінено. У checkpoint потрапляє
лише канал із
порожнім `blocking`; пройдений канал не генерується знову при наступному recovery.
(source: `src/lib/weekly-digest/social-adapter.ts`,
`src/lib/weekly-digest/social-checkpoint.ts`, `.github/workflows/weekly-master-cli-worker.yml`,
`src/lib/social/llm-router.ts`, `src/lib/weekly-digest/generation-control.ts`,
`src/lib/weekly-digest/social-adapter.ts`, `social-adapter.test.ts`, `llm-router.test.ts`;
production runs `32054964740` / `32057477211` / `32059830080` / `32061374498` та
production-DB live routing probe 2026-08-17)

Writer і critic тепер бачать один owner-approved fact snapshot із повного article master
(`buildWeeklySocialFactSnapshot`: article body + approved claims + item title/summary/why/practical).
Threads аудіюється з усіх parts; Instagram — з caption і полів 7-slide spec; X — root + self-reply.
Writer для Instagram використовує tagged contract `<COVER>` / `<STORY>` / `<COMPARISON>` /
`<CAVEAT>` / `<TAKEAWAY>` / `<CAPTION>`. Непояснений
zero-score JSON template від critic відхиляється як invalid response. Same-locale blind cross-post
входить у той самий repair loop; originality observation лишається warning, якщо score уже
проходить поріг. Після генерації worker ще раз fail-closed перевіряє всі шість reports і лише
тоді переводить package/posts у `in_review`; blocker-filled cached adaptation не відновлюється.
(source: `src/lib/weekly-digest/generation-worker.ts`,
`src/lib/weekly-digest/social-adapter.ts`, `src/lib/social/quality.ts`)

Під час repair існуючий editable post оновлюється in place з новими `content_version`,
`content_hash`, idempotency key та immutable `generated` review. Approved/scheduled/posted post
worker не перезаписує. У Social UI звичайний стан показує компактне `Ready for review · no
blockers`; legacy diagnostics лишаються доступними в згорнутому amber `<details>`, без дубльованої
червоної стіни.
(source: `src/lib/weekly-digest/generation-worker.ts`,
`src/components/admin/weekly-workspace.tsx`)

Generation jobs на Social tab також відділяє актуальний стан від діагностичної історії: поки є
non-terminal `social_copy`, видно його; інакше видно тільки найновіший terminal result. Старі
linked attempts зберігаються під нейтральним згорнутим `Previous generation attempts` і не
виглядають як чинні blocker-и owner review. На інших вкладках повна таблиця не змінена.
(source: `src/components/admin/weekly-generation-jobs-live.tsx`,
`src/lib/weekly-digest/generation-job-visibility.ts`)

### GitHub Actions dispatch 503 recovery (2026-08-17)

В о 15:37 UTC production `social_copy` linked retry вже був durable queued job, але GitHub
повернув HTTP 503 на workflow dispatch; server action пробросила зовнішню помилку в Server
Components render і CMS показала opaque React #441 (`digest: 2087663833`). Лізинг перед
викликом GitHub лишається `dispatching`, бо за невизначеної доставки не можна одразу створювати
другий workflow.

`dispatchWeeklyMasterCliWorker` тепер робить до трьох спроб для 408/429/5xx і transport errors
(300 ms, потім 900 ms). Якщо GitHub не підтвердив усі спроби, dispatcher повертає `false`, не
ламає RSC-відповідь адмінки, а fenced job recovery лишається за штатним database reaper. Це не
змінює editorial selection, не дублює child job і не витрачає attempt до фактичного старту runner.
(source: Vercel runtime error `2087663833` 2026-08-17;
`src/lib/weekly-digest/github-dispatch.ts`, `github-dispatch.test.ts`,
`supabase/migrations/20260809060929_weekly_generation_control_plane.sql`)

Studio version **`weekly-content-studio-v2.1`** + research schema **`weekly-research-v3`** +
master prompt **`weekly-master-v7`**. Бамп версії студії змінює стабільний ключ composer-старту;
кнопка **Start / retry** більше не залежить від бампу — див. нижче.
(source: `WEEKLY_CONTENT_STUDIO_VERSION`, `WEEKLY_RESEARCH_SCHEMA_VERSION`,
`WEEKLY_MASTER_SPEC_VERSION`)

### Content Studio retry after succeeded jobs (2026-08-16)

Composer (`startWeeklyContentStudio`) ставить `research_pack` ×3 і `editorial_master` зі
стабільним ключем `weekly-content-studio-v2.1:{digest}:{revision}:research:{item}` /
`…:master`. RPC `queue_weekly_digest_generation_job` на конфлікті скидає лише
`failed`/`cancelled`; для `succeeded` / `waiting` / `queued` / `running` повертає старий
рядок. Тому другий клік кнопки після успішного пака був тихим no-op: 16.08 12:46 UTC на
`ai-weekly-2026-08-09` rev.3 (`5b1aa70f`) з'явились `generation_queued` events, але jobs
лишились `succeeded` / `waiting`. Per-job Retry теж не бере `succeeded`
(`retry_weekly_digest_generation_job`).

Адмін-кнопка тепер викликає `retryWeeklyContentStudio`: якщо слот Top 3 уже in-flight
(`waiting`/`queued`/`dispatching`/`running`/`retry_scheduled`) — пропускає; інакше ставить
новий рядок з `:retry:{uuid}`. Waiting `editorial_master` на цій ревізії не дублюється —
він далі чекає 3 owner-approved packs. Succeeded master тут не переставляється (це кнопка
**Regenerate master**). Після нового пака треба знову Approve Top 3. Історія старих jobs
лишається.
(source: прод `weekly_digest_generation_jobs` live check 2026-08-16 12:46 UTC,
`src/lib/weekly-digest/orchestrator.ts`, `src/lib/weekly-digest/content-studio-queue.ts`,
`src/app/admin/(cms)/weekly/actions.ts`)

### Content-quality hardening (`weekly-master-v7`, 2026-08-09)

Аудит випуску `843975a8-8c19-4eca-96a8-035f76eae3ab` виявив системний prompt leak: повний
voice exemplar дослівно став англійським вступом, а український writer переклав його разом із
вигаданими деталями. Master також пройшов із однаковими 90/100 по всіх семи вимірах попри
очевидні орфографічні, граматичні та локалізаційні помилки.

`weekly-master-v7` прибирає повні exemplars із prompt, забороняє непідтверджені сцени й додає
детерміновані blockers до LLM-критика:

- writer не форсує umbrella-тему: використовує спільну логіку лише за реального зв'язку Top 3,
  інакше прямо називає конкретні події;
- 12-слівний overlap із legacy exemplar (`prompt_exemplar_copy`);
- абстрактний edition title і boilerplate standfirst;
- внутрішні редакційні бюджети metadata: SEO title 65, meta description 160, Open Graph title
  70, Open Graph description 200 символів. Це продуктове обмеження для компактного preview,
  не твердження про фіксований ліміт Google;
- непояснене слово `energy/енергія` у framing fields або energy multiplier без
  `electricity/електроенергія`, одиниці й workload;
- UK language residue: untranslated ordinary English/units, російські закінчення, сирі імена
  полів, відомі malformed tokens та нелокалізовані тисячі/десяткові дроби;
- твердження про власне `original research`, якщо випуск лише синтезує зовнішні джерела;
- article body менш як 1 800 або понад 3 300 слів при контракті 2 000–3 000 (дрібне
  відхилення лишається warning).

Новий revisable-код `language_mechanics` дає targeted line-edit для мовних помилок. Critic
повинен сканувати кожне UK-поле на spelling/grammar/localization і не може ставити 90+ виміру з
релевантним issue. Сім механічно однакових 90 тепер є окремою причиною провалу quality gate, а
не лише побажанням у промпті.
(source: `editorial-voice.ts`, `editorial-llm.ts`, `content-studio.ts`, owner audit 2026-08-09)

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

**PR5 (2026-08-06) → semantic-story-v4 (2026-08-11):** окремий шлях у
**`pipeline/card-image.ts`**: `weeklyReportageSceneBriefs` робить **source story → semantic
contract → three-lens concept jury** (два LLM-кроки на ролі `weekly.card_image_scene`) +
`buildEditorialConceptPrompt` (subject-first context → mechanism → consequence, craft bans) +
`generateWeeklyReportageIllustrations` (до 3 окремих сценаріїв; один render на концепцію).
**Daily-пайплайн не зачеплений.**

Контекст: title+summary+body excerpt+`why`+practical+limitation+takeaway+editorsView+
`editorialAngle`+approved research claims/context/risks+sibling metaphors. Top 3 беруть claims із
approved `research_pack`; fallback серіалізує `.text`, а не обʼєкти. Seed без `job.id`.
`metadata.prompt_policy` = **`weekly-semantic-story-v5.1`** (v4 був one-scene/three-seed policy).
Validator рахує semantic gates лише за `story_anchor` / `visible_mechanism` /
`visible_consequence` та іншими renderable fields; `why_it_fits` лишається rationale і не може
сам виконати `mechanism_not_visible`. `story_anchor` мусить містити actor/system із context, не лише
topic/impact entity; довгий prose headline не вважається однією required entity. Семантичний
fallback зберігає visual thesis + mechanism + consequence, а його literal component labels
санітизуються до FLUX. Structural sibling gates (`motif_class` uniqueness, scene
echo, character budget, dual_contrast cap/argued) лишились. Артефакт зберігає повний semantic
contract, metaphor rationale, `variant_scores` (`semantic_min`/`news_legibility`/`craft`) і
aligned `variant_concepts` (lens/scene/prompt/title/motif). Деталі —
[marketing/card-images](../marketing/card-images.md).

**Фікс мертвого negative prompt на klein:** multipart не шле `negative_prompt`; заборони в
validator *до* FLUX; позитивний desired-state (BFL: FLUX.2 без negatives) прямо забороняє readable
text/letters/numbers/logos/UI/screens.

**Зберігання варіантів:** RPC `save_weekly_digest_artifact` **не підтримує кілька одночасних
`is_current` рядків на один `slot_key`** (кожен save демотує попередній) — тож 3 варіанти НЕ
зберігаються як окремі артефакти. Замість цього використано вже наявний генеричний механізм
`content.preview_paths` → `content.preview_urls` (той самий, яким PDF-джоба вже підписує превʼю
сторінок) — 2 альтернативи йдуть туди, основний варіант лишається `storage_path` того самого
`story_image` артефакту. `selectWeeklyArtifactVariantAction` — просто міняє місцями, який
уже завантажений файл є primary (без нового рендеру/аплоуду). Це свідоме відхилення від
початкового формулювання плану («3 артефакти в одному slot») — після прочитання реального SQL
RPC з'ясувалось, що воно було неточним.

Visuals tab: сітка з 2 мініатюр-альтернатив під основним зображенням (клік = «Use this») з
per-variant score/blocker chips (`semantic` / `news` / `craft`); prompt details показує context,
meaning, mechanism, consequence, visual thesis і три independent concept briefs; overlays показують
concept title/lens. Primary badge `auto-picked` / `owner-promoted`; promotion переносить metadata
обраної концепції разом із файлом. Редагована сцена (`scene_override`) + «Regenerate with this
scene» зберігає її як concept 1, а concept 2–3 лишає незалежними; використовується наявний
`enqueueWeeklyGenerationAction`, нового job type не знадобилось.

**P2 prompt cards (2026-08-15):** окремий artifact type `story_prompt_set` (текст,
`locale: neutral`, не в `PUBLIC_IMAGE_TYPES`) версіонується з ревізією. Input-hash залежить від
revision item так само, як `story_image`. Visuals показує картки концептів з кнопками Canonical /
Midjourney / Negative і слот upload в тій самій картці (стан: `очікує зображення` /
`завантажено, on review` / `approved`).
(source: `supabase/migrations/20260815120000_weekly_story_prompt_set.sql`,
`src/lib/weekly-digest/story-prompt-set.ts`, `src/components/admin/story-prompt-set-panel.tsx`,
[weekly-illustration-plan](weekly-illustration-plan.md) P2)

**M1 prompt_only (2026-08-15):** `generateStoryImage` без `source_url` і `generateCover` більше
не викликають `generateWeeklyReportageIllustrations` / `runWeeklyImageSimLoop`. Джоба будує
essence + концепти, експортує `ManualImagePrompt` і зберігає `story_prompt_set` зі статусом
`succeeded` + `needs_owner_review`. Ingest `source_url` лишається. Прапорець
`WEEKLY_STORY_IMAGE_MODE=prompt_only|render` (дефолт `prompt_only`). Транспорт `story_image`
лишається GitHub Actions — не переносити в цьому PR.
(source: `src/lib/weekly-digest/story-prompt-job.ts`, `generation-worker.ts`, `.env.example`,
[weekly-illustration-plan](weekly-illustration-plan.md) M1)

**M2 post-upload QA (2026-08-15):** після ручного upload story/cover `after()` викликає
image-only critic (`buildImageOnlyCriticPrompt`, без headline/scene) і пише
`metadata.post_upload_qa`. `content_sim` не заповнюється, тож `simulation_not_passed` не
спрацьовує. Visuals: «QA чисто» або жовтий рядок + Ігнорувати / Замінити файл.
(source: `src/lib/weekly-digest/post-upload-qa.ts`, `src/app/admin/(cms)/weekly/actions.ts`,
[weekly-illustration-plan](weekly-illustration-plan.md) M2)

**Site WebP (2026-08-17):** ручний upload і render-persist `story_image` пишуть origin як
WebP 1600×900 q82 (`encodeSiteWebp`). Cover / social_asset / thumbnail лишаються JPEG
(digest `og:image`, Instagram API, YouTube thumb). Публічний сайт просить `format=webp` у
Supabase transform незалежно від origin. (source: `src/lib/encode-site-image.ts`,
`src/lib/image-loader.ts`, `src/app/admin/(cms)/weekly/actions.ts`)

**M3 preflight copy (2026-08-15):** `artifact_missing` для `story_image` / `cover` каже скопіювати
промпт, згенерувати в своєму інструменті й завантажити файл — не «Regenerate». Вага гейта
без змін. (source: `src/lib/weekly-digest/preflight.ts`,
[weekly-illustration-plan](weekly-illustration-plan.md) M3)

**B3 prompt readiness (2026-08-15):** Visuals біля кожної story показує `N/3 промпти готові`
і деталь `немає consequence` / `фолбек: mechanism`, якщо журі не заповнило три лінзи або
віддало `fallback_essence`. Cover не в цій хвилі. Вага гейта без змін.
(source: `src/lib/weekly-digest/story-prompt-set.ts`, `src/components/admin/weekly-workspace.tsx`,
[weekly-illustration-plan](weekly-illustration-plan.md) B3)

**C2 scene grammar (2026-08-15):** `pipeline/scene-grammar.ts` ставить
`deterministic_technical_hybrid`, коли в title/summary або essence є точна метрика.
`practical` / `takeaway` не скануються. Один `caching` не вмикає process grammar. V10 не
імпортується. (source: `pipeline/scene-grammar.ts`,
[weekly-illustration-plan](weekly-illustration-plan.md) C2)

**C3 mapping gate (2026-08-15):** `produceStoryPrompts` не пише в `story_prompt_set` концепт
без таблиці context/action/outcome. `visibleElementId`, не підпис; порожній `semanticProps`
не проходить вакуумно. Вага preflight без змін.
(source: `pipeline/concept-mapping-gate.ts`, `src/lib/weekly-digest/story-prompt-job.ts`,
[weekly-illustration-plan](weekly-illustration-plan.md) C3)

**D2 post-upload advice (2026-08-15):** QA після upload радить власнику (inpaint / той самий
промпт / інший концепт), не патчить промпт і не перегенеровує. Авто-repair лишається на
новинах. Вага preflight без змін.
(source: `src/lib/weekly-digest/post-upload-qa.ts`, `src/components/admin/weekly-workspace.tsx`,
[weekly-illustration-plan](weekly-illustration-plan.md) D2)

**D3 human_dignity_risk (2026-08-15):** critic ловить принизливі сцени з людьми. На новинах —
fail; на upload — попередження «ризик гідності», не preflight. Вага гейта без змін.
(source: `src/lib/content-sim/vision-critic.ts`, `src/lib/weekly-digest/post-upload-qa.ts`,
[weekly-illustration-plan](weekly-illustration-plan.md) D3)

**E1 owner-feedback (2026-08-15):** на кожному концепті Visuals — `used | used_with_edits |
rejected` + закриті `reasonTags`. Пишеться в `story_prompt_set` і в `metadata.owner_feedback`
завантаженого файлу. Вага preflight без змін.
(source: `src/lib/weekly-digest/owner-feedback.ts`, `src/app/admin/(cms)/weekly/actions.ts`,
[weekly-illustration-plan](weekly-illustration-plan.md) E1)

**E2 two-stage critic (2026-08-15):** у режимі `render` спочатку image-only (без headline),
потім story-aware лише якщо пікселі пройшли. M2 не змінювався. Вага гейта без змін.
(source: `src/lib/content-sim/adapters/weekly-image.ts`,
[weekly-illustration-plan](weekly-illustration-plan.md) E2)

**E3 prompt promotion (2026-08-15):** Visuals показує `гейт промптів` з ≥60% прийнятних
концептів (`used` / `used_with_edits`), 0 misleading у прийнятих, ≤10 хв/story і перевірку
B2 «не три копії». Це не preflight-код і не змінює `WEEKLY_CONTENT_STUDIO_V2=off`.
Пороги новин без змін.
(source: `src/lib/weekly-digest/prompt-promotion-gate.ts`,
[weekly-illustration-plan](weekly-illustration-plan.md) E3)

**F3 OpenRouter rerank (2026-08-15):** добовий job пише `llm_model_rank_audit` і може оновити
чергу `openrouter` (топ-3 `weekly.master_writer`) лише якщо якість не впала >5 пунктів.
Це не Visuals і не змінює `WEEKLY_CONTENT_STUDIO_V2=off`. Картинки дайджесту лишаються ручними.
(source: `pipeline/providers/model-rerank.ts`,
[weekly-illustration-plan](weekly-illustration-plan.md) F3)

**G illustration budget (2026-08-15):** `/admin/costs` ділить новини / weekly image API /
промпти+QA з `generation_cost_events`. Weekly image API очікується $0 у `prompt_only`.
`CONTENT_SIM_MAX_IMAGE_SPEND_USD` лишається 0.2 (новини). Це не змінює
`WEEKLY_CONTENT_STUDIO_V2=off`.
(source: `src/lib/generation-costs.ts`,
[weekly-illustration-plan](weekly-illustration-plan.md) G)

**A2 critic bake-off (2026-08-15):** vision-модель не перемикали (`google/gemini-2.5-flash`).
Усі три кандидати дали `Kept the good = 0/1`. Це не змінює `WEEKLY_CONTENT_STUDIO_V2=off`.
Картинки дайджесту лишаються ручними.
(source: [weekly-illustration-plan](weekly-illustration-plan.md) A2,
`experiments/critic-bakeoff/2026-08-15/`)

**F5 no pinned generation ids (2026-08-15):** прод не тримає `sonnet-5` / `gpt-5` /
`gemini-3.x` поза тестами. Це не змінює `WEEKLY_CONTENT_STUDIO_V2=off`.
(source: [weekly-illustration-plan](weekly-illustration-plan.md) F5,
`pipeline/model-version-pin.test.ts`)

**Content Sim (2026-08-11):** у режимі `render` після FLUX `generateStoryImage` ганяє vision repair loop
(hard cap 2 rounds, `CONTENT_SIM_*`) і пише `metadata.content_sim`. Preflight код `simulation_not_passed`
блокує реліз, доки sim не passed або owner Approve не поставить `human_override`.
V4 critic звіряє pixels з original story, окремо gate-ить context/mechanism/consequence/
instant comprehension; його `prompt_patches` застосовуються до наступного реального FLUX prompt,
не дописуються постфактум у metadata.
CLI: `npm run content-sim`. Деталі — [content-sim](content-sim.md).

**Experimental Visual Affordance V10 (2026-08-13):** окремий, детермінований renderer для
owner review порівнює V8 і V10 на трьох зафіксованих story cases. Це не `story_image` job і не
входить у production Visuals: усі зміни й результати лишаються в experimental branch. Після
локальних owner repairs V10 показує два різні code artifacts для Gemini, лінійний
`cache → split → BOUNDED 1/2/3` потік для Claude та видимий ланцюг hint → людська дія → фініш для
Deep Work. ⚠️ **Заявлені числа цього прогону (3/3 hard-integrity, 3/0 blind preference)
спростовані переоцінкою 2026-08-13.** Той харнес вимикав гейт `generated_text` лише для
кандидата, будував рубрику для обох гілок зі специфікації кандидата і подавав судді описи,
підписані назвами гілок. Після виправлення — ті самі пікселі, той самий суддя — V10 дає
**0/3 hard-integrity** і blind preference **1-1 з нічиєю**, а розрив зважених балів падає з 33.1
до 0.5 пункта. Обидві детерміновані сцени V10 блокуються на `generated_text`: впечені лістинги
коду і підписи суперечать політиці `weekly-semantic-story-v5.1` («без тексту в пікселях»).
Розбір — [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](../audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md),
дані — `experiments/visual-affordance-v10/targeted-v7-corrected-harness/`.
(source: `src/lib/weekly-digest/visual-affordance-treatment-v10.ts`, Actions run `31739283280`
2026-08-13, owner review 2026-08-13)

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
ніколи не був потрібен (`socialAngles`, яке PR6 тимчасово тримало в article:en-артефакті,
PR7 нижче прибрав з майстра повністю).
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

**PR7 (2026-08-06, останній з семи):** соц-голос + self-generated angle + hook picker + чистка.

`socialAngles` прибрано з `WeeklyMasterBundle`/майстер-виклику **повністю** (тип, `englishPrompt`'s
CONTRACT+JSON SHAPE, `parseEnglishPackage`, `normalizeWeeklySocialAngles`/`canonicalSocialChannel`
у `editorial-llm.ts`, `social_angle_grounding` deterministic-гейт у `content-studio.ts`). Причина:
майстер писав шість соц-кутів наосліп, без каналевого контракту перед очима, а
`social-adapter.ts` (де кут реально споживається) вже отримує повну статтю — дублювання без
користі. Замість цього **`social-adapter.ts` сам пропонує кут** для кожного каналу в тому ж
writer-виклику, що пише 3 hook-кандидати: JSON-відповідь тепер `{"angle":"","text":"...","firstComment":""}`;
`hookAngle` (аналітика/UTM, `weekly_digest_release_events`/`hook_angle` — окрема, незалежна
механіка, не займана) береться з `writer.value.angle`, не з зовнішнього інпуту.

Голос: `promptFor` тепер включає `VOICE_EN`/`VOICE_UK` з `editorial-voice.ts` (той самий модуль,
що PR1 збудував для статей) замість одного речення "trusted editor-practitioner, direct, vivid".
Детермінований `scoreCandidate` (ранжує 3 hook-кандидати перед відправкою критику) тепер штрафує
-15 за кожен спрацьований `bannedPhrasesFor(locale)`-патерн (той самий AI-tell/label-opener
детектор, що й `detectTemplateLeaks`) — той самий двошаровий підхід deterministic-gate-до-критика,
що й стаття.

Новий вимір критика — **originality**: третя вісь у тому ж critic-виклику
(`{"score":0,"flags":[],"platformFitScore":0,"platformFlags":[],"originalityScore":0,"originalityFlags":[]}`),
питає, чи копія читається як щось специфічне для цього тижня, чи як шаблонний AI-пост. Поріг
70/100 (`originality_score` blocking issue) + окремі `originality_flag` issues за цитовані фрази.
`parseCritic`/`QualityReport` (`src/lib/social/critic.ts`, `src/lib/social/types.ts`) розширені
опційними `originalityScore`/`originalityFlags` — той самий optional-field патерн, що вже мав
`platformFitScore`/`platformFlags`, тому **daily social-пайплайн не зачеплений** (його критик-
промпт про ці поля не питає, парсер їх просто не бачить).

Social tab: hook-кандидати клікабельні (`HookCandidatePicker`) через `data-social-panel`.
Threads candidate сплітиться за `<PART>` і атомарно заповнює 3–5 part fields без `slice` і без
залишення маркера в visible copy. X оновлює лише root; tracked URL лишається в self-reply.
Instagram hooks read-only — зміна angle потребує регенерації spec і семи JPEG.
(source: `src/lib/social/hook-candidate.ts`, `src/components/admin/hook-candidate-picker.tsx`)

### Social media contract і repair CLI (2026-08-18)

Нові weekly image assets у `social_posts.asset_urls` зберігають `artifactId`; signed URL більше
не є delivery contract. Admin loader і social worker резолвлять current/ready `image/*` на 60
хвилин і **не** записують URL назад у БД. Selector спочатку фільтрує approved images, тому
`linkedin-document:en` PDF ніколи не стає thumbnail. Instagram — hybrid carousel: cover + 3
approved story images + 3 brand cards; overflow layout є blocker, не обрізання.

Контрольований repair існуючого пакета (dry-run за замовчуванням):

`npm run weekly:social:repair -- --package-id <uuid>`

Запис лише з `--apply`. Не approve, не schedule і не вмикає publishing. Після apply всі
variants лишаються `in_review` з `social_post_reviews.action = 'edited'` і `reviewer_id: null`.
(source: `src/lib/social/asset-ref.ts`, `src/lib/social/channel-assets.ts`,
`src/lib/weekly-digest/repair-social-package.ts`, `scripts/repair-weekly-social-package.ts`)

Чистка: видалено мертвий `src/lib/weekly-digest/editorial-draft.ts` + тест (передував Content
Studio v2, ніде не імпортувався). **`GENERIC_PRACTICAL_PATTERNS` НЕ видалено** — на відміну від
початкового формулювання плану, читання коду показало, що це активний, протестований
deterministic-гейт (`generic_practical` blocker) для окремого класу проблеми (reused generic
template phrases), не дублікат `detectTemplateLeaks`; видалення відкрило б регресію без заміни.

Нове покриття: `social-adapter.test.ts` (5 тестів, раніше — нуль) на self-generated angle,
banned-opener ranking, originality blocking/non-blocking, originality-flag surfacing.
(source: `src/lib/weekly-digest/social-adapter.ts`, `src/lib/weekly-digest/social-adapter.test.ts`,
`src/lib/social/critic.ts`, `src/lib/social/types.ts`, `src/components/admin/weekly-workspace.tsx`,
`src/components/admin/hook-candidate-picker.tsx`)

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

## Master quality report carry-over при Restore (2026-08-17)

`content_quality_report` не бере участі в carry-forward-за-input_hash вище — його пише
`editorial_master` один раз, прив'язаним до конкретної ревізії, і `revision_id` в
`weekly_digest_artifacts` навмисно **immutable** (`guard_weekly_digest_artifact_write`
кидає «Artifact identity and dependency fields are immutable» на будь-який `UPDATE`
`revision_id`). Це зіткнулось із non-converged-гілкою `editorial_master`
([weekly-master-engine](weekly-master-engine.md)): коли критик не закриває всі перевірки,
воркер (1) пише `content_quality_report` на **ревізію, активну на старті job**, (2) окремим
викликом мінтить **draft**-ревізію з тим самим текстом через `create_service_weekly_digest_revision_draft`
— ця RPC копіює лише `weekly_digest_revisions`/`weekly_digest_revision_items`, жодних
артефактів, і навмисно не чіпає `active_revision_id` (коментар у самій функції: «this draft
does not touch it»). Job завершується `succeeded` — задум, не баг:
«Needs your review» — це редакційна задача, не інфраструктурний збій.

Якщо власник потім натискає **Restore this version** на цій draft-ревізії
(Overview → Editorial versions), `revert_weekly_digest_revision` лише перемикає
`active_revision_id` — жодних змін у `weekly_digest_artifacts`. Звіт критика лишається
на щойно-неактивній ревізії; Research tab фільтрує артефакти строго по активній ревізії
(`admin-data.ts` — `.eq('revision_id', revision.id)`), тож `artifactFor(..., 'content_quality_report', ...)`
повертає `undefined`, і панель показує «Master quality report is missing», хоч
`editorial_master` реально відпрацював і має score.

**Живо відтворено й полагоджено 17.08 на випуску `6cbcf0b3-187d-4d7d-9eb9-66bdff1c72d4`:**
критик не зійшовся (82/100, 1 unresolved check) на ревізії 3, draft-ревізія 4 створена,
власник відновив ревізію 4 через Restore — звіт лишився на ревізії 3. Перевірено прямими
запитами до прод-Supabase (`mdiqfatpqczwqghwttpm`): `weekly_digest_artifacts.revision_id`
для звіту не дорівнював `weekly_digests.active_revision_id`; `guard_weekly_digest_artifact_write`
підтвердив блокування `UPDATE revision_id` наживо (спроба прямого фіксу впала на
`Owner or editor session required` / immutability guard).

**Фікс:** новий `src/lib/weekly-digest/quality-report-carryover.ts` —
`carryOverOrphanedQualityReport(db, weeklyDigestId)` шукає `content_quality_report` з
`is_current=true`, що не належить активній ревізії, і **вставляє свіжу копію** на активну
ревізію тим самим RPC, яким пише воркер (`save_weekly_digest_artifact`, `review_status:
'in_review'` — Approve все одно окремий крок людини). Не мутує старий рядок — обходить
immutability навмисно, а не в обхід гейту.

Підключено у два місця:

1. **Автоматично** — `restoreWeeklyDigestRevisionAction` викликає carry-over одразу після
   успішного `revert_weekly_digest_revision`, best-effort (помилка тут логується, не ламає
   вже виконаний Restore). Закриває проблему для всіх майбутніх non-converged-циклів — Restore
   сам підвозить звіт, окремий клік не потрібен.
2. **Вручну** — `carryOverWeeklyQualityReportAction` + кнопка **Attach this report to the
   current version** на Research tab, але тільки коли `workspace.orphanedQualityReport`
   (нове поле в `getWeeklyDigestWorkspace`) знаходить осиротілий звіт: панель тоді показує
   не generic «Approve packs → Start Content Studio», а «Independent audit · found on an
   earlier version» зі score і поясненням чому. Потрібно для дайджестів, відновлених ще до
   цього фіксу (автоматичний виклик у Restore не діє заднім числом), і як видимий fallback,
   якщо автоматичний carry-over колись мовчки no-op-не.

(source: `src/lib/weekly-digest/quality-report-carryover.ts`,
`src/lib/weekly-digest/admin-data.ts`, `src/app/admin/(cms)/weekly/actions.ts`,
`src/components/admin/weekly-workspace.tsx`, live check прод-Supabase
`mdiqfatpqczwqghwttpm` 2026-08-17)

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
- **Social tab** (серп 2026, оновлено 2026-08-18): channel-aware форма замість універсальних
  CTA/hashtags/raw JSON. Telegram/Facebook/LinkedIn редагують post copy; X — root + self-reply;
  Threads — 3–5 part textareas; Instagram — caption і read-only 7-slide preview. Image assets
  зберігають `artifactId` (не 7-денний signed URL). LinkedIn PDF лишається
  `meta.document_artifact_id`, не thumbnail. Hook picker для Threads атомарно оновлює всі
  parts і не обрізає `<PART>` blob. Save дозволений із warnings; Save & approve блокується
  factual score <85, asset blockers і відсутнім critic, коли `SOCIAL_CRITIC_REQUIRED`.
  Destination URL автозаповнюється з clean weekly URL; помилки Save йдуть у
  `?tab=social&save_error=…`. Header-кнопка **Generate social package** ставить один
  `social_copy` job для всіх шести каналів.
  (source: `src/lib/social/channel-form.ts`, `src/lib/social/asset-ref.ts`,
  `src/lib/social/hook-candidate.ts`, `weekly-workspace.tsx`, `saveWeeklySocialAction`)
- **Мобільна адаптивність `/admin`** (2026-08-08): нижня навігація (`AdminNav`) мала
  `grid-cols-7` на 8 пунктів — «Settings» сиротою переносився на непорахований другий
  рядок, що перекривав контент сторінки знизу; фікс — `grid-cols-4` (два рівні рядки) +
  узгоджений `padding-bottom` у `CmsLayout`. `PreflightBlockerList` рендерить сирі
  story-UUID усередині вкладених `grid`-контейнерів без `min-w-0`/`break-words` — на
  вузькому вʼюпорті довгий непереносний токен міг «вибити» спільний grid-трек ширше за
  екран; `overflow-x:clip` на `html`/`body` (глобальний захист від horizontal scroll,
  `globals.css`) робить такий overflow невидимим і непрокручуваним, а не просто
  обрізаним зі скролом. Таб-бар секцій workspace (`overflow-x-auto`) отримав новий
  `ScrollFade` (`src/components/admin/scroll-fade.tsx`) — м'яке затемнення на краю, коли
  є ще вкладки для свайпу (мобільні браузери ховають скролбар).
  (source: гілка `claude/admin-mobile-responsive-pfb65o`, `admin-nav.tsx`,
  `weekly-workspace.tsx`, `scroll-fade.tsx`)
- **Стискання grid-треків** (2026-08-09): кожна пряма дитина Tailwind `.grid` отримує базове
  `min-width: 0`; кастомні гнучкі треки використовують `minmax(0, …)` замість голого `1fr`.
  Це не дає intrinsic-ширині form/textarea або довгому значенню збільшити трек ширше за батька.
  Саме так Article tab міг розтягнути 1193 px wrapper до 1258 px і винести праву колонку за
  екран; `p-5` лише робив дефект видимим. Таблиці з навмисною мінімальною шириною лишилися
  всередині власних `overflow-x-auto` контейнерів.
  (source: `src/app/globals.css`, `src/components/admin/weekly-workspace.tsx`, owner screenshot
  + Chrome layout measurement 2026-08-09)
- **«Newer draft available» banner + readable restore errors** (2026-08-10): the Article tab
  always rendered the **active** revision, with no indicator when a newer, usually better,
  auto-generated draft existed — the owner spent real time reading and reacting to a stale
  revision (`ai-weekly-2026-08-02`'s Revision 2, written before any v7 quality gate existed)
  while three later revisions sat unreviewed. `NewerDraftBanner` now renders on every tab
  whenever `workspace.revisions[0]` (newest by `created_at`) is not the active revision, with
  the draft's own "never became active" reason and a link straight to Editorial versions.
  Separately, `restoreWeeklyDigestRevisionAction` used a bare `throw` on any RPC error, which
  Next.js renders as an opaque digest-only production error (`Minified React error #441`) — a
  live click on **Restore this version** hit exactly this. ⚠️ First diagnosed (wrongly) as a
  transient session race; the owner confirmed the failure was consistent, and the real cause
  was a genuine `42501: permission denied for table weekly_digest_generation_jobs` —
  `create_weekly_digest_revision` ("Save") and `revert_weekly_digest_revision` ("Restore") are
  both `security invoker` and UPDATE that table directly, which `authenticated` has never had
  write access to (SELECT-only since 2026-07-23; Postgres checks table privilege before the
  WHERE clause, so even zero matching rows still fails). This hit every owner/editor call, not
  a rare edge case — production history shows exactly one successful human Save, ever.
  **Fixed in production the same day**: both functions moved to `security definer`
  (`supabase/migrations/20260810160000_weekly_revision_rpc_security_definer.sql`), matching
  the pattern this table's other writers (`retry_weekly_digest_generation_job`,
  `claim_weekly_digest_generation_jobs_v2`) already use; the internal `has_social_role` check
  is unchanged, so authorization is not weakened. Verified in a rolled-back transaction before
  applying. The action still redirects with `?save_error=…` instead of a bare throw, so any
  future failure shows its real message instead of a bare "Ref: …".
  (source: `src/components/admin/weekly-workspace.tsx`,
  `src/app/admin/(cms)/weekly/actions.ts`, live incident + Supabase/Vercel log read 2026-08-10,
  `set local role authenticated` reproduction 2026-08-10, production migration
  `20260810160000_weekly_revision_rpc_security_definer.sql` applied 2026-08-10)
- **Postpone release** (2026-08-10): `schedule_weekly_digest` only accepts Monday 16:00
  Europe/Kyiv and only from `status = 'approved'` — there was no way to move an
  already-`scheduled` release without three separate manual steps (Pause, write a reason;
  Resume, which re-approves; retype both Preflight/Release datetime-local fields for a new
  Monday). `postponeWeeklyDigestAction` composes the same three existing RPCs
  (`pause_weekly_digest` → `approve_weekly_digest` → `schedule_weekly_digest`) behind one
  button — pick 1–4 weeks, write one reason, done. No new RPC, so no new grants to get wrong;
  the re-approve step is a genuine full preflight re-check against current content, not a
  formality. The new date is computed in the Kyiv calendar (`addKyivWeeks`) rather than by
  adding a fixed UTC duration, so a postpone across a DST transition still lands on 16:00
  Kyiv, not 15:00 or 17:00 — verified by hand against both 2026 DST boundaries. Only shown
  when `status === 'scheduled'`; if an intermediate step fails, the edition lands in whatever
  state that step left it (`paused` or `approved`), never a partial/undefined state, and the
  error banner says exactly which step failed.
  (source: `src/app/admin/(cms)/weekly/actions.ts`, `src/components/admin/weekly-workspace.tsx`,
  owner request 2026-08-10)

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
розглянуто й відхилено: `retryableGenerationFailure` вже коректно не ретраїть детерміновані
помилки (наприклад, page-count contract violation у `generatePdf`).

## Durable recovery для `editorial_master` (2026-08-09)

> **Переписано того ж дня.** Секцію нижче лишено як історію: контрольна площина й межа
> «артефакти лише на активній ревізії» чинні, але одиниця відновлення змінилась із
> «повний EN+UK checkpoint» на **окремий сегмент**, а провал якості більше не є провалом
> джоби. Повний опис — [weekly-master-engine](weekly-master-engine.md).

Від 2026-08-09 `editorial_master` виконується посегментно: одна історія — один виклик, плюс
рамка випуску на локаль (14 сегментів для 3 feature + 3 radar). Кожен сегмент durable у
`weekly_digest_generation_jobs.output.master_run_state`, тож **Resume saved master** продовжує
з будь-якої точки, а не лише з повної пари локалей. Джоба має рівно три виходи:

| Вихід | Стан джоби | Що бачить власник |
|---|---|---|
| gate пройдено | `succeeded` | активна ревізія + quality report, як раніше |
| лишились невирішені перевірки | **`succeeded`** з `needs_owner_review: true` | неактивна draft-ревізія + `unresolved_issues` у стрічці |
| бюджет часу / сегмент не дописано / critic недоступний | `failed`, код **`resumable`** (retryable) | «N/14 сегментів збережено», повтор продовжує |

Провал якості більше **не** робить джобу `failed`: блокер спершу проходить цикл точкового
ремонту поля, і те, що лишилось нерозвʼязаним, їде до власника разом із чернеткою.
(source: `src/lib/weekly-digest/master-engine.ts`, `generation-worker.ts`,
`src/components/admin/weekly-generation-jobs-live.tsx`)

Якщо незалежний critic вичерпав власну provider-драбину і не може дати verdict, це
інфраструктурний, а не редакційний провал: рушій не створює неперевірену чернетку і не губить
14 уже збережених сегментів. Джоба завершується retryable `resumable`; **Resume saved master**
повторює лише оцінювання/наступні ремонти на тому самому durable тексті. (source:
`src/lib/weekly-digest/master-engine.ts`, follow-up critic-recovery fix 2026-08-10)

**Перший живий прогін нового рушія** (Actions run `31367921173`, 2026-08-10) знайшов реальну
регресію: UK-промпт наказує моделі не повертати `claimIds` (їх копіює складальник з EN), але
парсер вимагав це поле безумовно — кожна конформна UK-відповідь відкидалась, «Every
editorial provider failed» після ~40 хв на нуль результату. Не редакційний збій — інфраструктурний
контракт-мисматч між промптом і парсером. Виправлено на гілці
`fix/weekly-master-uk-claimids` (`requireClaimIds` параметр); заразом виключено
`openai/gpt-5.6-luna:batch` (Batch-only модель, 404 на звичайному шляху) з черги OpenRouter.
Повний розбір — [weekly-master-engine § Перший живий прогін](weekly-master-engine.md#перший-живий-прогін--2026-08-10-знайшов-реальну-регресію).
(source: Actions runs `31367921173`/`31371078952`, `src/lib/weekly-digest/editorial-llm.ts`)

Quality rejection як і раніше не пише article artifacts у неактивну draft revision:
`save_weekly_digest_artifact` навмисно приймає лише active revision. Draft зберігає поля master
для review, а quality report лишається на чинній активній ревізії; job output фіксує
`master_draft_revision_id`, `quality_artifact_id` і `unresolved_issues`.
(source: `src/lib/weekly-digest/generation-worker.ts`,
`supabase/migrations/20260723095458_weekly_digest_v2.sql`)

## PDF page-count contract violation — фікс (2026-08-07)

⚠️ Виправлення попереднього запису вище: page-count contract violation **не** був гіпотетичним
прикладом коректної retry-поведінки — це був **живий, невиправлений баг**. Останні 2 реальні PDF
(`ai-weekly-2026-07-26`, `ai-weekly-2026-07-27`, 03–05.08) впали **5/5 спроб** з
`Content Studio PDF is 20-21 pages; the approved A4 contract is 10–16 pages` — знайдено при
підготовці до weekly-випуску 08.08.

**Причина:** `buildStory()` (`pdf.ts`) рендерив повний ілюстрований розворот (зображення + body +
4 info-панелі) для **кожної** історії в дайджесті, незалежно від рангу — 700-слівна feature-стаття
й 140-слівний radar-айтем отримували однаковий обсяг. Виміряно на реальному випуску: rank 1-3
(features) — body ~4100-4240 симв., rank 4-7 (radar) — ~790-900 симв., усі з тим самим
зображенням+4 панелями.

**Фікс:** новий `buildRadarSection()` — повний розворот лишається лише для `rank <= 3` (той самий
кордон feature/radar, що вже використовує `claim_weekly_digest_generation_jobs`'s гейти для
`editorial_master`/`video_manifest`); решта рендериться компактним блоком title+summary+source без
зображення й панелей. Реалістична 7-історійна фікстура (3× ~4200 симв. body, 4× ~850, ті самі
довжини, що й у прод-випуску) тепер дає **13 сторінок** — комфортно в межах 10–16.
(source: `src/lib/weekly-digest/pdf.ts`, `src/lib/weekly-digest/pdf.test.ts`, live DB read
`weekly_digest_generation_jobs`/`weekly_digest_revision_items` 2026-08-07, гілка
`fix/weekly-pdf-page-cap`)

## Надійність master-write (2026-08-09)

`editorial_master` впав через сім окремих не-редакційних причин у трьох хвилях. Коротко:
4-хвилинна стеля `claude-cli` вбивала здоровий write на 240-й
секунді; CLI ганяв агентні tool-use цикли замість одного текстового виклику; stall-детектор
OpenRouter рахував лише `delta.content`, тому reasoning-моделі вмирали як «мовчазні»;
провалена джоба лишала Actions-прогін зеленим; а сам master-write мав рівно одного
кандидата-модель без фолбеку. Наступний прогін підтвердив ці фікси, але виявив ще дві
межі: CLI може повернути прозову преамбулу перед валідним JSON, а UK/revise-кроки раніше
не мали fallback-драбини взагалі.

`parseJsonObject` тепер витягує перший збалансований JSON-обʼєкт із відповіді CLI, враховуючи
рядки й екранування. Для UK і кожного revise-кроку `generatePreferringProvider` спершу лишає
провайдера, який написав англійський master (спільний голос), а після його збою пробує решту
налаштованої драбини. Це не маскує провал: у timeline видно фактичний provider кожного кроку,
а неуспішна джоба лишає Actions run червоним.
(source: `src/lib/weekly-digest/editorial-llm.ts`, Actions run `31324873875`)

Повний розбір із цифрами й фіксами — [weekly-master-failures](weekly-master-failures.md).
Спосіб перевіряти цей флоу без прода — [ops/weekly-sandbox](../ops/weekly-sandbox.md).

**Виміряна база (щоб наступного разу було з чим порівняти).** Повний master через OpenRouter
на реальній фікстурі: **28 хвилин, 9 викликів провайдера, $0.032** — EN 204 с, UK 251 с,
critic 130–295 с, revise-раунди 101–240 с. Тобто один крок master-а нормально живе
2–5 хвилин; будь-яка стеля коротша за це — не запобіжник, а причина збою. Критичне число:
`first_token_ms` у critic-викликів — 120.4 с і 116.6 с, тобто модель мовчить **довше** за
90-секундний first-token ліміт, поки думає.
(source: `artifacts/_local/weekly-sandbox/2026-08-09T15-34-07-721Z/run.json`, sandbox 2026-08-09)

## PDF-верстка v3 — фіксована сітка, 7 сторінок (2026-08-18)

Власник переглянув прод-PDF `Випуск 4` (2026-08-09 — 2026-08-15) і дав п'ять зауважень:
завеликий заголовок обкладинки; нечитабельний сірий текст на білому без відступів; майже
порожня сторінка з невидимим `aitodaybrief.com`; незрозумілий футер `Issue 4 / 2`; текст, що
налазить на футер; і 14 сторінок замість «7-8 найякіснішого матеріалу».
(source: owner PDF review 2026-08-18)

**Один корінь на три зауваження.** Обкладинка малювалася потоком: заголовок фіксованим 39 pt
з `y=390`, далі standfirst і блок вихідних даних на **фіксованому** `y=700`. Прод-заголовок
має 116 символів, standfirst — 1018 (той самий, що вже ламав LinkedIn-документ на 8 сторінок).
Текст переповнював сторінку, PDFKit додавав сторінку-переповнення **без** фонової заливки, і
`doc.y` вже вказував на неї — тому весь блок вихідних даних (`Issue 4`, діапазон тижня,
`aitodaybrief.com` кольором `COLORS.white`) друкувався світлим по білому на майже порожній
сторінці 2. Це не три різні баги, а один overflow.

**Наїзд на футер** мав власну причину: `ensureSpace()` рахував ліміт `PAGE.height - 72`, а
`infoPanel()` резервував фіксовані 120 pt під панель, чия реальна висота залежала від тексту.
Панель на 150 pt проходила перевірку і лягала на лінію футера (`PAGE.height - 73`).

**14 сторінок** — наслідок того, що після фіксу 2026-08-07 кожна з трьох feature-історій усе
одно текла через розриви сторінок: зображення + body ~4200 символів + чотири повноширинні
info-панелі = 3-4 сторінки на історію.

**Що змінено (`pdf.ts`, renderer `pdfkit-weekly-v3`).** Верстка більше не потік, а **фіксована
сітка**: кожен регіон має явні `y` + `height` + `ellipsis`, нічого не тече за `CONTENT_BOTTOM`
(= лінія футера мінус 24 pt), автопагінація неможлива структурно.

- **Обкладинка:** розмір заголовка авто-підбирається (`fitSize`, EN 36→22 pt, UK 32→20 pt) під
  190 pt; блок заголовка прив'язаний до низу, тому короткий і довгий хедлайн закінчуються на
  одній лінії. Standfirst обрізається `trimToFit` по **межі речення**, не посеред слова.
  Затемнення фото запікається в саму картинку через `sharp` + SVG-градієнт — PDFKit-градієнти
  з opacity-стопами PDF.js (яким рендеряться прев'ю в адмінці) показує як різкий стик.
- **Feature-сторінка = рівно одна сторінка:** eyebrow, заголовок, лід, зображення 491×168
  (кроп `fit: 'cover'` + `position: attention` у sharp, бо PDFKit `cover` не обрізає), сітка
  2×2 з панелей *Чому це важливо / Практичний приклад / Висновок / Обмеження*, рядок джерела.
  **Сирий `body` (~4200 символів) у PDF більше не друкується** — його місце в вебверсії, на яку
  веде посилання «Повна версія» в рядку джерела і QR на останній сторінці. Це редакційне
  рішення, а не побічний ефект: у 7 сторінок вміщується або body однієї історії, або
  дистильовані панелі всіх трьох.
- **Зміст клікабельний:** кожен рядок несе номер цільової сторінки праворуч і GoTo-анотацію на
  весь рядок (не лише на заголовок — дворядковий хедлайн інакше лишає мертву смугу, у яку читач
  усе одно цілиться). Цілі — named destinations `story-{rank}`, зареєстровані на верху сторінки
  історії; radar-айтеми ділять верх спільної сторінки. Номери сторінок беруться з того самого
  детермінованого плану (`planAnchors`), що й самі переходи, тому надрукований номер і ціль
  посилання не можуть розійтись.
- **Футер:** `Issue 4 / 2` → `Page 2 of 7` / `Стор. 2 з 7`, зліва `AI TODAY BRIEF · Випуск 4`.
- **Сторінок:** обкладинка + зміст + 3 features + radar + фінал = **7** (6, якщо у випуску
  лише топ-3). Контракт у `generation-worker.ts` — **6–8** замість 10–16.

**Перевірено:** рендер прод-розмірного випуску (116-символьний заголовок, 1018-символьний
standfirst, 3×4200 + 4×850 body) — 7 сторінок, обидві локалі, візуальний огляд усіх 14 растрів.
Тести (`pdf.test.ts`, 11/11) тепер тримають саме ці дефекти: рівно 7 сторінок на 7 історій і 6
на 3; блок вихідних даних присутній на сторінці 1; **жоден** текстовий елемент на сторінках 2+
не перетинає лінію футера, окрім самого футера; футер має форму `Page n of N` / `Стор. n з N`;
кожен рядок змісту веде на сторінку, де історія справді лежить (`[3,4,5,6,6,6,6]` для 7-історійного
випуску, `[3,4,5]` без radar) — перевіряється і GoTo-анотація, і надрукований номер.
Фікстура переписана під прод-довжини — попередня коротка фікстура рендерилась чисто, поки
прод ламався.
(source: `src/lib/weekly-digest/pdf.ts`, `src/lib/weekly-digest/pdf.test.ts`,
`src/lib/weekly-digest/generation-worker.ts`, `scripts/render-weekly-pdf-sample.ts`,
гілка `claude/pdf-weekly-digest-layout-1f3ba4`)

## Related pages

- [weekly-master-engine](weekly-master-engine.md) — ітеративний рушій `editorial_master`
- [weekly-master-failures](weekly-master-failures.md) — чому падав `editorial_master` 09.08
- [editorial-voice](editorial-voice.md) — house style, exemplars, banned-phrase gate
- [weekly-editorial-selection](weekly-editorial-selection.md)
- [video-boundary](video-boundary.md)
- [weekly-admin-runbook](../ops/weekly-admin-runbook.md)
- [card-images](../marketing/card-images.md)
- [open-questions](../open-questions.md)
- [now](../now.md)
