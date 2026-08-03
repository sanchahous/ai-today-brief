# Portability — swapping Beehiiv, Resend, LemonSqueezy, Telegram

Summary: Портативність зовнішніх сервісів і env-контракти.
Sources: none (analysis)
Last updated: 2026-06-04


Short answer: **yes, you can migrate**; difficulty depends on the service.

| Service | Where it lives | Swap effort | Notes |
|---------|----------------|-------------|--------|
| **Newsletter (Beehiiv)** | `src/app/api/subscribe/route.ts` | **Low** (1–2 days) | Single HTTP adapter. List ownership = export CSV from Beehiiv → import to ConvertKit/Mailchimp. No subscriber PII in Supabase by design. |
| **Transactional email (Resend)** | Not wired yet (planned Edge Function) | **Low** | Resend ↔ Postmark ↔ SES = same pattern (`fetch` + templates). |
| **Payments (LemonSqueezy)** | Not wired yet (webhook + checkout URL) | **Medium** (3–5 days) | MoR-specific checkout URLs and webhook signatures differ (Stripe/Paddle need UA workaround). Premium is off at launch — no rush. |
| **Telegram** | `news-pipeline` repo (`publish-telegram` stage) | **Low** | Bot API is standard; channel ID env swap only. Alternative: Discord webhook, Mastodon — small publish module change. |
| **GA4** | `src/components/google-analytics.tsx` | **Low** | Measurement ID is env-only. Plausible/Fathom = replace loader + events (1–2 days). |
| **Supabase** | Whole app + pipeline | **High** (weeks) | Postgres + RLS + RPCs — only if you outgrow Supabase; not a “service tweak”. |

**Recommendation:** keep thin **adapters** (`lib/integrations/beehiiv.ts`, etc.) when you wire Resend/LemonSqueezy so the next swap touches one file, not every form.
