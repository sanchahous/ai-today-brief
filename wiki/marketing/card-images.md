# Card images — per-item AI brand cards

Summary: Генерація карток/OG і weekly story-ілюстрацій: FLUX.2, fallback, no-text policy, cost ledger.
Sources: `pipeline/card-image.ts`, `.env.example`, PR #169–#175, editorial quality overhaul PR5
(гілка `feat/weekly-editorial-voice`, 2026-08-06), LLM provider registry Phase 2
(гілка `feat/llm-provider-registry`, 2026-08-06), post-merge review PR #191 (2026-08-07),
BFL FLUX.2 prompting + JSON structured prompting (live check 2026-08-10),
`feat/weekly-reportage-prompt-v2` (2026-08-10),
`feat/weekly-editorial-concept-v1` (2026-08-10)
Last updated: 2026-08-10

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
   separate house style since PR5** (`pipeline/card-image.ts`'s `weeklyReportageSceneBrief` +
   `buildEditorialConceptPrompt` / `buildWeeklyPrompt`, policy id **`weekly-editorial-concept-v1`**
   as of 2026-08-10): **essence → metaphor**, not documentary desk reportage. Pipeline:
   (1) essence director → one-sentence argument + forbidden clichés; (2) metaphor director →
   2–3 concrete visual metaphors; (3) deterministic score + `validateMetaphorPitch` (bans
   terminal/IDE/collage, paper-heap sludge, desk defaults without a conceptual prop; allows
   **`dual_contrast`** as one continuous photograph with a clear spatial divide — facade/backstage,
   left/right — never comic panels or readable UI); (4) subject-first SASC + HEX for FLUX.2
   (BFL: no giant `Avoid:` list). Context: `editorialAngle` + `why` + claim snippets + sibling
   scene diversity. Three seed variants; `scene_override` remains the escape hatch. Daily keeps
   `story-specific-editorial-v5-no-text`. (source: PR #174–#175, PR5 2026-08-06, reportage-v2
   2026-08-10, editorial-concept-v1 2026-08-10)
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

## Related pages

- [weekly-digest](../pipeline/weekly-digest.md)
- [overview](../overview.md) §4
- [custom-social-delivery](custom-social-delivery.md)
- [llm-providers](../pipeline/llm-providers.md)
