# Reddit Data API — compliance & status

> **Status (2026-07-16): DISABLED pending written approval.**
> Reddit treats use by a business, a monetized product, and even free features used
> for upsell as commercial. AI Today Brief therefore does not access Reddit’s Data
> API until Reddit grants written permission for this use case.
>
> **⛔ HARD GATE:** `REDDIT_DATA_API_APPROVED=1` may be set only after written Reddit
> approval is recorded. OAuth credentials alone never enable the source.

This note records the compliance review behind that decision so the next person
doesn't have to redo it. It is engineering due-diligence, **not legal advice**.

## TL;DR

- **Rate limits — fine.** ~8 requests/run, ~24/day vs. the free-tier ceiling of
  **100 queries/min per OAuth client** (averaged over a 10-min window). Thousands of ×
  of headroom; volume is never the problem.
- **AI-training ban — does not apply to us.** We do **not** train or fine-tune any
  model on Reddit content. We read post *metadata* (title, score, comment count,
  permalink) as a **deterministic** ranking signal and summarise the **external
  linked article**, never Reddit post bodies or comments. This is exactly the line
  Reddit is litigating (Anthropic, Perplexity) and our design sits on the safe side.
- **The future blocker — commercial use.** AI Today Brief *plans* to monetize
  (LemonSqueezy), but payments are **not connected yet**. Reddit's terms require
  written approval / a contract for *any* commercial use of the Data API — the trigger
  is the commercial **purpose**, not request volume (it lists "Subscription services"
  and "paywalls" as commercial). While the product is genuinely free, this is
  non-commercial use, which the free tier permits; the restriction bites the moment
  monetization goes live. Hence the hard gate above.

**Governing wording (Data API Terms §3.1):** commercial use, *or* research in excess
of rate limits, *or* any non-permitted use ⇒ "you will need to enter into a separate
agreement with Reddit." The triggers are independent ("or") — so once we monetize,
low volume will not exempt us.

## Decision (2026-07-16)

1. **Keep Reddit disabled now.** A free public site is not enough to treat a business
   use as non-commercial under Reddit’s current guidance.
2. **Request written approval** using the contact route below.
3. **Enable only after approval:** set the three OAuth secrets plus the repository
   variable `REDDIT_DATA_API_APPROVED=1`; otherwise the source returns no items.

## What the code does now (implemented)

- **Approval + OAuth only, no scraping fallback.** Without the explicit approval
  variable, OAuth token, and contact username, `fetchReddit` returns `[]` and never
  hits the public `*.json` endpoints.
  Unauthenticated scraping is both unreliable from CI (datacenter IPs get 403) and not
  a clean path for a commercial product. (`pipeline/sources/reddit.ts`)
- **Reddit-format User-Agent.** `web:ai-today-brief:1.0 (by /u/<username>)` — the
  contact is `REDDIT_USERNAME` when set, else the site URL. Generic UAs are
  "drastically limited" by Reddit. (`pipeline/sources/feeds.ts`)
- **Metadata-only persistence.** We store only `{subreddit, permalink, score,
  num_comments, created_utc, title}` in `articles.raw` — never `author`, `selftext`,
  awards, or thumbnails. This avoids over-collection and the content-deletion
  liability of mirroring user content. (`pipeline/sources/reddit.ts`)
- **Self-posts skipped; link-out only.** Unchanged — we never republish Reddit-hosted
  user content as a brief item body.

## Known follow-ups (do when re-enabling, not before)

- **Honor rate-limit headers.** `fetchWithRetry` reacts to `429` with a fixed backoff
  but ignores `Retry-After` and `X-Ratelimit-Remaining`/`-Reset`. Trivial at our
  volume, but the correct pattern once live. (`pipeline/sources/http.ts`)
- **Cache the OAuth token.** Currently fetched fresh each run; `client_credentials`
  tokens last ~1 h with no refresh token. Harmless at 3 runs/day. (`reddit.ts`)
- **Short retention / deletion sync.** Reddit recommends purging stored Reddit-derived
  content within ~48 h and forbids retaining deleted posts. If Reddit stays a
  long-term source, add a TTL/purge for the Reddit-derived columns.
- **Display posture.** Surface the stored permalink as a back-link, and never render
  ads directly alongside Reddit-derived content (explicitly prohibited).
- **Keep ranking deterministic.** If score/comments ever feed a *trained* ranking
  model, that re-enters the AI-training prohibition — flag for review first.

## How to apply for approval

Reddit blocks automated fetches of its help pages, so the exact ticket-form URL can't
be linked here reliably. Entry point: the official **Developer Platform & Accessing
Reddit Data** help article and follow its commercial "reach out / contact us" link:
<https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data>

Suggested request text:

```
Subject: Commercial Data API access — AI Today Brief (low-volume, metadata-only)

Hi Reddit team,

I run AI Today Brief (https://aitodaybrief.com), a daily curated AI/engineering news
brief. It is currently free (no payments, paywall, or ads). I plan to add paid
subscriptions later, so I'm requesting commercial Data API approval in advance to have
it in place before monetizing.

Intended use is deliberately minimal and good-faith:
- ~24 authenticated OAuth requests/day total (3 runs × 7 dev/AI subreddits' top-of-day
  listings) — far under the 100 QPM free-tier limit.
- We read only post METADATA (title, score, comment count, permalink) as a
  deterministic ranking signal to spot what dev communities are discussing.
- We only keep posts that link OUT; self-posts are skipped. We do NOT ingest or
  republish post bodies or comments.
- We summarise the EXTERNAL linked article, not Reddit content. We do NOT train or
  fine-tune any AI/ML model on Reddit data.
- We link back to the Reddit permalink as attribution and run no ads alongside
  Reddit-derived content.

Registered app: <fill in app name / client_id after creating a "script" or "web" app
at reddit.com/prefs/apps>. Reddit account: u/<username>. Contact: hello@sashakuzmenko.com.

Could you confirm whether this qualifies for free commercial access, or what tier/
agreement we'd need? Happy to provide anything else.

Thanks!
```

## How to enable after written approval

1. Create a **`script`** (or `web`) app at <https://www.reddit.com/prefs/apps>
   (`redirect uri` can be `http://localhost:8080`; unused for `client_credentials`).
2. Set GitHub Actions secrets: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`
   (already wired in `.github/workflows/pipeline.yml`).
3. Set `REDDIT_USERNAME` (env / secret) so the User-Agent carries `/u/<username>`.
4. Set GitHub repository variable `REDDIT_DATA_API_APPROVED=1`, recording the approval
   reference in the repository issue or this document.
5. For local testing, add the same four values to `.env.local`.
5. Run the pipeline; confirm source health shows Reddit `ok` (not `empty`).

## Sources

- Reddit Data API Terms — <https://www.redditinc.com/policies/data-api-terms>
- Developer Platform & Accessing Reddit Data — <https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data>
- Reddit Data API Wiki (limits, headers, User-Agent) — <https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki>
- Responsible Builder Policy (pre-approval, commercialization) — <https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy>
- Public Content Policy — <https://support.reddithelp.com/hc/en-us/articles/26410290525844-Public-Content-Policy>
- OAuth2 app types & grants — <https://github.com/reddit-archive/reddit/wiki/oauth2>
- API rules (User-Agent, rate-limit headers) — <https://github.com/reddit-archive/reddit/wiki/API>
