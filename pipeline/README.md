# `pipeline/` — the daily brief pipeline

End-to-end, step-by-step logic of how a day's brief is produced. Single entry
point: [`run-daily.ts`](./run-daily.ts). Five stages share typed structs and no
module-level mutable state:

```
                         pipeline/run-daily.ts (orchestrator + --dry-run)
                                        │
   ┌────────┬──────────┬─────────┬──────┴──────────┬─────────────┐
   ▼        ▼          ▼         ▼                  ▼             ▼
 FETCH ──► RANK ──►  SELECT ──► DEDUP  ──►     SUMMARIZE ──►  PUBLISH
 src/**   rank.ts  select.ts  embeddings.ts   summarize.ts   publish.ts
 fetch.ts topics.ts topics.ts  db.ts           (Gemini)       db.ts
   │                              │                              │
   └─ in-memory FetchedArticle[] ─┘                             │
                                                         Supabase (draft)
                                                         articles · briefs
                                                         brief_items
                                                         brief_item_embeddings
                                                         pipeline_runs
```

The store is the single source of truth. A brief is written as **`draft`**; a
human flips `briefs.status → published` (the editorial gate). The pipeline runs
**6 progóns per day** (every 4 h Kyiv: 00:00, 04:00, … 20:00). Each progón has
**4 retry slots** (every 30 min, 1.5 h window). After a successful publish +
Telegram notify, remaining slots in that progón skip — a pre-`npm ci` cycle-guard
(`.github/scripts/cycle-guard.mjs`) exits them in ~3 s. Interactive ✅/❌ cards go only to items
without `review_msg_id`. Draft items **sync by slug** across re-runs. The pipeline
holds the Supabase **service_role** key and is **never imported under `src/`**.

---

## File map

| File | Role | In coverage gate |
|---|---|---|
| `run-daily.ts` | Orchestration, `--dry-run`, per-stage `pipeline_runs` logging | excluded (IO) |
| `config.ts` | Env validation + tunables | ✅ |
| `fetch.ts` | Source orchestration + pure mappers (`prepareArticles`, `toCandidate`, window filter) | ✅ (network part `v8 ignore`) |
| `sources/http.ts` | `fetchWithRetry`, `FetchedArticle` type | excluded |
| `sources/feeds.ts` | HN queries, Reddit subs, RSS feeds, InBrief endpoint | excluded |
| `sources/{hacker-news,reddit,rss,inbrief}.ts` | Per-source fetchers | excluded |
| `rss-parse.ts` | Dependency-free RSS/Atom parser | ✅ |
| `rolling-window.ts` | 24h freshness cutoff helpers | ✅ |
| `rank.ts` | Clustering + the composite score | ✅ |
| `topics.ts` | `detectTopic` (diversity tag) + `categoryForTitle` (9 product categories) | ✅ |
| `text.ts` | Title similarity (Jaro/Jaccard) + `slugify`/`dedupeSlugs` | ✅ |
| `select.ts` | Quality floor + per-topic cap + pool size | ✅ |
| `embeddings.ts` | `gemini-embedding-001` @ 768 dims, batched, 429-backoff | ✅ (`embedInput`; SDK call `v8 ignore`) |
| `summarize.ts` | Gemini structured-JSON editor → bilingual brief | excluded (LLM IO) |
| `publish.ts` | Idempotent draft write composition | excluded (IO) |
| `db.ts` | Service-role client + queries (incl. `matchPublishedItem`, `storeItemEmbeddings`) | excluded (IO) |
| `log.ts` | Structured JSON logs | excluded |

---

## Step-by-step (what actually happens on `npm run pipeline`)

### 0. Config — `config.ts`
`loadPipelineConfig()` reads env (throws listing every missing var) and applies
tunables. `date` = today in UTC (`YYYY-MM-DD`) — this is the brief's unique key.

| Tunable (env) | Default | Range | Meaning |
|---|---|---|---|
| `MAX_ITEMS` | 8 | 1–10 | Max items the editor may keep (schema caps `rank` at 10) |
| `POOL_SIZE` | 16 | 4–40 | Candidates handed to the LLM after filters |
| `PER_TOPIC_CAP` | 2 | 1–5 | Max pooled items sharing one fine-grained topic |
| `MIN_SCORE` | 0.15 | 0–1 | Composite-score floor to enter the pool |
| `RECENT_TITLES` | 60 | 0–200 | Recently-published titles shown to the editor for dedup |
| `EMBED_LIMIT` | 20 | 1–50 | Max pool candidates to embed per run (quota guard) |
| `MAX_EMBED_DISTANCE` | 0.20 | 0.05–1 | Cosine distance ceiling for semantic dedup (lower = stricter) |
| `--dry-run` / `DRY_RUN=1` | off | — | Assemble + print, **no DB writes** (skips semantic dedup) |

Required env (first non-empty wins): `SCRAPPER_BASE_URL` ▸ `NEXT_PUBLIC_SUPABASE_URL` ▸ `SUPABASE_URL`;
`SCRAPPER_SERVICE_KEY` ▸ `SUPABASE_SERVICE_ROLE_KEY` ▸ `SUPABASE_SERVICE_KEY`; `GEMINI_API_KEY`.
Optional: `GEMINI_MODEL` (pin first in queue), `GEMINI_MODEL_PRIORITY` (comma substrings),
`GEMINI_MAX_MODEL_ATTEMPTS` (default 5). Summarize model order is fetched live from the
Gemini `models.list` API (newest flash/pro first); OpenRouter chain is the last resort.

### 1. Fetch — `fetch.ts` + `sources/**`
Pulls candidates concurrently (`Promise.allSettled`, so one dead source never
fails the run):
- **InBrief** — curated AI feed via its public Supabase RPC `get_archive_articles` (today + yesterday); carries an editorial `importance_score`.
- **Hacker News** — Algolia search over 11 AI/dev queries; carries points + comments (the engagement signal).
- **Reddit** — 7 dev/AI subreddits' top-of-day; carries score + comments; self-posts skipped.
- **RSS** — always-on 4th parallel source: 11 first-party lab + press feeds, parsed by the dependency-free `rss-parse.ts`. Promoted from thin-primary fallback so first-party announcements stop being structurally missed.

`collectArticles` also returns per-source health (ok/empty/failed, plus dead
RSS feeds) that `run-daily` logs to `pipeline_runs.meta.sources` and alerts to
Telegram, throttled to once per progón.

Every source maps onto one `FetchedArticle`. Then:
`prepareArticles` (drop non-http / empty-title, **de-dup by exact URL**,
canonical source names via `source-names.ts`) →
`filterToRollingWindow` (keep `published_at` within the last 24h). Output: an
in-memory `FetchedArticle[]`. **No DB yet.** If empty → run stops.

### 3.7. Enrich — `enrich.ts` (Phase 1)
For the top `ENRICH_LIMIT` (default 8) deduped pool candidates, fetch the
actual source page: heuristic readability extraction (largest `<article>` →
`<main>` → `<body>`, prose lines only, ≤ 8k chars), `og:image`, and the top 5
HN comments via Algolia when the story has an HN discussion. The summarizer
prompt gets a SOURCE MATERIAL block — items are written from full text
(numbers, prices, commands), not headlines. Failures degrade per-candidate.

### 4.5. Verify — `verify.ts` (Phase 1)
A second Gemini pass compares each drafted item's EN claims (title, summary,
facts, body) against its fetched source text and lists unsupported claims.
Non-fatal: failures land in `unsupported_claims` → `review_comment`, so the
Telegram reviewer decides with the warning in view. Skipped for items without
source text and when `VERIFY_CLAIMS=0`.

### 2. Rank — `rank.ts`
Each `FetchedArticle` → `Candidate` (`toCandidate`, one row = one "mention").

1. **Cluster same-event coverage** — `clusterByTitleSimilarity` groups candidates whose titles are similar (`titlesSimilar`: normalized **Jaro ≥ 0.82 OR** token **Jaccard ≥ 0.6**). The cluster lead is the highest-engagement member.
2. **Score each cluster** into `[0,1]` from six signals squashed individually (so the weights are truly proportional):

   | Signal | Weight | How it's computed |
   |---|---|---|
   | velocity | **0.30** | total engagement ÷ age-hours, saturating (15 pts/h ⇒ 0.5) |
   | cross-source | **0.22** | summed mentions, saturating (1.5 extra ⇒ 0.5) |
   | authority | **0.18** | max source-trust in the cluster (labs = 1.0 … unknown = 0.6) |
   | recency | **0.15** | `0.5 ^ (ageHours / 12)` — 12h half-life |
   | inbrief | **0.10** | `min(1, importance_score / 100)` |
   | breadth | **0.05** | count of **distinct** sources, saturating (1.5 extra ⇒ 0.5) |

3. **Demote clickbait/punditry** — multiplicative penalty up to ×0.5 for "X says…", "you won't believe…", "hot take", etc.
4. **Filter + sort + cap** — drop below `minScore` (0 at this stage; the floor is applied in select), sort desc, then **max 3 per source** (`capPerSource`).

Each surviving entry also gets `detectTopic(lead.title)` (for the diversity cap)
and `categoryForTitle(lead.title)` (the deterministic `category_slug` default).

### 3. Select — `select.ts`
Deterministic pool before the paid LLM call: drop `score < MIN_SCORE`, cap items
per fine-grained topic (`PER_TOPIC_CAP`), keep the top `POOL_SIZE`. Output:
`PoolItem[]` with a 1-based `ref` the editor selects by. If empty → run stops.

### 3.5. Semantic dedup — `embeddings.ts` + `db.ts` (`matchPublishedItem`)
Hard cross-day dedup before the LLM call — the counterpart to the title-based
dedup inside the LLM prompt, but deterministic and model-independent.

1. Embed up to `EMBED_LIMIT` pool candidate titles via `gemini-embedding-001`
   (768 dims, `SEMANTIC_SIMILARITY` task, batched ≤ 96, exponential 429-backoff).
2. For each embedding, call `match_published_item(embedding, MAX_EMBED_DISTANCE)` —
   a pgvector nearest-neighbour query against `brief_item_embeddings` restricted
   to `briefs.status = 'published'`.
3. Drop any candidate whose nearest published item is within `MAX_EMBED_DISTANCE`
   cosine distance (default 0.20). Catches the same story re-worded across days
   even when the titles share no tokens.
4. Re-number `ref`s so the LLM sees a contiguous 1..N. Candidates beyond
   `EMBED_LIMIT` (already below the pool cap in practice) pass through unchanged.
5. Logs `{ pool_in, pool_out, dropped }` to `pipeline_runs` as stage `'dedup'`.

**Skipped in `--dry-run`** (db is null). **Safe when `brief_item_embeddings` is
empty** — `matchPublishedItem` returns `null`, all candidates pass, the pipeline
accumulates semantic memory gradually as briefs are published.

After a successful publish, `storeItemEmbeddings` embeds the published items'
English titles and upserts into `brief_item_embeddings` (idempotent on
`brief_item_id`) so tomorrow's run can dedup against today's. Best-effort:
a failure here is logged but does not abort the run.

### 4. Summarize — `summarize.ts` (one Gemini call)
The editor-in-chief, EN-primary / UK-secondary, with a forced response schema:
- Input: the pool + up to `RECENT_TITLES` recently-**published** item titles (cross-day dedup context) + `MAX_ITEMS`.
- The prompt instructs: drop same-event repeats of published stories, collapse same-story candidates, avoid topic spam, drop punditry/clickbait, keep **at most `MAX_ITEMS`** (fewer/zero is valid), and write **both languages** plus a brief shell (title/intro).
- Per item the model returns: `category_slug` (constrained to the 9), `title/summary/why_matters/deep_dive` ×(en,uk), `takeaways` ×(en,uk), `tools_mentioned`.
- `parseBrief` resolves each item back to its candidate **by `ref`** (position is unreliable — the model reorders/drops); **skips hallucinated refs** and items with no English summary; validates `category_slug` (falls back to the deterministic one); derives each `slug` from the English title and **de-dupes within the brief**. An empty item list is a valid editorial outcome → run stops.

Bounded retry with optional fallback model; transient errors (429/5xx/network)
retry with backoff, fatal errors throw.

### 5. Publish — `publish.ts` + `db.ts` (idempotent)
Skipped entirely in `--dry-run` (which prints the assembled brief instead).
1. **`upsertArticles`** — upsert every fetched article as the raw audit trail (`onConflict: url`), return a `url → id` map for FK wiring.
2. **`upsertBriefForDate`** — upsert on unique `date`; keeps `published` status on re-runs (does not demote to draft).
3. **`syncBriefItems`** — draft briefs: full slug sync (reorder + drop removed slugs). Published briefs: append-only (new slugs as `pending`; never delete/overwrite approved or rejected rows).
4. **`pipeline_runs`** — each stage logs `{date, stage, status, duration_ms, meta}` (best-effort; a logging failure is non-fatal).

### 6. Editorial gate (out of this pipeline)
A human reviews the draft and sets `briefs.status = 'published'`. Only then does
RLS expose it to anon reads, and an on-publish `revalidateTag` should refresh ISR
(see `docs/07`, EPIC A — not wired yet).

---

## Data model touched

- **`articles`** — raw ingest + FK target. `url` unique; `hn_*`/`reddit_*`/`inbrief_score`, `raw` jsonb.
- **`briefs`** — one per `date` (unique), `slug` (globally unique), `title/intro_en/uk`, `status` `draft|published`, `generated_by`.
- **`brief_items`** — `unique(brief_id, rank)` and `unique(brief_id, article_id)`; `category_slug` → `categories`; bilingual text columns; `takeaways_*`/`tools_mentioned` jsonb; `search_tsv_*` are generated (never written).
- **`pipeline_runs`** — observability per stage.

## Run it

```bash
npm run pipeline:dry     # fetch + rank + summarize + print, NO writes
npm run pipeline         # also writes the day's DRAFT brief
# local env: the scripts expect env; for a local run use
#   npx tsx --env-file=.env.local pipeline/run-daily.ts [--dry-run]
# in CI the env comes from GitHub Actions secrets.
```

Failure semantics: partial source failures are absorbed (log + continue); the run
hard-fails only when a stage's result would be invalid (e.g. malformed editor
JSON). Re-running for the same date refreshes the draft.

---

## Known weak spots (brainstorm seeds)

Honest list of where this is thin — good places to pressure-test:

1. **All sync is non-destructive now** — `syncBriefItems` updates existing rows in place (matched by slug, or article when re-titled; rank/slug/review state survive) and appends genuinely new stories at the next free rank (cap 10). Removal is editorial only: ❌ reject suppresses the story for the day; 🔁 redo deletes the row so the next progón re-proposes it fresh.
2. ~~**Cross-day dedup is title-only.**~~ **Fixed** — step 3.5 embeds every pool candidate with `gemini-embedding-001` (768 dims) and drops any candidate whose cosine distance to a previously-published `brief_item_embeddings` row is ≤ `MAX_EMBED_DISTANCE` (default 0.20). The same event re-worded across days now lands close in vector space and is removed before the LLM call. *Residual:* the store is empty until at least one brief has been published; dedup strengthens over the first few days of use.
3. ~~**No cross-run signal accumulation.**~~ **Partially fixed** — after each successful publish, `storeItemEmbeddings` persists the published items' embeddings in `brief_item_embeddings`. Future runs check against them, so a story that keeps resurfacing stays blocked. Mention-count aggregation across days (the full testbed behaviour) is still per-run only.
4. ~~**Engagement signal is HN+Reddit only.**~~ **Mitigated** — top-trust first-party sources (Anthropic/OpenAI/…/NVIDIA blogs) get a velocity floor of 0.5 in `rank.ts`, so a fresh official announcement no longer loses to a noisy HN thread; recency decay still ages it out. Non-first-party RSS/InBrief items keep `velocity = 0` but are capped in the pool (`MAX_COLD_SINGLETONS`).
5. **`recentPublishedTitles` ordering.** It takes the 20 most recent published briefs, then their items ordered by **rank** (not date), limited to `RECENT_TITLES`. Skews toward rank-1 items; a not-yet-published draft from yesterday contributes nothing to dedup; with nothing published yet, dedup context is empty. *Note:* the title list is now a second, soft dedup layer — the primary hard block is the vector store (step 3.5).
6. **Clustering is title-only + O(n²).** Fine at ~127 items, but very differently-worded coverage of one event may **under-merge** (duplicates survive), and same-topic-different-story may **over-merge**.
7. **Topic/category detection is brittle regex.** English-only keyword patterns; `category_slug` derived from the English title; the LLM can override but the deterministic fallback can misfile.
8. ~~**UK quality is unverified.**~~ **Mitigated** — `lang-check.ts` flags `_uk` fields that look non-Ukrainian (incl. silent EN fallbacks) into `uk_quality_flags` → `review_comment`, so the Telegram reviewer sees the warning. Heuristic only; no deep linguistic validation.
9. **One LLM call, all-or-nothing.** The whole brief is one Gemini response; if `JSON.parse` fails despite the schema, the entire run throws — no per-item salvage. No overall wall-clock/cost budget (a real call took ~48s, ~20k chars).
10. **Source set is hard-coded and AI/dev-skewed.** New sources need code edits; X/Twitter only enters via what HN/Reddit surface. (~~No source-health metric~~ — per-source health + Telegram alerting now exist; the set itself is still static.)
11. ~~**Idempotency vs. human edits.**~~ **Fixed** — sync is non-destructive (see #1); re-runs update content fields but never delete rows or reset review state.

## Follow-ups (roadmap)

- ~~pgvector cross-day semantic dedup (`brief_item_embeddings`).~~ ✅ Done (migration 020).
- Scheduled trigger (GitHub Actions 06:00 / `pg_cron`) + on-publish `revalidateTag`.
- Admin-only draft review page with a publish-to-prod button (server action + `revalidateTag`).
- Telegram / newsletter publish (EPIC D) writing to `social_posts` / `newsletter_sends`.
- Per-run mention accumulation across days (carry forward cluster sizes from DB).
