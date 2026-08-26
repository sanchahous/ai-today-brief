# Log — журнал операцій

Summary: append-only журнал усіх операцій над базою знань. Нові записи додаються **зверху**,
під заголовком. Старі записи ніколи не редагуються і не видаляються — помилку виправляє новий
запис із поміткою «коригує запис від …».
Sources: самозаписи агента
Last updated: 2026-08-26

## 2026-08-26 — Visuals upload: Vercel body cap → Something broke

**Джерело:** owner session 2026-08-26 (Visuals tab, digest
`71af784b-3c89-47f8-bc38-e3eae4def2a7`), прод-Supabase/Vercel live check 2026-08-26.

Manual story/cover upload показував admin error boundary `Something broke` /
`An unexpected response was received from the server`. У Storage і
`weekly_digest_artifacts` не зʼявилось жодного `story_image`/`cover` — POST не
доходив до Server Action (Vercel Hobby request body ~4.5 MB; великі PNG з
генераторів). Код: клієнтське стиснення >3.5 MB → JPEG 1600×900 перед POST;
`proxyClientMaxBodySize` узгоджено з `serverActions.bodySizeLimit`; помилки на
картці upload замість opaque boundary. Client form не імпортує `encode-site-image`/
sharp — розмір canvas для стиснення в `admin-upload-limits.ts`.
(source: `src/components/admin/weekly-replacement-upload-form.tsx`;
`src/lib/weekly-digest/admin-upload-limits.ts`; `next.config.ts`;
[weekly-digest](pipeline/weekly-digest.md); [weekly-admin-runbook](ops/weekly-admin-runbook.md))

## 2026-08-25 — Image-only QA більше не валить чисті кадри шкалою 1/5

**Джерело:** прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-25, Actions
`32787092116` (Daily visual finalizer, editorial date 2026-08-24).

Перший nightly daily visual намалював primary (Seedream 5.0 Pro) і repair (Qwen Image 3 Pro),
settled spend як `committed`, але set зупинився на `needs_visual_choice`. Image-only
`google/gemini-2.5-flash` написав «No pixel defects found», проте віддав бали 1 (0–1) і 5
(1–5). Промпт не казав «0–100» і все одно просив `news_legibility`; парсер гейтив
`news_legibility >= 75` навіть при `requireStorySemantics: false`. Код: шкала в промпті,
без `news_legibility` у image-only JSON, Likert rescale, pixel-only pass без news floor.
(source: `src/lib/content-sim/vision-critic.ts`; `pipeline/daily-visual-qa.ts`)

## 2026-08-25 — Weekly Video: #441 на Approve і waiting stills, не скрипт

**Джерело:** owner session 2026-08-25 (Video tab, digest `71af784b-3c89-47f8-bc38-e3eae4def2a7`),
прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-25.

`video_script` на активній ревізії вже `approved`; `video_manifest` лишається `waiting`
через 0/3 approved Top 3 `story_image` (cover теж відсутній). Повторний Approve скрипта не
є гейтом. Review / comment / save video / enqueue кидали голий Server Action throw →
`Minified React error #441`. Код тепер редіректить на `?tab=…&save_error=…` (тоді ж вкладка),
ховає Approve version на вже approved артефактах і на Video показує лінк на Visuals.
(source: `src/app/admin/(cms)/weekly/actions.ts`; `src/lib/weekly-digest/workspace-tab.ts`;
`src/components/admin/weekly-workspace.tsx`)

## 2026-08-24 — Корекція safe visual refresh і bounded daily recovery

**Джерело:** owner рішення 2026-08-24, adversarial SQL/RLS review, isolated PostgreSQL 16.15
behavioral smoke та targeted TypeScript/Vitest checks у worktree
`claude/gpt-image-prompt-plan-review-2ffff7`.

**Коригує запис від 2026-08-24 «Daily cover production asset, safe visual refresh і
social/analytics fences»:** private weekly refresh більше не є лише `prompt-only` робочою копією.
Після private upload → post-upload QA → owner review AAL2 обирає точні staged cover/story assets.
Server action byte-verify копіює їх у content-addressed immutable `social-assets` path, а одна
fenced транзакція створює versioned pixels у вже published revision. Canonical text, SEO/OG, PDF,
social package і `published_revision_id` не рухаються; public reader не отримує prompt, thesis,
QA або private provenance metadata. Старий direction hash, duplicate/foreign IDs, mutable storage
reference чи slot collision відхиляються до public DB write. (source:
`supabase/migrations/20260824150000_weekly_visual_refresh_staged_assets.sql`;
`supabase/migrations/20260824160000_weekly_public_artifact_metadata_privacy.sql`;
`src/app/admin/(cms)/weekly/actions.ts`; `src/lib/digests.ts`)

**Daily recovery:** якщо звичайний daily direction не створив жодного AI candidate, owner+AAL2
може один раз запустити attempt `1`: direction + primary + два QA, без repair (максимум $0.084;
разом із normal day не більше $0.158). First fallback і його ledger не переписуються та ніколи не
стають automatic choice. Якщо GitHub dispatch не дійшов після durable queue, кнопка повторює лише
dispatch того самого frozen historical date без нової reservation/paid attempt. (source:
`supabase/migrations/20260824170000_daily_visual_direction_retry.sql`;
`pipeline/daily-visual-finalizer.ts`; `src/lib/daily-visual/retry-state.ts`)

**Перевірено:** isolated PostgreSQL smoke застосував 241500 і його behavioral test без error;
`npm run pr:check` пройшов (205 test files / 1810 tests, coverage gate, TypeScript, ESLint без
errors, e2e-map, wiki sync/lint і production build). (source: local verification 2026-08-24)

## 2026-08-24 — Фінальна race-верифікація weekly visual refresh

**Джерело:** adversarial code review + isolated PostgreSQL 16.15 smoke 2026-08-24.

**Корекція:** direction update тепер під тим самим порядком lock, що й strict writer, скасовує
`waiting/queued/dispatching/running/retry_scheduled/failed` jobs, завершує running attempts і
позначає current prompt-set stale. Старий worker мусить збігтися з актуальним
`visual_refresh_revision_hash` як під час save, так і перед claim; static SQL test більше не
залежить від того, чи `pg_get_functiondef` зберіг умову з префіксом `and`.
(source: `supabase/migrations/20260824130000_weekly_visual_refresh_draft.sql`;
`supabase/migrations/20260824140000_weekly_visual_direction_persistence.sql`;
`supabase/tests/20260824130000_weekly_visual_refresh_draft.sql`)

**Перевірено:** на isolated PostgreSQL 16.15 обидві migration застосувалися без error; static
tests 241300/241400 пройшли. Seed із running cover і dispatching story дав два cancelled jobs,
два cancelled attempts, два `job_cancelled` events, stale prompt-set та чотири свіжі queued
hash-fenced jobs; strict save зі старим hash повернув `SQLSTATE 55000`, а old-hash job не
claim-нувся. (source: isolated PostgreSQL smoke 2026-08-24)

## 2026-08-24 — Daily cover production asset, safe visual refresh і social/analytics fences

**Джерело:** owner діалог 23–24.08: один «правильний» causal visual, daily як site/social asset,
не як Telegram prompt; $5/month; manual choice не змінює live delivery; published weekly не
редагується в місці.

**Зроблено:** daily finalizer бере frozen snapshot після 20:00 Kyiv, створює один GPT Image 2
primary + максимум один repair, зберігає fallback лише для явного owner choice і normalizes master
в 1600×900 `contain`. Direction/image/QA paid calls резервуються до виконання під DB cap $5;
unknown billing fail-closed. Lease/claim і direction hash не дають застарілому worker змішати
старий кадр з новою тезою. Manual replacement дозволяє тільки official asset або editor upload і
пише selection history. (source: owner session 2026-08-24;
`pipeline/daily-visual-finalizer.ts`; `pipeline/daily-visual-contract.ts`;
`supabase/migrations/20260824100000_daily_visual_workflow.sql`)

**Social/analytics:** після activation daily composer готує 6 native drafts (UK Telegram/Facebook/
Threads; EN X/LinkedIn/Instagram 5-slide carousel). Identity package містить master fingerprint;
при зміні candidate mutable sibling posts замінюються, а publishing/posted/reconciliation не
торкаються. Server atomic gate записує outcome тільки після matching qualified impression; raw
URL/referrer/cursor/gaze не зберігаються. (source: `src/lib/social/daily-visual-composer.ts`;
`src/lib/social/daily-visual-assets.ts`; `src/app/api/daily/visual-engagement/route.ts`;
`supabase/migrations/20260824120000_daily_visual_engagement.sql`)

**Weekly/UI:** master може запропонувати localized reader-facing `display_title` і private
`visual_thesis`; canonical SEO/OG/list title лишається без змін. Для published digest є only
private prompt-only visual refresh draft. Hero date/title тепер входять одразу, intro/standfirst
відкривається лише через «Показати більше», а master показується повністю через contain/min-height.
(source: `src/lib/weekly-digest/editorial-llm.ts`; `src/lib/weekly-digest/visual-refresh.ts`;
`src/components/weekly/weekly-hero.tsx`; `src/components/daily/daily-hero.tsx`)

**Wiki:** додано [daily-visual-workflow](pipeline/daily-visual-workflow.md); оновлено
[gpt-image-prompt-plan-review](audits/2026-08-23-gpt-image-prompt-plan-review.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [card-images](marketing/card-images.md),
[weekly-digest](pipeline/weekly-digest.md), [now](now.md) та [index](index.md). (source: worktree
`claude/gpt-image-prompt-plan-review-2ffff7`)

## 2026-08-23 — Корекція primary render і fail-closed semantic QA

**Джерело:** завершальний adversarial review реалізації Prompt-as-Code v6 після owner-відповідей
про один «правильний» результат і скріни дешевих robot/UI-кліше.

**Корекція:** production `render`, як і `prompt_only`, тепер запитує `variantCount: 1`;
відхилення vision формує repair brief наступної спроби, а не три кандидати для ручної лотереї.
`routeSeatTemplates` та batch harness лишаються тільки offline/історичною можливістю. Для
ручного `story_image` відсутній `revision_item`, нечитабельний/відсутній QA payload, помилка
завантаження story context або `story_checked !== true` тепер fail-closed для machine attestation.
Ручний редакторський release не блокується. Другий critic бачить approved counterweight;
обидва critic-prompts явно відсікають mascot/cute humanoid robots, якщо робот не є буквальним
предметом новини. Після живого візуального перегляду legacy long title hero також стиснуто:
на desktop title і 16:9 cover входять в екран поруч, без обрізання повного title.

**Перевірено:** `npm run test` — 186 файлів / 1704 тести; `npm run build` (включно з TypeScript),
`git diff --check` і `npm run wiki:check` зелені. Full ESLint — 0 errors / 10 warnings у
неповʼязаних pre-existing файлах; wiki-lint — 0 errors / 4 pre-existing warnings. Browser route
check підтвердив видимий cover, `object-fit: contain`, відсутній framework overlay/console errors
і `#story-2` + `aria-current="location"` після click.
(source: локальна verification 2026-08-23)

**Wiki:** коригує попередній запис цього ж дня; оновлено
[content-sim](pipeline/content-sim.md), [weekly-digest](pipeline/weekly-digest.md),
[image-prompt-library](pipeline/image-prompt-library.md), [card-images](marketing/card-images.md),
[weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [weekly-sandbox](ops/weekly-sandbox.md),
[overview](overview.md), [now](now.md), [index](index.md) і
[gpt-image-prompt-plan-review](audits/2026-08-23-gpt-image-prompt-plan-review.md).
(source: owner session 2026-08-23; `src/lib/weekly-digest/generation-worker.ts`;
`src/lib/weekly-digest/machine-attest.ts`; `src/lib/content-sim/vision-critic.ts`)

## 2026-08-23 — Review primary illustration / semantic QA / weekly reading path

**Джерело:** відповіді власника й скріни weekly `ai-weekly-2026-08-09`: cheap robots,
фейковий UI, псевдотекст, component soup, silent crop, гігантський hero і sidebar без active
стану. Власник обрав один «правильний» primary результат із ручним переглядом, а не три
альтернативи для вибору.

**Корінь:** v6 покращив assembly, але тримав three-seat UX, мав математично недосяжний глобальний
template reuse gate (пʼять templates на весь digest), fallback planning-prose, image-only upload QA
і `object-cover` у pipeline/UI. Додатковий adversarial review знайшов, що semantic QA blocker міг
не потрапити в legacy auto-attest allow-list і тому автоматично схвалити файл.

**Зроблено:** `prompt_only` дає один 6-block primary cause-and-effect prompt; templates обмежують
інформаційний бюджет і ban fake UI/robots; semantic contract зберігається поруч із prompt і дає
clean story upload другий story-aware advisory pass. Будь-який active post-upload QA blocker
залишає картинку на owner review. Weekly image encode/UI використовують safe `contain` frame,
hero top-align, stories ідуть раніше за допоміжні блоки, ToC має active scroll/hash state; master
отримав length gate для hero copy.

**Перевірено:** `npm run test` — 186 файлів / 1700 тестів; `npm run typecheck`, targeted ESLint,
`git diff --check` і `npm run wiki:check` зелені. Browser route check підтвердив `object-contain`,
story ordering і `aria-current` для `#story-2`; повний site build ще не є твердженням у цьому записі.
(source: локальна verification 2026-08-23)

**Wiki:** новий [gpt-image-prompt-plan-review](audits/2026-08-23-gpt-image-prompt-plan-review.md);
оновлено [image-prompt-library](pipeline/image-prompt-library.md),
[weekly-digest](pipeline/weekly-digest.md), [card-images](marketing/card-images.md),
[weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [content-sim](pipeline/content-sim.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md), [weekly-sandbox](ops/weekly-sandbox.md),
[overview](overview.md), [now](now.md), [index](index.md).
(source: owner session 2026-08-23; `pipeline/card-image.ts`; `src/lib/weekly-digest/run-post-upload-qa.ts`; `src/lib/weekly-digest/machine-attest.ts`; `src/components/weekly/weekly-toc.tsx`)

## 2026-08-23 — Prompt-as-Code v6 (awesome-gpt-image-2, без галереї)

**Джерело:** власник ігнорував згенеровані weekly-промпти й писав свої з новини;
живий digest `71af784b-3c89-47f8-bc38-e3eae4def2a7` (вкладка Visuals): два
sun-printing кадри + diagram з `essence.mechanism` / `Teams should audit`.
Upstream: [awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) (MIT).

**Корінь:** `flattenMetaphorPitch` зліплював planning-поля в рядок для моделі;
`composeDiagramCanonical` вставляв editorial-прозу; журі просило кожну лінзу
показати повний causal mini-story; один FLUX-craft на всі seats.

**Зроблено:** `pipeline/image-prompt-library/` (5 шаблонів, 6-block assembler,
NOTICE MIT); `flattenMetaphorPitch` = лише renderable; policy
**`weekly-semantic-story-v6`**; Visuals бейдж шаблону; daily cover і news cards
через той самий асемблер (news без `infographic-engine`); house skill
`.agents/skills/gpt-image-2-editorial`. Текст у пікселях лишається D1.

**Wiki:** нова [image-prompt-library](pipeline/image-prompt-library.md); оновлено
[card-images](marketing/card-images.md), [weekly-digest](pipeline/weekly-digest.md),
[weekly-illustration-plan](pipeline/weekly-illustration-plan.md) P6,
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [overview](overview.md),
[now](now.md), [content-sim](pipeline/content-sim.md), [index](index.md).

## 2026-08-22 — Fix remaining issues переписував робочу копію з нуля

**Джерело:** власник — 35% за 17 хв, «він заново все проходить? уже ж було так багато
ревізій». Live check: job `0fcb0b04`, 35% `ukrainian`, DeepSeek flash, `input` лише
`{mode:production}`, без `resume_from_job_id`.

**Корінь:** кнопка = `regenerateWeeklyMasterAction` = новий writer на 14 сегментів.
Resume не підходить: persist пише нову ревізію, а `fetchMasterResumeSource` вимагає
ту саму `revision_id`. `planHash` ще й входить у новий quality report.

**Зроблено:** джобу cancelled. `seedMasterRunStateFromBundle` наливає сегменти з
поточного article; writer пропускається, якщо EN+UK уже є.
(source: owner session 2026-08-22, прод job `0fcb0b04`,
[pipeline/weekly-digest](pipeline/weekly-digest.md#fix-remaining-issues-на-master-quality-2026-08-22))

## 2026-08-22 — Critic не повторює ту саму модель у ревізіях

**Джерело:** власник — критик має оцінювати різними моделями; повтор тієї самої
в наступній ревізії не має сенсу.

**Корінь:** `generateIndependentCritic` брав перший незалежний provider-слот і
найдешевший OpenRouter-кандидат поза vendor письменника. Кожен **Fix remaining
issues** / critic-раунд знову потрапляв на ту саму модель.

**Що змінено** (та сама гілка `fix/weekly-pre-critic-hang`):
- `criticProviderLadder` — unused independent слоти першими, використані в кінці;
- `criticOpenRouterExclusionTiers` — спершу vendor+id усіх попередніх критиків,
  потім послаблює, щоб порожній каталог не валив джобу;
- `priorMasterCritics` читає `generation_cost_events` цього дайджесту
  (`step_key=critic`); раунди всередині джоби беруться з `state.calls.critic`.

113 тестів editorial-llm / master-engine / generation-worker / openrouter-value
зелені.
(source: owner session 2026-08-22,
[pipeline/weekly-digest](pipeline/weekly-digest.md#critic-не-повторює-ту-саму-модель-у-ревізіях-2026-08-22))

## 2026-08-22 — Pre-critic hang: Fix remaining issues застряг до критика

**Джерело:** власник зупинив завислу задачу; прод job `e4135c6d-cc35-49e2-99d6-502376d06832`
(digest `71af784b`, Actions `32584262752`), live check 22.08 ~17:20 UTC.

**Що сталось:** це був не critic. Після кліку **Fix remaining issues** воркер переписав
EN+UK (DeepSeek flash), на 16:45 UTC детермінований гейт знайшов 13 блокерів, і pre-critic
раунд почав LLM-ремонт полів. Один UK `body` тримав виклик 18 хв. Heartbeat живий, дедлайн
95 хв — з боку системи «не зависло», з боку власника — так.

**Корінь:** (1) після `applyLanguageMechanicsFixes` план ремонту брав **оригінальний** список
issues, тож уже сплайсені `language_mechanics` ішли повним переписом поля; (2) будь-який EN
body-repair ставив у чергу UK-counterpart, навіть для `template_leak`; (3) pre-critic не
обмежувався blockers.

**Зроблено зараз:** джобу `cancelled` у БД + Actions (без retry). Код на гілці
`fix/weekly-pre-critic-hang`. Робоча копія не змінена — ревізія `64170ec0`.

## 2026-08-22 — `naturalness` застрягав на 55 через 5+ ревізій — фікс

**Джерело:** власник — «5 ревізій а naturalness так і залишився 55. Тобі не здається що тут є
недопрацьований функціонал який не може якісно зробити naturalness?», плюс живий приклад
(«наймeншим» з латинською `e` в UK-хуку). Live check прод-Supabase (`mdiqfatpqczwqghwttpm`, 7
`content_quality_report` за 16–22.08) підтвердив структурний дефект, не одиничний збій.

**Знайдено:** (1) мех-фікс `applyLanguageMechanicsFixes` спліcував виправлення в текст, але
не перераховував `quality.dimensions` — виправлений текст усе одно провалював гейт власним
застарілим `naturalness: 55`; (2) `isDirectLanguageReplacement` мав blacklist дієслівних форм
(«замініть») замість whitelist — критиковий інфінітив «Замінити на «X» або «Y»» пройшов
перевірку і спліcувався в статтю разом із лапками; (3) мех-пас узагалі не запускався
всередині critic-циклу — кожен `language_mechanics` issue йшов повним LLM-переписом усього
поля, звідки й whack-a-mole (6 різних помилок за 6 годин, той самий `naturalness: 55`, score
82 → 70).

**Що змінено** (гілка `claude/naturalness-score-stagnation-722e9c`):
- новий детермінований homoglyph-скан (`content-studio.ts` `homoglyphIssues`) ловить латинську
  літеру-двійника в кириличному слові до першого critic-виклику;
- `liftNaturalnessCapAfterLanguageFixes` піднімає `naturalness` до порогу проходження (80,
  не вище) щойно всі `language_mechanics`-блокери locale=uk мех-пас закрив;
- мех-пас тепер запускається щоразу після critic-виклику, до планування ремонту раунду, не
  лише один раз після виходу з циклу;
- `isDirectLanguageReplacement` — whitelist (лапки «»/"" = інструкція, не буквальний фікс);
- `editors_view_locale_mismatch` — новий детермінований кросс-locale чек (пояснює живий
  `parity: 75`, EN radar W5–W7 порожні, UK — ні);
- `DIMENSION_FALLBACK_FIELDS.naturalness` розширено `['body']` → `['hook', 'body', 'summary']`.

Overall critic `score` навмисно не перераховується (власна холістична оцінка критика, не
середнє по вимірах) — інші реальні проблеми (`article_length`, `trust`) далі коректно гейтять
review. 537/537 тестів `weekly-digest`, `tsc --noEmit` і `eslint` чисті, `wiki:sync` без drift.
(source: owner session 2026-08-22, прод-Supabase `mdiqfatpqczwqghwttpm` live check,
[pipeline/weekly-digest § naturalness застрягав на 55](pipeline/weekly-digest.md#naturalness-застрягав-на-55-через-5-ревізій--фікс-2026-08-22))

## 2026-08-22 — Fix remaining issues на Master quality

**Джерело:** власник на Research tab бачив бали (naturalness 55, trust 74) і жовті ворнінги
(`story_length`, `trust_attribution`) з текстом `Fix: …`, але не бачив кнопки, яка б віддала
ці знахідки моделі.

**Що змінено:**
- Кнопка **Fix remaining issues** під картками Master quality (owner) →
  `regenerateWeeklyMasterAction` (той самий шлях, що **Regenerate master** у таблиці jobs)
- Retry guidance тепер включає неблокуючі issues, не лише blockers + below-floor dimensions
- `qualityContentNeedsRepair` ховає кнопку, коли звіт уже чистий
- Оновлено [weekly-digest](pipeline/weekly-digest.md),
  [weekly-admin-runbook](ops/weekly-admin-runbook.md),
  [weekly-editorial-selection](pipeline/weekly-editorial-selection.md), [now](now.md)

## 2026-08-22 — Робоча копія weekly = остання ревізія

**Джерело:** власник на `/admin/weekly` (випуск 16 Aug – 22 Aug 2026) не розумів, навіщо
Restore останньої AUTO-DRAFT ревізії, якщо саме в ній останні правки, а активною лишалась
перша.

**Що змінено:**
- `editorial_master` після будь-якого `complete` активує нову ревізію
  (`create_service_weekly_digest_revision`), пише article + quality report на неї;
  `create_service_weekly_digest_revision_draft` більше не викликається
- Quality blockers лишаються гейтом для Ship; visuals/social/PDF не ставляться в чергу,
  поки є `needs_owner_review`
- Адмінка: **Use latest version** (один клік) для вже існуючих неактивних drafts;
  **Go back to this version** — undo зі причиною
- Оновлено [weekly-digest](pipeline/weekly-digest.md),
  [weekly-master-engine](pipeline/weekly-master-engine.md),
  [weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md)

## 2026-08-22 — Другий follow-up: ланцюжковий resume досі self-invalidated (живе відтворення)

**Джерело:** власник попросив підключитись в адмінку й розібратись, як рухати конкретний
реліз (`/admin/weekly/71af784b-…`). Живий тест обох фіксів вище на цьому релізі.

**Знайдено:** **Resume saved master** на fresh-run джобі `411aba45` спрацював (job `7bf3974d`)
— перший follow-up-фікс підтверджено наживо. Але **Resume saved master** на самій `7bf3974d`
(яка була резюме `411aba45`) одразу впав знову — `failure_code=resume_source_stale`. Причина:
`beforeCreatedAt` бралась з `created_at` найближчого resume-джерела, а не кореня ланцюжка;
`7bf3974d`'s власна межа (при її старті) була `created_at` кореня `411aba45`, тож два запити
бачили різні набори звітів → `planHash` розійшовся.

**Змінено** (`src/lib/weekly-digest/generation-worker.ts`):
- `masterResumeGuidanceBoundary` — проходить `resume_from_job_id` до кореня (макс. 10 хопів),
  бере `created_at` кореня, а не найближчого джерела
- `fetchMasterResumeSource` вибирає `input` (потрібен для проходу ланцюжка)
- Тести: 3 нові (одно-хоповий, багато-хоповий, non-resume без зайвого DB-виклику) —
  `generation-worker.test.ts`, 34/34 у файлі
- [pipeline/weekly-digest § Третій шар](pipeline/weekly-digest.md#третій-шар-ланцюжковий-resume-досі-self-invalidated-2026-08-22-живе-відтворення)

**Не зроблено:** гілка `claude/editorial-master-chained-resume-fix` ще не в PR (попередня
`claude/editorial-master-admin-jobs-af3509` вже змержена як #313, тож новий фікс піднято на
новій гілці від актуального `main`). Два реальні прод-job'и (`c457f984` — впав, і сам `7bf3974d`
— succeeded-з-needs_owner_review) лишаються на релізі власника; після мержу натиснути
**Resume saved master** ще раз на `7bf3974d`.

## 2026-08-22 — Follow-up: Resume saved master самозаперечувала власний checkpoint

**Джерело:** власник запитав, чи пофіксено проблему editorial_master «в цілому» після
першого фіксу (нижче). Перевірка показала — ні: навіть без «Create linked retry», кнопка
**Resume saved master** сама по собі майже гарантовано падає для джоб з `needs_owner_review`.

**Знайдено:** `priorMasterRetryGuidance(revisionId)` бере останній `content_quality_report`
по ревізії без винятку для звіту, який щойно написала сама джоба-джерело. На проді:
звіт `411aba45` (та сама SUCCEEDED job з попереднього запису) містить вимір
`naturalness: 55` (поріг `NATURALNESS_PARITY_MIN_SCORE=80`) → непорожня retry guidance →
`planHash` при резюме відрізняється від `planHash`, з яким `411aba45` стартувала (тоді на
ревізії взагалі не було жодного звіту). Джоба інвалідує власний checkpoint саме в момент,
коли дописує фінальний звіт про себе — рівно той кейс, який код називає «precisely the case
an owner most wants to resume from».

**Змінено** (`src/lib/weekly-digest/generation-worker.ts`):
- `priorMasterRetryGuidance` приймає `beforeCreatedAt` — при резюме межа береться з
  `created_at` job'и-джерела
- `loadMasterResumeState` розбито на `fetchMasterResumeSource` (fetch + валідація, тепер
  повертає й `created_at`) + `resolveMasterResumeState` (перевірка стану проти planHash) —
  `created_at` потрібен **до** розрахунку `retryGuidance`, тож порядок кроків у
  `generateEditorialMaster` змінено
- Тести: `resolveMasterResumeState` (чисте резюме + помилка «no saved state»),
  `priorMasterRetryGuidance` (межа застосовується при резюме / не застосовується на
  свіжому ран / `naturalness`-вимір генерує guidance) — `generation-worker.test.ts`,
  +5 тестів (31/31 у файлі)
- [pipeline/weekly-digest § Глибша причина](pipeline/weekly-digest.md#глибша-причина-priormasterretryguidance-самозаперечувала-власний-checkpoint-2026-08-22)

**Перевірено на проді (read-only):** запит з межею `411aba45.created_at` повертає 0 звітів —
той самий порожній набір, що бачила сама джоба о 08:28:20, коли рахувала власний `planHash`.

**Не зроблено:** це зміна лише в app-коді (TypeScript), не в SQL — деплоїться звичайним
Vercel-пайплайном при мержі PR, на відміну від міграції з попереднього запису її не можна
застосувати напряму до прода з цієї сесії.

## 2026-08-22 — editorial_master «Create linked retry» нескінченно повторював мертвий resume

**Джерело:** власник повідомив «джоби editorial_master фейляться» зі скріншотом
`/admin/weekly/71af784b-3c89-47f8-bc38-e3eae4def2a7?tab=research` — два FAILED job'и поспіль,
`Code: unknown`. Підтверджено на прод-Supabase `mdiqfatpqczwqghwttpm`.

**Знайдено:** job `c471563f` (**Resume saved master** → `411aba45`) впав на `prepare`, бо
`priorMasterRetryGuidance` підхопив свіжий `content_quality_report`, який щойно записав сам
`411aba45` — `planHash` змінився, checkpoint не reusable (очікувано, `master-engine.ts`).
Власник натиснув **Create linked retry**: RPC `retry_weekly_digest_generation_job` копіював
`input` без змін, тож новий job `299e2c6c` успадкував той самий мертвий
`resume_from_job_id` і впав ідентично 3 хв по тому — джоба структурно не могла пройти цей крок,
кожен наступний ручний retry повторював би те саме нескінченно.

**Змінено:**
- `supabase/migrations/20260822130000_weekly_manual_retry_drops_stale_resume.sql`:
  `retry_weekly_digest_generation_job` вставляє `v_source.input - 'resume_from_job_id'` замість
  `v_source.input` — лінкований retry стартує свіжий master-ран, а не мертвий resume
- `src/lib/weekly-digest/generation-control.ts`: новий код `resume_source_stale` у
  `classifyGenerationFailure` з порадою «Regenerate master» замість дефолтного «create a manual
  retry» (та порада відтворювала провал)
- [pipeline/weekly-digest § retry_weekly_digest_generation_job](pipeline/weekly-digest.md#retry_weekly_digest_generation_job-копіював-мертвий-resume_from_job_id--фікс-2026-08-22)
- Тести: `generation-control.test.ts` (класифікатор), `supabase/tests/20260822130000_…sql`
  (структурний, як і решта тестів на цю RPC — CI їх не запускає, `npm run pr:check` +
  типчек зелені локально)

**Не зроблено:** міграцію не застосовано до прод-Supabase з цієї сесії (потрібне явне
підтвердження власника — зміна RPC на проді). Два вже завислі FAILED job'и (`c471563f`,
`299e2c6c`) термінальні й нічого не блокують; після мержу/застосування фіксу власник може
натиснути **Regenerate master** на ревізії, щоб отримати чистий прогін.

## 2026-08-22 — Прибрано другий GA4 ID: GTM-контейнер GTM-5S6TXPG5 видалено з коду

**Джерело:** власник помітив «різні GA4 ID». Розбір: на живій сторінці підвантажувались
обидва теги — прямий gtag `G-5R89X6Q5D4` і контейнер `GTM-5S6TXPG5`. Завантажив JS
контейнера з googletagmanager.com: у конфігурації `"tags":[]` і жодного
GA4-destination/`G-…` всередині — **контейнер порожній**, нічого не збирав, лише додавав
другий ідентифікатор і мережевий запит на кожну сторінку. Документована ідея «GTM шле
page_view» не відповідала дійсності — page_view шле наш код (SPA-роутер).

**Змінено:**
- Видалено `src/components/google-tag-manager.tsx`, його монтування в `layout.tsx`;
  `GTM_ID`/`gtmConfigured`/`tagsConfigured` з `analytics-config.ts`; env
  `NEXT_PUBLIC_GTM_ID` з `.env.example`
- Consent-defaults тепер гейтяться на `analyticsConfigured`
- [analytics/ga4-gsc](analytics/ga4-gsc.md): архітектура переписана — один тег gtag;
  чек-лист звірки property 540467725 залишено відкритим (власник)
- ⚠️ Власнику: можна видалити `NEXT_PUBLIC_GTM_ID` зі Vercel; контейнер GTM-5S6TXPG5 в
  Google не чіпати до звірки property (пункт 3 «Чекає на власника»)

## 2026-08-21 — Повне покриття GA4 + SEO hardening (гілка feat/ga4-coverage-and-seo-hardening)

**Джерело:** запит власника на глибокий аудит GA4-покриття і SEO з повною реалізацією знахідок.

**Змінено:**
- Аналітика: каталог подій `src/lib/analytics-events.ts`; трекінг кліків домашньої
  (top-of-week, weekly-блок, категорії, hero), айтемів брифів, hub_view, дзеркало weekly
  engagement у GA4, engagement гайдів, воронка підписки (impression/start/error),
  social_profile_click, dwell 30 с. → [analytics/event-taxonomy](analytics/event-taxonomy.md)
  (нова), [analytics/ga4-gsc](analytics/ga4-gsc.md) (оновлено)
- SEO: og:image/twitter скрізь (`src/lib/seo.ts` + кореневий opengraph-image), revalidate
  хабів при публікації + чесні changeFrequency, дедуп JSON-LD (концепти/тулзи), похідні
  описи хабів/брифів, proxy без hard-503, `/rss-uk.xml` + per-lang alternate + llms.txt,
  публічний manifest, self-canonical /news?page=N, автолінки концептів, lastmod trust +
  weekly dateModified, security headers → [seo/on-site-audit-2026-08-21](seo/on-site-audit-2026-08-21.md)
  (нова), [seo/aeo-strategy](seo/aeo-strategy.md) (нова)
- [index](index.md): seo/aeo-strategy ✅, analytics/event-taxonomy ✅

## 2026-08-21 — Review-pass автопілота: атомарний Ship, гейти attest = гейтам owner-RPC

**Джерело:** технічний аудит PR #311 (гілка `feat/weekly-release-autopilot`).

**Змінено:**
- [pipeline/weekly-digest](pipeline/weekly-digest.md) — hardening machine attestation: article
  перевіряє quality report і в машинному шляху; соц-attest ідемпотентний, не чіпає
  `publish_enabled`; use-block гейт = дієслово + конкретика; Ship — один RPC
  `ship_weekly_digest`; події `attest_failed` у job timeline
- [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md) — рядок `attest_failed` у таблиці
  статусів, уточнення про паузу каналу та use-block
- [now](now.md)
- Міграція `20260821170000_weekly_release_autopilot_ship_and_attest_hardening.sql`

## 2026-08-21 — Weekly release autopilot після backtest 09–20.08

**Джерело:** backtest релізу `ai-weekly-2026-08-09` (прод-БД + 87 merged PR 09–21.08).

**Змінено:**
- [audits/2026-08-21-weekly-digest-release-backtest](audits/2026-08-21-weekly-digest-release-backtest.md)
- [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md) — owner path: Hallucination board → 8 uploads → shooting+YouTube → Ship
- [pipeline/weekly-digest](pipeline/weekly-digest.md) — machine attestation, hydrator, social slots від `release_at`
- [pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md) — scope note: autopilot не змінює селектор
- [now](now.md)
- LinkedIn `612df95c` знову `scheduled` на 24.08 (відновлено content_hash після ручної правки)

## 2026-08-21 — Фільтр kind перед bulk cancel на Today

**Джерело:** власник: масове виділення в списку може випадково скасувати weekly digest.

**Змінено:**
- `/admin` черга стартує на фільтрі **Daily**; чіпи All / Daily / Weekly / інші kind
- **Select all** і чекбокси лише для видимих карток; при зміні фільтра приховане злітає з selection
- Confirm окремо попереджає, якщо в виділенні є weekly
- [ops/social-cms-runbook](ops/social-cms-runbook.md), [now](now.md)

## 2026-08-21 — Queue bulk cancel на Today

**Джерело:** власник: cancel майбутніх постів лише всередині пакета, незручно зі списку.

**Змінено:**
- `/admin` (Today): чекбокси на картках пакетів, Select all, одна кнопка
  **Cancel future posts** (AAL2, confirm)
- `cancelPackageAction` приймає кілька `package_id` або один `id` (редактор пакета)
- [ops/social-cms-runbook](ops/social-cms-runbook.md), [now](now.md)

## 2026-08-20 — Approve назавжди блокувався: threads EN/UK розсинхрон preflight vs генератора

**Джерело:** owner не міг зробити Approve взагалі (окремо від Monday-фіксу вище); live preflight
показав нездоланний блокер `social_variant_missing` на `threads`, який неможливо оверрайднути.

**Корінь:** `weekly_digest_preflight` (SQL, доданий 2026-07-23 в `weekly_digest_v2`) хардкодить
матрицю каналів/локалей inline і досі вимагав `threads`+`en`. `WEEKLY_SOCIAL_MATRIX` у
`src/lib/weekly-digest/preflight.ts` — джерело, за яким реально працює генератор/композер — у
тому ж PR змінили на `threads`+`uk`, але цю SQL-копію матриці забули оновити. Перевірив
production `social_posts`: **усі** threads-пости, які коли-небудь згенерував пайплайн, мають
`locale='uk'`. Тобто цей блокер не міг зникнути ніколи — структурно, для кожного випуску з
2026-07-23, не лише для цього.

**Змінено:**
- `supabase/migrations/20260820123400_weekly_digest_preflight_threads_locale_fix.sql` —
  `weekly_digest_preflight` тепер вимагає `threads`+`uk`, узгоджено з `WEEKLY_SOCIAL_MATRIX` і з
  тим, що реально генерується
- Застосовано напряму на production Supabase (owner request); live-check після фіксу:
  `ready: true, blockers: []`
- Approve + Schedule release виконано тут-таки для `ai-weekly-2026-08-09`
  (release 20.08.2026 13:30 Kyiv)

## 2026-08-20 — Schedule release: будь-яка дата/час, не лише понеділок 16:00

**Джерело:** власник закінчив ревʼю після довгої серії bugfix-сесій поза вікном 15:45/16:00
Kyiv і не міг натиснути Schedule release взагалі — RPC відхиляла будь-яке значення, крім
понеділка 16:00.

**Змінено:**
- `supabase/migrations/20260820121000_weekly_digest_arbitrary_release_time.sql` —
  `schedule_weekly_digest` більше не перевіряє день/годину/хвилину, лише що реліз у майбутньому
  і digest `approved` з чистим preflight; `preflight_at` лишається `release_at − 15 хв`
- `src/app/admin/(cms)/weekly/actions.ts` — прибрано «Monday 15:45» з тексту помилки й
  коментаря `addKyivWeeks`
- `src/components/admin/weekly-workspace.tsx` — copy Release-панелі узагальнено (freeze «за 15
  хв до релізу», а не фіксовані 15:45/16:00)
- `wiki/pipeline/weekly-digest.md`, `wiki/ops/weekly-admin-runbook.md`

## 2026-08-19 — Video shooting package в адмінці, рендерер лише зводить

**Джерело:** рішення власника — пакет для зйомки має бути у Video-табі CMS, інакше балаган
між двома репо.

**Змінено:**
- `src/lib/weekly-digest/video-shoot-pack.ts` — Hailuo/HeyGen jobs зі сцен
- `src/components/admin/VideoShootPackPanel.tsx` — copy-paste в адмінці
- `src/components/admin/weekly-workspace.tsx` — блок Shooting package
- `wiki/pipeline/video-boundary.md`, `wiki/pipeline/weekly-digest.md`,
  `wiki/ops/weekly-admin-runbook.md`, `wiki/now.md`

**Власник зараз:** Video tab → Shooting package; кліпи класти в `ai-today-brief-video`.

---

## 2026-08-18 — Video4 Remotion render готовий, імпорт чекає YouTube

**Джерело:** owner CMS Video4 gates на `ai-weekly-2026-08-09` (Step 7 of 8);
сесія `claude/video4-gates-completion-fc83e1` обірвалась на usage limit;
прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-18.

**Виявлено:** `video_script` v2 і `video_manifest` v1 (`weekly-video-v3`) уже
`approved` на rev. `3e955086`. Гейти `video_final` / captions EN/UK /
`thumbnail` закриваються лише `weekly-video-result-v2` з YouTube-id —
окремого MP4-upload у CMS немає.

**Змінено:** локальний рендер у `ai-today-brief-video` (гілка
`feat/audio-motion-upgrade`): 16:9 432с, thumbnail, 3 UK shorts, VTT;
скрипти `generate-captions.ts` / `build-result-manifest.ts`; wiki video-репо
(`now`, `ops/render-runbook`, `architecture/remotion-compositions`).
Попутно: `alignWords` після тире, десяткові в TTS, b-roll за
`revisionItemId`, градієнт-щит `Sources:`, Windows `spawnSync` + `shell`.

**Власник зараз:** залити `output/atb-weekly-2026-08-09.mp4` + thumbnail на
YouTube, віддати 11-символьний id.

---

## 2026-08-18 — Video Save stored scenes array as narration_plan

**Джерело:** production `video_script` v2 `4945648b…` на Revision 4
(`ai-weekly-2026-08-09`); job `a8c9040f…` упав на «does not contain the v3
script»; коригує запис «video_manifest companion missing» від 2026-08-18.

**Виявлено:** вкладка Video рендерить Scene JSON з `narration_plan.scenes`.
Save записував цей масив назад у `narration_plan`, стираючи title/hook/shorts.
Після фрази о 16:46 Києва approved v2 став масивом з 7 сцен. Manifest job
тому не стартував з валідним планом.

**Змінено:** прод-артефакт відновлено (v1 object + v2 script/scenes);
`video_manifest` succeeded → artifact `e7077c8f…` `weekly-video-v3`
`in_review`. Save тепер мержить сцени на поточний generated plan.

**Власник зараз:** Video → Approve weekly-video-v3. Не Save Video contract,
доки фікс не в проді.

---

## 2026-08-18 — video_manifest companion missing after script retry

**Джерело:** owner CMS (Release `video_manifest:en`, Video tab без enqueue),
`weekly_digest_generation_jobs` без рядка `video_manifest`; коригує запис
«video_script undefined.map» від 2026-08-18.

**Виявлено:** runbook очікував `waiting` companion з `queuePostMasterJobs`.
Після падіння `video_script` о 11:54 UTC і успішного retry о 13:15 UTC рядка
не було. UI показував «cannot generate until this script is approved» на вже
approved script; preflight казав enqueue, кнопки не було; картка v2 vs v3.

**Змінено:** Video → **Generate manifest**; companion upsert після script
success/enqueue; підписи `weekly-video-v3`.

**Не зроблено:** enqueue в прод до деплою — власник тисне Generate manifest
після merge.

---

## 2026-08-18 — video_script undefined.map on normalized article

**Джерело:** production job `43b9fcf1-e9ba-46b8-80a8-93d775cec8f0` на
`ai-weekly-2026-08-09` (heartbeat 2026-08-18 11:55 UTC), artifact `cfd41b17…`,
owner CMS screenshot.

**Виявлено:** `generateVideoScript` кастив approved `article.content` як
`WeeklyArticleMaster`. У проді content keys = `editor_note` / `key_takeaways`,
без `stories` → `article.stories.map` → `Code: unknown` за 1 с, до LLM.

**Змінено:** video job читає `masterBundleFromArtifacts`; `claimIds` і editorial
поля зі `source_snapshot.content_studio`; `requireVideoScriptArticle` валить
точно до `provider_call_started`.

**Не зроблено:** linked retry на проді — чекає merge/deploy.

---

## 2026-08-18 — Social Save on approved posts + copy/approve CLI

**Джерело:** owner UI «Social approval/schedule transitions require a workflow RPC» після
успішного Instagram approve; production package `612df95c`.

**Виявлено:** `saveWeeklySocialAction` писав `meta`/`url` через authenticated client.
Тригер `guard_social_v2_owner_actions` вимагає workflow GUC, коли `status` лишається
`approved`. Critic < 85 блокує approve на сервері; Instagram слайди read-only.

**Змінено:** metadata Save йде через service-role admin client; `weekly:social:repair-copy`
і `weekly:social:approve`. Production copy уже переписано, усі 6 каналів `approved`.

**Не зроблено:** публікація постів (чекають published digest 2026-08-24).

---

## 2026-08-18 — Production social repair applied on `612df95c`

**Джерело:** `npm run weekly:social:repair -- --package-id 612df95c-9c67-4db8-8f4b-209584d9ed68 --apply`,
production SQL live check 2026-08-18.

**Змінено:** 5 каналів отримали `artifactId` cover `a8bbf34e…` (`image/jpeg`); Instagram —
`meta.instagram_carousel` на 7 слайдів і 7 нових JPEG 1080×1350. Усі 6 posts знову `in_review`,
`publish_enabled=false`. Повторний dry-run — 0 mutations.

**Не зроблено:** Re-enable / Save & approve — owner review в адмінці.

---

## 2026-08-18 — Social repair: 8-slide Instagram mapping before production apply

**Джерело:** production package `612df95c-9c67-4db8-8f4b-209584d9ed68`, dry-run
`weekly:social:repair` 2026-08-18.

**Виявлено:** Disable publishing на 6 каналах пройшов (`publish_enabled=false`). Перший dry-run
після паузи був `ok: true`, але Instagram spec з 8 абзаців клав цілі параграфи в `headline`
(понад 72/54) і губив 8-й takeaway. `--apply` впав би на overflow.

**Змінено:** `instagramSpecFromLegacyParts` мапить 8+ parts як cover / 3 story / comparison /
caveat=передостанній / takeaway=останній і підганяє текст під контракт.

**Не зроблено в цьому записі:** результат production `--apply` — окремий рядок після виконання.

---

## 2026-08-18 — Social tab: media contract, channel-aware form, Instagram 7-slide renderer

**Джерело:** executor-spec PR #291 / `wiki/audits/2026-08-18-social-tab-improvement-plan.md`
(гілка `codex/social-tab-improvement-plan`); production Social package audit і owner screenshots
2026-08-18.

**Змінено:** `social_posts.asset_urls` зберігає `artifactId`; resolver підписує URL на 60 хв без
запису в БД; selector відсікає PDF; Threads hook apply атомарний; Instagram hybrid carousel
7×1080×1350 з measured layout; `buildWeeklySocialFactSnapshot` на generation і Save;
channel-aware Social UI; CLI `npm run weekly:social:repair`. Оновлено
[weekly-digest](pipeline/weekly-digest.md), [weekly-admin-runbook](ops/weekly-admin-runbook.md),
[now](now.md).

**Не зроблено в цьому PR:** production `--apply` repair живого пакета.

---

## 2026-08-18 — Захист гілки `main` увімкнено

**Джерело:** `gh api repos/.../branches/main/protection` (до: HTTP 404 «Branch not protected»),
Actions runs `32112884552` / `32112674915`, `gh pr view 273 --json statusCheckRollup`,
`gh api repos/.../actions/caches` — усе live check 2026-08-18.

**Виявлено:** `main` не була захищена взагалі, через що два коментарі в репозиторії описували
неіснуючий стан: `deps-integrity.yml` називав себе required-чеком, а `dependabot-automerge.yml`
стверджував «Branch protection already gates the squash on required checks». Наслідок —
auto-merge міг завести залежність у `main` без жодної зеленої перевірки.

**Змінено:** після мержу PR #290 увімкнено protection: required = `Clean install (npm ci)` +
`Playwright smoke` + `SonarQube Scan`, `strict=false`, без обов'язкових review (єдиний
мейнтейнер не може апрувити власний PR), заборонено force-push і видалення гілки, лінійна
історія, `enforce_admins=false`. Vercel навмисно не required. Деталі й обґрунтування кожного
правила — [ops/github-actions-cost § 6](ops/github-actions-cost.md).

**Перевірено:** `git push --dry-run` для перевірки protection **не годиться** — показує
клієнтський прогноз, server-side перевірку не проганяє. Функціональний доказ дав dependabot-PR
#273: усі три required-чеки зелені, `Playwright smoke` пройшов швидким шляхом за 10 с (усі
важкі кроки `skipped`) — тобто перенесення фільтра шляхів усередину job справді не дає
docs-only PR зависнути. Перший ран на `main` уперше записав кеші під `refs/heads/main`
(Playwright 467 МБ, Next 80 МБ), тож PR тепер їх відновлюють.

---

## 2026-08-18 — Аудит витрат GitHub Actions і перехід репо в public

**Джерело:** GitHub REST live check 2026-08-18 (`/actions/runs`, `/actions/runs/{id}/timing`,
`/actions/caches`, `gh pr list`, `secret-scanning/alerts`); `.github/workflows/e2e.yml`,
`playwright.config.ts`.

**Виявлено:** ≈3950 Actions-хвилин за 14 днів (≈8200/міс при 3000 включених). Розподіл:
e2e 1558 (39%), weekly worker 803, SonarQube 422, Daily Pipeline 348, Deps integrity 237.
Dependabot **не** винен — його automerge `skipped` і білиться в нуль. Драйвер — 120 PR за
14 днів. Один e2e коштував 15 хв бо: 339 тестів × 3 движки серійно (`workers: 1`), білд без
кешу `.next` (141–371 с) і кеш браузерів, що не влучав **жодного разу** — 467 МБ писалися під
`refs/pull/N/merge`, невидимий іншим PR, звідки 24 записи / 10.6 ГБ при ліміті 10 ГБ.
Поле `billable` в API цього репо повертає нулі — рахувалося з `run_duration_ms`.

**Змінено:** створено [ops/github-actions-cost](ops/github-actions-cost.md). Власник перевів
репозиторій у **public** (Actions на standard runners стали безкоштовні й безлімітні,
`ubuntu-latest` 2 → 4 ядра), тому оптимізація перецілена з хвилин на час очікування PR:
кеші розділено на restore-на-PR / save-на-main, повернуто `push: [main]` для прогріву кешів,
доданий кеш `.next/cache`, `workers` 1 → 2, `timeout-minutes: 40` і Telegram-алерт на падіння
в `main`. Увімкнено secret scanning + push protection. Частоту продуктових кронів не чіпали.

**Перевірено:** `wiki:check` зелений, YAML парситься, `playwright test --list` → 339 тестів
× 3 движки; історія — 856 комітів без жодного ключа, secret scanning дав 0 алертів. Розрахунок
«~19 → ~9-10 хв» живим раном **не** підтверджений — це станеться на першому PR.

---

## 2026-08-17 — Social review separates current success from failed history

**Джерело:** production job `df663262-1481-4f31-af0b-35d21e42caa7`, Actions run
`32065312557`; `src/components/admin/weekly-generation-jobs-live.tsx`;
`src/lib/weekly-digest/generation-job-visibility.ts`.

**Виявлено:** final recovery уже завершився `succeeded`, а package і всі шість posts були clean
`in_review` з нульовими blockers. Проте Social tab продовжував рендерити повну таблицю старих
linked jobs, тому десять terminal `FAILED` виглядали як чинні проблеми та візуально перекривали
готовий до approval стан.

**Змінено:** Social показує всі non-terminal jobs, а коли їх немає — лише найновіший terminal
result. Superseded attempts лишаються доступними під нейтральним згорнутим `Previous generation
attempts`; retry controls і червона error presentation старих runs не займають основний екран.
Інші weekly tabs зберігають повну job table.

**Перевірено:** unit regression 3/3, TypeScript та scoped ESLint green; production package
`612df95c-9c67-4db8-8f4b-209584d9ed68` лишається `in_review`, без автоматичного approve.

## 2026-08-17 — Existing Social posts enter the clean repair branch

**Джерело:** production job `606d0463-d479-49a3-828a-cf48232b8dff`, Actions run
`32063924268`; `src/lib/weekly-digest/generation-worker.ts`.

**Виявлено:** staged recovery підтвердив 2/6 restore, довів усі 6 adaptations до clean
checkpoints, зберіг 8 Instagram assets, LinkedIn document і package. На posts 92% фінальний guard
відхилив усі канали, бо БД все ще містила legacy blocker-filled reports. Якщо
`checkpoint.postIds[channel]` був порожній, fallback lookup за package/channel виконувався вже
після repair/update branch; знайдений existing post додавався до guard без оновлення.

**Змінено:** checkpoint і package/channel lookup завершуються перед спільним editable-post
repair branch. Legacy row тепер отримує clean content/report, новий content version/hash і
matching immutable generated review до фінального zero-blocker guard.

**Перевірено:** targeted generation-worker tests — 25/25; typecheck green.

**Wiki:** оновлено [weekly-digest](pipeline/weekly-digest.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md), [index](index.md).

## 2026-08-17 — Social critic flags aligned with approval scores

**Джерело:** production job `dc11b12f-58db-4944-8284-e3d646153e4c`, Actions run
`32062624113`; `src/lib/weekly-digest/social-adapter.ts`,
`src/lib/weekly-digest/generation-control.ts`.

**Виявлено:** Telegram і X успішно записались у durable checkpoints. Threads пройшов три
writer/critic repair rounds і впав з єдиним кодом `critic_flag`, без `critic_score` або
`platform_fit`. Отже critic dimension мав прохідний score 85+, але будь-який explanatory flag
окремо трактувався як blocker; заявлений score threshold фактично не керував approval boundary.

**Змінено:** factual/platform flags при прохідному dimension score стають editor warnings;
нижче 85 вони разом зі score лишаються blockers і запускають bounded repair. Quality exhaustion
класифікується як `quality_gate`, а terminal message містить точні blocker details замість одного
opaque code.

**Перевірено:** targeted social adapter + generation control tests — 23/23; typecheck green.

**Wiki:** оновлено [weekly-digest](pipeline/weekly-digest.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md), [index](index.md).

## 2026-08-17 — Social malformed candidate response uses model fallback

**Джерело:** production job `36ff3a56-f9e4-46eb-be83-bc92cedf3026`, Actions run
`32061374498`; `src/lib/weekly-digest/social-adapter.ts`.

**Виявлено:** reliable router відпрацював швидко (OpenAI mini writer ~6 s, Terra critic ~13 s),
але другий repair writer повернув валідний JSON лише з одним текстом без `2–3` candidates.
`candidatesFromText` викликався вже після завершення provider cascade, тому структурна помилка
однієї моделі завершила всю job як terminal `unknown`.

**Змінено:** candidate serialization перевіряється у `parseWeeklySocialWriter`, який є provider
response validator. Malformed response тепер запускає наступну модель bounded queue в тій самій
job. Додано прямі parser regressions на accepted multi-candidate і rejected single-candidate.

**Wiki:** оновлено [weekly-digest](pipeline/weekly-digest.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md), [index](index.md).

## 2026-08-17 — Social router: true override + reliable writer lane

**Джерело:** production job `02ad5e59-1888-4202-9b71-b6b9a93de03f`, Actions run
`32059830080`; `src/lib/social/llm-router.ts`.

**Виявлено:** bounded retry завершився за 2:23 з точною provider історією. Registry default
`deepseek-v4-pro` помилково запускався як «owner-configured» HTTP override, хоча production
`llm_role_chains` порожня; після нього social-ranked DeepSeek не дав first token за 30 s, а Qwen
повернув HTTP 429. Cap=2 не допустив до швидкої OpenAI mini lane.

**Змінено:** DB override тепер вимагає фактичний non-empty `social.writer` / `social.critic`
chain і приймає лише provider IDs із нього; default registry більше не дублює OpenRouter call.
Writer ranking ставить current OpenAI mini lane першою, а Anthropic/DeepSeek/Qwen лишає bounded
fallback. Critic ranking не змінено.

**Перевірено:** live probe через production DB з prompt 63 147 chars вибрав
`~openai/gpt-mini-latest`, отримав first token за 921 ms і валідний JSON за 1 507 ms без fallback.

**Recovery:** `All configured social LLM providers failed` тепер класифікується retryable
`provider_exhausted`; control plane робить backoff і не вимагає ще одного ручного linked retry.

**Wiki:** оновлено [weekly-digest](pipeline/weekly-digest.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md), [index](index.md).

## 2026-08-17 — Social provider ladder bounded end-to-end

**Джерело:** production job `1d255a95-d410-479e-9a6b-06d703dbee0d`, Actions run
`32057477211`; `src/lib/social/llm-router.ts`,
`.github/workflows/weekly-master-cli-worker.yml`.

**Виявлено:** перший latency hotfix обмежив один OpenRouter stream до 180 секунд, але не всю
model queue. Writer і critic могли кожен послідовно пройти три моделі в кожному з трьох repair
rounds; live Telegram тому не мав channel checkpoint понад 13 хв попри здоровий heartbeat.

**Змінено:** social-only budget тепер 30 s first token / 20 s idle / 60 s absolute **на модель**,
максимум дві моделі на call. Writer/critic надсилають `reasoning.effort=low`, приховують reasoning
із відповіді та мають 4 096 / 2 048 output tokens. Editorial jobs зберігають 90/45/720 s.

**Wiki:** оновлено [weekly-digest](pipeline/weekly-digest.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md), [index](index.md).

## 2026-08-17 — Social provider latency budget

**Джерело:** production job `ee0d727e-6e43-48be-b147-d759c25717a7`, Actions run
`32054964740`; `.github/workflows/weekly-master-cli-worker.yml`,
`src/lib/weekly-digest/social-adapter.ts`.

**Виявлено:** approval-ready recovery залишався на першому Telegram call понад 12 хв без
channel checkpoint. Social adapter успадкував 720 s OpenRouter ceiling великого editorial master
і в worst case міг аудіювати три candidates у кожному з трьох repair rounds.

**Змінено:** для `social_copy` streaming budget = 45 s first token / 30 s idle / 180 s absolute;
інші jobs лишають 90/45/720 s. Кожен repair round незалежно аудіює один найсильніший
deterministic candidate, тому максимум — три writer/critic pairs на канал, а не дев'ять.

**Wiki:** оновлено [weekly-digest](pipeline/weekly-digest.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md), [index](index.md).

## 2026-08-17 — Approval-ready Social repair boundary

**Джерело:** owner screenshot Social tab; production package
`612df95c-9c67-4db8-8f4b-209584d9ed68` / `social_posts` quality reports;
`src/lib/weekly-digest/social-adapter.ts`, `generation-worker.ts`, `social-checkpoint.ts`.

**Виявлено:** всі шість posts стояли `in_review` із 3–12 blockers. Worker запускав quality
audit, але persistence наприкінці безумовно переводив `draft` у `in_review`. Critic отримував
Instagram/Threads без contract markers; all-zero/no-flags template проходив parser; writer і
critic мали різні fact snapshots. UI двічі розгортав ті самі blockers червоними списками.

**Змінено:** до трьох bounded writer repair rounds із послідовним audit кандидатів; нативна
serialization; спільний approved fact snapshot; fail-closed rejection невалідного critic output;
cross-post repair; checkpoints приймають лише blocker-free channels. Existing editable posts
ремонтуються in place з новою content version/review, а package переходить у `in_review` лише
коли всі шість reports clean. Social UI показує green readiness, а legacy diagnostics — у
згорнутому amber блоці.

**Wiki:** оновлено [weekly-digest](pipeline/weekly-digest.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md), [index](index.md).

**Перевірки на момент запису:** targeted Vitest 39/39, `npm run typecheck`, `git diff --check`
green; production recovery чекає merge/deploy.

## 2026-08-17 — LinkedIn native-document 7-page overflow recovery

**Джерело:** production `social_copy` jobs
`f39b2429-63b1-4e08-82f9-fa496fa34840` / `d716aaef-f902-430f-b811-1f496852dd0c`,
Actions runs `32043513443` / `32044207908`; read-only content-length query;
`src/lib/weekly-digest/linkedin-document.ts`.

**Виявлено:** обидва linked retries уже пройшли normalized-article hydration і зберегли 6/6
channel adaptations, але впали на `LinkedIn document rendered 8 pages; expected 7.` PDFKit
автоматично додавав сторінку при overflow. Production standfirst має 1018 символів (тестовий —
101), takeaways до 205, story fields до 278, source URL до 130 символів.

**Змінено:** усі variable-copy regions семисторінкового документа мають bounded height та
ellipsis; Radar, next-week і sources ділять доступну висоту детерміновано. Source label
компактний, але лишається link на повний URL. Page-count gate не послаблено.

**Перевірка:** regression fixture з production-sized copy + коротка фікстура рендерять фактичні
7 сторінок; targeted LinkedIn/worker Vitest — 25/25. Після merge staged checkpoint recovery має
повторити лише LinkedIn і наступні durable кроки, без шести нових writer/critic calls.

## 2026-08-17 — Staged social-copy checkpoints across linked retries

**Джерело:** `src/lib/weekly-digest/generation-worker.ts`,
`src/lib/weekly-digest/social-checkpoint.ts`, `generation-control.ts`; прод-Supabase
`mdiqfatpqczwqghwttpm` read-only check 2026-08-17 (`weekly_digest_generation_jobs.output`,
`retry_of_job_id`, `weekly_digest_artifacts`, `social_packages`, `social_posts`,
`social_post_reviews`).

**Виявлено:** старий per-channel checkpoint справді зберігав legacy
`socialCopyCheckpointHash` / `tokens` / `adaptations`, але `loadSocialCopyCheckpoint` читав лише
поточний job ID. **Create linked retry** створює child із порожнім output, тому він повторював
усі шість дорогих writer/critic pairs; Instagram, LinkedIn document, package і posts також не
мали спільного versioned resume state.

**Змінено:** versioned `social_copy_checkpoint` сумісно читає legacy v1, обходить
`retry_of_job_id` chain і вибирає найдальший валідний state лише для того самого
digest/revision/input hash. Checkpoints пишуться після кожного channel result, кожного
Instagram slide artifact, LinkedIn PDF, draft package та кожного post + immutable generated
review. Package/posts стають `in_review` тільки після повного persist; signed URLs
перевидаються, stable DB/storage artifacts не генеруються повторно.

**Wiki:** оновлено [weekly-digest](pipeline/weekly-digest.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md), [index](index.md).

**Перевірки на момент запису:** targeted Vitest 39/39, `npm run typecheck`, scoped ESLint,
read-only production schema/query check — green.

## 2026-08-17 — Social package LinkedIn document recovery

**Джерело:** production `weekly_digest_generation_jobs` / `weekly_digest_generation_attempts` /
`weekly_digest_generation_events` / `weekly_digest_artifacts` live check 2026-08-17;
`src/lib/weekly-digest/generation-worker.ts`;
`src/lib/weekly-digest/linkedin-document.ts`.

**Виявлено:** `social_copy` job успішно завершив writer/critic для шести каналів і зберіг усі
вісім Instagram carousel slides, але відразу після цього завершився terminal error
`Cannot read properties of undefined (reading 'map')`. Current `article` artifact містив
normalised `editor_note` / `key_takeaways` без `stories`; LinkedIn document викликав
`bundle.en.stories.map`.

**Змінено:** [weekly-digest](pipeline/weekly-digest.md) (§ Social package + LinkedIn document
recovery), [weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md), [index](index.md).
`masterBundleFromArtifacts` відновлює stories з активної revision і нормалізує metadata для
social/LinkedIn consumers; regression test покриває production-shaped artifact.

**Операційно:** після мержу фіксу terminal job треба відновити **Create linked retry**. Це один
package job для шести каналів, не шість окремих генерацій.

## 2026-08-17 — Master quality report carry-over при Restore

**Джерело:** прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-17 (`weekly_digests`,
`weekly_digest_revisions`, `weekly_digest_artifacts`, `weekly_digest_generation_jobs`,
`weekly_digest_release_events` на `6cbcf0b3-187d-4d7d-9eb9-66bdff1c72d4`); власник побачив
«Master quality report is missing» після успішного `editorial_master`.

**Змінено:** [weekly-digest § Master quality report carry-over при Restore](pipeline/weekly-digest.md#master-quality-report-carry-over-при-restore-2026-08-17)
(нова секція), [weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md).

**Код (гілка `fix/weekly-quality-report-carryover`, змержено в `main` як `f137c39`):**
`src/lib/weekly-digest/quality-report-carryover.ts` (новий) —
`findOrphanedQualityReport` / `carryOverOrphanedQualityReport`, обидва через RPC
`save_weekly_digest_artifact` (не raw `UPDATE` — `revision_id` immutable, перевірено наживо);
`src/lib/weekly-digest/admin-data.ts` — нове поле `workspace.orphanedQualityReport`;
`src/app/admin/(cms)/weekly/actions.ts` — `restoreWeeklyDigestRevisionAction` викликає
carry-over автоматично після успішного `revert_weekly_digest_revision`, нова
`carryOverWeeklyQualityReportAction`; `src/components/admin/weekly-workspace.tsx` — Research
tab показує окрему панель «found on an earlier version» + кнопку **Attach this report to the
current version**, коли активна ревізія не має свого звіту, але осиротілий існує.

**PR:** [#275](https://github.com/sanchahous/ai-today-brief/pull/275), змержено в `main` 2026-08-17.

**Не зроблено:** UI-верифікація в браузері не пройдена (subst-drive `next dev` глюк
середовища).

## 2026-08-17 — Site images WebP

**Джерело:** запит власника після upload 7 story-картинок на `ai-weekly-2026-08-09`;
перевірка origin у прод-Storage (JPEG 1600×900) і коду `uploadWeeklyArtifactAction` /
`encodeCardOrigin` / `opengraph-image.tsx` (Satori не декодує WebP).

**Змінено:** [now](now.md), [overview](overview.md), [marketing/card-images](marketing/card-images.md),
[ops/vercel-image-quota](ops/vercel-image-quota.md), [weekly-digest](pipeline/weekly-digest.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md),
[weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md), [index](index.md).

**Код (гілка `feat/site-webp-origins`):** `src/lib/encode-site-image.ts` — WebP 1600×900 q82
для weekly `story_image`; loader `format=webp`; cover / news-card origin / social JPEG
без змін.

## 2026-08-16 — Start / retry Content Studio після succeeded jobs

**Джерело:** клік власника 16.08 12:46 UTC на `ai-weekly-2026-08-09` rev.3
(`5b1aa70f`); `weekly_digest_release_events.generation_queued` на вже
`succeeded`/`waiting` jobs; [now](now.md).

**Змінено:** [weekly-digest](pipeline/weekly-digest.md) (§ Start / retry),
[weekly-admin-runbook](ops/weekly-admin-runbook.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md), [now](now.md).

**Код (гілка `fix/weekly-content-studio-retry`):** `retryWeeklyContentStudio` ставить
нові `research_pack` з `:retry:{uuid}`, якщо слот не in-flight; waiting master
не дублюється. Composer лишає `startWeeklyContentStudio` зі стабільним ключем.

**Не зроблено:** прод-перезбір паків (чекає деплою + клік власника); апруви паків;
Rebuild selection.

---

## 2026-08-16 — Research pack: PostgREST 1000 + SPA model cards

**Джерело:** перезбір паків `ai-weekly-2026-08-09` rev.3 після #268 (jobs
`b9fd05b0` / `60a62216` / `84645b6f` succeeded, `independent_source_count` лишився 0);
`select count(*)` у вікні corroboration = 2440; live GET HF/ModelScope
`extractMainText` = 0 при HTTP 200.

**Змінено:** [weekly-digest](pipeline/weekly-digest.md) (§ Corpus corroboration),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md).

**Код (гілка `fix/weekly-research-spa-and-page`):** `generation-worker.ts` гортає
`articles` сторінками по 1000; `research.ts` для не-primary бере title + meta
description, якщо немає article prose.

**Не зроблено:** апруви паків; Rebuild selection. IBM ALTK і звіт HF надалі чесні 0,
якщо в корпусі немає другого видавця.

---

## 2026-08-16 — Daily rank: ownership щоденного тулу + кластер угоди Cursor

**Джерело:** власник (SpaceX закрила поглинання Cursor за $60B 14.08, сайт мовчав);
прод-`articles` live check 2026-08-16 (блог Cursor HN 98, TechCrunch close score 0.14,
Reuters announce 16.06 HN 1019); [now](now.md).

**Змінено:** [guide](pipeline/guide.md) §3, [weekly-digest](pipeline/weekly-digest.md)
(кластер на daily rank), [weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[now](now.md).

**Код (гілка `feat/reader-tool-lifecycle-news`):** `pipeline/reader-tools.ts` — тули
читача, ownership, false-positive дедупу, stale URL; `rank.ts` — виняток demotion +
кластер за сутностями/`storyIdentityKeys`; `summarize.ts` — промпт; `select.ts` /
`run-daily.ts` — `genre_floor` і `skipped_pool_titles`; `custom-research.ts` —
не брати primary з `/2024/` у 2026. `SCORE_VERSION` не бампили.

**Не зроблено:** розширення rolling window >24h (вечірній TechCrunch усе одно не
побачить ранковий блог наступного дня); разовий cleanup червневого хибного айтема
`$60M clarifies rumors`.

---

## 2026-08-16 — Research pack: corroboration з ingest-корпусу

**Джерело:** прод-паки `ai-weekly-2026-08-09` rev.2 (`independent_source_count=0` на 3/3
Feature); прод-`articles` (NVIDIA + HF card + ModelScope для Qwen 2.4T, різні
`cluster_id`); [now](now.md) owner session 2026-08-16.

**Змінено:** [weekly-digest](pipeline/weekly-digest.md) (§ Corpus corroboration),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md).

**Код (гілка `fix/weekly-research-corpus-corroboration`):** `pipeline/page-url.ts` —
канонічний URL; `pipeline/story-identity.ts` — conservative same-event match;
`research.ts` + `generation-worker.ts` — корпус за вікно тижня; `fetch.ts` — дедуп
slash/www/UTM; `editorial-llm.ts` — атрибуція чисел, коли немає corroborating excerpt.

**Не зроблено:** крос-джерельне звʼязування на daily `rank` (`mentions_count ≈ 1`) —
окремий L2 з bump `SCORE_VERSION`.

---

## 2026-08-16 — Editor swap у `ai-weekly-2026-08-09`: Needle → Anthropic 60 субагентів

**Джерело:** власник на Research tab, рішення лишити Top 3 і замінити rank 6 до апрувів;
прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-16.

**Змінено:** [now](now.md). Код репозиторію не змінювався.

**Прод:** нова активна ревізія №3 `5b1aa70f-3ef1-48a7-b96d-2377876443ab` через
`rebuild_weekly_digest_selection` (reason `editor_swap:needle2->anthropic-60-subagents`).
Anthropic `96b2cec4` на rank 6, seed 5/5 полів з daily item, джерело TechCrunch,
`diversity_penalty=8` у знімку. Needle прибрано. Selection run
`969b9ae2` (`weekly-editorial-v3+editor-swap`) позначає Anthropic `selected`, Needle
`editor_replaced`. Три `research_pack` + `editorial_master` поставлені в чергу на нову
ревізію; waiting-master на rev.2 скасовано.

**Не зроблено:** апруви паків (ще `queued`). Крос-джерельне підтвердження не чіпали.

---

## 2026-08-16 — Мовчазний суддя авто-публікації + кнопка перезбору відбору

**Джерело:** прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-16 (`pipeline_runs`
stage=`auto_publish` за 8 ранів, `item_reviews`, `brief_items`); пряма проба судді на брифі
`9deed7d1-d426-46fd-9b9b-9a802bf9d945`; живий `auto-publish --dry-run` до і після фіксу.

**Змінено:** [audits/2026-08-16-auto-publish-silent-judge](audits/2026-08-16-auto-publish-silent-judge.md)
(нова), [weekly-digest](pipeline/weekly-digest.md), [weekly-admin-runbook](ops/weekly-admin-runbook.md),
[index](index.md), [now](now.md).

**Код (гілка `fix/auto-publish-silent-judge`):** `pipeline/auto-publish.ts` — парсер конвертів
(+ `returned`), `judgeResponseIssue`, `judgeSilenceError`, `formatJudgeFailureAlert`,
`formatPendingReviewPing`, `status='failed'` + `error` у `pipeline_runs`, облік `unjudged`;
`pipeline/llm-json.ts` — `validateSemantic` у ланцюжку провайдерів (перемикає модель на
непридатній відповіді); `pipeline/scripts/auto-publish.ts` — exit code 1;
`src/lib/weekly-digest/rebuild-selection.ts` + `selection-snapshot.ts` (спільний із composer)
+ `rebuildWeeklySelectionAction` + кнопка в Overview;
`supabase/migrations/20260816120000_weekly_rebuild_selection.sql`.

**Перевірено:** дефект відтворено на живій БД **до** фіксу (`left_draft approved=0 rejected=0`,
`error=NULL`); модель відповідала правильно, але без конверта `{results:[…]}`. Після фіксу той
самий бриф дає `published approved=1`. RPC перевірено викликом у транзакції з відкатом на
прод-дайджесті `6cbcf0b3`; повний rebuild — наживо на **тестовому** `ai-weekly-test-2026-07-24`
(ревізія 3, 7 історій, 4 нові / 4 вибули). 1434 unit-тести, `tsc`/`eslint`/`wiki:check` зелені.

**Прод:** міграція `20260816120000` застосована; функція `security definer`, грант лише
`service_role` (`anon`/`authenticated` не мають). Прод-випуск `6cbcf0b3` не перезбирався —
це рішення власника через кнопку.

**Не зроблено:** `pipeline_runs.status='error'` (як просив власник) неможливий без міграції —
`pipeline_runs_status_check` дозволяє `ok/failed/skipped`; використано `failed`. Семантичний
валідатор перемикає модель лише в HTTP-смузі; `gemini`/`cli` валідатора не приймають, там та
сама перевірка дає чесну помилку після виклику.

---

## 2026-08-16 — Weekly відбір `weekly-editorial-v3` + seed-контент історій

**Джерело:** аудит власника прод-прогону `05cc4e6a-a709-44ca-b56a-382f21c40292` (тиждень
09–15.08); прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-16
(`weekly_digest_selection_runs`, `weekly_digest_revision_items`, `articles.score_authority`);
бектест `selectEditorialDigestItems` на реальному пулі.

**Змінено:** [weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-digest](pipeline/weekly-digest.md), [weekly-admin-runbook](ops/weekly-admin-runbook.md),
[now](now.md).

**Код (гілка `fix/weekly-selection-and-seed-content`):** новий `pipeline/source-authority.ts`
(таблиця feed-trust переїхала з `rank.ts` без зміни поведінки daily + `publisherAuthority` за
хостом призначення); `pipeline/weekly-digest.ts` — плато `recency` всередині тижня, evidence на
authority видавця, corroboration за незалежними хостами цитат, diversity як штраф замість капу,
greedy max-marginal вибір, `diversity_penalty`/`adjusted_score` у знімку кандидата;
`src/lib/weekly-digest/seed-content.ts` + composer — seed історій із `body_md`/`takeaways`/
`action_items`/`when_to_use` щоденного айтема.

**Перевірено:** усі чотири дефекти відтворені на живій БД **до** фіксу (7/7 історій із
`body = summary` і `takeaway = why`, кап на 68.1/67.4 проти обраних 63.9, evidence 17.2 однаково
для HN і bearblog, corroboration 0 у 21/22). Після фіксу на тому самому пулі: recency 4.4–4.9
(було 1.4–5.0), evidence 7.6–22.0 (було 14.4–18.0), corroboration > 0 у 3/33 (було 1/22),
викинута капом новина повертається 7-ю позицією, IBM ALTK-Evolve (76.1) обходить bearblog (67.3).
Seed-replay проти прод-даних — 5/5 полів без дублів у всіх 7 історіях. 1419 unit-тестів,
`tsc`/`eslint`/`wiki:check` зелені.

**Не зроблено:** наявні ревізії імутабельні — прод-дайджест `6cbcf0b3` лишається з порожніми
полями, доки власник не перескладе випуск. Крос-джерельне звʼязування на етапі `fetch`
(`mentions_count ≈ 1`) — окрема робота.

---

## 2026-08-15 — Ілюстраційний стек #241–#265 у `main` + прод-міграції

**Джерело:** PR [#265](https://github.com/sanchahous/ai-today-brief/pull/265) (merge-коміт
`294fe4e`), `gh pr checks` / `gh run list` live check, прод-Supabase `mdiqfatpqczwqghwttpm`,
https://aitodaybrief.com live check.

**Змінено:** [now](now.md).

**Код:** увесь стек (#241–#264 + два раунди review-фіксів) змержено merge-комітом, 99 файлів,
+12962/−509. PR перецілено на `main`, бо `e2e.yml`/`sonarqube.yml` тригеряться лише на
`pull_request → main` і за 24 стековані PR не відпрацювали жодного разу. Перецілення саме по
собі їх не запускає — подія `edited` поза `opened/synchronize/reopened`, знадобився
close+reopen. #241 закрився автоматично, #242–#264 закриті вручну, 24 гілки видалено.

**Прод:** 4 міграції `20260815*` застосовано (`weekly_story_prompt_set`, `briefs_cover_prompt`,
`llm_model_rank_audit`, `briefs_cover_prompt_column_privacy`). Repo variable
`OPENROUTER_RERANK_APPLY=off` виставлено до мержу.

**Тест:** перший в історії цього коду прогін — Playwright smoke **pass 14m55s**, SonarQube
**pass 3m11s**, Deps integrity pass, Vercel pass. Пост-деплой: `set local role anon` →
`PACK_COLUMNS`-select віддає рядки, `cover_prompt` → `insufficient_privilege`; `get_advisors`
без нових зауважень; живий сайт (`/`, `/uk/news`, `/uk/digests`) віддає контент, 0
console-помилок.

**Лишається:** живий weekly-прогін (siblings diversification, owner scene override, post-upload
QA recheck) — потрібен реальний випуск; рішення власника, чи вмикати
`OPENROUTER_RERANK_APPLY`, після кількох діб audit-рядків.

## 2026-08-15 — Пре-мерж перевірка самих фіксів: три з них були дефектні

**Джерело:** прод-Supabase `mdiqfatpqczwqghwttpm` (grants, тригери, `list_migrations`), живий
каталог OpenRouter 2026-08-15, `gh pr checks` по всіх 25 PR стека, локальний `npm run pr:check`.

**Змінено:** [audits/2026-08-15-illustration-pr-stack-review](audits/2026-08-15-illustration-pr-stack-review.md)
(розділ «Пре-мерж перевірка самих фіксів»), [now](now.md).

**Коригує запис нижче** — не спростовує його, а додає: фікси R1–R4 перевірено не лише тестами,
а проти живих систем, і три виявились такими, що не працюють.

**Код:** (1) `20260815180000` переписано — `revoke select (col)` є no-op проти табличного
granta, тепер `revoke select` + колонковий `grant` на 12 публічних колонок плюс self-verifying
`do $$` блок усередині міграції; (2) чергу OpenRouter обрізано до `OPENROUTER_MAX_MODEL_ATTEMPTS`
у плані rerank і захисно в реєстрі (на живому каталозі 197 → 6); (3) `isEligibleOpenRouterModel`
експортовано й застосовано в `scoreModelForRole` — `:batch`/`:free` більше не кандидати
quality/$; (4) `applyEnabled` прокинуто в `planOpenRouterRerank` + новий
`skip_reason='apply_disabled'`, щоб kill-switch не писав фантомний `applied=true` як базу
quality-drop guard наступного дня.

**Тест:** 106 тестів у `pipeline/providers/` + `openrouter-models` зелені (нових — 7); повний
`npm run pr:check` прогнано наскрізь із відсіченим exit code. Обидві правки БД перевірено
дров-раном на прод-Postgres у транзакції з відкатом — прод не змінювався.

**Не зроблено:** `daily.auto_publish_judge` за quality/$ обирає intelligence 37.8 при порозі 35 —
роль audit-only, застосовується лише ранжування `weekly.master_writer`; на першому прогоні
guard-а немає за побудовою (`currentApply = null`), тому apply вмикає власник вручну після
спостереження, а не cron за замовчуванням.

## 2026-08-15 — Review 24 PR (#241–#264) і виправлення на `feat/weekly-illustration-fixes`

**Джерело:** [audits/2026-08-15-illustration-pr-stack-review](audits/2026-08-15-illustration-pr-stack-review.md) — повний список.

**Змінено:** [audits/2026-08-15-illustration-pr-stack-review](audits/2026-08-15-illustration-pr-stack-review.md)
(нова), [index](index.md), [now](now.md), [marketing/card-images](marketing/card-images.md),
[overview](overview.md), [pipeline/weekly-digest](pipeline/weekly-digest.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[ops/weekly-admin-runbook](ops/weekly-admin-runbook.md), [open-questions](open-questions.md).

**Код:** 4 блокери (крос-story diversification мертва після M1; mapping gate кидав exception
замість «0/3»; daily rerank обрізав спільну чергу OpenRouter до 3 моделей для всіх ролей;
`QUALITY_FLOOR` без порога для 10 з 13 ролей), 8 якість (грамматика діаграми на всі 3 концепти
замість одного; B1-fix винятковував увесь UI-список, не лише `terminal`; motif-family matching
не працював крос-story; `prompt-export.ts` мовчки деградує при дрейфі формату + різав фразу
посеред слова; owner scene override ігнорувався в prompt_only), 4 безпека/цілісність
(cross-digest запис в owner-feedback/QA діях; read-modify-write без захисту від гонки;
`briefs.cover_prompt` читається anon; workflow без `permissions:`), 6 операційних (видалення
старого PNG на reencode; SELECT без `.limit()`; QA без retry; строге порівняння режиму env).

**Тест:** живий `npm run pr:check` — 1389/1389 тестів, typecheck/lint/e2e:check чисті,
wiki:check закрито цим самим комітом.

**Не зроблено (окремі, нижчий пріоритет):** агрегація owner_feedback у calibration dataset,
e2e для Visuals prompt-карток (немає авторизованого Playwright-сьюту на `/admin/weekly`),
поріг «дистинктності» для <2 промптів.

## 2026-08-15 — reencode історичних PNG карток без FLUX

**Джерело:** [ops/vercel-image-quota](ops/vercel-image-quota.md);
[marketing/card-images](marketing/card-images.md).

**Змінено:** [marketing/card-images](marketing/card-images.md),
[ops/vercel-image-quota](ops/vercel-image-quota.md), [overview](overview.md),
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[now](now.md), [index](index.md).

**Код:** `reencodeStoredCardOrigins` — download PNG → `encodeCardOrigin` → `${slug}.jpg` →
прибрати PNG. `--reencode-png` / `--dry-run`. Немає виклику моделі, `--force` не чіпали.
`WEEKLY_CONTENT_STUDIO_V2=off` без змін. Живий прогін по прод-бакету в цій хвилі не запускали.

**Тест:** `uploads a JPEG origin, points the row at it, and removes the PNG`.

**Не зроблено в цій хвилі:** live `--reencode-png` на проді; квота Supabase transform
`(needs verification)`; F4.

## 2026-08-15 — origin JPEG новинних карток (G2 follow-up)

**Джерело:** [ops/vercel-image-quota](ops/vercel-image-quota.md);
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) G2.

**Змінено:** [ops/vercel-image-quota](ops/vercel-image-quota.md),
[marketing/card-images](marketing/card-images.md), [overview](overview.md),
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[now](now.md), [index](index.md).

**Код:** `encodeCardOrigin` перед upload — 1280×720 JPEG q82, `${slug}.jpg`.
Модель новин не змінювали. Немає автогенерації картинок дайджесту. F4 не будується.
`WEEKLY_CONTENT_STUDIO_V2=off` без змін.

**Тест:** `encodes a 16:9 raster as a JPEG well under the 488 KB PNG origin`.

**Не зроблено в цій хвилі:** backfill історичних PNG; квота Supabase transform
`(needs verification)`; F4.

## 2026-08-15 — F5: без пінів версії моделі в прод-коді

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) F5.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[pipeline/llm-providers](pipeline/llm-providers.md), [pipeline/weekly-digest](pipeline/weekly-digest.md),
[now](now.md), [index](index.md).

**Код:** прод `pipeline/` / `src/` без `sonnet-5` / `gpt-5` / `gemini-3.x` поза тестами.
Trend `gpt` без номера покоління. Немає image-абстракції (F4). Vision-модель не чіпали.

**Тест:** `production pipeline/ and src/ do not pin sonnet-5, gpt-5, or gemini-3.x ids`.

**Не зроблено в цій хвилі:** F4, стискання origin PNG
([ops/vercel-image-quota](ops/vercel-image-quota.md)).

## 2026-08-15 — A2: bake-off vision-критика

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) A2;
Actions [`31879588071`](https://github.com/sanchahous/ai-today-brief/actions/runs/31879588071).

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[pipeline/content-sim](pipeline/content-sim.md), [pipeline/weekly-digest](pipeline/weekly-digest.md),
[ops/weekly-sandbox](ops/weekly-sandbox.md), [marketing/card-images](marketing/card-images.md),
[now](now.md), [index](index.md).

**Код:** харнес читає `headline` з visual-compiler маніфесту (`bakeoff-manifest.ts`).
`CONTENT_SIM_VISION_OPENROUTER_MODEL` не змінений — лишаємось на `google/gemini-2.5-flash`.
Немає автогенерації картинок дайджесту.

**Тест:** `uses top-level headline when story is missing`.

**Звіт:** `experiments/critic-bakeoff/2026-08-15/` — усі три моделі `Kept the good = 0/1`;
`claude-sonnet-5` unfit; позитив n=1.

**Не зроблено в цій хвилі:** F5 grep номерів версій, стискання origin PNG
([ops/vercel-image-quota](ops/vercel-image-quota.md)).

## 2026-08-15 — G: бюджет ілюстрацій з ledger

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) G.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[pipeline/weekly-digest](pipeline/weekly-digest.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[ops/weekly-admin-runbook](ops/weekly-admin-runbook.md), [overview](overview.md),
[open-questions](open-questions.md), [now](now.md), [index](index.md).

**Код:** `illustrationBudgetFromLedger` + секція Illustration budget на `/admin/costs`.
Daily cover prompt і post-upload QA пишуться в `generation_cost_events`. Cap 0.2 не піднято.
Немає автогенерації картинок дайджесту і image-абстракції (F4).

**Тест:** `illustration budget uses ledger events not policy spend caps`;
`does not treat weekly master LLM as illustration API spend`.

**Не зроблено в цій хвилі:** A2, F5 grep номерів версій, стискання origin PNG
([ops/vercel-image-quota](ops/vercel-image-quota.md)).

## 2026-08-15 — F3: добовий OpenRouter rerank + аудит

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) F3.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[pipeline/llm-providers](pipeline/llm-providers.md), [pipeline/weekly-digest](pipeline/weekly-digest.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[ops/weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md), [index](index.md).

**Код:** `llm_model_rank_audit` + `planOpenRouterRerank` + daily workflow. Черга `openrouter`
оновлюється топ-3 writer, якщо якість не впала >5. Адмінка показує latest audit на роль.
Немає image-абстракції (F4).

**Тест:** `does not apply a cheaper winner when quality drops below the current pick`;
`writes an audit row per role with score price and quality`.

**Не зроблено в цій хвилі:** F4, F5 grep номерів версій, G, A2.

## 2026-08-15 — F2: scoreModelForRole (якість / ціна)

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) F2.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[pipeline/llm-providers](pipeline/llm-providers.md), [now](now.md), [index](index.md).

**Код:** `pipeline/providers/model-scoring.ts` — floor + quality/price, топ-3, family-хвіст.
Немає добового job (F3) і image-абстракції (F4).

**Тест:** `a model with intelligence_index 14.2 at $0.01 is not chosen for weekly.master_writer`.

**Не зроблено в цій хвилі:** F3 (добове оновлення + аудит у `/admin/providers`), G, A2.

## 2026-08-15 — E3: promotion gate якості промптів

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) E3.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[pipeline/content-sim](pipeline/content-sim.md), [pipeline/weekly-digest](pipeline/weekly-digest.md),
[ops/weekly-sandbox](ops/weekly-sandbox.md), [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[marketing/card-images](marketing/card-images.md), [overview](overview.md),
[now](now.md), [index](index.md).

**Код:** Visuals рядок з ≥60% прийнятних / 0 misleading / ≤10 хв / 3 різні.
Не preflight. Пороги новин без змін.

**Тест:** `promotion gate passes when 60% of concepts are acceptable on the first or second owner attempt`;
`prompt promotion gate fails on misleading accepted concepts without blocking release preflight`.

**Не зроблено в цій хвилі:** F (динамічний вибір моделі), G (бюджет), A2 bake-off.

## 2026-08-15 — E2: двостадійний критик

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) E2.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[pipeline/content-sim](pipeline/content-sim.md), [pipeline/weekly-digest](pipeline/weekly-digest.md),
[ops/weekly-sandbox](ops/weekly-sandbox.md), [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[marketing/card-images](marketing/card-images.md), [overview](overview.md),
[now](now.md), [index](index.md).

**Код:** image-only → (якщо pass) story-aware. M2 без змін. A2 bake-off не чіпали.

**Тест:** `two-stage critique fails when image-only flags readable_text even if story-aware would pass`;
`skips story-aware vision when image-only already failed`.

**Не зроблено в цій хвилі:** E3 promotion gate.

## 2026-08-15 — E1: owner-feedback contract на концепт

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) E1.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[pipeline/weekly-digest](pipeline/weekly-digest.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[ops/weekly-admin-runbook](ops/weekly-admin-runbook.md),
[marketing/card-images](marketing/card-images.md), [overview](overview.md),
[now](now.md), [index](index.md).

**Код:** `owner-feedback.ts` + форма на картці концепту. Вердикт у `story_prompt_set` і в
`metadata.owner_feedback` upload. Snapshot `canonical`. Немає auto-export у `experiments/`.

**Тест:** `owner verdict from admin lands on the prompt set and uploaded image metadata`.

**Не зроблено в цій хвилі:** E2 двостадійний критик.

## 2026-08-15 — D3: human_dignity_risk у критику

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) D3.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[pipeline/content-sim](pipeline/content-sim.md), [pipeline/weekly-digest](pipeline/weekly-digest.md),
[ops/weekly-sandbox](ops/weekly-sandbox.md), [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[marketing/card-images](marketing/card-images.md), [overview](overview.md),
[now](now.md), [index](index.md).

**Код:** `human_dignity_risk` у `IMAGE_CRITIC_BLOCKER_CODES` і в обох critic prompt-ах.
Upload: «ризик гідності». Новини: critique `passed: false`.

**Тест:** `fails on human_dignity_risk even with a high score`.

**Не зроблено в цій хвилі:** E1 owner-feedback contract.

## 2026-08-15 — D2: QA-порада власнику замість auto-repair

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) D2.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[pipeline/weekly-digest](pipeline/weekly-digest.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[ops/weekly-admin-runbook](ops/weekly-admin-runbook.md),
[marketing/card-images](marketing/card-images.md), [overview](overview.md),
[now](now.md), [index](index.md).

**Код:** `adviceForPostUploadQa` у `post-upload-qa.ts`. Visuals показує do/dont. Немає
`prompt_patches` на upload. Новини лишаються на старому repair-циклі.

**Тест:** `baked text QA advises inpaint not a full regenerate`;
`false thesis QA advises switching concept not patching labels`.

**Не зроблено в цій хвилі:** D3 (`human_dignity_risk`).

## 2026-08-15 — C3: mapping gate перед story_prompt_set

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) C3.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[marketing/card-images](marketing/card-images.md), [overview](overview.md),
[pipeline/weekly-digest](pipeline/weekly-digest.md),
[now](now.md), [index](index.md).

**Код:** `pipeline/concept-mapping-gate.ts`. `produceStoryPrompts` відсікає брифи без таблиці
context/action/outcome. Id, не label. Порожній `semanticProps` — fail. V10 не імпортується.

**Тест:** `empty semanticProps do not vacuously pass the mapping gate`;
`unmapped_semantic_prop matches visibleElementId not visibleElement labels`;
`a concept missing visible outcome does not enter the prompt set`.

**Не зроблено в цій хвилі:** C5.4 (`inferRole`); D (truth in pixels).

## 2026-08-15 — C2: роутер грамматики від essence (без V10)

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) C2.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[marketing/card-images](marketing/card-images.md), [overview](overview.md),
[pipeline/weekly-digest](pipeline/weekly-digest.md),
[now](now.md), [index](index.md).

**Код:** `pipeline/scene-grammar.ts`. Метрика в title/summary/essence → схема. C5.2/C5.3
тести зелені. V10 не імпортується.

**Тест:** `an incidental duration in practical does not switch a domain story to the diagram grammar`;
`a single mention of caching does not select the process grammar`.

**Не зроблено в цій хвилі:** C3 (mapping gate), C5.4 (`inferRole`).

## 2026-08-15 — C0/C1: grammar на брифі, без моста autoClaim

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) C0/C1.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[marketing/card-images](marketing/card-images.md), [overview](overview.md),
[now](now.md), [index](index.md).

**Код:** `WeeklyReportageSceneBriefResult.grammar`. Журі → `cinematic_domain_scene`, fallback →
`source_led_fallback`. `exportManualImagePrompts` бере грамматику з брифа. C0: C2 буде
`pipeline/scene-grammar.ts` від `EditorialEssence`, не порт `VisualAutoClaim`.

**Тест:** `exportManualImagePrompts writes each brief grammar instead of one cinematic default`.

**Не зроблено в цій хвилі:** C2 (роутер метрики → схема), C3, C5.

## 2026-08-15 — P3: промпт обкладинки daily після publish

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) P3.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[pipeline/guide](pipeline/guide.md), [pipeline/llm-providers](pipeline/llm-providers.md),
[overview](overview.md), [now](now.md), [index](index.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md).

**Код:** роль `daily.cover_scene`; `pipeline/daily-cover-prompt.ts` будує `ManualImagePrompt` з
топ-3 заголовків + intro; колонка `briefs.cover_prompt jsonb`; `notifyReview` шле окреме
`<pre>`-повідомлення. Авто-рендеру обкладинки немає.

**Тест:** `daily cover prompt is built from the edition top stories, not from a single item`.

**Не зроблено в цій хвилі:** C (грамматика як третій вимір). Міграцію треба застосувати на прод
до першого запису колонки.

## 2026-08-15 — B3: Visuals показує N/3 промпти готові

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) B3.

**Змінено:** [pipeline/weekly-digest](pipeline/weekly-digest.md),
[ops/weekly-admin-runbook](ops/weekly-admin-runbook.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[now](now.md), [index](index.md).

**Код:** `storyPromptReadiness` — три місця журі `literal_context` / `mechanism` /
`consequence`. Рядок біля story на Visuals. `produceStoryPrompts` штампує `sceneSource` /
`motifClass` з брифів, бо `prompt-export` не несе `scene_source`. Cover і вага гейта без змін.

**Тест:** `shows N/3 промпти готові when all three seats are present`.

**Не зроблено в цій хвилі:** P3 (daily cover prompt).

## 2026-08-15 — M3: preflight missing-image веде до промпту, не до Regenerate

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) M3.

**Змінено:** [pipeline/weekly-digest](pipeline/weekly-digest.md),
[ops/weekly-admin-runbook](ops/weekly-admin-runbook.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[now](now.md), [index](index.md).

**Код:** `ARTIFACT_GATE_GUIDANCE.story_image.fixMissing` і `cover.fixMissing` — скопіюй промпт,
згенеруй у своєму інструменті, завантаж файл. Вага гейта (`ARTIFACT_TYPE_ORDER`) не чіпали.

**Тест:** `artifact_missing story_image and cover guidance points to the prompt, not Regenerate`.

**Не зроблено в цій хвилі:** B3 (N/3 prompts ready), P3 (daily cover prompt).

## 2026-08-15 — M2: post-upload QA попереджає, не блокує реліз

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) M2.

**Змінено:** [pipeline/weekly-digest](pipeline/weekly-digest.md),
[ops/weekly-admin-runbook](ops/weekly-admin-runbook.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[marketing/card-images](marketing/card-images.md),
[pipeline/content-sim](pipeline/content-sim.md),
[ops/weekly-sandbox](ops/weekly-sandbox.md),
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[now](now.md), [index](index.md).

**Код:** після `save_weekly_digest_artifact` upload story/cover планує `after()` з
`buildImageOnlyCriticPrompt` (без headline/scene). Результат — `metadata.post_upload_qa`.
Не пише `content_sim`. Ігнорувати ховає попередження.

**Тест:** `a failing post-upload QA does not add a preflight blocker`.

**Не зроблено в цій хвилі:** M3 (preflight copy), двостадійний critic у prod render (E2).

## 2026-08-15 — M1: weekly story/cover пишуть промпти, не рендерять FLUX

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) M1.

**Змінено:** [pipeline/weekly-digest](pipeline/weekly-digest.md),
[ops/weekly-admin-runbook](ops/weekly-admin-runbook.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[marketing/card-images](marketing/card-images.md),
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md),
[overview](overview.md), [open-questions](open-questions.md), [now](now.md), [index](index.md).

**Код:** `WEEKLY_STORY_IMAGE_MODE=prompt_only` (дефолт; `render` — відкат). `generateStoryImage`
без `source_url` і `generateCover` будують essence + концепти (`weeklyReportageSceneBriefs`),
експортують `ManualImagePrompt` і зберігають `story_prompt_set`. Не викликають
`generateWeeklyReportageIllustrations` / `runWeeklyImageSimLoop`. Ingest `source_url`
лишається. `story_image` лишається на GitHub Actions. Композит (`visuals.ts`,
`generateCoverDerivatives`) не чіпали.

**Тест:** `story_image job in prompt_only mode writes a prompt set and never calls the image provider`;
`story_image job with source_url still ingests the URL`.

**Не зроблено в цій хвилі:** M2 (post-upload QA), M3 (preflight copy), перенесення
`story_image` з Actions на Vercel.

## 2026-08-15 — P2: промпти живуть як `story_prompt_set` і копіюються з Visuals

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) P2.

**Змінено:** [pipeline/weekly-digest](pipeline/weekly-digest.md),
[ops/weekly-admin-runbook](ops/weekly-admin-runbook.md),
[pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[marketing/card-images](marketing/card-images.md),
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md), [now](now.md),
[index](index.md).

**Код:** міграція `20260815120000_weekly_story_prompt_set.sql` додає CHECK `story_prompt_set`
і рахує input-hash як у `story_image` (revision item). Visuals: картки концептів + Canonical /
Midjourney / Negative + слот upload в одній картці. Не в `PUBLIC_IMAGE_TYPES`. Worker не пише
сет у цій хвилі (M1).

**Тест:** `a ready story_prompt_set exposes three copy payloads and an upload slot`;
`after a story_image is ready the slot state is uploaded, on review`. Authenticated Playwright
на `/admin/weekly` у сьюті немає (лише login shell) — контракт покрито unit-тестами +
`data-testid`.

**Не зроблено в цій хвилі:** M1 (worker пише сет, без FLUX).

## 2026-08-15 — P1: промпт став копійованим продуктом

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) P1.

**Змінено:** новий `pipeline/prompt-export.ts`; [marketing/card-images](marketing/card-images.md),
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md), [now](now.md),
[index](index.md).

**Код:** `exportManualImagePrompt` перекладає `buildEditorialConceptPrompt` у канонічний
natural-language (субʼєкт першим) + Midjourney `--ar 16:9 --style raw --no text` + negative з
обовʼязковою забороною тексту. Грамматика схеми пише діаграму. Номерів версій у виході немає.

**Не зроблено в цій хвилі:** P2 (зберігання + UI).

## 2026-08-15 — B2: журі більше не добиває три однакові фолбеки

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) B2;
`pipeline/card-image.ts`.

**Змінено:** [marketing/card-images](marketing/card-images.md), [overview](overview.md) §4,
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md), [now](now.md),
[index](index.md).

**Код:** `weeklyReportageSceneBriefs` повертає лише прийняті лінзи (або один `fallback_essence`);
фолбеки більше не маскують копії різними `fallback_${lens}`; `motifFamilyKey` відхиляє
 pitched-дублікати однієї родини (`sibling_motif_family_reuse`). Пункт «фолбек з іншої
грамматики» відкладено до C.

**Не зроблено в цій хвилі (окремі PR):** P1 і далі за порядком плану.

## 2026-08-15 — B1-fix: craft-заборона більше не валить предмет самої новини

**Джерело:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) B1-fix;
`experiments/jury-blockers/2026-08-digest-843975a8.md`; `pipeline/card-image.ts`.

**Змінено:** [marketing/card-images](marketing/card-images.md), [overview](overview.md) §4,
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md), [now](now.md),
[index](index.md).

**Код:** `validateMetaphorPitch` рахує craft-cliché потерміново. Голий `terminal` дозволений,
коли `storyContext` / `mechanism` / entities говорять про `command line` / `CLI` / `terminal`.
`terminal window`, `npx`, `glowing brain`, collage лишаються забороненими навіть на CLI-новині.
`WEEKLY_SLUDGE_BANNED` не чіпали.

**Тест:** `a command-line story may use the word terminal for a physical object`. Контроль —
CLI-story з UI-кліше все одно відхиляється.

**Не зроблено в цій хвилі (окремі PR):** B2 і далі за порядком плану.

## 2026-08-15 — Картинки дайджестів переходять на ручну генерацію

**Джерело:** рішення власника 2026-08-15; інспекція коду
`src/app/admin/(cms)/weekly/actions.ts:1649`, `src/lib/weekly-digest/{generation-worker.ts:2429,
preflight.ts:331-496, visuals.ts}`, `pipeline/run-daily.ts:627`, `supabase/migrations/
20260723095458_weekly_digest_v2.sql:369`, `001_initial_schema.sql:25`.

**Змінено:** [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) —
переписано під новий режим; [index](index.md) — оновлено опис сторінки.

**Рішення:** картинки для daily і weekly дайджестів більше не генеруються автоматично — власник
генерує їх сам і завантажує. Система зобовʼязана готувати професійні текстові промпти.
**Зображення новин на сайті лишаються на повній автогенерації.** Композитний шар
(`visuals.ts`, `social/assets.ts`) не є генерацією — він накладає текст на вже наявні зображення
і лишається автоматичним.

**Уточнення власника (4 відповіді):** вимкнути лише AI-рендер · формат промптів = канонічний
natural-language + похідні Midjourney/negative · post-upload QA попереджає, але не блокує ·
для daily потрібен промпт обкладинки випуску.

**Нове в плані:** розділ **P** (промпт як продукт: `pipeline/prompt-export.ts`, артефакт
`story_prompt_set`, UI копіювання, daily cover prompt у Telegram) і розділ **M** (вимкнення
авто-рендеру через `WEEKLY_STORY_IMAGE_MODE`, post-upload QA, підказки preflight).

**Виведено зі scope:** C4 і C5.1/C5.5 — параметричні SVG-рендерери схем, бо це теж автогенерація
картинки дайджесту. Код не видаляється; він лишається можливим інструментом для новинної гілки.

**Що не змінилось:** B1/B1-fix/B2 — причина деградації трьох варіантів і її фікс чинні дослівно,
бо працюють на етапі планування концепту, до будь-якого рендеру. Після переходу вони стають
дорожчими: три схожі промпти означають, що власник витратить свій час на три схожі картинки.

**Бюджет перерахований:** авто-витрата на weekly-зображення → $0 (було $11.29/міс за планом);
лишаються новини $1.73–2.70/міс + <$0.10 на промпти й QA. Скасовано підняття
`CONTENT_SIM_MAX_IMAGE_SPEND_USD` для weekly. Підписка ($10–30) вперше стала доречною формою —
але для ручної гілки, і лише після фіксу різноманіття промптів.

**Уже існує, будувати заново не треба:** ручний upload (`uploadWeeklyArtifactAction`, ресайз
1600×900, alt EN/UK, `source: manual_upload`), форма в Visuals, збереження
`positive_prompt`/`negative_prompt` у metadata, гілка `source_url` у джобі.

**Потрібні дві міграції:** адитивне розширення CHECK `artifact_type` для `story_prompt_set`;
нова колонка `briefs.cover_prompt jsonb` (таблиця не має jsonb взагалі).

**Знайдена прогалина (новий підрозділ C0):** `autoClaim` не існує в продакшн-шляху — `grep` по
`generation-worker.ts` і `card-image.ts` порожній, модуль `visual-auto-claim-v5.ts` має
споживачів лише в експериментальному кластері V10. Отже C2 не є «портуванням»: спершу потрібен
міст `EditorialEssence → VisualAutoClaim` або переписані під `essence` сигнали. Обсяг не
оцінений — це єдиний розділ плану без відповіді «що саме змінити».

## 2026-08-14 — Розподіл бюджету на зображення і відео

**Джерело:** live `https://openrouter.ai/api/v1/models` і `https://aitodaybrief.com/rss.xml`
2026-08-14; `pipeline/run-daily.ts`; `.env.example:197`; дослідження провайдерів
(Artlist, Midjourney, Freepik, Higgsfield, Krea, Runway, Recraft, Leonardo, Ideogram).

**Змінено:** розділ G у
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md).

**Виміряний обсяг:** ~180 новин/міс (RSS: 3–7/добу), 84 weekly-концепти/міс, 4 відео.
Важливо: мініатюра і повне зображення — **одне** зображення (`news.ts:207`), розміри робить
`image-loader.ts`. Планувати 180 генерацій, не 360.

**Розподіл:** новини `gpt-5-image-mini` $1.73/міс · weekly `gemini-3-pro-image` $11.29/міс ·
відео (аватар + сцени + голос) $25–42/міс. Разом $38–55/міс поверх наявних ~$60 підписок.

**Головне: відео дорожче за всю генерацію зображень разом** — оптимізувати треба його. Варіант
фонових сцен кодом (Three.js) прибирає ~$10 і дає консистентність, якої AI-відео не дає.

**Підписки для авто-гілки відкинуто:** 180 новин/міс поштучно коштують $1.73 проти $9–12
підпискою. Artlist: «до 1 650 зображень» і «до 206 відео» — той самий пул 16 500 кредитів за
найдешевшою моделлю; одне Veo 3.1 з аудіо = 15–24% плану. Midjourney не має публічного API.

**Потрібні дві зміни в коді:** `CONTENT_SIM_MAX_IMAGE_SPEND_USD` підняти до ~$0.50 лише для
weekly (зараз $0.2 не пропустить `gemini-3-pro` при $0.40/story), і тримати weekly на одному
раунді з трьох концептів.


## 2026-08-14 — Виконавча специфікація робіт над генерацією ілюстрацій

**Джерело:** `AI_Today_Brief_Visual_Algorithm_Plan.pdf` (власник, 11 с., розбір V1–V10, поза
репо); живий digest `843975a8-8c19-4eca-96a8-035f76eae3ab` — 7 story з вердиктами власника
2026-08-14; інспекція `pipeline/card-image.ts`.

**Змінено:** нова сторінка
[pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md); рядок в
[index](index.md).

**Що вона фіксує.** Розбір живого випуску дав чотири дефекти, підтверджені кодом:

1. **Три варіанти під story однакові.** `card-image.ts:1939` віддає лінзам без прийнятого pitch
   `fallbackSceneBrief`, а той (`:1780-1785`) будує всі три брифи з **одного** `essence`,
   змінюючи лише обгортку (`tableau`/`cutaway`/`environment`). `motifClass: fallback_${lens}`
   (`:1797`) маскує цю однаковість від валідатора дублікатів. Індикатор в адмінці — рядок
   `Illustration prompt · fallback` проти `· openrouter`; на живому випуску кореляція повна.
2. **Три story мають одну ілюстрацію** — вони створені 11 серпня старим 5-раундовим циклом
   (`5/5 attempts` проти `2/2` у пізніших), тобто застарілі, а не зламані.
3. **Немає вибору режиму.** Усі три лінзи — завжди кінематографічне фото; лінза змінює *що*
   показано, але не *чим*. Власник просить діаграму/інфографіку там, де вона доречніша.
4. **Впечений текст протікає в прод** попри політику `weekly-semantic-story-v5.1`.

**Що з V10 береться.** PDF власника описує **маршрутизацію між грамматиками зі збереженням
current art director**, а не заміну FLUX схемами — і це збігається з діагнозом живого випуску.
Береться проєктний шар: шість грамматик, mapping gate, двостадійний критик, defect-level repair,
owner-feedback contract. Не береться реалізація PR #229 (три захардкожені сцени за регексами,
покриття 29%). Показово, що та реалізація порушила власну специфікацію: §8.1 PDF називає
`generated_text` hard-блокером, а код впік текст у растр і вимкнув цей гейт для себе.

**Порядок робіт:** A (закрити хвости) → B1 (діагностика блокерів журі) → B2/B3 → D1 → C
(режим як третій вимір) → D2 → E (калібрування). B2 не можна починати без чисел із B1.

---
## 2026-08-14 — Биті зображення в проді: квота Vercel, не генерація

**Джерело:** повідомлення власника 2026-08-14; live check
`https://aitodaybrief.com/_next/image?…` -> HTTP 402 `OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`;
той самий файл в origin — HTTP 200, 487 841 байт.

**Діагноз.** Генерація зображень працювала весь час. Перестав віддавати їх **оптимізатор
Vercel** після вичерпання квоти плану — це другий випадок упирання в ліміти Hobby після
Fluid CPU 99.8%.

**Змінено:** `next.config.ts` переведено на `images.loader: 'custom'`; новий
`src/lib/image-loader.ts` ресайзить наші картки через Supabase Storage
(`render/image/public`), а hero-зображення чужих видань пропускає без змін. Оптимізатор Vercel
більше не використовується взагалі. Нова сторінка
[ops/vercel-image-quota](ops/vercel-image-quota.md).

**Чому не `unoptimized: true`:** він теж полагодив би сайт, але віддавав би 488 КБ PNG у слот
92 px. Виміряно на реальній картці: через Supabase transform 96 px = **13 252 байт**, тобто
у 37 разів менше, і нуль квоти Vercel.

**Лишається відкритим:** ліміт трансформацій самого Supabase `(needs verification)`; надлишкова
вага origin-файлів (488 КБ PNG правильніше зменшувати в `pipeline/card-image.ts`, а не
компенсувати на кожному показі); hero-зображення видань тепер без ресайзу.

## 2026-08-14 — Коригує записи від 2026-08-13: продакшн БУВ у порівнянні

**Джерело:** `scripts/visual-compiler-v6-render-ab.ts:310` (git history, коміт `464b656`);
`experiments/visual-compiler-v7/fresh-holdout/results/render-report.md`; питання власника
2026-08-14.

**Що було неправильно.** Записи від 2026-08-13 — і в [now](now.md), і в
[open-questions](open-questions.md) §8, і в
[audits/2026-08-13-pr-229-visual-v10-sonnet-plan](audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md) —
стверджували, що продакшн `pipeline/card-image.ts` «у порівнянні не брав участі жодного разу».

**Як є насправді.** У прогонах v6 і v7 гілка `current` — це і є продакшн:
`renderCurrent()` викликає `generateWeeklyReportageIllustrations` з `pipeline/card-image.ts`.
Підтверджено незалежно таймінгом у власному render-report: 1326,6 с на 7 image calls ≈ 190 с
на виклик — характерна латентність FLUX, а не детермінованого SVG (той дає 0,4–4 с).
Твердження справедливе **лише** для пізніх targeted-прогонів V10, де порівнювали v10 проти v8
і продакшн-гілку прибрали.

**Чому це має значення.** W4 плану вимагав «додати третю гілку = продакшн». Насправді її треба
не будувати, а **повернути** — харнес це вже вмів. Крім того, з ранніх прогонів випливає
результат, якого раніше не було видно: за оцінками власника продакшн дав єдину прийнятну
ілюстрацію, а компілятор — жодної.

**Змінено:** сторінки [now](now.md), [open-questions](open-questions.md),
[audits/2026-08-13-pr-229-visual-v10-sonnet-plan](audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md)
отримали помітку коригування. Цей запис — джерело правди щодо самої помилки.

---

## 2026-08-13 — Переоцінка виправленим харнесом: перевага V10 спростована

**Джерело:** Actions run [`31739283280`](https://github.com/sanchahous/ai-today-brief/actions/runs/31739283280)
(гілка `main`, dispatch `visual-experiment.yml`, дозвіл власника на платний прогін);
`experiments/visual-affordance-v10/targeted-v7-corrected-harness/`.

**Змінено:** нова тека прогону зі звітами (без пікселів, за новим правилом зони `experiments/`);
оновлено [now](now.md), [pipeline/weekly-digest](pipeline/weekly-digest.md);
[open-questions](open-questions.md) §8 закрито частково.

**Результат.** Ті самі пікселі V10 і V8, той самий суддя `google/gemini-2.5-flash` — змінені лише
правила оцінювання:

| Метрика | v6 (харнес із маніпуляціями) | v7 (виправлений) |
|---|---:|---:|
| V10 hard integrity | 3/3 | **0/3** |
| V8 hard integrity | 0/3 | 0/3 |
| V8 headline-grounded | 0/3 | **2/3** |
| Зважений бал V10 / V8 | 87.2 / 54.1 | **68.1 / 67.6** |
| Blind preference | V10 3-0 | **1-1, 1 нічия** |

Розрив зважених балів впав з 33.1 до **0.5** пункта — при виміряному раніше шумі того самого
судді у 15.5 пункта на незмінних пікселях. Тобто різниці немає.

Блокери V10: `generated_text` на обох детермінованих сценах (впечені лістинги коду і підписи —
пряме порушення політики `weekly-semantic-story-v5.1`), `labels_carry_claim` на
Claude-thresholds, пʼять блокерів на Deep Work (`core_action_missing`, `outcome_missing`,
`causal_relation_missing`, `beam_purpose_unclear`, `domain_context_missing`).

**Висновок:** заявлена перевага V10 була артефактом вимірювання, а не якості зображень. Baseline
V8 виявився не таким слабким, як звітувалося, — його headline-grounded зріс з 0/3 до 2/3 щойно
його перестали оцінювати за специфікацією конкурента. Обидві гілки провалюють hard integrity за
однаковими правилами, тому це **не** доказ, що V8 кращий. Питання «чи краще за продакшн»
лишається відкритим: `pipeline/card-image.ts` у порівнянні не брав участі жодного разу.

**Вартість:** 6 vision calls, 13 206 токенів, $0.0149, 1 image call, 1 хвилина CI.

---

## 2026-08-13 — W0 cleanup: підготовка PR #229 до мержу в `main`

**Джерело:** [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md) §W0;
гілка `chore/visual-v11-hygiene` (від гілки експерименту, вже з PR #230).

**Змінено:**

- з git видалено 101 PNG/JPG (**83 МБ**) під `experiments/` і `artifacts/`; пікселі
  `experiments/**` додані в `.gitignore` — звіти `.md`/`.json`/`.csv` лишаються трековані,
  бо wiki на них посилається;
- видалено 35 із 41 one-shot скриптів `scripts/visual-*.ts`; лишилось 6 багаторазових
  (targeted render/evaluate, calibration, v9 generalization render/evaluate/route-claims);
- видалено 3 модулі, що після цього стали недосяжними: `visual-gate-policy.ts`,
  `visual-specialized-svg-v7-2.ts`, `visual-treatment-v7-2.ts` (+ тести). Решту v5–v9
  свідомо лишено — вони або досяжні з kept-скриптів, або названі базою порту для v11;
  їх прибирає окремий chore-PR після появи v11 (§7);
- видалено 66 із 67 `.github/workflows/visual-*.yml`; замість них один
  `visual-experiment.yml`: `workflow_dispatch` only, `permissions: contents: read`,
  без `git push`, вивід через `actions/upload-artifact`. Старі 62 були push-тригерні з
  `contents: write` і платними секретами;
- видалено `artifacts/visual-affordance-v10-owner-review-complete/` — після зняття бінарників
  це була побайтова копія `experiments/visual-affordance-v10/targeted-v3/results/` під назвою
  «complete», яка суперечила заявленому V6;
- `experiments/` описано як пʼяту зону в `CLAUDE.md` і додано в `tsconfig` `exclude`;
- **evaluator**: знято waiver `generated_text` для гілки-кандидата (параметр `Source` прибрано
  з `sourceEvaluation`, щоб гілка не могла повернутись), спостереження тепер підставляються за
  стороною (`OBSERVATION FOR CARD X/Y`), рубрика більше не містить `expectedEvidence` /
  `forbiddenImplications` / `labels` кандидата, а `beamPurposeClear` і обидва invariant
  повернуто з story-aware у blind-стадію.

**Виміряно:** покриття нових модулів — 83.17% statements / 72.03% branches / 86.62% lines
(17 файлів, 121 тест). Це вище 70%-гейта; проблема PR не в обсязі покриття, а в тому, які саме
шляхи не покриті.

**Не зроблено:** переоцінка виправленим харнесом — потребує платного прогону
(Cloudflare + OpenRouter). Тому всі числа V6 позначені як невалідні у `now.md`,
`pipeline/weekly-digest.md` і в README прогону; питання відкрите —
[open-questions](open-questions.md) §8.

---

## 2026-08-13 — PR #229 Visual V10 review + Sonnet executor plan

**Джерело:** GitHub PR #229; код `src/lib/weekly-digest/visual-*.ts`; V6 pixels у
`experiments/visual-affordance-v10/targeted-v6-owner-outcome-repair/`; interrupted Claude
workflow `wf_40755980-8f7` (138 findings витягнуто з StructuredOutput після spend-limit).
Гілка фіксації: `review/pr-229-sonnet-plan`.

**Змінено:** нова сторінка
[audits/2026-08-13-pr-229-visual-v10-sonnet-plan](audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md);
рядок в [index](index.md); уточнення в [now](now.md); новий конфлікт §8 в
[open-questions](open-questions.md).

**Вердикт:** не мерджити PR як є. V10 — три ручні сцени, не алгоритм; eval 3/3 ненадійний
(n=3, rubric leak, `generated_text` waiver); 67 workflows + бінарники. План для Sonnet 5 —
хвилі W0–W5 (hygiene → total router → honest scenes → cost gate → honest eval → shadow worker).

**Другий прохід того ж дня — ручна верифікація + доповнення сторінки.** Оскільки фаза
adversarial-верифікації в `wf_40755980-8f7` не встигла відпрацювати (spend limit), ключові
заявки перевірено безпосередньо в коді гілки. Підтвердились усі перевірені; додано те, чого
в першій редакції не було:

- четверта витік-точка блайнду — blind-промпт (`targeted-evaluate.ts:374`) прямо каже судді не
  флагати deterministic labels, тобто перша стадія не intent-blind, попри формулювання
  «image-only and intent-blind» в усіх звітах;
- `labelsHiddenDuringSemanticTest: true` не виконується: підписи впечені в растр, тому
  «pixels-only» файли досі містять `BOUNDED 1/2/3` і лістинги коду;
- фабрикацію `sourceGrounding` для Claude-thresholds підтверджено дослівним звіренням з
  approved story (джерело каже лише про monitoring token spend — CACHE і SPLIT вигадані);
- `validateVisualPropositionV10` — механізм, заради якого існує весь V10, — не викликається
  жодним модулем чи скриптом; це корінь того, чому сцени довелося малювати руками;
- виміряне покриття: 4/14 історій отримують treatment, 1/14 і eligible, і правильно
  змаршрутизована; на свіжому holdout 0 specialized matches, repair полагодив 0 із 3;
- чотири баги коректності (`inferRole` `\b` у альтернаціях, односторонність `guardedCertainty`,
  скоуп `hasExactMetric`/`requiresTemporalSequence`, null-safety `parseAutoVisualClaimV5`);
- відсутній `markerUnits` у всіх пʼяти `<marker>` → вістря 84 user units, dispatch-стрілки 9,3 px
  — механічна причина owner-тегу `broken_arrow`;
- уточнення по вартості: стеля економії в доларах $19–53/рік, справжній важіль — 190 с/FLUX-виклик
  проти 95-хвилинного дедлайну воркера;
- ⚠️ **коригує пункт T0.5 першої редакції:** там сказано, що відсутність
  `src/lib/weekly-digest/**` у `LOGIC_INCLUDE` — «це добре». Це половина картини: gate справді
  не роздувається, але покриття 18 нових модулів не вимірюється взагалі, тому заява PR
  «coverage passed» не є доказом щодо жодного доданого рядка;
- уточнення до T0.2: `git rm` у follow-up коміті прибирає 88 МБ з `main` **лише при
  squash-merge** (owner обрав саме його); при merge-коміті блоби входять в історію назавжди.

## 2026-08-11 — Story-image rollout: regenerate deduplication

**Коригує запис нижче про parallel durable workers. Джерело:** після merge PR #222 production
app уже працював на `241f4e5`, але Supabase migration history закінчувалась на
`20260810114150`; сім нових Regenerate jobs о 21:05 отримали backend `vercel`, тоді як новий
Vercel worker навмисно більше не claim-ив `story_image`. У тій самій active revision лишались
retry/stale jobs для частини тих самих `revision_item_id`. (source: Vercel deployment/runtime logs,
GitHub Actions run list і Supabase production snapshot 2026-08-11)

**Змінено:** migration ранжує recoverable rows один раз: live lease або найновіший Regenerate
стає winner, старі attempts/jobs фіксуються як `cancelled / superseded_by_regeneration`, і лише
winner переходить у GitHub Actions. Production preview з rollback підтвердив 7 winners і 7
superseded без зміни даних. Міграцію застосовано як production version `20260811183201`; cron о
21:35 повернув `200` і створив рівно сім паралельних Actions runs `31523472069`…`31523483477`
на `241f4e5`, без старих дублікатів. (source:
`supabase/migrations/20260811183201_weekly_story_image_async_worker.sql`, Vercel production log
2026-08-11 21:35 Kyiv, GitHub Actions runs `31523472069`…`31523483477`)

## 2026-08-11 — Story images: Vercel timeout → parallel durable workers

**Джерело:** production runtime logs після deploy PR #221: `/api/internal/weekly/generate` о
20:00, 20:05 і 20:10 Kyiv завершувався `504 Task timed out after 300 seconds`; endpoint брав одну
short job за poll, а v4 робив кілька послідовних 40–137-секундних OpenRouter calls ще до FLUX.

**Змінено:** `story_image` переведено у GitHub Actions long-job backend; enqueue dispatch-ить її
одразу, cron batch-dispatch-ить до 10, per-job concurrency дозволяє story renders іти паралельно.
Міграція переносить активну чергу, не обриваючи live Vercel lease, і відновлює три attempts для
incident timeout jobs. Admin timeline тепер переходить у `generate`/`persist`, а не висить у
`prepare / Provider not started`. (source: Vercel production runtime logs 2026-08-11,
`src/app/api/internal/weekly/generate/route.ts`, `.github/workflows/weekly-master-cli-worker.yml`,
`supabase/migrations/20260811183201_weekly_story_image_async_worker.sql`)

## 2026-08-11 — Vision critic JSON soft-fail (story_image)

**Джерело:** live fail `story_image` на digest `843975a8…` — `last_error: No JSON object in
critic response` (code `unknown`); throw у `scoreAndPickVariants` (до try/catch repair loop).

**Змінено:** `parseImageCriticResponse` / `extractJsonObject` більше не кидають — повертають
`critic_parse_error` + `changeSeed` repair; джоба йде в retry/escalation замість terminal fail.

## 2026-08-11 — Illustration fidelity: mechanism anchor + honest critic (v3)

**Джерело:** ревʼю Stories 2/3/6/7 після v2 regen — critic давав 100 за craft+match до pitched
сцени, а не за читабельність новини; метафора дропала concrete mechanism з `why_en`.
План `illustration_fidelity_fix`.

**Змінено:**
- `pipeline/card-image.ts` — `WEEKLY_PROMPT_POLICY = weekly-editorial-concept-v3`:
  `EditorialEssence.mechanism` / `readerTest`; gate `mechanism_not_visible`; ban high-speed /
  motion-blur language; score бонус/штраф за mechanism hit.
- Vision critic — `off_news`, `melted_motion`, dimension `news_legibility`, overall clamp
  `min(overall, news_legibility + 5)`; pass потребує news floor.
- Worker / weekly-image adapter — проброс mechanism/readerTest; `variant_scores` з dims;
  Visuals chips `news · craft`.
- Wiki: card-images, content-sim, weekly-digest, overview, now; sync fact `WEEKLY_PROMPT_POLICY`.

## 2026-08-11 — Weekly illustration flow overhaul (editorial-concept-v2)

**Джерело:** ревʼю Stories 1/2/7 (`ai-weekly-2026-08-02`) — bias theater/journal у промпті й
скорері; physics fail; primary без ранжування 3 variants. План `illustration_flow_overhaul`.

**Змінено:**
- `pipeline/card-image.ts` — `WEEKLY_PROMPT_POLICY = weekly-editorial-concept-v2`:
  `motifClass`/`subjectKind`, `siblingMetaphors`, rewrite metaphor prompt/score (без
  theater/journal gold-standard boost), sibling gates у `validateMetaphorPitch`.
- Vision critic — blockers `impossible_orientation` / `prop_use_mismatch` /
  `decorative_second_beat` / `sibling_echo`.
- `adapters/weekly-image.ts` — per-variant QA + `pickBestVariantIndex`; metadata
  `variant_scores` / `pick_source`; worker збирає sibling metadata; Visuals UI chips.
- Wiki: card-images, content-sim, weekly-digest, overview, now.

## 2026-08-11 — Content Simulation & Backtest System

**Джерело:** план власника (універсальна симуляція daily+weekly+images; vision critic ≤5
ітерацій → human review).

**Змінено:**
- Нове ядро `src/lib/content-sim/` (loop, escalation, deterministic + vision critic parse).
- `pipeline/providers/vision.ts` + roles `weekly.image_critic` / `daily.image_critic`.
- Weekly `generateStoryImage` — vision repair loop; `metadata.content_sim`; preflight
  `simulation_not_passed`; admin escalation UI; Approve → human override.
- CLI `npm run content-sim` (capture/run/gates/hypothesis); adapters daily-brief/daily-image/
  weekly-image-fixture; optional workflow `content-sim.yml`.
- Wiki: [content-sim](pipeline/content-sim.md), оновлення card-images / weekly-digest /
  weekly-sandbox / now / index; `.env.example` `CONTENT_SIM_*`.

## 2026-08-10 — Weekly story images: editorial-concept-v1 (essence → metaphor)

**Джерело:** feedback після regen stories 1/2/7 на `ai-weekly-2026-08-02` — reportage-v2
давав literal props / fallback blink / слабкий essence; план `editorial_metaphor_images`.

**Змінено:**
- `pipeline/card-image.ts` — `WEEKLY_PROMPT_POLICY = weekly-editorial-concept-v1`: essence +
  metaphor JSON, `validateMetaphorPitch` (incl. `dual_contrast`), craft bans (paper-heap,
  UI/collage), `buildEditorialConceptPrompt`, keyword metaphor fallbacks.
- `generation-worker.ts` — claims excerpt + sibling scenes; metadata `essence` /
  `metaphor_title`.
- Wiki: [card-images](marketing/card-images.md), [weekly-digest](pipeline/weekly-digest.md),
  [overview](overview.md); sync fact `WEEKLY_PROMPT_POLICY`.

## 2026-08-10 — Weekly story images: prompt policy v2 (BFL-aligned)

**Джерело:** аудит якості ілюстрацій `ai-weekly-2026-08-02` (сцени без сенсу новини,
JSON-leak арт-директора, desk-convergence) + офіційні BFL/Cloudflare guides.

**Змінено:**
- `pipeline/card-image.ts` — `WEEKLY_PROMPT_POLICY = weekly-reportage-v2`: structured scene
  JSON + `validateWeeklySceneSpec` + 1 retry; `buildWeeklyPrompt` subject-first SASC + HEX
  (без giant Avoid-list); `weeklyFallbackScene` замість daily-метафор; entity extraction +
  `editorialAngle`/`why` у бриф.
- `generation-worker.ts` — передає angle/why; пише `prompt_policy` з константи.
- Wiki: [card-images](marketing/card-images.md), [weekly-digest](pipeline/weekly-digest.md),
  [overview](overview.md); sync fact `illustration-prompt-policy` → `WEEKLY_PROMPT_POLICY`.

## 2026-08-10 — Weekly admin: додано Postpone release

**Джерело:** власник попросив «можливість вручну переносити реліз, бо деколи не встигаю».

**Знайдено:** `schedule_weekly_digest` жорстко вимагає понеділок 16:00 Europe/Kyiv і статус
`approved` — прямої RPC «перенеси дату» немає навмисно. Для вже `scheduled` випуску єдиний
робочий шлях був Pause → Resume (= re-approve) → заново вписати обидва datetime-local поля.

**Змінено:** новий `postponeWeeklyDigestAction` (`src/app/admin/(cms)/weekly/actions.ts`)
компонує три вже наявні RPC (`pause_weekly_digest` → `approve_weekly_digest` →
`schedule_weekly_digest`) за один клік — 1–4 тижні, одна причина. Жодної нової RPC, тож
жодних нових грантів (враховуючи щойно знайдений і виправлений баг з грантами того самого
дня — свідомо уникнув повторення). Нова дата рахується в Kyiv-календарі
(`addKyivWeeks` — Kyiv Y-M-D + N×7 днів → назад через `kyivWallClockToUtc`), не додаванням
UTC-тривалості — перевірено вручну на обох DST-переходах 2026 (25.10 і 29.03), час
лишається 16:00 Kyiv по обидва боки. Новий блок «Postpone» на Release tab
(`weekly-workspace.tsx`) видимий лише коли `status === 'scheduled'`. `pr:check` зелений,
49/49 pre-push e2e. Оновлено [now](now.md), [weekly-digest](pipeline/weekly-digest.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md). Гілка `feat/weekly-postpone-release`,
PR ще не відкрито.
(source: owner request 2026-08-10, `src/app/admin/(cms)/weekly/actions.ts`,
`src/components/admin/weekly-workspace.tsx`, manual DST verification 2026-08-10,
local `pr:check` 2026-08-10)

## 2026-08-10 — Weekly admin: справжня причина Restore/Save 403 знайдена й виправлена в прод-БД

**Коригує запис нижче** («newer-draft banner, читабельні restore-помилки, quantified
length-repair»): там 403 на **Restore this version** приписаний «ймовірно транзиентному
глюку сесії». **Це виявилось хибним** — власник спробував ще раз і повідомив, що помилка
стабільна, не одноразова.

**Знайдено (відтворено детерміновано):** `create_weekly_digest_revision` («Save») і
`revert_weekly_digest_revision` («Restore») — обидві `security invoker` — намагаються
`UPDATE weekly_digest_generation_jobs`, а роль `authenticated` мала до цієї таблиці лише
`SELECT` з моменту її створення (23.07, `weekly_digest_v2` migration) — жодного `UPDATE`.
Постгрес перевіряє право на рівні таблиці до WHERE-умови, тож навіть 0 підхожих рядків усе
одно валить запит `42501: permission denied for table weekly_digest_generation_jobs`. Це
б'є **кожен** виклик owner/editor, не рідкісний випадок: за всю історію прод-БД був рівно
**один** успішний людський Save (04.08) і жодного відтоді — Save, судячи з усього, теж тихо
ламався весь цей час, просто непомітно (AI-пайплайн пише через окремі `security definer`
шляхи, не через цю RPC). Відтворено напряму через `set local role authenticated;` у
транзакції з відкатом — детерміновано, не залежить від сесії.

**Змінено й застосовано до прод-БД:** обидві функції отримали `security definer` (той самий
патерн, що вже мають `retry_weekly_digest_generation_job`/`claim_weekly_digest_generation_
jobs_v2` для тієї ж таблиці). Перевірка `has_social_role(['owner','editor'])` усередині
незмінна — авторизація не послаблена, дано лише права на конкретний запис. Перед застосуванням
перевірено в транзакції з відкатом на реальному дайджесті — виклик успішно повернув нову
активну ревізію, прод не чіпався до явного дозволу власника. Міграція
`supabase/migrations/20260810160000_weekly_revision_rpc_security_definer.sql` застосована
через Supabase MCP 2026-08-10; `get_advisors` після застосування показує очікувані WARN
(«authenticated може виконати SECURITY DEFINER») — той самий прийнятий патерн, що вже є для
інших definer-функцій цієї таблиці. Оновлено [now](now.md), [weekly-digest](pipeline/weekly-digest.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md).
(source: production Supabase read + `set local role authenticated` reproduction 2026-08-10,
`supabase/migrations/20260810160000_weekly_revision_rpc_security_definer.sql`,
`get_advisors` live check 2026-08-10)

## 2026-08-10 — Weekly admin: newer-draft banner, читабельні restore-помилки, quantified length-repair

**Джерело:** owner намагався зрозуміти «Needs your review», побачив у активній ревізії
абстрактний заголовок «Зсув до агентів» і зламане слово «доп'яти», потім при спробі **Restore
this version** на Revision 5 отримав `Minified React error #441`.

**Знайдено:** активна ревізія дайджесту `ai-weekly-2026-08-02` (843975a8…) була написана
09.08 07:27, до всіх v7-гейтів, поки три новіші ревізії (3, 4, 5 — усі кращі) лежали
неактивованими без жодного UI-сигналу. Restore впав через `POST rpc/revert_weekly_digest_revision`
403 (`Owner or editor session required`) для акаунту з коректним `role: owner, enabled: true`
у БД — ймовірно транзиентна сесійна гонка; реальна причина була невидима, бо дія кидала сиру
помилку замість читабельного повідомлення. Окремо: 7 із 8 unresolved-пунктів прогону
`3c60e3bc…` зводились до однієї задовгої історії (EN 1203 / UK 1121 слів проти 400–650) — ремонт
не зміг довести її до цілі за 2 спроби з розпливчастим «rewrite to 400–650 words».

**Змінено:** `NewerDraftBanner` (`weekly-workspace.tsx`) — банер на кожній вкладці, коли є
новіша ревізія за активну. `restoreWeeklyDigestRevisionAction` редіректить із `?save_error=…`
замість сирого throw. `story_length`'s `suggestedFix` тепер називає точну дельту слів і вимагає
структурної правки при великому розриві. `WEEKLY_MASTER_MAX_REPAIR_ATTEMPTS` дефолт 2→3.
Два нові тести в `content-studio.test.ts`. Оновлено [weekly-master-engine](pipeline/weekly-master-engine.md),
[weekly-digest](pipeline/weekly-digest.md), [weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md) та [now](now.md). Повний `pr:check` зелений
локально; PR ще не відкрито.
(source: production Supabase read 2026-08-10, `src/components/admin/weekly-workspace.tsx`,
`src/app/admin/(cms)/weekly/actions.ts`, `src/lib/weekly-digest/content-studio.ts`,
`src/lib/weekly-digest/master-engine.ts`)

## 2026-08-10 — `editorial_master`: перший живий прогін нового рушія знайшов і виправив UK `claimIds` регресію

**Джерело:** owner помітив дві задачі GitHub Actions ([`31367921173`](https://github.com/sanchahous/ai-today-brief/actions/runs/31367921173)
failed, [`31371078952`](https://github.com/sanchahous/ai-today-brief/actions/runs/31371078952)
running 46 хв на 35%) і попросив розібратись.

**Знайдено:** перший живий прогін нового ітеративного рушія (PR #209, вже в `main`) впав на
UK feature story #1 — структурна регресія, не редакційна. `ukrainianStorySegmentPrompt`
наказує моделі не повертати `claimIds` (складальник копіює їх з EN), але `parseStorySegment`
вимагав це поле безумовно й кидав `SyntaxError` на кожній конформній UK-відповіді —
`claude-cli` і всі 6 моделей OpenRouter-черги писали валідний текст і відкидались на тому
самому рядку, «Every editorial provider failed» після ~40 хв на нуль результату. Другий
прогін резюмував ті самі 8/16 durable-сегментів і впав так само (власник скасував вручну).
Супутній менший дефект: `openai/gpt-5.6-luna:batch` (Batch-only модель, 404 на звичайному
шляху) 6 разів забирав слот у черзі того самого прогону.

**Змінено (гілка `fix/weekly-master-uk-claimids`, PR ще не відкрито):**
`parseStorySegment` отримав `requireClaimIds = true` за замовчуванням; UK-виклик передає
`false` (значення все одно негайно перезаписується `english.claimIds`, EN-контракт
лишається строгим). `isEligibleModel` (`pipeline/openrouter-models.ts`) тепер виключає
`:batch`-моделі так само, як `:free`. Додано регресійні тести на обидва випадки. Оновлено
[weekly-master-engine](pipeline/weekly-master-engine.md),
[weekly-digest](pipeline/weekly-digest.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md) та [now](now.md). 85 фокусних тестів і
повний `pr:check` (coverage/typecheck/lint/e2e:check/wiki:check/build) зелені локально.
(source: Actions runs `31367921173`/`31371078952`, `src/lib/weekly-digest/editorial-llm.ts`,
`src/lib/weekly-digest/master-engine.ts`, `pipeline/openrouter-models.ts`, local `pr:check`
2026-08-10)

## 2026-08-10 — `editorial_master`: critic outage зберігає випуск для retry

**Джерело:** follow-up до змерженого PR #209; локальний регресійний тест
`master-engine.test.ts`.

**Змінено:** незалежний critic-виклик у `runWeeklyMaster()` тепер guarded. Якщо його
provider-драбина не дала verdict, рушій зберігає вже готові сегменти, пише warning у timeline і
повертає retryable `resumable`; **Resume saved master** починає з того самого тексту, а не
переплачує за EN/UK generation. Неперевірена чернетка не створюється й не може пройти human
approval. Оновлено [weekly-digest](pipeline/weekly-digest.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md), [now](now.md) та [index](index.md).
(source: `src/lib/weekly-digest/master-engine.ts`,
`src/lib/weekly-digest/master-engine.test.ts`, local test 2026-08-10)

## 2026-08-09 — follow-up master fallback + синхронізація wiki

**Джерело:** follow-up `fix/weekly-master-revise-parse-fallback` після Actions run
`31324873875`.

**Змінено:** `parseJsonObject` відновлює валідний JSON із prose-преамбулою CLI; UK і revise
кроки тримають preferred EN-provider, але після його збою переходять до решти драбини.
Оновлено [weekly-digest](pipeline/weekly-digest.md),
[weekly-editorial-selection](pipeline/weekly-editorial-selection.md),
[weekly-admin-runbook](ops/weekly-admin-runbook.md),
[weekly-master-failures](pipeline/weekly-master-failures.md), [now](now.md) та [index](index.md).
Додано регресійні тести для JSON-преамбули, fallback UK і fallback revise; фокусний набір
`editorial-llm.test.ts` пройшов 32/32. (source: `src/lib/weekly-digest/editorial-llm.ts`,
`src/lib/weekly-digest/editorial-llm.test.ts`, локальний прогін 2026-08-09)

## 2026-08-09 — прогін 31324873875: підтвердження фіксів + причини 6 і 7

**Джерело:** власник — «знову фейл». Перший прогін уже з фіксами PR #205/#206.

**Що фікси підтвердили наживо** (Actions run `31324873875`): preflight 9/9 OK за 6 секунд
(токен у Secrets живий, CLI 2.1.226); `--tools ""` дав **1 turn** замість 3 і 7; EN+UK через
claude-cli зайняли **12 хв 18 с** — стара 4-хвилинна стеля вбила б це знову; critic мав
`first_token_ms` **315 162 мс** проти 90-секундного ліміту й **завершився** — за старим кодом
був би вбитий як «зависання»; провалена джоба зробила прогін **червоним**.

**Дві нові причини, обидві виправлені:**

- **6.** Revise-крок повернув `**Applying…` перед JSON — CLI відповідає як асистент, а не як
  API. `parseJsonObject` умів зрізати лише ```-огорожу. Новий `extractJsonObject` витягує
  перший збалансований `{…}` з урахуванням рядків і екранування; у revise-промпт додано
  вимогу «raw JSON, без преамбули».
- **7.** UK і revise взагалі не мали драбини провайдерів — лише англійський крок її мав.
  Новий `generatePreferringProvider` лишає перевагу тому самому провайдеру (спільний голос
  обох локалей), але за ним тепер стоїть решта ланцюжка.

Деталі — [pipeline/weekly-master-failures](pipeline/weekly-master-failures.md).

## 2026-08-09 — OpenRouter-фолбек у воркері + гейт `numeric_parity`

**Джерело:** власник після мержу PR #205 — «роби фолбек звісно щоб не було падінь» і
«з приводу окремої знахідки — це треба виправити».

**Змінено:**

- `weekly-master-cli-worker.yml`: `WEEKLY_MASTER_PROVIDER_ORDER` став `claude-cli,openrouter`.
  Стара конфігурація «лише claude-cli» стояла на тому, що збій має падати видимо, а не тихо
  витрачати гроші; 09.08 показало ціну цього — три втрачені джоби через таймаут CLI, за яким
  не було нічого. Видимість тепер дає preflight-крок і те, що провалена джоба валить прогін,
  тож фолбек більше нічого не ховає. Повний master через OpenRouter виміряно: $0.032.
- Новий детерміністичний блокер `numeric_parity` у `content-studio.ts` — ловить підміну
  кратності відсотком між локалями (EN «600x» → UK «на 600%»). Деталі, включно з двома
  технічними пастками (ASCII-only `\b` під `/u`, український десятковий кома-роздільник) —
  [pipeline/editorial-voice](pipeline/editorial-voice.md).
- У промпт UK-адаптації додано рядок контракту «кратність лишається кратністю».

**Перевірено:** гейт спрацьовує на реальному зіпсутому UK-виводі з sandbox-прогону
(`field=title`, `span=600%`) і не спрацьовує на виправленій версії того самого випуску.

## 2026-08-09 — `editorial_master`: 5 причин збоїв + sandbox для тестування флоу

**Джерело:** власник — «джоба фейлиться, розберись що з флоу і налаштуй безпечну можливість
тестування в sandbox, в сліпу далі працювати не варіант». Розбір GitHub Actions runs
`31312642192` / `31313598133` / `31313601219` / `31299873942` + живі sandbox-прогони на
фікстурі `ai-weekly-2026-08-02`.

**Знайдено пʼять окремих причин, жодної редакційної** — повний розбір у новій сторінці
[pipeline/weekly-master-failures](pipeline/weekly-master-failures.md):

1. `claude-cli` мав 4-хвилинну стелю, яку ніхто не перевизначав; EN-write більше в неї не
   вкладається (SIGTERM/143 рівно на 240с при `duration_api_ms` 178с і 233с) → дефолт 20 хв,
   `CLAUDE_CLI_TIMEOUT_MS`, і вбивство по таймауту тепер називається таймаутом;
2. CLI ганяв агентні tool-use цикли (3 і 7 turn-ів, 296k cache-read токенів) → `--tools ""`;
3. stall-детектор OpenRouter рахував лише `delta.content`, тож reasoning-моделі вмирали як
   «мовчазні» — ≈20 хвилин ротації по 12 моделях у прогоні 07:27 → `reasoning` тепер
   рахується як активність, але ніколи не потрапляє в парсений `content`;
4. провалена джоба лишала Actions-прогін зеленим → тепер червоний;
5. master-write мав рівно одного кандидата-модель без фолбеку → `WEEKLY_MASTER_OPENROUTER_CANDIDATES`
   (дефолт 1, на CLI-воркері 3).

**Додано (нова сторінка [ops/weekly-sandbox](ops/weekly-sandbox.md)):**

- `npm run weekly:doctor` — префлайт провайдерів за хвилину, read-only; стоїть першим кроком
  у `weekly-master-cli-worker.yml` із `continue-on-error: true` (діагностика, не гейт);
- `npm run weekly:sandbox` — `capture` (read-only знімок реального master-входу з прода
  воркеровими ж лоадерами), `run` (повний `generateWeeklyMaster` **без хендла БД**),
  `gates` (детерміністичні валідатори безкоштовно);
- `loadMasterGenerationInput` експортовано з `generation-worker.ts` як read-only seam.

**Чому це важливо:** причину №5 знайшов сам sandbox — за 138 секунд і за центи замість
40-хвилинного Actions-прогону. Найдешевша модель, що проходить quality-floor, стабільно
віддає повну статтю на 31k символів з однією зайвою лапкою у відкривальній дужці.

**Оновлено:** `wiki/index.md` (дві нові сторінки), `wiki/now.md` (пункт −1), `.env.example`.

## 2026-08-09 — Weekly Content Studio: v7.1 commercial-balance point fixes

**Джерело:** owner review of PR #199 (v7 hardening) — питання, чи детерміновані гейти зарізали
комерційну привабливість (авторське бачення, практична цінність, retention) заради чистоти
фактажу. Три хибнопозитиви підтверджено емпіричним прогоном regex-гейтів на реальних заголовках.

**Змінено (`content-studio.ts`):**

- `ambiguous_energy_claim` звужено до явного порівняння («N times/разів more energy») — раніше
  блокував будь-яку згадку слова «energy»/«енергія» у framing-полях (title/seoTitle/meta/
  standfirst/theme), напр. «OpenAI signs nuclear energy deal» чи «Скільки енергії з'їдає
  кодинг-агент». Конкретна одиниця (kWh/електроенергія) тепер шукається по всій статті, а не в
  тому самому полі — `seoTitle` фізично не вміщує і гачок, і одиницю в 65 символів;
- UK `uk_language_residue`: прибрано `score` і `мейнтейнер` з блоклиста — усталені
  dev-жаргонізми цільової аудиторії, не неперекладений/зламаний текст;
- `looksLikeUniformCriticRubberStamp`: замість жорсткого «усі сім рівно 90/100» — будь-яка
  однакова оцінка нижче 95 (лишає можливість для дійсно рівно сильного, не «заглушеного»
  чернетки отримати uniform ≥95 без штучного regenerate-циклу).

**Чому:** Definition of Done проєкту — прибутковий продукт із повторюваним трафіком
(`wiki/overview.md` §1), а Week-1 retention вже задокументовано як ≈0 (§7 #2). Заборонні гейти
без симетричних вимог до цікавості тягнуть текст у канцелярит, що працює проти retention.

**Не змінено:** решта v7-гейтів (prompt-copy, metadata length, abstract title, standfirst
boilerplate, unsupported-original-research, article length) — залишені як є, підтверджені
коректними.

## 2026-08-09 — Weekly Content Studio: quality hardening v7

**Джерело:** owner audit + live admin read випуску
`843975a8-8c19-4eca-96a8-035f76eae3ab`, 2026-08-09.

**Змінено:**

- `editorial-voice.ts` — повні exemplars вилучено з writer prompt; джерельно непідтверджені
  сцени/реакції/хронологія прямо заборонені;
- `editorial-llm.ts` — конкретні titles, атрибуція single-source case studies, визначені
  electricity units/workload, доказова наскрізна логіка Top 3 без форсованої umbrella-теми,
  UK proofreading/localization, critic calibration і новий revisable-код `language_mechanics`;
- `content-studio.ts` — `weekly-master-v7`, legacy exemplar overlap, metadata, abstract-title,
  ambiguous-energy framing, UK residue, unsupported-original-research, gross-length і
  uniform-critic-score blockers;
- `weekly-workspace.tsx` — зрозумілі підписи standfirst / search preview / Open Graph і
  редакційні ліміти полів;
- тести — регресії для prompt leakage, вигаданих сцен, мовних помилок, localization, metadata
  та critic rubber-stamping;
- `wiki/pipeline/{weekly-digest,editorial-voice}.md`, `wiki/ops/weekly-admin-runbook.md`,
  `wiki/now.md`, `wiki/index.md` — оновлено контракт і редакторський runbook.

**Нотатка:** поточний записаний випуск не редагувався й не апрувився автоматично; зміни
посилюють наступну регенерацію після deployment.

**Перевірка:** `npm run pr:check` — 957/957 тестів, coverage gate, TypeScript, ESLint,
affected E2E map, strict wiki sync/lint і Next.js production build пройшли.

---

## 2026-08-09 — recovery GitHub Actions dispatcher для Weekly Digest

**Джерело:** production Supabase migrations `20260809064415_weekly_github_dispatch_fix`,
`20260809064621_weekly_github_dispatch_token_fix`, `20260809065118_weekly_generation_claim_shadowing_fix`;
live verification 2026-08-09.

**Змінено:**

- усунуто три PL/pgSQL name-shadowing помилки в GitHub dispatch/claim RPC: dispatcher тепер
  створює одноразовий token без двозначного `RETURNING`, а fenced claim однозначно резолвить
  поля таблиці;
- stalled linked `editorial_master` без створеної спроби повернуто в `queued` з append-only
  recovery event; новий GitHub Actions run успішно створив `Attempt 1/3`, перейшов у `running`
  та надсилає heartbeat;
- workflow тепер встановлює Claude Code CLI й запускає writer з `claude-cli` як єдиним дозволеним
  writer-провайдером: несправність CLI/subscription стає явною terminal-помилкою, а не тихим
  OpenRouter fallback;
- `wiki/index.md` — лічильник міграцій 70 → 73.

**Перевірка:** три SQL contract tests виконано напряму в production DB; `get_advisors` не показав
нових WARN від цих функцій. Існуючі RLS/SECURITY DEFINER advisory findings не змінювалися.

---

## 2026-08-09 — durable Weekly Digest worker control plane (production DB migration)

**Джерело:** production Supabase migration `20260809060929_weekly_generation_control_plane`;
verification query 2026-08-09.

**Змінено:**

- additive control-plane migration застосовано в production DB; minute reaper, private attempt/event
  tables і linked recovery ledger підтверджені query;
- historical `editorial_master` `f41de2f1-6056-4e84-9ee0-0528fedce615` закрито як
  `legacy_worker_timeout`; створено пов’язаний GitHub Actions retry
  `fe82f82c-7ceb-458e-9889-b5890b0e6d11` у `queued`, Attempt 1/3;
- application dispatch/worker code ще очікує merge та deployment; до цього queued GitHub retry
  навмисно не може бути claimed legacy Vercel worker.

---

## 2026-08-09 — durable Weekly Digest worker control plane (implementation)

**Джерело:** owner-approved reliability plan 2026-08-08; `supabase/migrations/20260808204920_weekly_generation_control_plane.sql`.

**Змінено:**

- additive attempt/event ledger, fenced lease/checkpoint/finish RPC, a minute-by-minute heartbeat reaper, linked manual retry and one automatic linked GitHub recovery retry for a terminal legacy long job;
- long master/social/video routing to one 120-minute GitHub Actions job; Vercel keeps only short jobs;
- provider/model/cost event instrumentation plus live 5-second admin status panel;
- SQL contract tests and unit tests for routing, progress, ETA fallback, redaction and failure classification.

**Стан:** код готовий у `codex/weekly-generation-control-plane`; production migration/deploy і smoke
master ще не виконані, тому старий current job не змінювався цією гілкою.

---

**Формат запису:**

```markdown
## YYYY-MM-DD — короткий заголовок

**Джерело:** raw/… | live check | рішення власника | нове
**Змінено:**
- `wiki/path.md` — що саме
**Нотатка:** одне речення, якщо потрібне.
```

---

## 2026-08-08 — Admin mobile responsive fix

**Джерело:** запит власника — скріншот адмінки на телефоні, контент горизонтально
обрізається без можливості побачити решту

**Змінено:**
- `src/components/admin/admin-nav.tsx` — мобільний нижній нав мав `grid-cols-7` на 8
  пунктів (`LINKS`); «Settings» сиротою переносився на непорахований другий рядок. Фікс:
  `grid-cols-4` — два рівні рядки по 4
- `src/app/admin/(cms)/layout.tsx` — `pb-20` (розрахований на 1 рядок нава) замінено на
  `pb-[calc(7rem+env(safe-area-inset-bottom))]` під новий 2-рядковий нав
- `src/components/admin/weekly-workspace.tsx` (`PreflightBlockerList`) — блокери
  рендерять сирі story-UUID усередині вкладених `grid`-контейнерів без `min-w-0`; додано
  `min-w-0` на grid-обгортки й `break-words` на текст блокера (той самий патерн, що вже
  був на `artifact.provider_id` у цьому ж файлі)
- `src/components/admin/scroll-fade.tsx` — новий `'use client'`-компонент: м'яке
  затемнення на краю горизонтально прогортаного ряду, коли є ще вміст поза екраном
- `src/app/admin/(cms)/weekly/[id]/page.tsx` — таб-бар секцій workspace обгорнуто в
  `ScrollFade`
- `src/app/admin/(cms)/weekly/page.tsx` — `min-w-60` на картці видання знято з мобільного
  брейкпоінту (`md:min-w-60`), щоб не форсувати ширину там, де макет одноколонковий
- `wiki/pipeline/weekly-digest.md`, `wiki/ops/weekly-admin-runbook.md`,
  `wiki/pipeline/weekly-editorial-selection.md`, `wiki/now.md` — синхронізовано під
  wiki-sync gate (watcher `weekly-digest` зачепив шляхи з `weekly/`)

**Перевірка:**
- Ізольований прод-білд (`npm run build && npm run start`) + Playwright (Chromium з
  `/opt/pw-browsers`) на вʼюпорті 375px: до фіксу — `grid-cols-7` дає 2 нерівні рядки
  (7+1 сирота), після — 2 рівні рядки по 4 (скріншот + `offsetTop`-вимірювання рядків)
- `ScrollFade`: підтверджено через прод-білд (dev-mode тут ламав гідратацію — HMR
  WebSocket не піднімається в цьому сендбоксі) — `opacity-0 → opacity-100` на потрібному
  краю коректно і на mount, і після програмного скролу
- `PreflightBlockerList`: конкретний UUID із реального скріншота в Chromium сам не
  «вибивав» ширину (браузер розбиває на дефісах), але той самий клас бага (`grid`-item
  без `min-w-0` + жорстка `min-w-max`-дитина) емпірично відтворено в тому ж тестовому
  дереві іншим вмістом — `min-w-0` на grid-item це виправляє; `break-words`/`min-w-0`
  лишені як захист для інших рушіїв (Safari/WebKit не тестувався — недоступний у
  сендбоксі) і довших id
- `npm run pr:check` — 941/941 тестів, `tsc`/`eslint` чисті (8 попередніх warning не по
  цих файлах), `build` зелений

**Нотатка:** справжній `/admin/weekly/[id]` із реальними даними перевірити не вдалось —
немає живих Supabase-креденшлів у цій сесії, `requireSocialAdmin()` редіректить на
login. Верифікація йшла через ізольований debug-роут з реальним компонентним деревом і
mock-даними (видалений перед комітом). Власнику варто самому глянути на реальному
телефоні після мержу.

## 2026-08-07 — Weekly 08.08 readiness check: PDF page-cap fix + 2 missing migrations applied

**Джерело:** «завтра я буду створювати новий weekly. Чи все готово... чи не має підводних
каменів» (власник)

**Змінено:**
- `src/lib/weekly-digest/pdf.ts` — новий `buildRadarSection()`; повний ілюстрований розворот
  (image+body+4 панелі) лишається лише для `rank<=3`, решта — компактний блок title+summary+source
- `src/lib/weekly-digest/pdf.test.ts` — новий тест на реалістичній 7-історійній фікстурі
  (довжини body зняті з реального прод-випуску), перевіряє 10-16 сторінок
- `wiki/pipeline/weekly-digest.md` — новий розділ «PDF page-count contract violation — фікс»,
  корекція попереднього невірного запису («живого бага немає»)
- `wiki/pipeline/editorial-voice.md` — PR3/PR5 позначені змерженими (були «Не змержено», стало
  неправдою після мержу PR #189 2026-08-07)
- `wiki/now.md` — «Активна робота» перероблено під поточний стан (усі 7 PR у main, знайдені й
  виправлені підводні камені)

**Перевірка:**
- Supabase live read (`mdiqfatpqczwqghwttpm`): `weekly_digest_generation_jobs` — 6/6 останніх
  `pdf`-джобів `failed` з `last_error: "Content Studio PDF is 20-21 pages; the approved A4
  contract is 10–16 pages"` (03 і 05.08, 5/5 спроб кожен); job_type CHECK-констрейнт не мав
  `video_script`; `weekly_digest_story_directions` не існувала
- Застосовано 2 міграції (`weekly_digest_story_directions`, `weekly_video_script_job`) через
  Supabase MCP `apply_migration`, підтверджено читанням констрейнту й `to_regclass` після
- `npx vitest run src/lib/weekly-digest/pdf.test.ts` — новий тест підтвердив 13 сторінок на
  реалістичній фікстурі (тимчасовий `console.log` для вимірювання, прибраний з коміту)
- `npx vitest run` повний — 941/941; `npx tsc --noEmit`, `npx eslint`, `npm run pr:check` — усі
  зелені
- Git: fluid-cpu fix (#184) підтверджено в `main`; PR #193 (Codex CLI Phase 7) виявився вже
  змерженим під час підготовки цієї гілки

**Нотатка:** Vercel MCP цієї сесії підключений до проєкту `portfolio` (sashakuzmenko.com), не
`ai-today-brief` — не вдалось звірити живе значення `WEEKLY_CONTENT_STUDIO_V2` напряму;
непряме свідчення (успішні джоби в БД ще 05.08) каже, що прапорець не `off`, всупереч
дефолту `.env.example`.

## 2026-08-07 — LLM provider registry Phase 7: Codex CLI adapter

**Джерело:** «продовжуємо фазу 7» (власник)

**Змінено:**
- `pipeline/providers/cli/codex.ts` (новий) — `CODEX_CLI_CONFIG` (buildArgs + parseCodexExecEnvelope),
  перший реальний другий споживач `cli-provider.ts`'s Фаза-1-скелету
- `pipeline/providers/cli/codex.test.ts` (новий) — 9 тестів
- `pipeline/providers/registry.ts` — `KNOWN_CLI_PROVIDERS['codex-cli']` зареєстровано
- `pipeline/providers/registry.test.ts` — +1 тест (DB-ланцюжок з `codex-cli` резолвиться,
  на відміну від незареєстрованого `claude-cli`)
- `wiki/pipeline/llm-providers.md` — статус Фази 7 + «Що лишається» п.3 позначено виконаним
- `wiki/now.md` — нова бульєта під гілку `feat/llm-registry-phase-7`

**Перевірка:**
- Дослідження CLI-флагів/env var через WebSearch/WebFetch офіційної документації OpenAI
  (learn.chatgpt.com: non-interactive-mode, config-file/environment-variables, auth) +
  незалежний community-гіст із реальним виводом 81 прапорця `codex exec` — звірено між
  джерелами, розбіжність (`CODEX_API_KEY` vs `OPENAI_API_KEY`) вирішена додатковим пошуком
  (`CODEX_API_KEY` підтверджено як призначений саме для одноразового `codex exec`-виклику).
  **Не верифіковано живим прогоном** — немає бінарника/ключа в сесії, на відміну від Фази 1's
  NIM dry-run.
- `npx vitest run` — 940/940 тестів (було 930, +10).
- `npx tsc --noEmit`, `npx eslint` на змінених файлах — чисто.
- `npm run build` — успішний, `/admin/providers` у білді.
- `npm run wiki:check` — чисто (46 сторінок, sync-тести зелені).

**Нотатка:** Codex не вмикається сам по собі — реєстрація в `KNOWN_CLI_PROVIDERS` лише робить
`codex-cli` резолвним, коли власник (а) поставить бінарник + `CODEX_API_KEY` на runner і (б)
додасть провайдера через `/admin/providers`. Жоден живий шлях не зачеплений.

## 2026-08-07 — LLM provider registry: PR #192 (Phase 6b) змержено, міграції застосовано до прод-БД

**Джерело:** «продовжити далі план, 192 ПР вмержено» (власник) → «застосувати міграції до
прод-БД» (власник, вибір із запропонованих варіантів)

**Змінено:**
- `wiki/now.md` — бульєти «Стан репозиторію» зведені під PR #192 (`290eaf5`, гілка
  `feat/llm-registry-phase-6b` видалена після мержу); зафіксовано застосування обох реєстрових
  міграцій до прод-БД і 2 нові WARN з `get_advisors`
- `wiki/pipeline/llm-providers.md` — «Що лишається» п.2 позначено виконаним з деталями
  застосування і знахідками advisors; лишились лише п.3 (Фаза 7, опційно) і п.4 (спостереження
  живого циклу)

**Перевірка:**
- `git checkout main && git pull --ff-only` — fast-forward `8909f50..290eaf5`; локальну гілку
  `feat/llm-registry-phase-6b` видалено (`git branch -d`, вже змержена).
- Supabase MCP `list_migrations` на `mdiqfatpqczwqghwttpm` підтвердив: обидві цільові міграції
  відсутні в проді → прочитано SQL обох файлів (чисто адитивні, той самий Vault-паттерн, що й
  `040_social_cms.sql`) → `apply_migration` для `llm_provider_registry`, потім
  `llm_provider_registry_fixes` — обидва `{"success":true}`.
- `list_tables` підтвердив: `llm_providers`/`llm_provider_models`/`llm_role_chains` існують,
  RLS увімкнено, 0 рядків (без зміни поведінки pipeline — `loadProviderRegistry` і далі фолбечить
  на дефолтний ланцюг).
- `get_advisors('security')` після застосування: 2 нові WARN (mutable `search_path` на
  `replace_llm_provider_models`; anon/authenticated технічно можуть викликати
  `store_/read_/delete_llm_provider_secret` через REST RPC, хоч і безрезультатно — власна
  `service_role`-перевірка кидає виняток). Не пофіксовано — звіт власнику, рішення чекає.

**Нотатка:** усі фази 0-6b плану `pipeline/llm-providers.md` тепер живі й діють у проді. З плану
лишається: Фаза 7 (Codex CLI, лише якщо власник хоче) і спостереження живого прод-циклу 6a/6b
з часом.

## 2026-08-07 — LLM provider registry Phase 6b: живий auto-publish dry-run

**Джерело:** «безпечно продовжувати» (власник, після паузи через паралельну сесію) → «живий
dry-run auto-publish, потім push+PR» (власник)

**Змінено:**
- `wiki/pipeline/llm-providers.md` — секція «Фаза 6b» доповнена результатом живого прогону;
  «Що лишається» п.1 позначено виконаним, додано новий п.4 (спостерегти реальний прод-цикл)
- `wiki/now.md` — бульєта 6b доповнена результатом живого прогону + новий source-рядок

**Перевірка:** `npx tsx --env-file=.env.local pipeline/scripts/auto-publish.ts --dry-run` (двічі:
дефолтне 7-денне вікно, потім `--window-days 90`). Перший прогін — `window_drafts: 0` (нічого в
вікні прямо зараз). Другий підняв 9 старих `draft`-брифів (2026-06-10…2026-07-20, свідомо поза
7-денним вікном) у область видимості й реально викликав суддю: 3 успішні живі виклики через
`daily.auto_publish_judge` → `generateWithRegistry` → OpenRouter (`deepseek/deepseek-v4-pro`),
підтверджено унікальним для реєстрового шляху логом `openrouter-models.ts`. БД без змін
(dry-run пропускає всі записи; перевірено повторним читанням `briefs`/`brief_items`). Тимчасові
скрипти: `tmp/auto-publish-6b-dryrun/{check-drafts,check-stale}.ts` (author-only, не закомічені).

**Нотатка:** побічно знайдено pre-existing (не Фаза 6b) баг — `runAutoPublish`'s ранній `return`
при порожньому вікні жорстко ставить `staleDrafts: 0` замість реального підрахунку; не впливає на
жодне рішення, лише на видимість у логах. Не фіксив — поза обсягом цієї міграції, окремо
прапорцьовано власнику.

## 2026-08-07 — LLM provider registry Phase 6b: auto-publish judge → реєстр, daily-смуга закрита

**Джерело:** «підтягни main гілку. Продовжи реалізацію по плану починаючи там де закінчив від 6b»
(власник; гілка `feat/llm-registry-phase-6b` від `main` після мержу #190/#191)

**Змінено:**
- `wiki/pipeline/llm-providers.md` — секція «Фаза 6b» у «Статус», нова секція «Що лишається»
- `wiki/now.md` — нова бульєта про гілку 6b; бульєта #190 позначена як змержена

**Код:**
- `pipeline/auto-publish.ts` — judge-виклик іде роллю `daily.auto_publish_judge` через реєстр із
  `db` (БД-ланцюжок з `/admin/providers` перекриває дефолт). Новий `createRegistryLoader` резолвить
  реєстр один раз на весь 7-денний sweep, лінивo й із мемоізацією відмови — без цього кожна
  чернетка окремо била живий каталог OpenRouter + три `llm_*`-читання (та сама проблема, що
  фіксили батчингом у Фазі 2).
- `pipeline/llm-json.ts` — став registry-only: мертву `primaryProvider`-гілку видалено (після 6b
  на ній не лишилось жодного виклику), сигнатуру з 9 позиційних параметрів перероблено на
  `JsonRoleCallOptions`, `role` обов'язковий. `withJsonSchema` → `withGeminiCallConfig`.
- `pipeline/verify.ts`/`pipeline/run-daily.ts` — параметри `primaryProvider`/`role` прибрано
  (роль там може бути лише `daily.verify`). `PipelineConfig.primaryTextProvider` лишається — він
  і далі керує `summarize.ts` (циклічна залежність, Фаза 6a).
- **Полагоджено тиху регресію Фази 6a:** `geminiMaxAttempts` (розширений бюджет спроб на
  останньому слоті доби) губився при переході на реєстр; тепер їде на gemini-запис ланцюга
  разом зі схемою.
- Поведінкова зміна даних: `reviewed_by`/`item_reviews.reviewer` тепер `auto:{provider}:{model}`
  замість `auto:{model}` на Gemini-плечі — обидва споживачі дивляться лише на префікс `auto:`.

**Тести:** 930/930, `tsc`/`eslint` чисті (`llm-json.test.ts` +4 / −1).

**Нотатка:** умову плану «6b лише після ≥1 доби стабільної роботи 6a» не витримано — 6a у `main`
менш ніж добу; живого прогону `auto-publish --dry-run` не робив (рішення власника).

## 2026-08-07 — Post-merge tech review PR #189/#190: 3 registry bugs + admin UX/safety fixes

**Джерело:** «зроби технічне ревʼю 189 і 190 пул реквесту як senior full stack developer» →
«давай пофіксимо всі ці баги» (власник, гілка `claude/tech-review-pr-189-190-859ena`, обидва PR
вже змержені в `main` до початку ревʼю)

**Змінено:**
- `wiki/pipeline/llm-providers.md` — новий підрозділ «Пост-мерж ревʼю + фікси» в кінці «Статус»
- `wiki/now.md` — нова бульєта в «Стан репозиторію»
- `wiki/index.md` — лічильник міграцій 68 → 69 (нова міграція цієї сесії)

**Код (блокери, підтверджені тестом до/після фіксу):**
- `pipeline/providers/registry.ts`'s `loadDbRoleChains` — порожній резолвлений DB-чейн більше не
  пишеться в мапу (раніше `[]` вигравав над `defaultChain` через `??`, перетворюючи одну
  недоналаштовану роль на повну відмову); `logEvent('warn', ...)` коли непорожній вихідний чейн
  резолвився в нуль провайдерів.
- `pipeline/providers/registry.ts`'s `loadProviderRegistry` — `resolveOpenRouterModelQueue` і
  `loadDbRoleChains` обгорнуто в try/catch (429/мережевий збій каталогу раніше валив побудову
  всього реєстру, навіть коли Gemini був живий); `run-daily.ts`'s
  `resolveDbHttpProvider('daily.summarize', db)` отримав `.catch(() => null)` для узгодженості з
  сусідніми викликами.
- `src/lib/weekly-digest/editorial-llm.ts`'s і `src/lib/social/llm-router.ts`'s `generateOpenRouter`
  — DB-override провайдер (Phase 4/5 «partial by design») тепер падає на звичайну
  ranked-OpenRouter драбину при збої виклику, замість валити весь запит.

**Код (важливе):**
- `src/app/admin/(cms)/providers/actions.ts` — усі 12 `throw new Error` тепер редиректять на
  `/admin/providers?error=...` (новий `withProvidersErrorRedirect`, за патерном
  `redirectWeeklySocialError`); `updateLlmRoleChainAction` валідує, що id у чейні існує в
  `llm_providers`.
- `src/app/admin/(cms)/weekly/actions.ts` — `saveWeeklyStoryDirectionAction`/
  `selectWeeklyArtifactVariantAction` (нові в PR #189) переведено з сирих throw на існуючий
  `fail()`/redirect патерн файлу.
- `src/app/admin/(cms)/loading.tsx` + `error.tsx` (нові) — жодного admin-маршруту не мав
  loading/error boundary; спільні на весь `(cms)` route group.
- `supabase/migrations/20260807120000_llm_provider_registry_fixes.sql` (нова, author-only) —
  `delete_llm_provider_secret` (Vault-секрет лишався сиротою при видаленні провайдера) і
  `replace_llm_provider_models` (атомарна заміна списку моделей); `providers/page.tsx` більше не
  фільтрує за `enabled` при побудові textarea (раніше тихо губило disabled-моделі на наступний
  Save).
- `src/components/admin/social-char-count.tsx` (новий) + `hook-candidate-picker.tsx` — лічильник
  символів посту був статичним server-рендером, що ніколи не оновлювався (ні від тайпінгу, ні від
  кліку по hook-кандидату); тепер живий client-компонент на `input`-івенті,
  `HookCandidatePicker` диспатчить `input` і ріже кандидата до `maxLength`.
- `pipeline/card-image.ts`'s `runArtDirectorLadder` — мовчазний catch отримав `logEvent('warn', ...)`.
- `wiki/_tools/lib/project-sync.mjs` і `wiki/_tools/wiki-lint.mjs`'s `toPosix` — `p.split(sep)`
  було no-op на Linux (`sep === '/'`), тест падав на будь-чому крім Windows; тепер
  `p.split(/[\\/]/)` — блокувало `npm run wiki:check` (частина `pr:check`) у цьому середовищі.

**Retracted:** ревʼю спершу стверджувало (а) «сервер довжину поста взагалі не валідує» —
неточно, `runQualityGate` (`quality.ts`) вже блокує Approve через наявний `maxChars`-чек; реальна
дірка була вужчою (мертвий лічильник, вище); (б) AAL2-write RLS на provider-таблицях «обходиться»
— насправді той самий наскрізний патерн, що й в усьому CMS (`040_social_cms.sql`), де всі записи
йдуть через `service_role`; не PR-специфічна проблема, код не змінено.

**Верифіковано:** 927/927 тестів, `tsc --noEmit` чисто, `eslint` чисто (ті самі 8 pre-existing
warnings), `npm run wiki:check` зелений (раніше падав), `npm run build` зелений.

## 2026-08-07 — LLM provider registry, Phase 6a: daily verify.ts + summarize.ts migrated, verified live

**Джерело:** «продовжуй далі усі фази по порядку з фіксуванням комітами» (власник, продовження
Фази 5 в межах затвердженого плану, `feat/llm-provider-registry`)

**Змінено:**
- `wiki/pipeline/llm-providers.md` — статус Фази 6a: реальна зміна дефолтного порядку для
  verify.ts, циклічна залежність, яка змусила іншу конструкцію для summarize.ts, live-верифікація
- `wiki/now.md` — стан гілки оновлено, наступний крок = Фаза 6b

**Код:**
- `pipeline/llm-json.ts`'s `generateJsonWithFallback()` — новий `role?`/`db?`; коли `role`
  передано, іде через `generateWithRegistry` з новою `withJsonSchema()`-обгорткою (роль
  `daily.verify` потребує різних схем залежно від виклику — `VERIFY_SCHEMA` чи `GEMINI_SCHEMA`).
  **Реальна зміна поведінки:** реєстровий шлях використовує дефолтний порядок реєстру
  (OpenRouter першим), а не старий `primaryProvider`-прапорець (типово gemini) — саме те, що
  коментар «тимчасова заглушка... deleted once this migration reaches the daily lane» обіцяв з
  Фази 0. Коли `role` не передано (`auto-publish.ts`, Фаза 6b) — стара логіка незмінна.
- `verify.ts`'s `verifyClaims`/`reviseFlaggedItems` — новий `role?`/`db?`, усі 3 виклики з
  `run-daily.ts` передають `'daily.verify'`.
- `summarize.ts`'s `runSummarizeFromPrompt` — **інша конструкція, свідомо**: прямий імпорт з
  `pipeline/providers/registry.ts` створив би циклічну залежність
  (`summarize.ts`→`registry.ts`→`gemini-provider.ts`→`summarize.ts`). Транспорт OpenRouter-плеча
  замінено на `generateWithHttpProviderChain` (імпорт лише з `http-provider.ts`, без циклу);
  БД-override резолвиться викликачем (`run-daily.ts`/`custom-news.ts`, де імпорт з `registry.ts`
  безпечний) і передається як `dbHttpOverride`. `primaryProvider` (gemini-first) НЕ прибрано
  тут — асиметрія з verify.ts, задокументована як архітектурне обмеження, не забаганка.
- Нові тести: `pipeline/llm-json.test.ts` (новий файл, 4 тести); `summarize.test.ts` +3 для
  `llmUsageFromProviderUsage`.

**Живо верифіковано (2026-08-07):** `npx tsx --env-file=.env.local pipeline/run-daily.ts
--dry-run` — повний реальний прогін: fetch (214 статей) → rank → enrich → summarize (Gemini
503/429 retry відпрацював, `gemini-3.5-flash-lite` встиг) → verify (реальний виклик через новий
реєстровий шлях, живий `deepseek/deepseek-v4-pro` через OpenRouter відповів за ~36с) → валідний
3-айтемний бриф. Сильніша верифікація, ніж Фази 4/5.

**Верифіковано:** 927/927 тестів, `tsc --noEmit` чисто, `eslint` на змінених файлах чисто,
`npm run build` успішний, плюс живий `run-daily.ts --dry-run` вище.

## 2026-08-06 — LLM provider registry, Phase 5: social writer/critic (llm-router.ts) migrated, partial by design

**Джерело:** «продовжуй далі усі фази по порядку з фіксуванням комітами» (власник, продовження
Фази 4 в межах затвердженого плану, `feat/llm-provider-registry`)

**Змінено:**
- `wiki/pipeline/llm-providers.md` — статус Фази 5: що мігровано/не мігровано і чому, важлива
  відмінність тестового покриття від попередніх фаз
- `wiki/now.md` — стан гілки оновлено, наступний крок = Фаза 6a

**Код:**
- `src/lib/social/llm-router.ts`'s `generateOpenRouter()` — транспорт замінено на
  `generateWithHttpProviderChain` (`OPENROUTER_HTTP_DEFAULTS`); `rankSocialOpenRouterModels`
  лишилось незайманим. Новий `resolveSocialDbHttpProvider(role, db)` — той самий патерн, що й
  Фази 4, для ролей `social.writer`/`social.critic` (вже існували в `PROVIDER_ROLES`).
- Свідомо НЕ мігровано: `generateGemini` (per-role `GEMINI_SCHEMAS` + env-специфічні
  оверрайди/фільтри, не покриті generic-адаптером) і `generateOllama` (локальний self-hosted
  сервер з власною security-перевіркою, поза призначенням `http-provider.ts`).
- `generateSocialJson` отримав `options.db?: PipelineDb`, протягнуто через усі реальні
  продакшн-виклики: `attachCriticReport` (`src/lib/social/critic.ts`, викликається з
  `composer.ts` і `admin/actions.ts`), `adaptWeeklySocialChannel`
  (`src/lib/weekly-digest/social-adapter.ts`, викликається з `generation-worker.ts`), і прямий
  виклик у `admin/actions.ts`'s ручному regenerate-екшені — усюди `getSupabaseAdmin()`.
- 2 нових тести — перші, що реально викликають `generateOpenRouter` (не через
  `deps.generators`-injection, як усі наявні тести цього файлу); наявні 12 тестів пройшли без
  змін.

**Свідомо не зроблено:** живий shadow-run (та сама причина, що й Фаза 4 — БД-шлях не перевірити
без застосованої міграції; дефолтний шлях успадковує живу верифікацію Фази 1).

**Верифіковано:** 920/920 тестів, `tsc --noEmit` чисто, `eslint` на змінених файлах чисто,
`npm run build` успішний.

## 2026-08-06 — LLM provider registry, Phase 4: weekly master (editorial-llm.ts) migrated, partial by design

**Джерело:** «продовжуй далі усі фази по порядку з фіксуванням комітами» (власник, продовження
Фази 3 в межах затвердженого плану, `feat/llm-provider-registry`)

**Змінено:**
- `wiki/pipeline/llm-providers.md` — статус Фази 4: що мігровано, що свідомо НЕ мігровано і чому,
  чому live shadow-run не проведено
- `wiki/now.md` — стан гілки оновлено, наступний крок = Фаза 5

**Код:**
- `src/lib/weekly-digest/editorial-llm.ts`'s `generateOpenRouter()` — транспортний шар
  замінено з прямого `generateWithOpenRouterChain` на `generateWithHttpProviderChain`
  (`pipeline/providers/http-provider.ts`, Фаза 1) через `OPENROUTER_HTTP_DEFAULTS`.
  Value-ранжування моделей (`premiumOpenRouterModels`, токен-профіль 12k/20k, поріг якості)
  лишилось незайманим.
- Новий `resolveWeeklyDbHttpProvider(role, db)` — перевіряє БД-ланцюжок
  `weekly.master_writer`/`weekly.master_critic` на `http`-запис перед дефолтним value-ранжованим
  шляхом; якщо власник додав провайдера (напр. NIM) через `/admin/providers` для однієї з цих
  ролей, він обслуговує виклик зі своїм сконфігурованим списком моделей.
- Свідомо НЕ мігровано: `generateGemini` (пряма Gemini-SDK-логіка, три різні JSON-форми без
  native schema — `generateWithGemini`-адаптер дефолтить на неправильну daily-brief-схему коли
  `cfg.schema` не задано) і `generateClaudeCli` (лишається на `pipeline/claude-cli.ts`, узгоджено
  з рішенням Фази 1 — немає другого CLI-споживача).
- `generateWeeklyMaster` отримав `options.db?: PipelineDb`; `generation-worker.ts` передає
  `getSupabaseAdmin()`.
- 2 нових тести для DB-override; усі 22 наявні тести пройшли БЕЗ ЗМІН (мокають
  `generateWithOpenRouterChain` на рівень нижче за новий код — той самий мок прозоро перехоплює
  новий шлях, підтверджуючи побайтову ідентичність запиту).

**Свідомо не зроблено:** живий shadow-run цієї фази (план це передбачав). Дефолтний шлях
успадковує живу верифікацію Фази 1 (та сама `http-provider.ts`-обгортка). Новий БД-override шлях
неможливо живо перевірити зараз — міграція `llm_role_chains` навмисно не застосована до прод-БД.

**Верифіковано:** 918/918 тестів, `tsc --noEmit` чисто, `eslint` на змінених файлах чисто,
`npm run build` успішний.

## 2026-08-06 — LLM provider registry, Phase 3: custom-research.ts migrated

**Джерело:** «продовжуй далі усі фази по порядку з фіксуванням комітами» (власник, продовження
Фази 2 в межах затвердженого плану, `feat/llm-provider-registry`)

**Змінено:**
- `wiki/pipeline/llm-providers.md` — статус Фази 3: що замінено, знайдений баг (мертва
  `openRouterApiKey`-опція), `withResearchSchema()`-обгортка для Gemini structured output
- `wiki/now.md` — стан гілки оновлено, наступний крок = Фаза 4

**Код:**
- `pipeline/custom-research.ts`'s `researchCustomStory()` — раніше прямий
  `new GoogleGenerativeAI(apiKey)` + `createResearchGenerate()`, без фактичного OpenRouter-фолбеку
  попри наявну опцію `openRouterApiKey` (**реальний баг, знайдений під час читання коду для цієї
  фази** — опція існувала, але ніде не використовувалась). Тепер
  `generateWithRegistry('custom_research', prompt, registry, {validateResponse})`.
- Новий експортований `withResearchSchema(registry)` — патчить `RESEARCH_SCHEMA`
  (Gemini-native structured output) лише на `gemini`-записи ланцюжка ролі `custom_research`,
  хоч би звідки вони прийшли (env-дефолт чи БД-ланцюжок з `/admin/providers`); OpenRouter/CLI-записи
  не чіпаються — вони й так отримують «Return JSON only» текстову інструкцію та перевіряються
  легким `validateResearchJson` (прогін через `parseResearchResult`).
- `pipeline/custom-news.ts`'s `runCustomNews` тепер будує `db` до виклику research (не після
  dry-run-гілки) — БД-ланцюжок для `custom_research` тепер спрацьовує навіть у dry-run.
- 2 нових тести для `withResearchSchema`; `researchCustomStory` лишається поза юніт-покриттям
  (`/* v8 ignore start -- Gemini integration */`, як і раніше).

**Верифіковано:** 916/916 тестів, `tsc --noEmit` чисто, `eslint` на змінених файлах чисто,
`npm run build` успішний.

## 2026-08-06 — LLM provider registry, Phase 2: card-image.ts art-director ladder migrated

**Джерело:** «продовжуй далі усі фази по порядку з фіксуванням комітами» (власник, продовження
Фази 1b в межах затвердженого плану, `feat/llm-provider-registry`)

**Змінено:**
- `wiki/pipeline/llm-providers.md` — статус Фази 2: що замінено, продуктивність-компроміс
  (резолв реєстру раз-на-батч), свідомий компроміс вартості на OpenRouter-фолбеку
- `wiki/now.md` — стан гілки оновлено, наступний крок = Фаза 3

**Код:**
- `pipeline/card-image.ts`'s `runArtDirectorLadder()` — раніше хардкоджений
  `GoogleGenerativeAI`-виклик + сирий `fetch` на `~openai/gpt-mini-latest` через OpenRouter,
  тепер `generateWithRegistry(role, instruction, registry)` для ролей
  `daily.card_image_scene`/`weekly.card_image_scene`. `CardImageConfig` отримав `db?`/`registry?`
  опційні поля. `fillCardImages` резолвить реєстр один раз на весь батч (до 12 айтемів), не на
  кожен айтем окремо — інакше кожен айтем окремо бив би живий каталог OpenRouter.
  `SceneBriefResult.source` розширено з фіксованого union до `string` (може нести будь-який
  provider id з реєстру, напр. `'nim'`).
- `src/lib/weekly-digest/generation-worker.ts` — weekly-виклик тепер передає `db:
  getSupabaseAdmin()`, щоб БД-ланцюжок для `weekly.card_image_scene` теж міг спрацювати.
- 4 нових тести в `card-image.test.ts` (registry reuse, env-ключі при побудові, повний успішний
  шлях через CLI-адаптер зі stub `spawnFn`, weekly-роль); існуючі 29 тестів пройшли без змін.

**Свідомий компроміс:** OpenRouter-фолбек для цієї (дешевої, низько-ставкової) ролі тепер іде
через той самий benchmark-ранжований каталог, що й усі інші ролі, замість старої хардкодженої
дешевої моделі-псевдоніма. НЕ компенсовано через `roleOverrides`, бо `roleOverrides` в
`loadProviderRegistry` має пріоритет над БД-ланцюжком — жорстке зашивання дешевої моделі
назавжди заблокувало б власника від керування цією роллю через `/admin/providers`.

**Верифіковано:** 914/914 тестів, `tsc --noEmit` чисто, `eslint` на змінених файлах чисто,
`npm run build` успішний.

## 2026-08-06 — LLM provider registry, Phase 1b: DB-driven role chains + admin UI

**Джерело:** «продовжуй далі усі фази по порядку з фіксуванням комітами» (власник, продовження
Фази 1 в межах затвердженого плану, `feat/llm-provider-registry`)

**Змінено:**
- `wiki/pipeline/llm-providers.md` — статус Фази 1b: що збудовано, свідоме обмеження CLI-рядків з БД
- `wiki/now.md` — стан гілки оновлено, наступний крок = Фаза 2

**Код:**
- `supabase/migrations/20260806160000_llm_provider_registry.sql` (авторська, НЕ застосована до
  живої БД) — таблиці `llm_providers`/`llm_provider_models`/`llm_role_chains`, той самий
  admin-read+AAL2-write RLS-патерн що в `040_social_cms.sql`, дві нові Vault RPC
  (`store_llm_provider_secret`/`read_llm_provider_secret`, змодельовані на
  `store_social_oauth_secret`/`read_social_oauth_secret`).
- Нова сторінка `/admin/providers` (`src/app/admin/(cms)/providers/{page.tsx,actions.ts}`) —
  додати/редагувати/видалити провайдера, вставити ключ (write-only, AAL2), редагувати
  ланцюжок провайдерів по кожній з 10 ролей. Посилання в `admin-nav.tsx`.
- `pipeline/providers/registry.ts`'s `loadProviderRegistry` тепер реально читає `db`-параметр
  (у Фазі 1 був зарезервованим): `http`/`gemini`-рядки резолвляться повністю, `cli`-рядки —
  лише для інструментів, зареєстрованих у `KNOWN_CLI_PROVIDERS` (поки що порожньо), інакше
  пропускаються з `logEvent('warn', ...)`. Черговість: `roleOverrides > db > built-in default`.
- 19 нових тестів у `registry.test.ts`; попутно виправлено leak стану моків (`vi.mock()` без
  `afterEach`-скидання) у `http-provider.test.ts` і `registry.test.ts` — читання
  `mock.calls[0]` між тестами давало хибні pass/fail.

**Верифіковано:** 910/910 тестів, `tsc --noEmit` чисто, `eslint` на змінених файлах чисто,
`npm run build` успішний (`/admin/providers` — новий маршрут у білді).

**Нотатка:** нічого в проєкті ще не викликає `generateWithRegistry` для реального LLM-запиту —
admin-сторінка й БД-читання безпечні для експериментів, порожні таблиці = поточна поведінка без
змін. Наступний крок — Фаза 2 (`card-image.ts`'s `runArtDirectorLadder`).

## 2026-08-06 — LLM provider registry, Phase 1: registry core + live NIM verification (2 bugs found+fixed)

**Джерело:** продовження Фази 0 в межах затвердженого плану (`feat/llm-provider-registry`);
живий dry-run проти реального NVIDIA NIM API (ключ власника додано в `.env.local`)

**Змінено:**
- `wiki/pipeline/llm-providers.md` — статус Фази 1: що збудовано, обидва знайдені баги, успішний
  результат live-верифікації
- `wiki/now.md` — стан гілки оновлено

**Код:** новий каталог `pipeline/providers/` (`types.ts`, `http-provider.ts`, `cli-provider.ts`,
`gemini-provider.ts`, `registry.ts`) + 30 нових тестів (раніше 0 покриття цього шару). Адитивні
опційні параметри в `openrouter-summarize.ts`/`openrouter-adaptive.ts` (`requestConfig`/`baseUrl`)
з дефолтами, що 1-в-1 відтворюють поточну поведінку OpenRouter — жоден існуючий виклик не
змінено. `claude-cli.ts` свідомо НЕ чіпався (немає другого споживача скелету CLI-провайдерів
поки що).

**Знайдено й виправлено живим прогоном (2026-08-06):**
1. **Реальний баг, не одноразовий здогад:** `buildChatBody()` (`openrouter-summarize.ts`) і
   **окремо** `streamOpenRouterCompletion()` (`openrouter-adaptive.ts`) обидва незалежно
   хардкодили OpenRouter-специфічне поле `usage: {include: true}` у тілі запиту. NIM валідує
   тіло суворо і повертає HTTP 400 `"Unsupported parameter(s): 'usage'"` — на відміну від
   припущення в плані про "graceful degradation", яке було правильним лише для ВІДПОВІДІ
   (`usage.cost` дійсно деградує в `null`), не для ЗАПИТУ. Перша спроба фіксу (лише в
   `buildChatBody` через `extraBodyForModel`) не спрацювала в живому прогоні — другий,
   незалежний хардкод у `streamOpenRouterCompletion` мовчки перекривав перший фікс. Знайдено
   лише повторним живим прогоном після першого «фіксу», який не змінив реальну поведінку.
2. `moonshotai/kimi-k2.6` — HTTP 404, модель не активована на конкретному NVIDIA-акаунті
   (обліковий нюанс, не код).

**Результат:** `deepseek-ai/deepseek-v4-pro` через реальний NIM API успішно повернув валідний
JSON за 86.9с — підтверджує головну тезу дослідження: generic OpenAI-сумісний HTTP-шар дійсно
працює проти неOpenRouter-провайдера лише зі зміною base URL + ключа.

**Нотатка:** це другий приклад у цій сесії (після PR3's critic-vocabulary фіксу), коли живий
прогін ловить реальний баг, який юніт-тести з мокнутим fetch не могли б виявити — мокнутий
`fetch` ніколи б не повернув справжню 400-помилку суворого валідатора NIM.

---

## 2026-08-06 — LLM provider registry, Phase 0: Gemini removed from default rotation

**Джерело:** рішення власника (session 2026-08-06) — під час обговорення дещо ширшого запиту
(«прибрати Gemini + зробити зручну систему керування провайдерами для всього проєкту, не лише
weekly»); дослідження коду (2 Explore-агенти + 1 Plan-агент) + Plan-mode затверджений план у
`C:\Users\Oleksandr\.claude\plans\06-08-2026-12-32-oleksandr-kuzmenko-prancy-gizmo.md`

**Змінено:**
- Нова гілка `feat/llm-provider-registry` (від tip `feat/weekly-editorial-voice`)
- `wiki/pipeline/llm-providers.md` — нова сторінка: навіщо, ключові знахідки дослідження,
  статус фаз
- `wiki/index.md` — новий рядок
- `wiki/now.md` — стан нової гілки, залежність від `feat/weekly-editorial-voice`

**Код (Фаза 0 з 7+ фаз плану):**
- `src/lib/weekly-digest/editorial-llm.ts`'s `providerOrder()`: дефолт `WEEKLY_MASTER_PROVIDER_ORDER`
  `claude-cli,openrouter,gemini` → `claude-cli,openrouter`
- `src/lib/social/llm-router.ts`'s `DEFAULT_PROVIDER_ORDER`: writer/critic обидва тепер
  `['openrouter','ollama']` (gemini прибрано з обох); незалежність writer/critic і далі йде через
  `excludeProviders` у `generateSocialJson`, не через різний перший провайдер за замовчуванням
- Daily: новий тимчасовий прапорець `DAILY_LLM_PRIMARY_PROVIDER` (`pipeline/config.ts`'s
  `PipelineConfig.primaryTextProvider`), протягнутий через `pipeline/llm-json.ts`,
  `pipeline/summarize.ts`, `pipeline/verify.ts`, `pipeline/auto-publish.ts`,
  `pipeline/custom-news.ts`. Дефолт `'gemini'` — нуль зміни поведінки без явного env override.
  **Свідомо тимчасова конструкція**, видаляється у фазі 6 плану, коли daily переходить на повний
  реєстр провайдерів.
- Gemini-клієнти (`gemini-models.ts`, SDK-виклики) не чіпались — лишаються доступні через явний
  env override у всіх трьох шляхах.

Typecheck/lint/build/vitest зелені (873 тести). Наступний крок — Фаза 1: ядро реєстру
(`pipeline/providers/`) + БД-таблиці + один живий dry-run проти реального NVIDIA NIM API
(ключ власника вже додано в `.env.local` як `NVIDIA_API_KEY`).

**Нотатка:** повний план (типи, БД-схема з Vault-секретами, admin UI, фазовий порядок 0–7) — у
файлі плану вище, тут навмисно лише статус, щоб не дублювати. `docs`-Plan-агент перевірив і
підтвердив реальний, робочий Vault-патерн для зберігання секретів провайдера
(`store_social_oauth_secret`/`read_social_oauth_secret`, `040_social_cms.sql`) — не здогад.

---

## 2026-08-06 — Editorial quality overhaul, PR7: social voice + hook picker + cleanup (all 7 PRs done)

**Джерело:** рішення власника (session 2026-08-06) — «код продовжується» по завершенні PR6;
завершення 7-PR плану `feat/weekly-editorial-voice`

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — новий підрозділ «PR7»: socialAngles видалено з майстра,
  self-generated angle, voice-модуль у social-adapter, banned-openers ranking, originality
  critic-вимір, hook picker UI, dead-code cleanup, plan-correction на `GENERIC_PRACTICAL_PATTERNS`
- `wiki/now.md` — усі 7 PR позначені готовими; наступний крок явно передано власнику
  (code review / shadow-прогін / klein-оцінка)

**Код:** `WeeklyMasterBundle.socialAngles` видалено end-to-end (тип, `englishPrompt` CONTRACT+JSON
SHAPE, `parseEnglishPackage`, `normalizeWeeklySocialAngles`, `social_angle_grounding` гейт) --
`social-adapter.ts` тепер сам пропонує кут для кожного каналу в тому ж writer-виклику, що пише
3 hook-кандидати (`{"angle":"","text":"...","firstComment":""}`), замість читати заздалегідь
згенерований, каналево-сліпий кут з майстра. Імпортовано `VOICE_EN`/`VOICE_UK` з `editorial-voice.ts`
(PR1) у writer-промпт; `scoreCandidate` тепер штрафує за `bannedPhrasesFor(locale)`-спрацювання.
Новий critic-вимір `originality` (`src/lib/social/critic.ts`, `src/lib/social/types.ts` --
optional-field патерн, daily social-пайплайн не зачеплений) з порогом 70/100. Social tab: hook-
кандидати клікабельні (`src/components/admin/hook-candidate-picker.tsx`, новий client-компонент).

**Видалено:** мертвий `src/lib/weekly-digest/editorial-draft.ts` + тест (передував Content Studio
v2, ніде не імпортувався окрім власного тесту).

**Виправлення плану:** початковий план казав видалити й `GENERIC_PRACTICAL_PATTERNS` як нібито
дублікат `detectTemplateLeaks` -- читання коду показало, що це активний, протестований гейт
(`generic_practical`) для іншого класу проблеми (reused generic template phrases в полі
practical), не дублікат. Залишено як є.

**Нове покриття:** `social-adapter.test.ts` (5 тестів, раніше -- нуль тестів на цей модуль):
self-generated angle, banned-opener ranking, originality blocking/non-blocking, originality-flag
surfacing. Typecheck/lint/build/vitest зелені (872 тести, 99 файлів).

**Нотатка:** як і PR6, немає окремого live-прогону в межах цієї сесії -- новий originality-вимір
критика жодного разу не бачив реальну відповідь моделі. Усі 7 PR плану тепер на гілці
`feat/weekly-editorial-voice`; злиття, shadow-прогін і фінальна візуальна оцінка klein-стилю
(PR5) лишаються рішенням власника.

---

## 2026-08-06 — Editorial quality overhaul, PR6: video script stage + manifest v3

**Джерело:** рішення власника (session 2026-08-06) — «кодити PR6–7 паралельно» під час двох
live-верифікацій PR3/PR5; продовження 7-PR плану `feat/weekly-editorial-voice`

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — новий підрозділ «PR6» під «Editorial voice overhaul»:
  video виключено з майстер-виклику, новий standalone job `video_script`, WPS-валідатор,
  manifest v3 з per-scene `revisionItemId`, оновлений порядок job-пайплайну
- `wiki/pipeline/video-boundary.md` — попередження про застарілий приклад схеми (`v1` замість
  живого `v3`), лінк на актуальний контракт
- `wiki/now.md` — стан гілки (PR1–6 закомічені, PR7 останній), PR6 позначено «не верифіковано
  наживо» (на відміну від PR3/PR5)
- `wiki/index.md` — лічильник міграцій ~66 → ~67

**Код:** `WeeklyMasterBundle.video` видалено з типу; новий `src/lib/weekly-digest/video-script-llm.ts`
(TV-news драматургія: cold open → anchor → b-roll×3 (по одній на feature-історію) → radar
quick-hits → outro, той самий Claude CLI → OpenRouter → Gemini ladder через щойно експортований
`generateFirstAvailable`); новий `validateVideoScript` (`content-studio.ts`) — WPS-гейт
`durationSeconds ≈ words(voiceover)/2.6 ±20%` б'є задокументований корінь «німого слайдслайду»
з `ai-today-brief-video`; `video_script` — тепер queueable job type (раніше писався синхронно
всередині `editorial_master`); міграція `20260806150000_weekly_video_script_job.sql`
(job_type CHECK + обидва RPC) написана, **не застосована до прод-БД**; попутний фікс —
`generateSocialCopy` більше не залежить від існування video_script-артефакту (побічний баг
старого коду). Typecheck/lint/vitest зелені (152 тести, +17 нових на `validateVideoScript` і
`generateWeeklyVideoScript`).

**Нотатка:** на відміну від PR3 (critic shadow-run) і PR5 (klein dry-run), тут не було окремого
live-прогону в межах цієї сесії — рекомендовано запустити `video_script` на реальному
approved-артикулі перед shadow-розкаткою всього пайплайну.

---

## 2026-08-06 — Editorial quality overhaul, PR1: editorial-voice.ts core

**Джерело:** рішення власника (session 2026-08-06) — забракував якість усього weekly-контенту
(текст/ілюстрації/відео/соц) як «машинну»; опитування власника (аудиторія, голос, спекуляції,
AEO-блоки, людина-в-циклі, формат відео, бюджет) + 7-PR план `feat/weekly-editorial-voice`

**Змінено:**
- `wiki/pipeline/editorial-voice.md` — нова сторінка: архітектура голосу, exemplars,
  contrast-pairs, banned-phrase гейт, Unicode-regex пастка
- `wiki/pipeline/weekly-digest.md` — секція «Editorial voice overhaul (2026-08-06)»,
  `weekly-master-v4` → `weekly-master-v5`
- `wiki/pipeline/weekly-editorial-selection.md` — межа з overhaul (selection незмінний, лише
  вхід для нового voice-майстер-промпту)
- `wiki/ops/weekly-admin-runbook.md` — нові блокери `editors_view_missing` /
  `discussion_question_missing` / `template_leak:*` у кроці Research
- `wiki/now.md` — активна робота п.1 = редакційний перегляд; trial release
  `ai-weekly-2026-07-27` свідомо призупинено до PR1–3
- `wiki/index.md` — новий рядок для `pipeline/editorial-voice.md`; лічильник міграцій 63 → 65
  (pre-existing drift, не повʼязаний з цією роботою, виправлено заразом бо блокував `wiki:check`)

**Нотатка:** код PR1 (`src/lib/weekly-digest/editorial-voice.ts` + переписані промпти в
`editorial-llm.ts` + `detectTemplateLeaks`/нові поля `editorsView`/`discussionQuestion` в
`content-studio.ts` і `generation-worker.ts`) готовий локально — typecheck/lint/vitest (832
тестів) зелені; ще не закомічено/запушено, чекає рішення власника. PR2–7 заплановані, не
почато.

---

## 2026-08-06 — Editorial quality overhaul, PR2: render new story anatomy

**Джерело:** продовження 7-PR плану (PR1 запис вище); власник підтвердив підхід «AEO-блоки
поза прозою» під час опитування 2026-08-06

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — секція PR2: `digests.ts`/`weekly-story.tsx`/`pdf.ts` зміни
- `wiki/pipeline/editorial-voice.md` — позначено рендеринг як вирішений, приберано з «НЕ вирішує»

**Нотатка:** `src/lib/digests.ts` читає нові поля з `source_snapshot.content_studio`
(`contentStudioFrame`); `weekly-story.tsx` рендерить `limitation` (приглушений рядок),
«Погляд редакції» (пунктирна рамка + дисклеймер) і `discussionQuestion` (завершальне питання) —
усі умовно, зворотна сумісність зі старими випусками. PDF отримав панель `limitation` тим самим
шляхом; `editorsView`/`discussionQuestion` свідомо НЕ додані в PDF. Живо перевірено на єдиному
опублікованому випуску (`ai-weekly-2026-06-29`) — 200 OK, без regressions (dev-сервер довелось
піднімати напряму через Bash, не через preview_start: харнес-тул під час запуску `next dev`
ловить відомий subst-drive path-duplication баг з `dev-env-subst-drive-e2e-2026-07`, тепер він
проявляється і поза Playwright-контекстом; `turbopack.root` у `next.config.ts` не допоміг і був
відкочений — ENOENT стосується internal dev-manifest шляху, не module resolution).

---

## 2026-08-06 — Editorial quality overhaul, PR3: critic rubric + line-edit pass

**Джерело:** продовження 7-PR плану (PR1/PR2 записи вище)

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — секція PR3: engagement/voice виміри, revise loop, latest-only
  retry guidance, `weekly-master-v6`
- `wiki/pipeline/editorial-voice.md` — PR3 позначено вирішеним із застереженням «не змержено»
- `wiki/now.md` — зупинка перед мержем PR3 явно виділена

**Нотатка:** `criticPrompt` тепер несе якорьовану рубрику (3 приклади на вимір: як виглядає
90/75/55) і вимагає цитованих спанів для оцінок нижче 80. `generateWeeklyMaster` отримав
in-process revise-loop (макс 2 спроби): на revisable провалі (`reportIsRevisable` —
виключає grounding/структурні коди) шле targeted `reviseArticlePrompt` замість повної
регенерації; англійська правка завжди тягне за собою переадаптацію української (не наосліп).
Вартість по кожному кроку (english/ukrainian/critic) сумується по всіх спробах в межах одного
виклику — інакше revise тихо занижував би облік витрат. `priorMasterRetryGuidance` звужено з
«усі історичні звіти, змерджені» до «лише останній звіт» — стара версія ніколи не забувала
код, навіть після виправлення, тому ретраї монотонно звужувались і сіріли.
**НЕ змержено:** потребує critic-only shadow-прогону на `ai-weekly-2026-07-27` (реальний
виклик OpenRouter, ~$0.30) — власник має підтвердити, що нова рубрика справді провалює
старий текст по voice/engagement, перш ніж це можна мержити.

---

## 2026-08-06 — Editorial quality overhaul, PR4: owner-set story angle

**Джерело:** продовження 7-PR плану (PR1–3 записи вище); перша точка «людина-в-циклі»
(~30–60 хв/випуск), яку власник обрав на опитуванні 2026-08-06

**Змінено:**
- `supabase/migrations/20260806140000_weekly_digest_story_directions.sql` — нова таблиця
  (написана, **не застосована** до живої БД)
- `src/lib/database.types.ts` — ручний тип для `weekly_digest_story_directions` (codegen
  неможливий, доки міграція не задеплоєна)
- `wiki/pipeline/weekly-digest.md` — секція PR4 + виправлено дублікат абзацу (залишок від
  вставки PR2/PR3 між старим текстом PR1)
- `wiki/pipeline/editorial-voice.md` — PR4 позначено вирішеним зі спрощенням (без AI-пропозицій)
- `wiki/now.md`, `wiki/index.md` (лічильник міграцій 65 → 66)

**Нотатка:** таблиця keyed by `brief_item_id` (не `revision_item_id`) — щоб кут подачі не
губився при кожному Save, який карбує нову ревізію (той самий урок з #177/#187). Спрощено
проти плану: research pack лишається 100% детермінованим (без LLM-викликів), тому AI-пропозиції
кута (2-3 варіанти на вибір) НЕ реалізовані — тільки вільний текст власника. Це і economy
рішення (не додавати платний LLM-виклик у надійний детермінований етап), і узгоджується з
принципом сесії «не витрачати гроші власника без питання» — згенеровані пропозиції довелося б
показувати без live-перевірки якості. `masterInputStories` і адмін-читання деградують до
порожньої мапи/масиву, якщо таблиця ще не задеплоєна — жодна сторінка не падає.

---

## 2026-08-06 — Editorial quality overhaul, PR5: reportage illustrations + variants

**Джерело:** продовження 7-PR плану (PR1–4 записи вище); друга точка «людина-в-циклі»
(вибір з варіантів + редагована сцена), яку власник обрав на опитуванні 2026-08-06

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — секція PR5, включно з відхиленням від початкового плану
  щодо зберігання варіантів (RPC не підтримує кілька `is_current` на один slot_key)
- `wiki/pipeline/editorial-voice.md` — PR5 позначено вирішеним, «не змержено»

**Нотатка:** `pipeline/card-image.ts` отримав повністю окремий шлях для weekly
(`weeklyReportageSceneBrief`/`buildWeeklyPrompt`/`generateWeeklyReportageIllustrations`) —
daily-пайплайн (`sceneBrief`/`buildPrompt`/`fillCardImages`) не чіпали, спільний лише
provider-ladder. Головний фікс: `buildWeeklyPrompt` вшиває avoid-list у позитивний промпт,
бо на дефолтному провайдері (FLUX.2 klein, multipart) окремий `negative_prompt` фізично не
надсилався — мертвий код, який показувався в адмінці, але ніколи не діяв. Дизайн зберігання
варіантів довелося переглянути після прочитання реального `save_weekly_digest_artifact` RPC:
план описував «3 артефакти в одному slot», але RPC демотує попередній `is_current` рядок при
кожному save — кілька одночасних is_current на один slot_key неможливі. Використано вже
наявний `content.preview_paths`/`preview_urls` механізм (той самий, яким PDF підписує превʼю
сторінок) замість нової архітектури — нуль нових DB-запитів у admin-data.ts.
**НЕ змержено:** потребує dry-run 9 klein-рендерів — власник має підтвердити, що модель
тримає репортажний стиль (не галюцинує чи не зісковзує назад у метафору), перш ніж це
можна вважати готовим.

---

## 2026-08-06 — Editorial quality overhaul: PR3 + PR5 live verification, critic vocab fix

**Джерело:** власник дав дозвіл запустити обидві відкладені live-перевірки (реальні платні
виклики OpenRouter + Cloudflare) замість чекати окремого рішення по кожній

**Змінено:**
- `src/lib/weekly-digest/editorial-llm.ts` — `criticPrompt` тепер задає закритий словник із
  6 кодів для non-factual issues (знайдено живим прогоном, критик вигадував власні коди)
- `src/lib/weekly-digest/content-studio.ts` — `REVISABLE_ISSUE_CODES` розширено цими 6 кодами
- `src/lib/weekly-digest/content-studio.test.ts` — тести на новий і старий (відхилений) словник
- `wiki/pipeline/weekly-digest.md` — результати обох live-перевірок у секціях PR3/PR5
- `wiki/now.md`

**Нотатка:** PR3 acceptance test **PASSED** — новий критик дав 73/100 (voice 68, naturalness 70)
на точно тому контенті, що раніше отримав 93/100, і самостійно процитував фрази з оригінальної
скарги власника («Обмеження полягає в тому, що…», «For product and security leaders…»). Рубрика
дискримінує за призначенням. PR5 dry-run дав 9 генуїнно фотореалістичних репортажних кадрів —
технічна перевірка пройдена, зображення надіслані власнику для фінальної візуальної оцінки;
одна самостійно помічена проблема — композиційна одноманітність між історіями (не хиба
регістру, радше брак сценарної різноманітності, вартий уваги в майбутньому тюнінгу
`weeklyReportageSceneBrief`). Скрипти верифікації — `tmp/pr3-shadow-critic/`,
`tmp/pr5-klein-dryrun/` (одноразові, за конвенцією директорії `tmp/` цього репо).

---

## 2026-08-04 — Weekly Social: preview assets + safe save/approve

**Джерело:** live fail Telegram Save & approve (`schedule_past`) + founder report
«бачу alt text, не бачу image»

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — нотатки Social tab (preview `asset_urls`, Destination URL,
  blockers, збереження provenance)
- `wiki/ops/social-cms-runbook.md` — Weekly Social tab notes
- `wiki/now.md` — поточний фокус на Social save/UX

**Нотатка:** ілюстрації вже були в БД; UI показував лише alt/JSON без превʼю.

## 2026-08-04 — Weekly admin runbook + Research next-step UX

**Джерело:** запит власника (незрозумілий gate: master queued після succeeded packs)

**Змінено:**

- `wiki/ops/weekly-admin-runbook.md` — **нова** покрокова інструкція адмінки
- `wiki/index.md` — рядок ops/weekly-admin-runbook
- `wiki/pipeline/weekly-digest.md` — лінк на runbook + Research UX note
- `wiki/now.md` — runbook як primary pointer для редакції

**Нотатка:** succeeded ≠ approved — головна пастка human research gate.

## 2026-08-04 — Vercel Fluid CPU: lazy imports + checkpoint-merge + admin prefetch

**Джерело:** live check Vercel dashboard 2026-08-04 (Fluid Active CPU 3h58m/4h Hobby, `ai-today-brief` = 99.8% акаунта)

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — новий розділ «Fluid CPU / вартість»: lazy `import()`
  для sharp/pdfkit/pdfjs-dist/canvas у `generation-worker.ts`, RPC-мерж замість overwrite
  для checkpoint editorial_master, `prefetch={false}` на admin weekly Links
- `wiki/now.md` — нова секція «Vercel Fluid CPU» з поточним статусом
- `wiki/index.md` — лічильник міграцій 62 → 63 (`20260804180000_weekly_digest_generation_job_output_merge.sql`)

**Нотатка:** міграція вже застосована в прод-Supabase. pdfkit Helvetica.afm ENOENT (окрема
підозра з тієї ж інвентаризації) виявився вже полагодженим PR #152 (24.07) — дій не було.
Content-hash caching для retry image/pdf-джобів розглянуто і відхилено: живого бага не
знайдено (`retryableGenerationFailure` вже коректно не ретраїть детерміновані помилки).

## 2026-08-04 — Master critic grounds on primary excerpts

**Джерело:** live fail `ai-weekly-2026-07-27` (`UNSUPPORTED_DETAIL` Python/Sage vs вузький claim set)

**Змінено:**

- `wiki/pipeline/weekly-digest.md` — evidence grounding: claims + primary excerpt (12k),
  studio `v2.1` / research `v3` / master `v4`
- `wiki/now.md` — після деплою: regen research packs → re-approve Top 3 → retry master

**Нотатка:** старі packs з 2.4k excerpt не містили mid-article деталей; потрібна перегенерація.

## 2026-08-04 — Preflight blockers: sectioned release path

**Джерело:** запит власника (порядок ворнінгів)

**Змінено:**

- `wiki/pipeline/weekly-digest.md` — preflight згруповано по Steps 1–8 (вкладки) з
  порядком усередині секції

**Нотатка:** порожні секції приховані; шлях зверху вниз = Stories→…→Video.

## 2026-08-04 — Preflight blockers: fix + tab links

**Джерело:** запит власника (UX Release preflight)

**Змінено:**

- `wiki/pipeline/weekly-digest.md` — Admin UX: actionable preflight (`fix` + лінк на вкладку;
  Master quality на Research)

**Нотатка:** `content_quality_report` не окремий upload — з’являється після Content Studio critic.

## 2026-08-04 — Dependabot #164 → #179 (safe patch/minor)

**Джерело:** live check #178/#179 CI; Playwright run 30899512987 (339 passed)

**Змінено:**

- `wiki/now.md` — #164 закрито, #179 змерджено; `main` = deps bump без pdfkit

**Нотатка:** recreate #164 не знадобився — Dependabot закрив групу після pdfkit ignore і відкрив #179 (12 updates).

---

## 2026-08-04 — Dependabot інфра (automerge + secrets + pdfkit ignore)

**Джерело:** live check PR #164 CI / `gh api .../dependabot/secrets`; план safe deps infra

**Змінено:**

- `.github/workflows/dependabot-automerge.yml` — прибрано `gh pr review --approve` (GITHUB_TOKEN не апрувить)
- `.github/dependabot.yml` — ignore `pdfkit` minor/major (окремий PR після PDF smoke)
- Dependabot secrets — `SCRAPPER_BASE_URL` + `SCRAPPER_BASE_ANON_KEY` (e2e на Dependabot PR)
- `wiki/ops/owner-checklist.md`, `wiki/now.md` — стан secrets / #164

**Нотатка:** без Dependabot copies e2e #164 падав на порожніх `NEXT_PUBLIC_SUPABASE_*`.

---

## 2026-08-04 — wiki:sync гейт (код ↔ специфікація)

**Джерело:** запит власника; live check після #177 wiki refresh

**Змінено:**

- `wiki/_meta/project-sync.json` — контракт watchers/facts/counts/index
- `wiki/_tools/lib/project-sync.mjs` + `wiki-project-sync.mjs` + `*.test.mjs`
- `package.json` — `wiki:sync`, `wiki:sync:test`, `wiki:check`; `pr:check` включає `wiki:check`
- `.cursor/rules/pr-gate.mdc`, `CLAUDE.md`, `wiki/architecture/agentic-workflow.md` — опис гейту
- `wiki/pipeline/weekly-digest.md` — формулювання `default $4` під fact-check

**Нотатка:** зміна коду під watcher без оновлення listed wiki-сторінок тепер валить `pr:check`.

---

## 2026-08-04 — актуалізація wiki під main + weekly stability

**Джерело:** live check `git log` / `gh pr list` / Supabase preflight 2026-08-04; PR #166–#177

**Змінено:**

- `wiki/now.md` — повне оновлення: `main`=#176, відкриті #177/#164, закрита docs→wiki,
  активна редакція `ai-weekly-2026-07-27`, owner/code next steps
- `wiki/pipeline/weekly-digest.md` — **нова** сторінка Content Studio v2 + revision stability
- `wiki/marketing/card-images.md` — FLUX.2 klein, no-text policy, multipart Node, costs
- `wiki/overview.md` §4 — FLUX.2, spend-cap, `generation_cost_events` / `/admin/costs`
- `wiki/open-questions.md` #2/#4 — ledger існує; критерій shadow→production ще відкритий
- `wiki/index.md` — `weekly-digest` ✅; ~62 міграції; дати live check

**Нотатка:** `now.md` від 2026-08-03 був застарілий (ще описував docs→wiki як активну роботу).

---

## 2026-08-03 — fix: Last updated + дрібні шляхи після ревʼю #166

**Джерело:** ревʼю PR #166

**Змінено:**

- усі 33 мігровані сторінки — `Last updated` перештамповано з contentful `git log --follow`
  (міграційні коміти пропущені); `Sources:` → `none (analysis)`
- `wiki/architecture/prototype-to-production.md` — історичний шлях `docs/STARTUP-PLAN.md` відновлено
- `wiki/strategy/master-roadmap.md`, marketing/pipeline посилання — старі імена файлів → поточні wiki-шляхи
- `wiki/ops/mcp.md` — лінк на reddit-compliance спростити до `./`
- коментарі e2e/sonar workflows: `docs/` → `wiki/`

**Нотатка:** виправляє п. 1–5 ревʼю #166 до мержу.

---

## 2026-08-03 — міграція docs/** → wiki/** · raw/ · artifacts/


**Джерело:** [ADR 2026-08-02](decisions/2026-08-02-knowledge-base-restructure.md) кроки 2–8;
гілка `chore/migrate-docs-to-wiki`

**Змінено:**

- `raw/db/2025-07a-supabase-mvp-migration.sql` — `git mv` з `docs/07a — Supabase MVP migration.sql`
- `raw/reference/prototypes/**` — `git mv` з `docs/reference/prototypes/`
- `artifacts/brand-kit/**` — `git mv` з `docs/marketing/brand-kit/`
- `artifacts/card-samples/**` — локальний (gitignore) переніс із `docs/marketing/card-samples/`
- 33 markdown-сторінки перенесено з `docs/` у тематичні розділи `wiki/` (strategy, architecture,
  pipeline, analytics, marketing, product, ops, audits) зі збереженням історії (`git mv`)
- шапки `Summary` / `Sources` / `Last updated` додано всім мігрованим сторінкам
- посилання `docs/…` переписано в `wiki/` · `raw/` · `artifacts/` у коді, конфігах і ядрі wiki
- `tsconfig.json`, `eslint.config.mjs`, `.vercelignore`, `sonar-project.properties`,
  `.gitignore`, `.cursor/rules/{00-core,pr-gate}.mdc`, workflows e2e/sonar — прибрано / оновлено
  згадки `docs/`
- `wiki/index.md`, `wiki/now.md`, `wiki/overview.md` — статуси ✅ після міграції
- `wiki/decisions/2026-08-02-knowledge-base-restructure.md` — статус: кроки 1–8 виконано
- папку `docs/` видалено (`git ls-files docs` → 0)

**Нотатка:** історичні згадки `docs/` у тексті ADR (команди `git mv`) залишено навмисно як
документацію плану. Зовнішні URL на `docs.claude.com` / `platform.claude.com` не чіпались.

---

## 2026-08-02 — bootstrap agentic-архітектури бази знань

**Джерело:** `WorkShop 23-25_07 Prompts. Personal.pdf` (поза репозиторієм, у Downloads власника) +
інвентаризація репозиторію (live check)

**Змінено:**

- `CLAUDE.md` — переписано з опису продукту на **системний контекст поведінки**: два режими
  (engineer / wiki-curator), мовна політика, карта зон, 10 жорстких правил, ingest workflow,
  question answering, lint, page format, citation rules, MCP-екосистема, сумісність із Knowledge
  Work Plugins. Бізнес-факти винесено звідси у `wiki/overview.md`.
- `AGENTS.md` — додано «Agent contract» для Codex/Cursor/Copilot поверх наявного
  `nextjs-agent-rules` блоку (блок збережено дослівно).
- `raw/` — створено скелет: `exports/`, `research/`, `scrapes/`, `db/`, `reference/`, `_local/` + `README.md`.
- `artifacts/` — створено з `README.md` і `_local/`.
- `wiki/index.md` — створено головний зміст + мапу міграції `docs/** → wiki/**`.
- `wiki/overview.md` — створено; зібрано бізнес-контекст, ринок, бюджетні обмеження, 8 жорстких
  обмежень, вузьке місце й розділ «Що НЕ спрацювало» (10 позицій) — усе з посиланнями на джерела.
- `wiki/now.md` — створено; стан `main` (`c4abe06`), відкритий PR #157, 5 останніх PR, 5 блокерів
  на власникові, 3 найближчі дії в коді.
- `wiki/log.md` — створено (цей файл).
- `wiki/open-questions.md` — створено; 7 відкритих питань, зокрема конфлікт GA4-property.
- `wiki/_meta/page-template.md` — створено шаблон сторінки.
- `wiki/architecture/agentic-workflow.md` — створено; опис самої системи.
- `wiki/ops/mcp.md` — створено; налаштування chrome-devtools / apify / supabase / ahrefs / vercel.
- `wiki/decisions/2026-08-02-knowledge-base-restructure.md` — створено ADR + покроковий план міграції.
- `wiki/_tools/wiki-lint.mjs` + `npm run wiki:lint` — лінтер формату сторінок, посилань і сирітства.
- `README.md` — переписано з дефолтного `create-next-app` на реальний вступ: чотири зони,
  команди, правило «ніколи не пушити в `main`».
- `.mcp.json` — створено (chrome-devtools + apify), обидва opt-in.
- `package.json` — додано скрипт `wiki:lint` (не входить у `pr:check`, щоб не міняти гейт).
- `.gitignore` — додано `raw/_local/*`, `artifacts/_local/*` із винятком для `.gitkeep`.
- `eslint.config.mjs`, `.prettierignore`, `.vercelignore`, `sonar-project.properties` — `raw/`,
  `wiki/`, `artifacts/` додано до ignore-списків (шар знань не проходить через code-гейти).
- `.github/workflows/e2e.yml`, `.github/workflows/sonarqube.yml` — `wiki/**`, `raw/**`,
  `artifacts/**` додано в `paths-ignore` (зміни в базі знань не запускають Playwright і Sonar).

**Нотатка:** фізичне перенесення 40+ файлів `docs/**` у `wiki/**` **не виконано** — це окремий
PR за планом у
[decisions/2026-08-02-knowledge-base-restructure](decisions/2026-08-02-knowledge-base-restructure.md),
щоб не змішувати створення каркасу з масовим `git mv` і переписуванням посилань.
Вихідний PDF воркшопу навмисно не скопійовано в `raw/research/` — рішення за власником
(файл особистий, репозиторій має remote на GitHub).

---

## 2026-08-09 — durable recovery для weekly master

**Джерело:** production Supabase + Actions run `31327537969` (live check 2026-08-09),
`src/lib/weekly-digest/generation-worker.ts`, `src/app/admin/(cms)/weekly/actions.ts`.

**Змінено:**

- `wiki/pipeline/weekly-digest.md` — описано checkpoint-resume без повторного EN/UK writer run
  та active-revision межу article artifacts;
- `wiki/pipeline/weekly-editorial-selection.md` — зафіксовано, що recovery не послаблює
  shortlist або fail-closed uniform-critic rule;
- `wiki/ops/weekly-admin-runbook.md` — додано відмінність **Resume saved master** від generic
  retry і порядок дій для failed master;
- `wiki/now.md`, `wiki/index.md` — поточний emergency recovery та мапу оновлено.

**Нотатка:** source job містив повний EN+UK checkpoint; фактичний failure був спробою записати
article artifact у неактивну quality-draft revision, яку DB навмисно відхиляє.

---

## 2026-08-09 — recovery PR відкрито

**Джерело:** draft PR [#208](https://github.com/sanchahous/ai-today-brief/pull/208).

**Змінено:** `wiki/now.md` та `wiki/index.md` тепер посилаються на відкритий draft PR.

---

## 2026-08-09 — `editorial_master` переписано на ітеративний рушій

**Джерело:** рішення власника 2026-08-09 (відмова від подальших точкових фіксів старої схеми),
`src/lib/weekly-digest/master-engine.ts`, `master-segments.ts`, `master-repair.ts`,
`editorial-llm.ts`, `generation-worker.ts`, `generation-control.ts`,
`pipeline/scripts/weekly-master-sandbox.ts`.

**Змінено:**

- **нова сторінка** `wiki/pipeline/weekly-master-engine.md` — сегментований запис (14 сегментів
  замість двох монолітів), точковий ремонт поля, безкоштовний детермінований раунд до критика,
  правило «якість ніколи не валить джобу», бюджети й прозорість стрічки;
- `wiki/pipeline/weekly-master-failures.md` — додано розділ про те, що з семи причин усунуто
  структурно, а не латкою;
- `wiki/pipeline/weekly-digest.md` — секцію master оновлено на новий рушій і три виходи джоби;
- `wiki/ops/weekly-sandbox.md` — `run` тепер пише `state.json` після кожного сегмента,
  доданий `--resume <dir>`;
- `wiki/ops/weekly-admin-runbook.md` — що робити з `needs_owner_review` і як читати
  **Resume saved master** з частковими сегментами;
- `wiki/now.md`, `wiki/index.md` — поточний стан і мапа.

**Нотатка:** редакційні гейти v7 і пороги якості не послаблені — перенесені в посегментні
промпти дослівно. Змінилась одиниця роботи (поле замість статті) і поведінка на провалі
(draft-ревізія на огляд власника замість `failed`), не планка.

---

## 2026-08-11 — Weekly image prompt review: semantic-story-v4

**Джерело:** owner request 2026-08-11, `pipeline/card-image.ts`,
`src/lib/weekly-digest/generation-worker.ts`, `src/lib/content-sim/vision-critic.ts`,
`src/lib/content-sim/adapters/weekly-image.ts`.

**Виявлено:** v3 втрачав або імітував story context у пʼяти місцях: fallback claims ішли як
`[object Object]`; `why_it_fits`, якого не бачив FLUX, міг виконати mechanism gate;
practical/limitation/takeaway/research risks не доходили до art director/critic; critic оцінював
власну essence без повного original story; repair `prompt_patches` дописувались уже після render.
Окремо кожен `dual_contrast` отримував hidden `facade versus backstage` bias.

**Змінено:**

- policy → `weekly-semantic-story-v4`: context → meaning → mechanism → consequence → visual thesis;
- metaphor schema → `story_anchor` / `visible_mechanism` / `visible_consequence`; deterministic
  gates бачать лише renderable FLUX fields;
- context-anchor gate відсікає topic-only metaphor без story actor/system; prose headline більше не
  стає однією required entity;
- reject усіх LLM pitches переходить у semantic fallback (visual thesis + context + mechanism +
  consequence), не generic spotlight; його literal component-label invitations санітизуються перед
  FLUX;
- worker передає approved research claims/context/risks + practical/limitation/takeaway;
- vision fail-closed gate: context/mechanism/consequence/instant comprehension, overall clamp за
  `semantic_min`; repair patch застосовується до наступного реального FLUX request;
- Visuals показує semantic contract і semantic score; оновлено card-images/content-sim/
  weekly-digest/weekly-selection/admin-runbook/sandbox/overview/now/index.

**Перевірено:** `npm run typecheck`; 103 targeted Vitest tests (`card-image`, content-sim loop,
weekly-image adapter, generation-worker); чотири live art-director + Cloudflare smoke-render
ітерації показали й закрили generic fallback, headline-as-entity, topic-only anchor і literal-label
failure modes. Окремий реальний FLUX → vision → repair → FLUX → vision прогін підтвердив:
semantic-вдалий кадр із псевдотекстом блокується як `readable_text`; repair доходить до наступного
render; красивий, але менш зрозумілий repair лишається failed за `ambiguous_visual_story` /
`missing_mechanism` / `missing_consequence`. Повний `npm run pr:check` пройшов (1 095 tests,
coverage/typecheck/lint/e2e/wiki/build).

---

## 2026-08-11 — Manual retry duplicate incident and idempotency guard

**Джерело:** owner incident report 2026-08-11; production Supabase queue snapshot; GitHub Actions
runs `31524340046`…`31524357383`;
`supabase/migrations/20260811185251_weekly_manual_retry_idempotency.sql`.

**Виявлено:** аварійний SQL-виклик `select (retry_rpc()).*` розгортав composite return і повторно
виконав volatile RPC для кожної з 32 колонок `weekly_digest_generation_jobs`. Це створило 32
linked retry children для одного failed `story_image`; safety poll забрав перші 10 у паралельні
GitHub runs, решта лишилась queued.

**Відновлено:** 22 queued duplicates скасовано до dispatch; дев'ять duplicate GitHub runs
скасовано і fenced у durable ledger; retry `7886cc88-30cf-4f83-a90a-7263c753a124` залишено
канонічним. Production snapshot після cleanup: 32 children = 31 cancelled + 1 active, active
duplicate groups = 0.

**Захищено:** migration `20260811185251` дедуплікує старі active children, додає partial unique
index на active `retry_of_job_id`, source-row lock і reuse live/succeeded child у retry RPC.
Production dry-run із rollback і повторним composite expansion не створив нових jobs; migration
застосована в production, guard index і нова function definition перевірені.

---

## 2026-08-11 — паралельний short-job fan-out Weekly Digest

**Джерело:** `src/lib/weekly-digest/generation-worker.ts`,
`src/lib/weekly-digest/generation-control.ts`, `src/lib/weekly-digest/orchestrator.ts`,
`src/app/api/internal/weekly/generate/route.ts`,
`supabase/migrations/20260809060929_weekly_generation_control_plane.sql`.

**Змінено:**

- `generation-worker.ts` — worker може обробляти claimed незалежні jobs паралельно; Vercel route
  свідомо лишається з claim=1 для short jobs, а 6–7 long story images dispatch-яться в окремі
  GitHub workers;
- `orchestrator.ts` і post-master fan-out — незалежні research/derivative jobs ставляться в чергу
  паралельно;
- `generation-control.ts` — додано bounded helper із збереженням порядку результатів і очікуванням
  усіх already-started tasks перед передаванням помилки;
- `pipeline/weekly-digest.md`, `index.md` — зафіксовано нову паралельність і межі, які лишаються
  послідовними через checkpoint/dependency contract.

**Нотатка:** quality та dependency gates не послаблено: `cover`, PDF і video manifest усе ще
стартують лише після готовності обов’язкових артефактів; `editorial_master` і поканальний
`social_copy` залишаються checkpoint-послідовними.

---

## 2026-08-11 — двораундовий illustration loop і прозорий spend

**Джерело:** owner audit Story 2/3/5/6 2026-08-11; production Supabase snapshot;
`pipeline/card-image.ts`, `src/lib/content-sim/config.ts`,
`src/lib/content-sim/adapters/weekly-image.ts`, `src/lib/content-sim/vision-critic.ts`,
`src/lib/weekly-digest/generation-worker.ts`, `src/lib/weekly-digest/admin-data.ts`,
`src/components/admin/weekly-workspace.tsx`.

**Виявлено:** максимальний successful cost поточного artifact був $0.175 (3 renders + 3 vision у
першому раунді, потім до чотирьох single-render repairs), але повторні manual regenerations
накопичили приблизно $3.173 recorded spend по active revision. Failed/cancelled provider work міг
не потрапити в ledger, бо aggregate cost писався лише після artifact save. Пізній single repair
перезаписував початкові три variants одним. Story 5 pneumatic tubes і Story 6 switchboard показали,
що high craft score не дорівнює зрозумілому news context. Окремий incident із 32 retry children
був process bug і вже закритий idempotency migration.

**Змінено:** hard cap 2 rounds; обидва раунди мають 3 variants; seed renders і vision reviews
паралельні. Три critiques агрегуються, а суцільний semantic fail примусово re-plan-ить метафору.
Opaque data-flow machinery блокується, human-centered scene budget дозволяє до двох character
stories, critic вимагає pixel evidence і headline-substitution test. Кожен image/vision provider
call тепер пишеться в cost ledger до artifact save; Visuals показує current run і cumulative story
revision spend з legacy-safe breakdown.

**Перевірено:** 96 targeted Vitest tests (`card-image`, content-sim loop, weekly-image adapter) і
`npm run typecheck` пройшли; окремі concurrency-тести доводять peak=3 для render і vision batch.
Повний Vitest: 113 files / 1 107 tests; ESLint — 0 errors (7 pre-existing warnings у чужих
файлах); `npm run wiki:check` — 0 errors / 0 warnings; `npm run e2e:check` і production
`next build` пройшли.

---

## 2026-08-11 — три незалежні концепції замість seed-варіацій

**Джерело:** owner follow-up про три різні візії на одну новину 2026-08-11;
`pipeline/card-image.ts`, `src/lib/content-sim/adapters/weekly-image.ts`,
`src/lib/weekly-digest/generation-worker.ts`, `src/app/admin/(cms)/weekly/actions.ts`,
`src/components/admin/weekly-workspace.tsx`.

**Виявлено:** три FLUX renders мали різні seeds, але ділили один scene brief і positive prompt,
тому давали косметичні варіації тієї самої візії. Це витрачало три image/vision calls без реальної
диверсифікації editorial hypothesis.

**Змінено:** policy bump → `weekly-semantic-story-v5`. Один factual semantic contract тепер
подається в three-seat concept jury. За один
structured LLM call jury повертає `literal_context`, `mechanism` і `consequence`; validator до
рендеру вимагає різні subject, `motif_class`, setting і physical action. Кожен concept має власні
scene/prompt/render/vision metadata. Owner-edited scene зберігається як concept 1, а дві альтернативи
плануються незалежно. `variant_concepts` зберігається aligned із файлами/scores; auto-pick і owner
promotion переносять scene/prompt/lens обраного concept. Visuals показує concept title/lens/scene.

**Перевірено:** targeted Vitest для concept lenses, окремих FLUX prompts, per-concept vision input
і auto-pick metadata alignment; повний `npm run pr:check` пройшов: 113 files / 1 109 tests,
coverage/typecheck/e2e/wiki/build зелені, ESLint — 0 errors (7 pre-existing warnings).

---

## 2026-08-12 — v5.1 concept-collapse repair

**Джерело:** owner production review Story 2/3/5 2026-08-12; GitHub worker logs
`31570121815`, `31570127047`, `31570130567`; Supabase artifact metadata;
`pipeline/card-image.ts`, `src/lib/content-sim/adapters/weekly-image.ts`,
`src/lib/weekly-digest/generation-worker.ts`.

**Виявлено:** jury реально повертав різні motifs, але planning validator відкидав їх через
literal `story_anchor`/semantic token mismatch. Після двох спроб fallback створював однакову
семантичну форму для всіх lens. Додатково critic `sceneOverride` і його prompt patches ставали
спільним наступним FLUX prompt, тому production показав три typewriters/cars/hands.

**Змінено:** `weekly-semantic-story-v5.1` розділяє planning gates: structural duplication,
opaque abstraction, banned UI/clichés лишаються blockers; semantic mismatch стає advisory для
paid vision. При `rejectMetaphor` critic direction і patches ідуть у concept jury як feedback,
але не копіюються в усі три renders. Додані regression tests для variant prompts, critic feedback
і production-shaped three-pitch planning.
## 2026-08-13 — Experimental Visual Affordance V10 owner local repairs

**Джерело:** owner review 2026-08-13; `src/lib/weekly-digest/visual-affordance-treatment-v10.ts`;
`experiments/visual-affordance-v10/targeted-v6-owner-outcome-repair/results/evaluation-report.md`.

**Змінено:** в isolated experimental branch Gemini отримав два різні code artifacts; Claude —
лінійний cache → split → BOUNDED 1/2/3 потік і MONITOR для кожної bounded session; Deep Work —
чіткий зв'язок device hint → людська дія → фініш задачі.

**Перевірено:** targeted V6: V10 3/3 hard visual integrity, 3/3 headline grounded, blind preference
3 V10 / 0 V8 / 0 ties. Це не production approval: `main`, production visuals і Supabase не змінені;
фінальний owner verdict залишається окремим гейтом.

---

---

## 2026-08-12 — reviewable illustration render history

**Джерело:** owner request 2026-08-12; `src/lib/content-sim/adapters/weekly-image.ts`,
`src/lib/weekly-digest/generation-worker.ts`, `src/lib/weekly-digest/admin-data.ts`,
`src/components/admin/weekly-workspace.tsx`, `src/app/admin/(cms)/weekly/actions.ts`.

**Змінено:** кожен фактично згенерований buffer із кожного repair round зберігається у private
storage з round/variant/concept/score labels і доступний у Visuals до approval. Approve прибирає
review-only files та gallery metadata, залишаючи selected primary; artifact/review rows
залишаються для audit.
## 2026-08-17 — GitHub Actions dispatch 503 не ламає CMS

**Джерело:** Vercel production runtime error `2087663833` (2026-08-17 15:37 UTC), production
`weekly_digest_generation_jobs`, `src/lib/weekly-digest/github-dispatch.ts`.

**Виявлено:** після створення linked `social_copy` retry GitHub Actions повернув HTTP 503. Job
вже був durable `dispatching`, але server action пробросила відповідь API як Server Components
render error, тому mobile CMS показала opaque React #441 і повторний клік міг створити ризик
дублювання.

**Змінено:** dispatcher робить до трьох коротких повторних спроб для 408/429/5xx і transport
errors. Коли підтвердження так і не надійшло, зберігає fenced lease для штатного database
recovery та повертає UI без RSC crash; non-transient 4xx/configuration errors не замовчуються.

**Перевірено:** `github-dispatch.test.ts` — 7/7, включно з 503 → success та exhausted-503
класифікацією.

---

## 2026-08-18 — PDF weekly digest: фіксована сітка замість потоку, 7 сторінок

**Джерело:** owner review прод-PDF `Випуск 4` (2026-08-09 — 2026-08-15), скріншоти сторінок
1-3; `src/lib/weekly-digest/pdf.ts`, `src/lib/weekly-digest/pdf.test.ts`,
`src/lib/weekly-digest/generation-worker.ts`.

**Виявлено:** три з п'яти зауважень власника мали спільний корінь — обкладинка малювалася
потоком, а прод-заголовок (116 симв.) і standfirst (1018 симв.) переповнювали сторінку. PDFKit
додавав сторінку-переповнення без фону, і блок вихідних даних (`Issue 4`, тиждень,
`aitodaybrief.com` світлим кольором) друкувався світлим по білому на майже порожній сторінці 2.
Наїзд на футер — окремий дефект: `ensureSpace()` резервував фіксовані 120 pt під `infoPanel()`,
чия реальна висота залежала від тексту. 14 сторінок — бо кожна feature-історія текла через
розриви (зображення + ~4200 симв. body + 4 повноширинні панелі).

**Змінено:** renderer переписано на фіксовану сітку (`pdfkit-weekly-v3`): явні `y`/`height`/
`ellipsis` на кожен регіон, обрізання по межі речення (`trimToFit`), авто-підбір кегля
заголовка, кроп зображень через `sharp` `fit: 'cover'`, затемнення обкладинки запікається в
картинку. Feature = рівно одна сторінка (лід + зображення + 2×2 панелі); сирий `body` лишається
вебверсії, куди ведуть «Повна версія» і QR. Футер: `Page n of N` / `Стор. n з N`. Контракт
сторінок 10-16 → **6-8**. Зміст клікабельний: номер цільової сторінки праворуч у кожному рядку
плюс GoTo-анотація на весь рядок; цілі — named destinations `story-{rank}`, номери й переходи
беруться з одного детермінованого плану (`planAnchors`).

**Перевірено:** прод-розмірний випуск рендериться у 7 сторінок в обох локалях (візуальний огляд
усіх растрів); `pdf.test.ts` 13/13 з новими гардами — page count, cover-блок на сторінці 1,
жодного тексту нижче лінії футера, форма пагінації, цілі переходів змісту; `weekly-digest` suite 472/472; typecheck,
lint і `wiki:check` зелені.

---

## 2026-08-21 — Omni-channel publishing matrix

**Джерело:** запит власника на систему шаблонів верстки weekly digest під соцмережі;
заземлення — `src/lib/social/quality.ts` (`CHANNEL_RULES`), `src/lib/social/providers.ts`,
`src/lib/social/instagram-carousel.ts`, `src/lib/weekly-digest/social-adapter.ts`,
`src/lib/weekly-digest/preflight.ts`, ручний реліз `ai-weekly-2026-08-09` 2026-08-20.

**Зміни:**
- нова сторінка [marketing/omni-channel-publishing-matrix](marketing/omni-channel-publishing-matrix.md):
  8 блоків-примітивів (`HOOK`…`TAGS`) з фіксованим порядком і розкладкою по 6 каналах;
  таблиця жорстких лімітів, узятих з коду, а не з загальних порад; матриці розміщення лінка
  й хештегів; готові адаптації базового тексту в продакшн-локалі кожного каналу
  (UK для Telegram/Facebook/Threads, EN для X/LinkedIn/Instagram); pre-publish чек-лист на 7 секцій;
- `wiki/index.md` — рядок у секції Marketing.

**Конформанс-знахідки (ТЗ проти коду, §7 сторінки):** 6 правил редакційного ТЗ не виконуються
поточним гейтом — LinkedIn вимагає рівно 1 URL у тілі замість лінка в 1-му коментарі
(`rootUrlStrategy: 'one'`); зразок ТЗ має 4 емодзі при `linkedin.maxEmoji: 3`; X забороняє URL
у root; Instagram фіксований на 7 слайдах і ≤5 хештегах у caption (ТЗ просив 3–4 слайди і 5–8
хештегів); Threads вимагає 3–5 частин, а не один пост; Markdown не рендериться в жодному каналі,
Telegram-провайдер шле текст без `parse_mode`. Шаблони написані під поточний код і публікуються
без змін; розбіжності зафіксовані як відкриті питання, не як зроблене.

---


## 2026-08-21 — Розбір релізу 20.08 і фікс «сухої» подачі

**Джерело:** шість зауважень власника до першого ручного релізу `ai-weekly-2026-08-09`
плюс редакційна критика («пости сухі, не видно користі для читача»); перевірка —
прод-`social_posts` package `612df95c`, `weekly_digest_revision_items`,
`social_click_events`, live check 2026-08-21.

**Що показала перевірка (не скріншоти, а БД):**
- LinkedIn `post_text` = 996 символів і **0 переносів рядка** — полотно згенерував пайплайн;
- Telegram = 1495 символів, 9 переносів, **0 порожніх рядків** — блоки злипались;
- Threads мав у базі **правильні 4 `content_parts`** з URL в останній — один пост без
  ланцюжка був помилкою ручного постингу, не пайплайна;
- X root без лінка — за контрактом правильно; дефект у тому, що в self-reply пішов голий URL;
- Facebook порожня OG-картка: `/r/s/[token]` віддавав 302 з `no-store`, крізь який скрапер
  Facebook не резолвить Open Graph;
- той самий корінь дав **34 бот-кліки проти 8 живих** у `social_click_events` (81% сміття).

**Корінь «сухості» знайдено і він не стилістичний.** У всіх 7 історій випуску заповнені
`practical_en` (107–269 символів) і `takeaway_en` — конкретика рівня «забрати чекпоінт з
Hugging Face, підняти через vLLM, reasoning=low, але без GB300 NVLink заявленої пропускної
здатності не буде». `buildWeeklySocialFactSnapshot` **уже передавав ці поля письменнику**.
Промпт їх ніколи не просив: він складався майже виключно із заборон, а критик оцінював
факти, платформу й оригінальність — корисність не оцінював ніхто. Це повторення раніше
зафіксованого фідбеку власника про асиметрію «лише заборони» → канцелярит.

**Зміни в коді (гілка `claude/weekly-digest-release-aug-fcfe9c`):**
- `social-adapter.ts` → `CHANNEL_CONTRACT`: вимоги верстки (порожній рядок між блоками; для
  LinkedIn — одне речення на рядок) і обовʼязковий блок практики в усіх 6 каналах. Контракт
  підставляється і в промпт письменника, і в промпт критика, тому критик аудитує практику
  під `platformFlags` без зміни парсера чи схеми `quality_report`;
- `social-adapter.ts` → промпт письменника: новий блок `WHAT THIS COPY MUST GIVE THE READER`
  — перша позитивна вимога (назва інструменту + крок + ціна/ліміт) із прямою вказівкою
  будувати копію на `practical_*`;
- `src/app/r/s/[token]/route.ts`: боти отримують 200 HTML з `canonical`/`og:url` замість
  302 `no-store`, і бот-звернення більше не пишеться в `social_click_events`.

**Зміни у wiki:** [marketing/omni-channel-publishing-matrix](marketing/omni-channel-publishing-matrix.md)
перероблено — новий примітив `USE` (назва + крок + ціна/ліміт) як обовʼязковий у кожному
каналі, розділ розбору релізу, усі 6 адаптацій переписані з практикою й реальною версткою.
Заміри: LinkedIn 14 порожніх рядків проти 0 у релізі, Telegram 9 проти 0.

**Перевірено:** `tsc --noEmit` exit 0; targeted vitest (social-adapter, quality,
instagram-carousel) 26/26; `wiki:check` exit 0. **Не перевірено наживо:** поведінка скрапера
Facebook на новому `/r/s/` — після деплою прогнати через Facebook Sharing Debugger.

---


## 2026-08-21 — Відео на початку, «взяти в роботу», Telegram parse_mode, LinkedIn-коментар

**Джерело:** чотири рішення власника після розбору релізу 20.08.

**1. Рівень випуску на сторінці.** Новий `src/components/weekly/weekly-action-board.tsx` —
блок «Що взяти в роботу цього тижня» одразу під героєм: до 5 дій із `practicalExample`
кожної історії, кожна з якорем `#story-{rank}`. Нічого не генерується: копія — це вже
схвалене поле історії, яке доти можна було знайти лише прочитавши весь випуск. Логіку
відбору винесено в чисту `weeklyActionItems` і покрито тестами (фільтр порожніх, стеля 5).

**2. Відео перенесено з кінця статті на початок** колонки контенту, перед блоком дій.
JSON-LD `VideoObject` не змінювався.

**3. Telegram parse_mode.** Новий `src/lib/social/telegram-format.ts`: спершу екранування
`&<>`, потім промоція закритого whitelist — `**bold**` → `<b>`, `` `code` `` → `<code>`,
fenced-блок → `<pre>`. MarkdownV2 свідомо відкинуто: він вимагає екранувати 15 символів
будь-де в копії, і один пропущений валить усе повідомлення на публікації; HTML має три
зарезервовані символи, які екрануються до промоції, тож модель не може внести непідтриманий
тег. `telegramRenderedLength` рахує довжину так, як її рахує Telegram після парсингу
ентіті — це те, до чого застосовуються стелі 1024 (підпис) і 4096 (повідомлення).
Гейт отримав `raw_markup`: ті самі маркери **заборонені в решті пʼяти каналів**, де вони
друкуються сирими.

**4. LinkedIn: лінк у 1-му коментарі.** `CHANNEL_RULES.linkedin.rootUrlStrategy` `'one'` →
`'none'`, нове блокування `linkedin_comment_url`, `validate()` вимагає `firstComment`, а
`LinkedInPublisher.publish` після поста викликає `/rest/socialActions/{urn}/comments`. Збій
коментаря = `partial_linkedin_comment` (`ambiguous`) — пост уже живий, тож ретрай його
дублював би; шлях той самий, що для невдалого X self-reply.

**Перевірено:** `tsc --noEmit` чисто; `eslint` на всіх змінених зонах 0 помилок 0 попереджень;
vitest по `src/lib/social`, `src/lib/weekly-digest`, `src/components` — **592/592** (нові:
6 на telegram-format, 3 на відбір дій, 3 на LinkedIn-коментар і його часткові збої);
`wiki:lint` 0 error. **Не перевірено:** візуальна розкладка сторінки випуску — `next dev`
у цьому worktree падає через відомий subst-drive глюк (шлях потроюється), не повʼязаний зі
змінами; дивитись на Vercel preview. Так само лишається неперевіреним скрапер Facebook на
новому `/r/s/` — Sharing Debugger після деплою.

---


## 2026-08-21 — Прод-правка LinkedIn-рядка під нову політику лінка

**Причина:** після переходу `linkedin.rootUrlStrategy` на `'none'` уже запланований на
24.08 LinkedIn-пост пакета `612df95c` став невалідним — URL стояв у тілі, а `first_comment`
був порожній. Поки канал вимкнений і акаунта немає, це не спрацювало б, але одразу після
підключення LinkedIn пост упав би назавжди (`invalid_reply`, `permanent`).

**Зроблено (прод-Supabase `mdiqfatpqczwqghwttpm`, service_role, за рішенням власника):**
трекований URL прибрано з хвоста `post_text` і перенесено у `first_comment` як
`Full weekly digest: https://aitodaybrief.com/r/s/<tracking_token>`.

**Наслідок, який дав сам гард:** `guard_social_content_approval` відпрацював як задумано —
`content_version` 3 → 4, `content_hash` обнулено, апрув відкликано, статус `scheduled` →
**`in_review`**. Тобто змінений пост не буде опублікований, доки власник не перегляне і не
апрувне його заново — саме та поведінка, яку описує runbook для правки копії після апруву.
Тіло: 996 → 930 символів, 0 URL, 2 хештеги. Інші пʼять рядків не чіпались; розмітки
(`**`, backticks) немає в жодному, тож нове блокування `raw_markup` нічого не ламає.

---

## 2026-08-24 — Закрито RPC-поверхню weekly refresh і hot path daily analytics

**Джерело:** production Supabase Security Advisor після rollout PR #320.

`invalidate_weekly_visual_refresh_staged_assets()` є внутрішньою `SECURITY DEFINER`
trigger-функцією: її викликає лише trigger зміни visual direction, а не HTTP RPC.
`machine_attest_weekly_digest_artifact()` змінює review state лише від `service_role`, але
після перестворення функції теж успадкувала PostgreSQL `PUBLIC EXECUTE`. Міграція
`20260824180000_revoke_weekly_visual_refresh_trigger_execute.sql` відкликає зайві grants для
обох функцій; attester отримує вузький `service_role EXECUTE`, а trigger не має API-grant.
Це прибирає непотрібну публічну RPC-поверхню без зміни редакційного потоку.

Окрема міграція `20260824181000_daily_visual_publication_set_index.sql` додає унікальний
індекс для одного public projection на frozen daily visual set. Він прибирає `Seq Scan` у
гарячому lookup endpoint аналітики daily і водночас фіксує на рівні БД уже наявний контракт
даних. Решту рекомендацій індексатора не додавали: перевірка production query plans не
показала для них hot path. (source: Supabase Security + Performance Advisor live checks
2026-08-24; `supabase/migrations/20260824180000_revoke_weekly_visual_refresh_trigger_execute.sql`;
`supabase/migrations/20260824181000_daily_visual_publication_set_index.sql`)

---

## 2026-08-24 — Vercel: знайдено джерело Fast Origin Transfer

Vercel попередив про 100% ліміту Fast Origin Transfer (10 ГБ) з ризиком авто-паузи. Живий
замір заголовків показав, що /en/news (343 КБ) і /uk/news (390 КБ) — єдині маршрути з
`x-vercel-cache: MISS` на кожен запит, тоді як усі інші хаби, item-сторінки й головна дають HIT.
Причина: сторінка робить `await searchParams`, а це runtime API Next 16 — маршрут стає
динамічним і `revalidate = 3600` ігнорується.

Зроблено: CDN-кеш `s-maxage=300, stale-while-revalidate=3600` для `/:lang(en|uk)/news`,
коротша драбина `deviceSizes`/`imageSizes` (40 КБ з 343 КБ припадало на `srcSet`; рунг 1200
збережено, бо heroes мають слот 1160 px), і `sitemap.xml` з 1 год на 6 год (1316 URL, 943 КБ,
~22 МБ/добу origin transfer). Попередження про Image Optimization — залишок квоти, вигорілої до
14.08: у HTML прода нуль входжень `/_next/image`, трансформацій ми більше не робимо.

Свідомо не чіпали клієнтський payload на 100 items: після кешування він майже не впливає на
білінг, це окрема CWV-задача. (source: листи Vercel 2026-08-24; live check 2026-08-24;
[vercel-origin-transfer](ops/vercel-origin-transfer.md); `next.config.ts`; `src/app/sitemap.ts`)
## 2026-08-24 — Daily visual: bounded dynamic OpenRouter image route

Daily renderer більше не залежить від окремого `OPENAI_API_KEY`: він використовує вже наявний
`OPEN_ROUTER_API_KEY` і dedicated Image API. До першого paid render worker зберігає приватний
route snapshot з конкретними model, provider endpoint, 16:9 resolution і fixed endpoint price;
retry читає саме цей snapshot, а не поточний catalog.

Новий eligible stable Pro Seedream/Qwen release може пройти як canary primary лише через existing
semantic QA; Lite не є automatic upgrade. Якщо canary не рендериться або не проходить, repair
використовує frozen champion; якщо repair активувався, невдалий canary не перезапускається щодня.
Ціна без `variant` трактується як base tier endpoint, а не як ціна будь-якої resolution, тому
вищий tier без іменованого variant не проходить у route. Catalog outage, зниклий champion, один
route або незафіксована додаткова ціна тепер fail-closed,
без hard-coded paid fallback. `provider.max_price.image` блокує request до dispatch при зміні ціни,
а `usage.cost` completed response комітиться точно лише коли він не перевищує frozen price та
reservation; інакше candidate лишається private. Retry не обійде цей gate після crash: existing
bytes мусять мати committed exact reservation. Routine fallback established champion не змінює
global champion; лише canary pass/rollback впливає на наступний route. (source: owner decision
2026-08-24;
[OpenRouter Image Generation API](https://openrouter.ai/docs/guides/overview/multimodal/image-generation);
 [OpenRouter Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection);
`pipeline/daily-visual-openrouter.ts`; `pipeline/daily-visual-finalizer.ts`)

---

## 2026-08-24 — Daily visual: crash-safe duplicate reservation quarantine

Повторний worker, який бачить exact `reservation_exists`, не може ані повторно відправити paid
provider request, ані назавжди залишити slot у generic `reserved`: він атомарно переводить його в
`held_for_reconcile`. Якщо race означає, що інший worker уже settle-нув row, повтор однаково
зупиняється на manual choice без render. Це консервативно зберігає потенційну вартість у $5 ledger
до owner reconciliation, замість допускати непідтверджений другий charge. Regression test покриває
обидва outcomes SQL row lock (`true` і already-settled `false`). (source:
`pipeline/daily-visual-finalizer.ts`; `pipeline/daily-visual-finalizer.test.ts`;
`supabase/migrations/20260824100000_daily_visual_workflow.sql`)

---

## 2026-08-24 — Vercel: заголовок кешу не спрацював, /news переведено на статику

Фікс із попереднього запису (Cache-Control через headers()) **на проді не працює**: /en/news далі
віддавав private, no-cache, no-store і X-Vercel-Cache: MISS. Next перекриває цей заголовок для
динамічно відрендереного маршруту. Мертве правило прибрано.

Справжній фікс: /[lang]/news більше не читає searchParams і став prerendered (build-маркер
● SSG замість ƒ Dynamic, Cache-Control: s-maxage=3600, x-nextjs-prerender: 1), а пошук переїхав
на власний динамічний маршрут /[lang]/news/search — noindex, follow, канонікал на /news, ті самі
server-side результати. Усі 9 внутрішніх ?q=-посилань переведено, старі ловить 308-редірект.
Перевірено на локальному production-білді: хаб віддає 13 карток і 100 посилань у HTML, пошук
дає 68 результатів на «cursor», перехід за trending-посиланням і повторний пошук працюють.

Записано також три способи лишити ?q= на статичному хабі, які НЕ працюють у prod-білді
(Suspense з тим самим компонентом у fallback, React-контекст, читання window.location.search),
щоб наступного разу не заходити на це коло. Штатний механізм — Cache Components, окрема
міграція. Скорочення стрічки 100 → 40 заміряно (−21% en / −24% uk) і визнано непотрібним після
переходу на статику. (source: live check прода 2026-08-24; production-білд локально;
[vercel-origin-transfer](ops/vercel-origin-transfer.md); next.config.ts;
src/app/[lang]/news/search/page.tsx)

---

## 2026-08-24 — Vercel: фікс origin transfer підтверджено на проді

Після мержу #325 перевірено на живому Vercel, а не лише на локальному білді: /en/news віддає
X-Vercel-Cache: PRERENDER на першому запиті й HIT на повторному, /uk/news — PRERENDER,
Cache-Control більше не private/no-store. /en/news?q=cursor дає 308 на /en/news/search?q=cursor,
сама сторінка пошуку — 200 з noindex, follow, канонікалом на хаб і робочими результатами.
Вміст хабу в HTML не постраждав: 13 карток і 100 посилань. Клік по trending-посиланню з хабу
soft-навігує на /news/search і дає 80 результатів.

Тобто дві найважчі сторінки сайту більше не доходять до origin на кожен запит — причина
вичерпання Fast Origin Transfer усунена. Скільки це дасть у ГБ, буде видно на наступному циклі
білінгу. (source: live check прода 2026-08-24 після деплою #325;
[vercel-origin-transfer](ops/vercel-origin-transfer.md))

---
