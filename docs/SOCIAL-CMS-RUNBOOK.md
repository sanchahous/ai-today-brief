# AI Today Brief Social CMS runbook

The CMS is deliberately safe on first deploy: migration `040_social_cms.sql`
creates `global_kill_switch = true`, disables every channel, and requires an
AAL2 owner approval before a variant can become publishable.

## 1. Deploy the foundation

1. Confirm the existing `039_match_relevant_item_window.sql` is present in
   production, then apply `039_social_publishing_queue.sql` followed by
   `040_social_cms.sql`. Apply the follow-up
   `20260717102343_social_scheduler_security_hardening.sql` and
   `20260717103150_social_admin_helper_invoker.sql` afterwards. Preserve the
   canonical filenames recorded in the target Supabase migration history; never
   rename an already-applied migration. Then apply
   `20260723063548_weekly_digest_editorial_reviews.sql` followed by
   `20260723095458_weekly_digest_v2.sql` and
   `20260723175658_weekly_digest_test_and_rolling_window.sql`. Never run the
   CMS migration before the delivery queue. Before production, run `supabase
   test db`; the Weekly tests roll back their RLS, DST, grants, dependency,
   lease and test-publication-lock assertions.
2. Verify the critical objects:

   ```sql
   select column_name
   from information_schema.columns
   where table_schema = 'public' and table_name = 'social_posts'
     and column_name in ('content_hash', 'approval_version', 'tracking_token');

   select id, global_kill_switch, channel_enabled
   from public.social_settings;
   ```

3. Deploy the Next.js application with the new server-only environment values
   from `.env.example`.
4. Create the owner in Supabase Auth manually. Do not enable public signup.
   Add the same email to `SOCIAL_ADMIN_EMAILS`.
5. Open `/admin`, use the magic link, then enroll TOTP. Approval and safety
   mutations redirect to `/admin/mfa` until the session reaches AAL2.

## 2. Configure Supabase Cron

Store the URL and bearer secret in Vault once. Use the deployed HTTPS origin,
not a preview URL.

```sql
select vault.create_secret(
  'https://aitodaybrief.com/api/internal/social/publish-due',
  'social_publish_due_url',
  'Next social queue worker endpoint'
);
select vault.create_secret(
  'https://aitodaybrief.com/api/internal/social/compose',
  'social_compose_url',
  'Next social package composer endpoint'
);
select vault.create_secret(
  'https://aitodaybrief.com/api/internal/weekly/generate',
  'weekly_generate_url',
  'Weekly Digest artifact generation worker'
);
select vault.create_secret(
  'https://aitodaybrief.com/api/internal/weekly/release-due',
  'weekly_release_due_url',
  'Weekly Digest release worker'
);
select vault.create_secret(
  '<same value as SOCIAL_CRON_SECRET>',
  'social_cron_secret',
  'Authorization bearer for social internal endpoints'
);
```

Enable `pg_cron` and `pg_net`, then create the jobs:

```sql
select cron.schedule(
  'social_publish_due',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'social_publish_due_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

select cron.schedule(
  'social_compose_review',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'social_compose_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

select cron.schedule(
  'weekly_digest_generate',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_generate_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

select cron.schedule(
  'weekly_digest_release_due',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_release_due_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
```

The composer is idempotent by date, kind, source, and generation version. A
30-minute trigger therefore does not regenerate or spend LLM budget after the
day's packages exist. Production Weekly composition begins on Sunday at 09:00
`Europe/Kyiv`: it uses the seven editorial days ending on that creation date
and schedules the next Monday's gates. Owners can create a separate test
edition in **Weekly Digest → Create test edition**; it exercises the same
generation, review, approval, scheduling and preflight path, but a database
lock prevents web publication and social delivery.

The weekly artifact worker claims one heavy versioned job per five-minute
invocation, with a lease and immutable idempotency key. This keeps image/PDF
generation inside the 55-second `pg_net` request timeout while progressively
draining the Sunday queue. The release worker may run every five minutes:
PostgreSQL only claims a `scheduled` edition for preflight at its stored Monday
15:45 `Europe/Kyiv` gate and for publication after its stored 16:00 release time.
Review and replacements remain open through Monday 15:45; after that gate the
owner must pause, edit, approve, and schedule the edition again.
When `TELEGRAM_BOT_TOKEN` and `TELEGRAM_REVIEW_CHAT_ID` are configured, failed
generation, blocked preflight, and release failures send a best-effort owner
alert linking directly to the edition workspace.

## 3. LLM writer and critic policy

Do not pin a retired numbered model as the default. The application reads the
live Gemini and OpenRouter catalogs, filters previews, expired endpoints and
previous Gemini generations, then records the provider and model used in the
quality report.

- Writer order: Gemini → OpenRouter → optional Ollama.
- Critic order: latest stable standard OpenAI Terra (never Sol or Terra Pro) →
  Claude Sonnet latest → current DeepSeek Pro → Gemini → optional Ollama. This
  keeps the first reviewer independent from the first writer.
- Set `SOCIAL_CRITIC_REQUIRED=true` in production. A variant without a
  successful current-generation audit cannot be approved in the CMS.
- A provider/model failure advances the cascade. Invalid JSON also counts as a
  failed attempt. The CMS stores sanitized attempt metadata, never raw provider
  errors.
- Critic flags and a score below `SOCIAL_CRITIC_MIN_SCORE` require owner review;
  they never approve content automatically.

Vercel production needs `GEMINI_API_KEY`, `OPEN_ROUTER_API_KEY`,
`SOCIAL_WRITER_PROVIDER_ORDER=gemini,openrouter`, and
`SOCIAL_CRITIC_PROVIDER_ORDER=openrouter,gemini`. Vercel cannot reach a local
Ollama instance on `127.0.0.1`.

For a local/manual terminal fallback, set this only in an uncommitted local env
file:

```dotenv
SOCIAL_OLLAMA_BASE_URL=http://127.0.0.1:11434/v1/
```

The router discovers installed text models from `/v1/models` and selects the
newest/largest eligible model. A remote Ollama endpoint is accepted only over
HTTPS and only with `SOCIAL_OLLAMA_API_KEY`; never expose an unauthenticated
Ollama port publicly.

After a critic outage or model change, open the package and press **Save** (no
copy change is required) or **Regenerate selected**. The new audit timestamp,
provider, model, score and flags appear in the package editor.

## 4. 20-day shadow discovery

Keep the global kill switch on. Generate recent packages locally or in a secure
one-off job:

```bash
npm run social:shadow -- --days 20
```

For each channel, record the reason for every manual edit. The rollout gate is
at least 90% of variants requiring no more than one short edit. Also confirm:

- every source item remains `approved` and its brief remains `published`;
- Instagram assets are five immutable 1080×1350 JPEG slides;
- X root copy is link-free and the tracked URL is in the self-reply;
- a save after approval moves the variant back to `in_review`;
- two simultaneous worker calls claim a post only once.

## 5. Connect and activate channels in waves

Connection and worker activation are separate controls. OAuth connection never
enables publishing by itself.

1. **Telegram**: configure the bot/channel, run one private/test post, mark the
   account healthy, enable the account and channel, then turn off the global
   switch for Telegram only.
2. **X**: configure OAuth 1.0a, keep the DB cap at or below €10/month, validate
   root + self-reply in a test account, then enable X.
3. **Threads**: use Settings → Connect OAuth, smoke test, then enable.
4. Observe Wave 1 for seven days before enabling LinkedIn.
5. **LinkedIn**: connect OAuth. If Standard organization posting access is not
   approved, use the package's native-scheduler link and leave the account
   disabled.
6. **Instagram/Facebook**: connect the Meta app, validate with Meta test users,
   and keep mandatory owner approval for at least two weeks.

The old GitHub `social-repost` and `weekly-digest` jobs are disabled unless the
repository variable `ENABLE_LEGACY_SOCIAL_WORKFLOWS=true` is set. Use that only
as an emergency fallback with the CMS kill switch on.

## 6. Incident and reconciliation procedure

- A provider timeout after the publish call becomes `needs_reconciliation`.
  The worker does not retry it.
- A clearly retryable provider response is retried after 5 minutes, 30 minutes,
  and 2 hours. Including the initial delivery, this is at most four provider
  calls; the audit table preserves every attempt.
- Open the package from the Telegram alert, check the native account, paste the
  live URL/external ID into the audit record if it exists, or create a new
  reviewed version if it does not.
- For incorrect live copy, turn on the global or channel kill switch first,
  open the direct live-post URL, and delete natively. The CMS never auto-deletes
  a live provider post.
- Permanent auth failures leave the package intact and raise an account warning.
- The X budget reservation is atomic. Reaching the hard cap fails safely before
  another provider request.

## 7. Acceptance smoke tests

Before production posting, run one private/test delivery per network and verify:

- anonymous and non-owner authenticated users cannot read CMS tables;
- AAL1 cannot approve, schedule, publish, change accounts, or change switches;
- editing exact copy, media, alt text, locale, format, or time revokes approval;
- a stale `publishing` row moves to `needs_reconciliation` after 15 minutes;
- `/r/s/<token>` records only post id, time, referrer host, and device class;
- a newsletter signup after that redirect stores the originating
  `social_post_id`;
- the global and per-channel switches stop queue claims.
- the mobile login/PWA shell passes `npx playwright test e2e/admin-mobile.spec.ts`;
  repeat login + TOTP + preview + edit + batch approval + cancel manually on
  private test data before each production wave.
