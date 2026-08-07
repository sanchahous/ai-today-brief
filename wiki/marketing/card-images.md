# Card images — per-item AI brand cards

Summary: Генерація карток/OG і weekly story-ілюстрацій: FLUX.2, fallback, no-text policy, cost ledger.
Sources: `pipeline/card-image.ts`, `.env.example`, PR #169–#175, editorial quality overhaul PR5
(гілка `feat/weekly-editorial-voice`, 2026-08-06), none (analysis earlier draft)
Last updated: 2026-08-06

---

Every brief item gets a unique cinematic AI illustration tied to its headline,
under a constant brand overlay. It is the OG/share image **and** the on-site
card thumbnail / article hero. Weekly Digest story images reuse the same
Cloudflare Workers AI path with a stricter editorial prompt policy.

## How it works

1. **Subject** — a tiny Gemini text call turns the headline into a visual metaphor
   (daily cards); weekly story images use scene briefs stored on the artifact.
2. **Prompt** — cinematic house style + category accent (daily). **Weekly is a
   separate house style since PR5** (`pipeline/card-image.ts`'s `weeklyReportageSceneBrief` +
   `buildWeeklyPrompt`, policy id **`weekly-reportage-v1`**): one documentary-reportage frame
   of the actual news event — "picture a photographer standing in the room where this
   happened" — not the daily path's abstract metaphor register. Avoid-list is folded into the
   **positive** prompt, not a separate `negative_prompt` field — FLUX.2 klein's multipart
   Workers AI call never transmits `negative_prompt`, so a separate one silently never reached
   the model on this provider. Three variants (same scene, different seeds) are generated per
   story so the owner can pick the best render; seed is `digestId:revisionItemId:v{n}`, no
   `job.id`, so a regeneration is iterative rather than a fresh lottery. Daily generation keeps
   its own **no baked-in typography / mastheads** policy `story-specific-editorial-v5-no-text`,
   untouched by PR5. (source: PR #174–#175, editorial quality overhaul PR5 2026-08-06)
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
