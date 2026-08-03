# Card images — per-item AI brand cards

Summary: Генерація карток/OG-зображень: провайдери, fallback, стилі.
Sources: migrated from `docs/` (git history via `git log --follow`); none (analysis) where unmarked
Last updated: 2026-08-02


Every brief item gets a unique cinematic AI illustration tied to its headline,
under a constant brand overlay. It is the OG/share image **and** the on-site
card thumbnail / article hero.

## How it works

1. **Subject** — a tiny Gemini text call turns the headline into a visual metaphor.
2. **Prompt** — a constant cinematic house style + the category's accent colour.
3. **Image** — generated free: **Cloudflare Workers AI FLUX** → **Pollinations**
   fallback → procedural **duotone** fallback (`src/lib/card/duotone.ts`).
4. **Store** — uploaded to the public Supabase Storage bucket `card-images`; the
   URL is saved to `brief_items.card_image_url`.
5. **Render** — `opengraph-image.tsx` (Satori) composites the brand overlay over
   the image for OG/share; the on-site listing, homepage, category hubs and the
   article hero read `card_image_url` directly via `next/image`.

Generation runs **once, post-publish** (`pipeline/card-image.ts`, called from
`pipeline/run-daily.ts`) and is idempotent — items that already have an image are
skipped, so re-runs never regenerate. The news listing stays light: the card is a
cached static image, not a per-card client render.

## Env

```
CLOUDFLARE_ACCOUNT_ID=…
CLOUDFLARE_API_TOKEN=…   # token scoped to "Workers AI: Read"
```

Unset → the generation step is skipped and the branded duotone fallback renders.

## Backfill

Fill historical items that predate the feature (free, idempotent):

```
npx tsx scripts/backfill-card-images.ts            # all published briefs
npx tsx scripts/backfill-card-images.ts <brief-slug>  # one brief
```

## Verify a render offline

`scripts/render-og-check.ts` renders the OG card via `next/og` without a dev
server (handy where `next dev` is memory-constrained).
