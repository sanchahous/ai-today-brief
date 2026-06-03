# Supabase — AI Today Brief

Schema for the data layer + the `fetch→rank→summarize→publish` pipeline.

## Migrations

`migrations/` is the source of truth. Numbered sequentially.

**Content layer (`001`–`014`, ported verbatim from the proven ai-news schema):**

| Table           | Purpose                      | Key fields                                                                                                                                                                                 |
| --------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `articles`      | Raw ingest from sources      | `url` (unique), `source_name`, `published_at`, `raw` jsonb, `hn_score`, `reddit_score`, `mentions_count`, `composite_score`, `inbrief_score`                                               |
| `briefs`        | Daily issue                  | `date` (unique), `slug`, `title_en/uk`, `intro_en/uk`, `status` (draft/published), `published_at`                                                                                          |
| `brief_items`   | Published units (1–10/brief) | `brief_id`, `article_id`, `rank`, `summary/why_matters/title/deep_dive _en/uk`, `takeaways`, `tools_mentioned`, `social_hook`, `category_slug`, `slug`, `search_tsv_en/uk` (generated FTS) |
| `categories`    | Taxonomy                     | `slug` (PK), `name/description _en/uk`, `color`, `position`                                                                                                                                |
| `concepts`      | Concept hubs                 | `slug` (PK), `name/description _en/uk`, `type`, `category`, `aliases[]`                                                                                                                    |
| `pipeline_runs` | Pipeline observability       | `date`, `stage`, `status`, `duration_ms`, `meta`                                                                                                                                           |

RPCs: `search_brief_items`, `search_facets`. Extensions: `pgcrypto`, `uuid-ossp`, `pg_trgm`, `pg_stat_statements`.

**Business layer (`015_mvp_business_layer.sql`, from `docs/07a`):**

- `subscribers` — the email list (service_role only; writes via Edge Function + double opt-in).
- `newsletter_sends` — open/click analytics (feeds the decision-gate open-rate).
- `social_posts` — Telegram/X/LinkedIn publish tracking (public read of `posted`).
- `sponsors` / `sponsor_placements` — P1 monetization (anon reads only live placements).
- `profiles` / `saved_items` / `comments` / `brief_item_embeddings` — P2 scaffolding.
- Security advisor fixes: `pipeline_runs` no-public policy; pinned `search_path` on search RPCs; `pg_trgm`→`extensions` (manual, outside the txn — see file §4.3); RLS published-only audit checklist (§5).

> Strategy-specific fields (`content_type` news/evergreen/techarticle, `faq` jsonb, `last_reviewed_at`) are added **just-in-time** in P3/P4 when the UI + schema.org needs are concrete — not speculated here.

## How this DB is set up (relocate, not recreate)

Supabase free plan caps at 2 projects. The existing ai-news project **relocates** to this app (it moves out of the portfolio with the code) — we do **not** create a third:

1. **Full backup first** (`supabase db dump` / `pg_dump` → keep locally + `supabase/_legacy/`).
2. Rename the project to `ai-today-brief` in the dashboard.
3. Apply the delta: the live DB already has `001`–`014`; apply `015` (idempotent — only adds the business layer + fixes). For a **fresh** DB, all migrations apply in order.
4. Run the manual `pg_trgm` move + the RLS published-only audit (file §4.3, §5).
5. Rotate the keys; point this repo + the pipeline at the project.
6. `generate_typescript_types` → `src/lib/database.types.ts`. Re-run `get_advisors(security|performance)` until clean.

> ⚠️ Steps 1–5 mutate the live project — run only after explicit go-ahead. Until then this folder is just authored SQL.

## Env

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client, RLS-gated) · `SUPABASE_SERVICE_ROLE_KEY` (server/pipeline only — never `NEXT_PUBLIC`, never under `src/`). See `.env.example`.
