-- Editorial "angle" the owner sets/edits for a Top-3 feature story before the
-- weekly master runs (editorial quality overhaul, PR4). Keyed by
-- brief_item_id, NOT revision_item_id or revision_id -- the last month of
-- weekly-digest fixes (#177, #187) established that revision-keyed state
-- detaches whenever a Save mints a new revision underneath the operator, and
-- an editorial angle decided once for a story should survive that churn.
-- One row per (weekly_digest_id, brief_item_id); the admin action upserts.

create table if not exists public.weekly_digest_story_directions (
  id uuid primary key default gen_random_uuid(),
  weekly_digest_id uuid not null references public.weekly_digests (id) on delete cascade,
  brief_item_id uuid not null references public.brief_items (id) on delete cascade,
  angle text not null check (char_length(angle) > 0),
  -- Free-text hints the owner can leave for downstream stages (PR5 scene
  -- prompts). Optional -- the angle itself is the only required decision.
  editors_view_hint text null,
  scene_hint text null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (weekly_digest_id, brief_item_id)
);

create index if not exists weekly_digest_story_directions_digest_idx
  on public.weekly_digest_story_directions (weekly_digest_id);

alter table public.weekly_digest_story_directions enable row level security;

drop policy if exists "weekly story directions: admin read"
  on public.weekly_digest_story_directions;
create policy "weekly story directions: admin read"
  on public.weekly_digest_story_directions for select to authenticated
  using (public.is_social_admin());

revoke all on table public.weekly_digest_story_directions from public, anon, authenticated;
grant select on table public.weekly_digest_story_directions to authenticated;
grant all on table public.weekly_digest_story_directions to service_role;
