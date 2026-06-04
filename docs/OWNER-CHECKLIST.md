# Owner checklist — launch blockers (human / accounts)

Items the codebase cannot complete without you. Engineering prep lives on branch `feat/p7-launch-prep-unblocked`.

## Accounts & API keys (Vercel + GitHub Actions)

| Service | Env vars | Action |
|---------|----------|--------|
| **Beehiiv** | `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` | Create publication; enable double opt-in; paste keys → `/api/subscribe` goes live |
| **Resend** | `RESEND_API_KEY` | Optional transactional confirm (Phase 3 in doc 08) |
| **GA4** | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | e.g. `G-5R89X6Q5D4` in Vercel + local `.env.local`; events fire after cookie consent |
| **Revalidate hook** | `REVALIDATE_SECRET` | Generate secret; give to pipeline: `POST /api/revalidate` with `Authorization: Bearer …` |
| **Telegram** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` | Bot + channel for daily brief autopost |
| **LemonSqueezy** | `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET` | MoR account (premium off at launch is OK) |
| **Pipeline** | `SCRAPPER_*`, `GEMINI_*`, `INBRIEF_*` | Same Supabase project; secrets in pipeline repo GHA |

## Legal & editorial (human)

| Item | Action |
|------|--------|
| **Privacy / Terms** | Lawyer reviews `src/lib/legal.ts`; remove `legalDraft` banner; fill `[placeholders]` |
| **Editorial gate** | Publish briefs only via `briefs.status = published` (admin UI not built yet — Supabase dashboard or SQL) |

## Infra & ops

| Item | Action |
|------|--------|
| **Supabase** | Apply migration `015` if not applied; run RLS audit in `015` §5; `get_advisors` clean |
| **Domain** | `aitodaybrief.com` → Vercel; verify `NEXT_PUBLIC_SITE_URL` |
| **Search Console** | Submit `sitemap.xml` + `news-sitemap.xml` |
| **SonarCloud** | Fix CI 403 on scanner download or re-run workflow |

## Go-live moment

1. Pipeline publishes first **human-approved** brief.
2. Call `POST /api/revalidate` (or Vercel deploy hook).
3. Confirm site + **email** (Beehiiv) + **Telegram** post the same issue.
