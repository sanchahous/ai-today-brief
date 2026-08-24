# Content Simulation & Backtest

Summary: універсальний harness симуляції контенту (daily + weekly + images): generate →
batch critic → один decisive re-plan → pass або human review з escalation; weekly release
гейтиться цим.
Sources: `src/lib/content-sim/`, `pipeline/providers/vision.ts`, `pipeline/scripts/content-sim.ts`,
`.github/workflows/content-sim.yml`, план Content Sim Backtest 2026-08-11,
owner prompt review + `weekly-semantic-story-v6` Prompt-as-Code follow-up 2026-08-23,
weekly illustration M2 post-upload QA 2026-08-15
Last updated: 2026-08-23

---

## Навіщо

Зміни промптів, image policy і weekly master раніше перевірялись лише живим прод-прогоном.
Content Sim дає **офлайн / shadow** прогін на фікстурах і **обовʼязковий vision loop** для
weekly story images перед релізом.

## Архітектура

| Шар | Шлях | Роль |
|---|---|---|
| Ядро | `src/lib/content-sim/` | типи, `runRepairLoop`, escalation, deterministic image gates, vision critic parse |
| Vision I/O | `pipeline/providers/vision.ts` | `generateWithVision` (Gemini → OpenRouter); roles `weekly.image_critic` / `daily.image_critic` |
| Weekly images (prod) | `generation-worker.ts` → `adapters/weekly-image.ts` | FLUX generate + максимум 2 раунди; metadata `content_sim` |
| CLI | `npm run content-sim` | `capture` / `run` / `gates` / `hypothesis` |
| Release gate | `preflight.ts` code `simulation_not_passed` | блок без pass або human override |
| Admin | Visuals ArtifactCard | escalation panel + Approve записує `human_override` |
| Post-upload QA (M2) | `uploadWeeklyArtifactAction` → `buildImageOnlyCriticPrompt` | advisory `metadata.post_upload_qa`; **не** пише `content_sim`, реліз не блокує |

Adapters: `weekly-master` (делегує `weekly:sandbox`), `weekly-image`, `daily-brief`, `daily-image`.
(source: `src/lib/content-sim/`, `pipeline/scripts/content-sim.ts`)

**Поточний production contract (2026-08-23):** `generation-worker` передає в weekly `render`
`variantCount: 1`. Тобто кожен раунд створює один primary candidate; vision rejection повертає
repair brief наступного раунду, а не вибирає «найкращу» картинку з трьох. Описані нижче batch/three-
concept механізми лишаються здатністю offline harness і читанням історичних artifacts, не
owner-facing production UX. (source: `src/lib/weekly-digest/generation-worker.ts`; owner session
2026-08-23)

## Image loop

1. Deterministic (розмір / aspect / bytes) — безкоштовно.
2. **Per-concept vision** (weekly): art director спершу формує один factual semantic contract,
   а потім одним structured jury call повертає до **3 незалежних концепцій**: literal context
   (хто/що змінилось), mechanism (як це працює), consequence (користь/шкода/trade-off/
   uncertainty). Це не три seed-відхилення одного кадру: validator вимагає різні subject,
   `motif_class`, setting і physical action; camera/color/seed/scale не зараховуються як нова
   концепція. Кожен концепт отримує власні scene/prompt/render/vision; три renders і три
   vision-виклики йдуть паралельно, але порядок та `variant_concepts` зберігаються. Це також
   прибирає дефект, коли фінальний repair перезаписував першу трійку одним кадром.
   primary = найвищий overall без blockers (`pickBestVariantIndex`); scores у
   `metadata.variant_scores`. При тиску `CONTENT_SIM_MAX_IMAGE_SPEND_USD` — vision лише на
   top-1 за heuristic (розмір буфера), інші `budget_skip`.
3. Vision critic JSON (пороги: overall ≥ `CONTENT_SIM_SCORE_THRESHOLD`, default **80**,
   **і** `news_legibility` ≥ max(75, threshold)). Для weekly v4 додатково кожен із
   `context_fidelity`, `mechanism_legibility`, `consequence_legibility`,
   `instant_comprehension` мусить пройти той самий floor; overall clamp-иться до
   `semantic_min + 5`. Critic отримує original summary/why/practical/limitation/takeaway/claims
   як authority, а generated semantic contract — як hypothesis для перевірки. Blockers включають:
   `impossible_orientation`, `prop_use_mismatch`, `decorative_second_beat`, `sibling_echo`,
   editorial fidelity **`missing_context` / `missing_mechanism` / `missing_consequence` /
   `ambiguous_visual_story` / `off_news`**, **`opaque_abstraction`** (generic tubes/canisters/
   switchboards/data-flow machinery) і **`melted_motion`** (smeared/blur artifacts). Для pass
   critic також мусить назвати видимі pixel-evidence для context/mechanism/consequence/headline
   pairing; самих високих чисел без доказів недостатньо (`semantic_evidence_missing`).
   Якщо vision повертає prose замість
   JSON — **`critic_parse_error`** (soft-fail → repair/retry), а не hard-fail усієї
   `story_image` джоби.
4. Три critiques агрегуються в одне batch-рішення. Якщо всі три семантично невдалі, другий раунд
   **відкидає метафору й заново планує сцену**, а не робить seed roulette того самого задуму.
   Structural blockers (sibling echo, opaque abstraction, banned UI/clichés) відхиляють pitch до
   render; semantic token mismatch лишається advisory, бо vision має перевірити, чи метафора читається
   в pixels. Critic `sceneOverride` і prompt patches при `rejectMetaphor` передаються в новий jury як
   feedback, але не копіюються в усі три FLUX prompts — це запобігає collapse до одного motif.
   Non-reject prompt patches можуть потрапити в наступний FLUX request.
5. Максимум **2 раунди**: initial batch + один decisive re-plan. Код hard-cap-ить старе env
   `CONTENT_SIM_MAX_IMAGE_REPAIR=5` до 2; default spend cap — **$0.20**.
6. Fail → `needs_human_review` + escalation (blockers + suggested actions). Джоба **не** валиться.
(source: `pipeline/card-image.ts`, `src/lib/content-sim/loop.ts`, `config.ts`,
`adapters/weekly-image.ts`, `vision-critic.ts`)

Owner Approve на failed sim ставить `metadata.content_sim.human_override=true` і знімає
`simulation_not_passed`. Promote alternate у Visuals ставить `pick_source=owner` і переносить
scene/prompt/lens саме обраного запису `variant_concepts`, а не metadata попереднього primary.
(source: `src/app/admin/(cms)/weekly/actions.ts`, `preflight.ts`)

Кожен успішний image render і vision call записується в `generation_cost_events` одразу після
provider-виклику, ще до збереження фінального artifact. Тому ledger бачить витрати failed/
interrupted jobs; Visuals окремо показує current run cost і накопичений Story revision spend із
render/vision split. Старі aggregate events показуються окремо як legacy, без неправдивого split.
(source: `src/lib/weekly-digest/generation-worker.ts`, `src/lib/weekly-digest/admin-data.ts`,
`src/components/admin/weekly-workspace.tsx`)

**Policy default (2026-08-23):** vision critic і weekly-image fixture без явного
`policyId` підставляють **`weekly-semantic-story-v6`**. Планування seats і copy-ready
збір — [image-prompt-library](image-prompt-library.md); цей harness як і раніше
оцінює пікселі, не пише промпт.
(source: `src/lib/content-sim/vision-critic.ts`, `adapters/weekly-image-fixture.ts`)

## CLI

```bash
npm run content-sim -- capture --adapter weekly-master --digest <uuid>
npm run content-sim -- capture --adapter daily-brief --brief <slug>
npm run content-sim -- run --adapter weekly-image --fixture path/to/fixture.json
npm run content-sim -- gates --run artifacts/_local/content-sim/<run>
npm run content-sim -- hypothesis --baseline quality.json --run artifacts/_local/content-sim/<run>
```

Артефакти: `artifacts/_local/content-sim/` (gitignored). Фікстури daily: `raw/_local/content-sim/`.

## CI

`.github/workflows/content-sim.yml` — **не** частина `pr:check`. Запуск: `workflow_dispatch`
або label `run-content-sim` на PR.

## Env

Див. `.env.example` секцію Content simulation (`CONTENT_SIM_*`).
`CONTENT_SIM_IMAGE_LOOP=off` вимикає vision loop (один generate без critic).

**M2 post-upload (superseded 2026-08-23):** ручний upload cover запускає один image-only critic.
Ручний `story_image` після clean pixels запускає другий story-aware critic з headline, approved
story fields (включно з counterweight), semantic contract і primary scene; semantic failure —
advisory warning, не auto-repair і не release blocker. Це не `content_sim` і не
`simulation_not_passed`; але missing story-aware pass або active QA blocker fail-closed для
machine attestation. Critic також відсікає mascot/cute humanoid robots, якщо робот не є буквальним
предметом новини. (source: `src/lib/weekly-digest/run-post-upload-qa.ts`; `src/lib/weekly-digest/post-upload-qa.ts`; `src/app/admin/(cms)/weekly/actions.ts`; `src/lib/weekly-digest/machine-attest.ts`; `src/lib/content-sim/vision-critic.ts`)

**D3 human_dignity_risk (2026-08-15):** critic flags degrading depictions of people (especially
children). News: critique fails. Upload: warning, not a preflight block.
(source: [weekly-illustration-plan](weekly-illustration-plan.md) D3,
`src/lib/content-sim/vision-critic.ts`)

**E2 two-stage critic (2026-08-23):** auto loop runs image-only first (no headline), then
story-aware only if pixels passed. Prompt-only upload now follows the same ordering for a story,
but never writes a `content_sim` decision; cover remains pixel-only because it represents the whole
issue rather than one source story. (source: `src/lib/content-sim/adapters/weekly-image.ts`; `src/lib/weekly-digest/run-post-upload-qa.ts`)

**E3 prompt promotion (2026-08-15):** Visuals digest line scores prompt quality from owner
verdicts. It does not write `content_sim` and does not add `simulation_not_passed`. News
score floor stays overall ≥ 80.
(source: [weekly-illustration-plan](weekly-illustration-plan.md) E3,
`src/lib/weekly-digest/prompt-promotion-gate.ts`)

**A2 critic bake-off (2026-08-15):** Actions `31879588071` scored three OpenRouter vision
models against owner verdicts v6. All three had `Kept the good = 0/1`. Production stays on
`google/gemini-2.5-flash`; `CONTENT_SIM_VISION_OPENROUTER_MODEL` was not changed. Positive
set is n=1. Harness reads top-level `headline` from visual-compiler manifests.
(source: [weekly-illustration-plan](weekly-illustration-plan.md) A2,
`experiments/critic-bakeoff/2026-08-15/`, `src/lib/content-sim/bakeoff-manifest.ts`)

## Related pages

- [weekly-sandbox](../ops/weekly-sandbox.md)
- [card-images](../marketing/card-images.md)
- [image-prompt-library](image-prompt-library.md)
- [weekly-digest](weekly-digest.md)
- [weekly-master-engine](weekly-master-engine.md)
- [llm-providers](llm-providers.md)
