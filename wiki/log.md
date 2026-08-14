# Log — журнал операцій

Summary: append-only журнал усіх операцій над базою знань. Нові записи додаються **зверху**,
під заголовком. Старі записи ніколи не редагуються і не видаляються — помилку виправляє новий
запис із поміткою «коригує запис від …».
Sources: самозаписи агента
Last updated: 2026-08-14

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
