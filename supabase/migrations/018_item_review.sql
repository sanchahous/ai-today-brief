-- ============================================================================
-- 018 — Per-item editorial review (Telegram approve/reject workflow)
--
-- The daily pipeline writes a draft brief; the founder reviews each item one at
-- a time in a private Telegram chat (✅ approve / ❌ reject + reason). Only
-- APPROVED items of a PUBLISHED brief are ever shown publicly (the read-layer
-- filter lands in a later migration/PR). Rejected items stay in the DB with the
-- reason as a labelled dataset for fine-tuning.
--
-- This migration is additive and changes NO read behaviour on its own:
--   • adds review state columns to brief_items (existing rows backfilled to
--     'approved' so nothing already published is hidden once the filter lands);
--   • adds a self-contained item_reviews audit/dataset table (service-role only).
-- ============================================================================

begin;

-- ── brief_items: per-item review state ──────────────────────────────────────
alter table public.brief_items
  add column if not exists review_status  text not null default 'pending'
    check (review_status in ('pending','approved','rejected')),
  add column if not exists review_comment text,
  add column if not exists reviewed_at    timestamptz,
  add column if not exists reviewed_by    text,           -- Telegram user id/username
  add column if not exists review_msg_id  bigint;         -- Telegram message id (to edit ✅/❌)

-- Existing rows predate review → treat as approved so the future approved-only
-- public filter doesn't retroactively hide already-published content.
update public.brief_items set review_status = 'approved' where review_status = 'pending';

create index if not exists brief_items_review_status_idx
  on public.brief_items (review_status);

-- ── item_reviews: append-only decision log + fine-tuning dataset ─────────────
-- Self-contained (snapshots the reviewed content) so a row survives even if the
-- brief_item is later replaced on a draft re-run.
create table if not exists public.item_reviews (
  id            uuid primary key default gen_random_uuid(),
  brief_id      uuid,
  brief_item_id uuid references public.brief_items (id) on delete set null,
  action        text not null check (action in ('approved','rejected')),
  comment       text,                       -- founder's reason when rejecting
  reviewer      text,                       -- Telegram user id/username
  -- content snapshot (what was reviewed) — the training signal
  category_slug text,
  article_url   text,
  title_en      text,
  summary_en    text,
  model_output  jsonb,                      -- optional: the editor's raw item JSON
  created_at    timestamptz not null default now()
);

create index if not exists item_reviews_action_idx     on public.item_reviews (action);
create index if not exists item_reviews_created_at_idx  on public.item_reviews (created_at desc);

-- ── RLS: internal-only (service_role bypasses; no anon/authenticated access) ──
alter table public.item_reviews enable row level security;
-- No policies → anon/authenticated cannot read or write; all access is service-role
-- (the Telegram webhook / pipeline). Explicit deny for clarity:
drop policy if exists item_reviews_no_anon on public.item_reviews;
create policy item_reviews_no_anon on public.item_reviews
  for all to anon, authenticated using (false) with check (false);

commit;
