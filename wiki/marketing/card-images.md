# Card images — per-item AI brand cards

Summary: Генерація карток/OG і weekly story-ілюстрацій: FLUX.2, один primary weekly prompt, no-text policy, advisory semantic QA і cost ledger.
Sources: `pipeline/card-image.ts`, `.env.example`, PR #169–#175, editorial quality overhaul PR5
(гілка `feat/weekly-editorial-voice`, 2026-08-06), LLM provider registry Phase 2
(гілка `feat/llm-provider-registry`, 2026-08-06), post-merge review PR #191 (2026-08-07),
BFL FLUX.2 prompting + JSON structured prompting (live check 2026-08-10),
`feat/weekly-reportage-prompt-v2` (2026-08-10),
`feat/weekly-editorial-concept-v1` (2026-08-10),
`feat/weekly-editorial-concept-v2` (2026-08-11 illustration overhaul),
`feat/weekly-editorial-concept-v3` (2026-08-11 mechanism fidelity),
Content Sim vision loop 2026-08-11, owner prompt review + `weekly-semantic-story-v6` Prompt-as-Code
library 2026-08-23, daily production cover 2026-08-24, image-only QA Likert 2026-08-25
Last updated: 2026-10-30

---

Every brief item gets a unique cinematic AI illustration tied to its headline,
under a constant brand overlay. It is the OG/share image **and** the on-site
card thumbnail / article hero. Weekly Digest story images reuse the same
Cloudflare Workers AI path with a stricter editorial prompt policy.

## How it works

1. **Subject** — a tiny text-model call turns the headline into a visual metaphor
   (daily cards); weekly story images use scene briefs stored on the artifact. As of the LLM
   provider registry Phase 2 (2026-08-06) this call goes through
   `generateWithRegistry('daily.card_image_scene' | 'weekly.card_image_scene', ...)` instead of a
   hardcoded Gemini-SDK-then-OpenRouter ladder — Gemini is still the default first choice, but the
   owner can now add another provider (e.g. a promo like NVIDIA NIM) to either role's chain via
   `/admin/providers` without a deploy. See [llm-providers](../pipeline/llm-providers.md).
   When the whole chain fails, the ladder falls back to a keyword scene as before, but since the
   post-merge review of PR #191 (2026-08-07) it also emits a `warn` log with the role and the
   error — the silent fallback gave no signal that the art director had stopped running at all.
   (source: `pipeline/card-image.ts`'s `runArtDirectorLadder`, PR #191)
   **Scene output contract (2026-10-29):** the daily director is asked for a one-key JSON object
   `{"scene": "..."}` and the Gemini adapter is pinned to a one-field `scene` schema
   (`withGeminiCallConfig`). Before this fix the Gemini adapter defaulted to the full bilingual
   brief schema and answered every scene request with a whole `{"title_en":…,"items":[…]}`
   brief (~4.5k chars, ~30 s, ~3k output tokens) that was truncated to 320 chars and pasted into
   the FLUX prompt as the "scene". `cleanSceneText` now returns an empty string for any JSON
   object without a known scene key, so such a reply falls back to the keyword scene instead of
   reaching the image model. (source: live probe of `generateWithRegistry('daily.card_image_scene')`
   2026-10-29; `pipeline/card-image.ts`)
2. **Prompt** — cinematic house style + category accent (daily). **Weekly is a
   separate semantic house style** (`pipeline/card-image.ts`'s `weeklyReportageSceneBrief` +
   `buildEditorialConceptPrompt` / `buildWeeklyPrompt`, policy id **`weekly-semantic-story-v6`**
   as of 2026-08-23): **approved source → context → meaning → mechanism → consequence**, then a
   deterministic template router (`literal_context` → photo/scene, `mechanism` → infographic or
   breakdown, `consequence` → scene/illustration) and a six-block Prompt-as-Code assembler.
   Canonical більше не зливає `essence.mechanism` у рядок для моделі. Деталі —
   [image-prompt-library](../pipeline/image-prompt-library.md).
   `generation-worker.ts` передає не лише headline/summary: `why`, practical,
   limitation, takeaway, editor inference, owner angle, approved research claims/context/risks.
   Essence director мусить відділити факт від inference і не вигадувати downstream outcome;
   metaphor director повертає `story_anchor`, `visible_mechanism`, `visible_consequence`.
   `validateMetaphorPitch` рахує semantic/craft gates тільки за renderable полями, які реально
   потрапляють у FLUX prompt — пояснення `why_it_fits` більше не може фальшиво виконати
   `mechanism_not_visible`. Окремий context-anchor gate вимагає actor/system із story context,
   тому generic battery/cog/pump, що показує лише тему, не проходить. Якщо обидва metaphor rounds
   провалились, fallback будується з semantic contract/visual thesis, а не з generic spotlight;
   literal label invitations на кшталт `"model" slot` прибираються із semantic fallback до FLUX.
   У `prompt_only` shared semantic contract подається одному **primary editorial director**:
   він повертає одну connected cause-and-effect scene з actor/system, видимою дією та grounded
   result. Subject-first prompt ставить causal mini-story до стилю; planning rationale не може
   потрапити в canonical. Якщо owner редагує scene вручну, вона стає primary direction.
   Structural sibling gates (`motif_class`, scene echo, character/dual caps) лишились для
   справжніх multi-concept render batches. **Content Sim scores each concept against its own
   scene/prompt** лише у `render`; `prompt_only` не показує власнику три лотерейні картки.
   `scene_override` лишається escape hatch.
   Daily keeps `story-specific-editorial-v5-no-text`.
   (source: PR #174–#175, PR5 2026-08-06, reportage-v2 / editorial-concept-v1 2026-08-10,
   illustration overhaul v2 + fidelity v3 2026-08-11)
3. **Image** — Cloudflare Workers AI default
   `@cf/black-forest-labs/flux-2-klein-9b` (multipart FormData under Node; do not
   stream the body without duplex — that silently spilled to `flux-1-schnell`).
   Ladder (since 2026-10-30, ATB-91): Gemini (opt-in) → Cloudflare klein → **OpenRouter
   `black-forest-labs/flux-3-image-klein`** (paid, daily-capped, see below) → Cloudflare schnell
   (last free tier) → **null** → branded procedural **duotone** (`src/lib/card/duotone.ts`). The keyless Pollinations tier was
   **removed entirely on 2026-10-29** (provider function, `allowPollinations` option and
   `'pollinations'` provider value deleted; prod had 0 `brief_items.card_image_url` rows
   pointing at pollinations, so no image-host allowlist was involved): the anonymous
   endpoint served a small "sana" model regardless of `model=flux`, added a watermark,
   ignored in-prompt "never a face" negations and was limited to 1 image / 45 s / IP, so
   every CI fallback between 2026-08-30 and 2026-10-28 produced an off-topic AI portrait
   (46 items). The replacement is the OpenRouter flux-3-image-klein tier (owner decision
   2026-10-30). A failed generation now leaves `card_image_url` null and the next `fillCardImages` run
   retries it. (source: PR #169, #171, `pipeline/card-image.ts`; live check
   `generation_cost_events` + `storage.objects` + Pollinations response header
   `x-model-used: sana`, 2026-10-29)

   **Cloudflare failure modes (live check 2026-10-29):**
   - **HTTP 429, code 4006** — "you have used up your daily free allocation of 10,000 neurons".
     This is the Workers AI *free-plan daily quota* (reset 00:00 UTC), not a per-minute rate
     limit, and klein and schnell share the one pool; klein costs roughly 1.4k neurons per
     1280×720 image (estimate from $0.015/image), so the free tier covers only ~7 klein covers a
     day, while schnell is ~10× cheaper (estimate, ~90/day). Once it is spent *every* Cloudflare
     call fails until midnight UTC, which is why CI runs used to fall through to the
     (now removed) Pollinations tier. Code now classifies 4006 as a quota: no retry, no pointless schnell spillover, a
     process-local latch (`cloudflareQuotaExhausted`) skips later Cloudflare calls, and batch
     loops (`fillCardImages`, `regenerate-card-image.ts`) stop before paying for scene-director
     calls. The item keeps `card_image_url = null` and the next run retries it. A plain
     per-minute 429 is retried at most twice (2 s, 5 s, or `Retry-After` capped at 20 s).
     Real fix for volume: Workers Paid plan, or `CLOUDFLARE_IMAGE_MODEL` set to schnell.
   - **HTTP 400 on schnell** — the old JSON body sent `seed`; flux-1-schnell's schema is strict
     (`prompt` ≤ 2048 chars + `steps` 1–8 only) and answered "Additional or unevaluated
     properties '/seed' at '/' not allowed" (code 5006), so the schnell spillover never worked.
     `seed` is no longer sent and the prompt is clamped to 2048 chars.
   (source: direct API calls 2026-10-29; `pipeline/card-image.ts` `generateCloudflare`,
   `cloudflareJsonBody`)

   **OpenRouter image tier (2026-10-30, owner-chosen):** `POST https://openrouter.ai/api/v1/images`
   with `model = black-forest-labs/flux-3-image-klein`, `aspect_ratio 16:9`, `resolution 1K`,
   `n 1`. Trial 2026-10-30: 10/10 HTTP 200, 1360×768 JPEG, ~7 s, $0.009/image (`usage.cost`),
   no people/text. The API has no negative-prompt field, so the ban list
   "No people, no faces, no portraits, no hands, no text, no letters, no logos." is appended to
   the prompt text. This is the only **paid** tier, so it is fenced:
   - request pins `provider: {only: ["black-forest-labs"], allow_fallbacks: false,
     require_parameters: true, max_price: {image: 0.015}}` — a re-route can never bill more;
   - **daily cap** `OPENROUTER_IMAGE_DAILY_CAP` (default **20** images per UTC day, `0` = off),
     counted from `generation_cost_events` (`kind='image'`, `provider='openrouter'`, since
     00:00 UTC, any scope) and max'd with an in-process reservation counter (parallel callers
     reserve before the await; if the ledger count query fails the process counter alone applies);
   - HTTP **402** (no credits) / **401** / **403** latch the tier off for the rest of the process
     (`openRouterImageLatchReason`); **429** retries once (`Retry-After` capped at 20 s);
     60 s timeout; any other error just fails the tier (next image tries again);
   - a response with `usage.cost > $0.02` is discarded and latches the tier off;
   - every success is ledgered with the real `usage.cost` (`cost_source='reported'`) via
     `recordCardImageCostEvent`, used by the daily pipeline, both backfill scripts and
     `regenerate-card-image.ts` — a caller that skips it hides spend from the cap;
   - no `OPEN_ROUTER_API_KEY` ⇒ tier skipped silently. The model has no seed.
   Caveat: the cap sees only what reaches the ledger; the OpenRouter dashboard stays the
   source of truth for dollars. The account key itself has no per-key limit.
   (source: OpenRouter docs `/guides/overview/multimodal/image-generation` 2026-10-30;
   trial run 2026-10-30; `pipeline/card-image.ts` `generateOpenRouter`)
4. **Store** — `encodeCardOrigin` cover-resize to 1280×720, flatten alpha onto
   `#071019`, JPEG q82 mozjpeg progressive → `${slug}.jpg` (`image/jpeg`) in the
   public `card-images` bucket → `brief_items.card_image_url`. JPEG, not WebP,
   so OG crawlers and Satori (`opengraph-image.tsx`) can read the origin without a
   transform. The public site still requests `format=webp` from Supabase Storage
   (`src/lib/image-loader.ts`). Idempotent skip leaves existing `.png` (~488 KB
   from the 2026-08-14 incident) until `--reencode-png` (no FLUX). Weekly
   **story** figures (`story_image`) are stored as WebP 1600×900 q82 on a branded
   `contain` canvas, so a non-16:9 source is not silently cover-cropped; weekly **cover** stays JPEG because it is the digest
   `og:image`. Social/IG crops stay JPEG. (source: [ops/vercel-image-quota](../ops/vercel-image-quota.md),
   `pipeline/card-image.ts`, `src/lib/encode-site-image.ts`)
5. **Render** — `opengraph-image.tsx` (Satori) composites the brand overlay for
   OG/share; listings / heroes use `next/image` → WebP via the loader.

Daily generation runs **once, post-publish** (`pipeline/card-image.ts` from
`pipeline/run-daily.ts`) and is idempotent. Estimated image spend can land in
`generation_cost_events` (see `/admin/costs`).

### News cards: no human portraits (2026-10-27)

Daily **news** covers (`brief_items.card_image_url`) must never centre a human face,
portrait, headshot, or stock-photo person — the story is about technology, not a
model posing for the camera. The art-director prompt, FLUX positive/negative
prompts, and `prepareNewsCardScene` all enforce this; portrait/headshot scene
language is discarded for the causal **topic fallback** (`fallbackScene`) before
pixels are sent to `@cf/black-forest-labs/flux-2-klein-9b` (default
`DEFAULT_CF_IMAGE_MODEL`). There is no “unless the story is about them” escape
hatch (unlike the physical-robotics exception). (source: ATB-89,
`pipeline/card-image.ts` `HUMAN_PORTRAIT_SCENE_PATTERN`, 2026-10-27)

Цей абзац описує **news-card** images. Він не є daily digest cover: з 2026-08-24 daily cover має
окремий production workflow з однією тезою, pinned dynamic OpenRouter Image route, bounded
$5/month spend, semantic QA, manual source/editor choice і шість social draft’ів. News cards
лишаються на наявному automatic provider/publish flow; їх покращено causal prompt policy без
нового ручного gate. Деталі — [daily-visual-workflow](../pipeline/daily-visual-workflow.md).
(source: owner session 2026-08-24; `pipeline/card-image.ts`;
`pipeline/daily-visual-finalizer.ts`; `pipeline/daily-visual-openrouter.ts`)

### Letterbox trim (2026-10-30)

OpenRouter `flux-3-image-klein` sometimes returns a 16:9 canvas with uniform black or slate-grey bars top and bottom (3 of 27 in one regen batch, 2026-10-30; one sample had the scene bleeding faintly into the bar). `encodeCardOrigin` — the single place every provider's bytes pass through — now calls `detectLetterbox` first: a row/column is bar when ≥70% of its pixels are within ±12 luminance of the edge line's median, the run must be ≥2% of the axis and end at a hard edge (mean pixel step ≥10, which rejects smooth vignettes), bars summing to >35% of an axis are treated as content, and 2px extra is cut to drop the JPEG seam. The remainder is then cover-cropped to 1280×720; a warn is logged if that crop would discard >25% of the frame. Left/right pillarbox is handled the same way. Verified on the 27 raw samples: exactly the 3 barred images trimmed, 24 clean ones untouched. (source: ATB-91, `pipeline/card-image.ts` `detectLetterbox`)

## Current weekly acceptance rule (2026-08-23)

For a new weekly prompt the desired primary image is not a compressed visual version of every
fact. Together with the headline it must make one `actor/system → visible change → grounded
consequence` readable in roughly 2–3 seconds. Text, labels and diagrams stay absent by default;
one deterministic overlay is a last-resort clarification, never a substitute for scene clarity.
(source: owner session 2026-08-23; `pipeline/card-image.ts`; `pipeline/image-prompt-library/templates.ts`)

After manual upload, a story gets pixel QA and, only when the pixels are clean, a second
story-aware semantic pass, including the approved counterweight when one exists. It is an owner
warning rather than a release blocker; model certainty does not replace editorial review. A missing
story-aware pass or any active QA blocker does, however, fail closed for machine attestation.
(source: `src/lib/weekly-digest/run-post-upload-qa.ts`; `src/lib/weekly-digest/post-upload-qa.ts`; `src/lib/weekly-digest/machine-attest.ts`)

## Env

```
CLOUDFLARE_ACCOUNT_ID=…
CLOUDFLARE_API_TOKEN=…   # Workers AI
# optional override (default flux-2-klein-9b):
# CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-2-klein-9b
# free-plan alternative (~10x cheaper in neurons, lower quality):
# CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
# CLOUDFLARE_IMAGE_USD_FIRST_MP=0.015
# CLOUDFLARE_IMAGE_USD_NEXT_MP=0.002
# Paid OpenRouter image tier (uses the existing key; no key => skipped):
OPEN_ROUTER_API_KEY=…
# OPENROUTER_IMAGE_MODEL=black-forest-labs/flux-3-image-klein
# OPENROUTER_IMAGE_DAILY_CAP=20   # images per UTC day; 0 disables the tier
```

Unset account/token → generation step skipped; branded duotone fallback renders.

## Backfill

```
npx tsx scripts/backfill-card-images.ts            # all published briefs (FLUX, missing only)
npx tsx scripts/backfill-card-images.ts <brief-slug>  # one brief
npx tsx scripts/backfill-card-images.ts --reencode-png --dry-run
npx tsx scripts/backfill-card-images.ts --reencode-png
```

`--reencode-png` downloads existing PNG origins, runs `encodeCardOrigin`, writes
`${slug}.jpg`, updates `card_image_url`, then removes the PNG. **No image-model
call** and no Cloudflare key. Idempotent: JPEG URLs are skipped. Cap 250/run
(`CARD_ORIGIN_REENCODE_MAX`). (source: `pipeline/card-image.ts`, 2026-08-15)

**Single-item repair** (regenerates pixels via FLUX, upserts `${slug}.jpg`, bumps `?v=`):

```
npx tsx --env-file=.env.local pipeline/scripts/regenerate-card-image.ts --slug <item-slug>
```

(source: `pipeline/scripts/regenerate-card-image.ts`, ATB-89, 2026-10-27)

## Verify a render offline

`scripts/render-og-check.ts` renders the OG card via `next/og` without a dev
server (handy where `next dev` is memory-constrained).

**Content Sim (2026-08-11):** weekly `story_image` jobs run a vision critic loop
of maximum two rounds (initial 3-variant batch + one 3-variant re-plan) via `src/lib/content-sim` +
`pipeline/providers/vision.ts` (`weekly.image_critic`). Failures escalate to human
review with an admin escalation panel; release preflight blocks on
`simulation_not_passed` until pass or owner override. Offline:
`npm run content-sim -- run --adapter weekly-image|daily-image --fixture …`.
See [content-sim](../pipeline/content-sim.md).

**Виявлені v3 failure modes, закриті v4:** approved claims серіалізувались як
`[object Object]`; semantic gate міг зарахувати слова лише з невидимого `why_it_fits`; vision
  `prompt_patches` дописувались у metadata після render, тому не змінювали наступне зображення;
  critic порівнював картинку переважно з власною essence, а не з original story; `dual_contrast`
  примусово отримував backstage-мотив; довгий prose headline міг помилково стати однією required
  entity, а reject усіх pitches викидав semantic contract у generic fallback. (source:
  `generation-worker.ts`, `pipeline/card-image.ts`,
`src/lib/content-sim/adapters/weekly-image.ts`, owner prompt review 2026-08-11)

**v4 cost/quality hardening (owner audit 2026-08-11):** три independent-concept renders і
per-concept vision працюють паралельно; critiques агрегуються, а суцільний semantic fail примусово
планує нову трійку в єдиному repair-раунді. Обидва раунди лишають три owner-visible concepts.
Generic pneumatic
tubes/canisters/switchboards/data streams блокуються як `opaque_abstraction`, якщо це не буквальний
контекст новини; human-centered tutoring/help/evaluation stories можуть використати персонажів
(digest cap піднято з одного до двох character-led scenes). Vision вимагає pixel evidence, а
provider-call ledger і Visuals показують фактичний render/vision spend поточної ревізії. (source:
`pipeline/card-image.ts`, `src/lib/content-sim/adapters/weekly-image.ts`,
`src/lib/content-sim/vision-critic.ts`, `src/lib/weekly-digest/generation-worker.ts`)

**v5.1 concept-collapse fix (owner production review 2026-08-12):** jury pitch-ів, які відрізняються
структурно, більше не відкидаються лише через literal story-token mismatch — це advisory для paid
vision. Якщо critic просить `rejectMetaphor`, його replacement scene/patches стають feedback нового
jury, але не shared FLUX instruction. Так три варіанти не перетворюються на три typewriters/cars/
hands. (source: `pipeline/card-image.ts`, `src/lib/content-sim/adapters/weekly-image.ts`,
`src/lib/weekly-digest/generation-worker.ts`, owner review 2026-08-12)

**B1-fix craft-ban literal exception (2026-08-15):** `validateMetaphorPitch` більше не відхиляє
pitch лише тому, що в ньому є слово зі списку craft-cliché, якщо це слово (або `command line` /
`CLI` для голого `terminal`) уже є в `storyContext` / `mechanism` / required entities. Інакше
story про командний рядок не можна було описати без слова `terminal`, усі три лінзи падали в
fallback і власник бачив три однакові шафи. `terminal window`, `npx`, `glowing brain`, collage
й інші UI-кліше лишаються забороненими навіть на CLI-новині — виняток потерміновий, не на весь
список одразу. `WEEKLY_SLUDGE_BANNED` не чіпали: немає даних, що він б'є буквальний предмет
новини. (source: [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) B1-fix,
`experiments/jury-blockers/2026-08-digest-843975a8.md`, `pipeline/card-image.ts`)

**B2 — не добивати кількість трьома копіями (2026-08-15):** якщо журі прийняло одну чи дві лінзи,
`weeklyReportageSceneBriefs` повертає стільки брифів, скільки є — не дописує перефразування
одного `essence`. Повний провал журі дає **один** бриф із `motifClass: fallback_essence`, не три
з `fallback_${lens}`. Дублікат ловиться також за **родиною мотивів** (≥2 з head-noun subject /
head-noun setting / `subjectKind`), тож `single_slot_cabinet` і `single_shaft_carousel` в одній
майстерні більше не проходять як різні концепції. (source:
[weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) B2, `pipeline/card-image.ts`)

**P1 — промпт як продукт (2026-08-15):** `pipeline/prompt-export.ts` видає канонічний
natural-language промпт (субʼєкт першим) плюс Midjourney і negative; текст у пікселях заборонений
окремим реченням і в negative.

**C1 — grammar на брифі (2026-08-15):** `WeeklyReportageSceneBriefResult.grammar` поруч із лінзою.
Журі лишає кінематографічний промпт; fallback пише `source_led_fallback`. Export читає поле з
брифа, тож схема (`deterministic_technical_hybrid`) описує елементи й стрілки, не фото.
Роутер «метрика → схема» — C2.
(source: [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) C1,
`pipeline/card-image.ts`, `pipeline/prompt-export.ts`)

**C2 — роутер грамматики (2026-08-15):** `pipeline/scene-grammar.ts` читає essence +
title/summary, не practical/takeaway. Метрика → `deterministic_technical_hybrid`. Один
`caching` не вмикає process grammar; duration у practical лишає кінематограф. V10 не
імпортується.
(source: [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) C2,
`pipeline/scene-grammar.ts`)

**C3 — mapping gate (2026-08-15):** перед записом `story_prompt_set` кожен концепт мусить мати
таблицю source → visible object → outcome з `visibleElementId`. Порожній `semanticProps`
не проходить. V10 не імпортується.
(source: [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) C3,
`pipeline/concept-mapping-gate.ts`, `src/lib/weekly-digest/story-prompt-job.ts`)

**D2 — QA-порада (2026-08-15):** після ручного upload Visuals каже, що робити з дефектом
(inpaint, той самий промпт, інший концепт). Немає auto-repair на дайджестах.
(source: [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) D2,
`src/lib/weekly-digest/post-upload-qa.ts`)

**D3 — human_dignity_risk (2026-08-15):** критик банить принизливі сцени з людьми; на upload —
попередження «ризик гідності».
(source: [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) D3,
`src/lib/content-sim/vision-critic.ts`)

**E1 — owner-feedback (2026-08-15):** вердикт на концепт (`used` / `used_with_edits` /
`rejected` + `reasonTags`) живе в `story_prompt_set` і поруч із `post_upload_qa`.
(source: [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) E1,
`src/lib/weekly-digest/owner-feedback.ts`)

**E2 — двостадійний критик (2026-08-15):** image-only без headline, потім story-aware лише
якщо пікселі пройшли. Image-only з 2026-08-25 рахує 0–100 і не гейтить `news_legibility`;
Likert 0–1 / 1–5 rescale-иться. Upload QA для clean `story_image` далі має story-aware pass.
(source: [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) E2,
`src/lib/content-sim/adapters/weekly-image.ts`; `src/lib/content-sim/vision-critic.ts`)

**E3 — promotion gate промптів (2026-08-15):** Visuals рахує ≥60% прийнятних з 1–2 спроби,
0 misleading, ≤10 хв/story, 3 різні промпти. Не блокує реліз. Пороги **новин** без змін.
(source: [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) E3,
`src/lib/weekly-digest/prompt-promotion-gate.ts`)

**A2 — bake-off критика (2026-08-15):** `CONTENT_SIM_VISION_OPENROUTER_MODEL` лишається
`google/gemini-2.5-flash`. Усі три моделі в прогоні `31879588071` дали `Kept the good = 0/1`.
(source: [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) A2,
`experiments/critic-bakeoff/2026-08-15/`)

**P2 — Visuals copy/upload (2026-08-15):** артефакт `story_prompt_set` (текст, не в
`PUBLIC_IMAGE_TYPES`) + картки Canonical / Midjourney / Negative і слот upload на вкладці
Visuals.

**M1 — prompt_only (2026-08-15):** weekly `story_image` / `cover` за замовчуванням не кличуть
FLUX (`WEEKLY_STORY_IMAGE_MODE=prompt_only`). Worker пише `story_prompt_set`; картинки новин
на сайті лишаються на повній автогенерації. `render` повертає старий цикл без зміни деплою.

**M2 — post-upload QA (2026-08-15):** ручний файл перевіряється image-only критиком; результат у
`metadata.post_upload_qa`. Попередження в Visuals, реліз не блокується.
(source: [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md) P1/P2/M1/M2,
`pipeline/prompt-export.ts`, `src/lib/weekly-digest/story-prompt-set.ts`,
`src/lib/weekly-digest/story-prompt-job.ts`, `src/lib/weekly-digest/post-upload-qa.ts`)

**Review PR-стека #241–#264 і виправлення (2026-08-15, гілка `feat/weekly-illustration-fixes`):**
серед знайденого й виправленого щодо цієї сторінки — B1-fix's literal-source виняток
винятковував увесь список `WEEKLY_CRAFT_BANNED_OTHER`, а не лише `terminal` (новина про
dashboard могла відкрити буквальний скріншот); grammar cap тепер на лінзу `mechanism`, а не на
всі три концепти (metric у заголовку раніше робив усі три діаграмою); `motifFamilyKey` для
крос-story siblings тепер отримує реальні `subject`/`setting` замість `sceneSummary`-фолбеку;
owner-scene-override («Edit direction») тепер працює і в prompt_only-режимі, не лише в render;
`reencodeOneCardOrigin` більше не видаляє старий PNG за замовчуванням. Повний список —
[audits/2026-08-15-illustration-pr-stack-review](../audits/2026-08-15-illustration-pr-stack-review.md).

**Reviewable render history (2026-08-12):** кожен image buffer з кожного repair round зберігається
до approval як підписаний private preview із round, variant, concept lens/title, motif, scene та
per-variant score. Visuals показує всю generation history; owner promotion лишається можливим для
поточної трійки. Після approval storage cleanup видаляє review-only previews і залишає тільки
обраний primary, тоді як artifact/review ledger зберігає audit trail. (source: `generation-worker.ts`,
`admin-data.ts`, `weekly-workspace.tsx`, `weekly/actions.ts`, owner request 2026-08-12)

## Related pages

- [content-sim](../pipeline/content-sim.md)
- [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md)
- [image-prompt-library](../pipeline/image-prompt-library.md)
- [overview](../overview.md) §4
- [custom-social-delivery](custom-social-delivery.md)
- [llm-providers](../pipeline/llm-providers.md)
