# Card images — per-item AI brand cards

Summary: Генерація карток/OG і weekly story-ілюстрацій: FLUX.2, fallback, no-text policy, cost ledger.
Sources: `pipeline/card-image.ts`, `.env.example`, PR #169–#175, editorial quality overhaul PR5
(гілка `feat/weekly-editorial-voice`, 2026-08-06), LLM provider registry Phase 2
(гілка `feat/llm-provider-registry`, 2026-08-06), post-merge review PR #191 (2026-08-07),
BFL FLUX.2 prompting + JSON structured prompting (live check 2026-08-10),
`feat/weekly-reportage-prompt-v2` (2026-08-10),
`feat/weekly-editorial-concept-v1` (2026-08-10),
`feat/weekly-editorial-concept-v2` (2026-08-11 illustration overhaul),
`feat/weekly-editorial-concept-v3` (2026-08-11 mechanism fidelity),
Content Sim vision loop 2026-08-11, owner prompt review + `weekly-semantic-story-v5.1` and
three-concept jury follow-up 2026-08-11
Last updated: 2026-08-11

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
2. **Prompt** — cinematic house style + category accent (daily). **Weekly is a
   separate semantic house style** (`pipeline/card-image.ts`'s `weeklyReportageSceneBrief` +
   `buildEditorialConceptPrompt` / `buildWeeklyPrompt`, policy id **`weekly-semantic-story-v5.1`**
   as of 2026-08-11): **approved source → context → meaning → mechanism → consequence → causal
   visual metaphor**. `generation-worker.ts` передає не лише headline/summary: `why`, practical,
   limitation, takeaway, editor inference, owner angle, approved research claims/context/risks.
   Essence director мусить відділити факт від inference і не вигадувати downstream outcome;
   metaphor director повертає `story_anchor`, `visible_mechanism`, `visible_consequence`.
   `validateMetaphorPitch` рахує semantic/craft gates тільки за renderable полями, які реально
   потрапляють у FLUX prompt — пояснення `why_it_fits` більше не може фальшиво виконати
   `mechanism_not_visible`. Окремий context-anchor gate вимагає actor/system із story context,
   тому generic battery/cog/pump, що показує лише тему, не проходить. Якщо обидва metaphor rounds
   провалились, fallback будується з semantic contract/visual thesis, а не з generic spotlight;
   literal label invitations на кшталт `"model" slot` прибираються із semantic fallback до FLUX.
   Один shared semantic contract подається в **three-seat concept jury**, який за один structured
   LLM call створює три окремі сценарії: `literal_context`, `mechanism`, `consequence`. Кожен має
   інші subject, motif, setting і physical action; зміна camera/color/seed/prop placement/scale
   не вважається новою концепцією. Якщо owner редагує scene вручну, вона лишається concept 1, а
   concept 2–3 плануються незалежно й мають не повторювати owner direction. Subject-first prompt
   ставить causal mini-story до стилю й більше не інʼєктить `facade versus backstage` у кожен
   `dual_contrast`. Structural sibling gates v2/v3
   (`motif_class`, scene echo, character/dual caps) лишились. **Content Sim scores each concept
   against its own scene/prompt** й auto-picks primary; `metadata.variant_scores` має semantic
   minimum + craft, `metadata.variant_concepts` зберігає aligned concept metadata, а Visuals показує
   три назви/лінзи/сцени. `scene_override` лишається escape hatch.
   Daily keeps `story-specific-editorial-v5-no-text`.
   (source: PR #174–#175, PR5 2026-08-06, reportage-v2 / editorial-concept-v1 2026-08-10,
   illustration overhaul v2 + fidelity v3 2026-08-11)
3. **Image** — Cloudflare Workers AI default
   `@cf/black-forest-labs/flux-2-klein-9b` (multipart FormData under Node; do not
   stream the body without duplex — that silently spilled to `flux-1-schnell`).
   Fallback ladder: Pollinations → procedural **duotone**
   (`src/lib/card/duotone.ts`). (source: PR #169, #171, `pipeline/card-image.ts`)
4. **Store** — public Supabase bucket `card-images` → `brief_items.card_image_url`
   (daily); weekly artifacts keep their own storage paths + prompt metadata.
5. **Render** — `opengraph-image.tsx` (Satori) composites the brand overlay for
   OG/share; listings / heroes use `next/image`.

Daily generation runs **once, post-publish** (`pipeline/card-image.ts` from
`pipeline/run-daily.ts`) and is idempotent. Estimated image spend can land in
`generation_cost_events` (see `/admin/costs`).

## Env

```
CLOUDFLARE_ACCOUNT_ID=…
CLOUDFLARE_API_TOKEN=…   # Workers AI
# optional override (default flux-2-klein-9b):
# CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-2-klein-9b
# CLOUDFLARE_IMAGE_USD_FIRST_MP=0.015
# CLOUDFLARE_IMAGE_USD_NEXT_MP=0.002
```

Unset account/token → generation step skipped; branded duotone fallback renders.

## Backfill

```
npx tsx scripts/backfill-card-images.ts            # all published briefs
npx tsx scripts/backfill-card-images.ts <brief-slug>  # one brief
```

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

**Reviewable render history (2026-08-12):** кожен image buffer з кожного repair round зберігається
до approval як підписаний private preview із round, variant, concept lens/title, motif, scene та
per-variant score. Visuals показує всю generation history; owner promotion лишається можливим для
поточної трійки. Після approval storage cleanup видаляє review-only previews і залишає тільки
обраний primary, тоді як artifact/review ledger зберігає audit trail. (source: `generation-worker.ts`,
`admin-data.ts`, `weekly-workspace.tsx`, `weekly/actions.ts`, owner request 2026-08-12)

## Related pages

- [content-sim](../pipeline/content-sim.md)
- [weekly-digest](../pipeline/weekly-digest.md)
- [overview](../overview.md) §4
- [custom-social-delivery](custom-social-delivery.md)
- [llm-providers](../pipeline/llm-providers.md)
