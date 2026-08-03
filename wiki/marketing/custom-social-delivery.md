# Custom social delivery — operator runbook

Summary: Кастомна доставка соц-постів поза стандартним CMS-шляхом.
Sources: migrated from `docs/` (git history via `git log --follow`); none (analysis) where unmarked
Last updated: 2026-08-02


The site publishes social content directly through GitHub Actions and the
platform APIs. No Postiz account, VPS, queue server or third-party OAuth vault
is required. Supabase remains the source of truth for delivery history and
native platform metrics.

## Safety model

- A story must be `published` and `approved` before it is eligible.
- `social_posts` records the provider result and prevents a second top-story
  post to the same channel on the same day.
- `SOCIAL_CHANNELS` is an explicit allowlist. When it is missing, existing
  Telegram/X behaviour remains in place. A token alone never enables Threads.
- `SOCIAL_CHANNELS=none` is the emergency stop for all public daily reposts.
- Never put tokens in `.env.example`, committed files, screenshots or issue
  comments. Use GitHub Actions secrets and the password manager only.

## What is ready

| Capability | Status |
| --- | --- |
| Telegram daily post and weekly digest | Existing production path |
| X hook + link reply | Existing opt-in path |
| Threads text post | Ready; disabled until explicitly allowlisted |
| UTM per platform and post format | Ready |
| Queue states, idempotency keys and metric snapshots | Migration ready |
| Instagram/Facebook media publishing | Next implementation phase |

## Safe Threads launch

1. Apply `supabase/migrations/039_social_publishing_queue.sql` through the
   normal Supabase migration process, then apply
   `supabase/migrations/040_social_cms.sql`.
2. In GitHub Actions, run **Social repost** manually with `dry_run=true` and
   review the printed Telegram, Threads and X previews. It makes no network
   publish call.
3. Add the Meta long-lived token as the GitHub secret `THREADS_ACCESS_TOKEN`.
4. Set repository variable `SOCIAL_CHANNELS` to `telegram,threads,x` only after
   a successful private/test Threads post. Use `telegram,threads` when X should
   stay disabled.
5. Run the workflow manually for one approved test story, then verify the
   Threads post, UTM session in GA4 and its `social_posts` row.
6. Keep the next seven scheduled runs under observation. Set
   `SOCIAL_CHANNELS=none` to stop immediately if a provider returns errors or
   copy needs correction.

## Credential inventory

| Platform | GitHub secret | Launch guard |
| --- | --- | --- |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` | Existing channel path |
| Threads | `THREADS_ACCESS_TOKEN` | `threads` must be in `SOCIAL_CHANNELS` |
| X | `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | `x` must be in `SOCIAL_CHANNELS` |
| Instagram | Not needed yet | Implement after 4:5/card carousel renderer |
| Facebook | Not needed yet | Implement after Page content format is chosen |

Current daily timing remains 17:00 UTC. Each tracked article URL uses
`utm_source`, `utm_medium=social`, `utm_campaign=daily_news` and
`utm_content=top_story`, so GA4 and first-party item events can be joined back
to a platform and a published item.
