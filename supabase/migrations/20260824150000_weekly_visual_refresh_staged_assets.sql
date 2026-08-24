begin;

-- A visual refresh has two deliberately separate publication boundaries:
--
-- 1. replacement pixels live only in the active private refresh revision;
-- 2. an AAL2 owner promotes *selected, reviewed* pixels as new artifact
--    versions in the existing published revision.
--
-- The published revision pointer, canonical text, SEO fields, PDF and social
-- package rows are never changed by this migration. Storage itself is not
-- transactional, so the server action copies and byte-verifies each object
-- into an immutable public key first; the RPC below then performs the only
-- public database state transition atomically.

create table if not exists public.weekly_visual_refresh_asset_promotions (
  id uuid primary key default gen_random_uuid(),
  weekly_digest_id uuid not null references public.weekly_digests(id) on delete cascade,
  refresh_revision_id uuid not null references public.weekly_digest_revisions(id) on delete cascade,
  source_revision_id uuid not null references public.weekly_digest_revisions(id) on delete restrict,
  staged_artifact_id uuid not null references public.weekly_digest_artifacts(id) on delete restrict,
  staged_direction_hash text not null,
  staged_version integer not null check (staged_version > 0),
  staged_input_hash text not null,
  published_artifact_id uuid not null references public.weekly_digest_artifacts(id) on delete restrict,
  published_slot_key text not null,
  published_version integer not null check (published_version > 0),
  public_storage_bucket text not null check (public_storage_bucket = 'social-assets'),
  public_storage_path text not null,
  public_byte_sha256 text not null check (public_byte_sha256 ~ '^[0-9a-f]{64}$'),
  promoted_by uuid references auth.users(id) on delete set null,
  promoted_at timestamptz not null default now(),
  unique (staged_artifact_id)
);

create index if not exists weekly_visual_refresh_asset_promotions_refresh_idx
  on public.weekly_visual_refresh_asset_promotions (refresh_revision_id, promoted_at desc);

alter table public.weekly_visual_refresh_asset_promotions enable row level security;
revoke all on table public.weekly_visual_refresh_asset_promotions from public, anon, authenticated;
grant select on table public.weekly_visual_refresh_asset_promotions to authenticated;

drop policy if exists "weekly visual refresh promotions: admin read"
  on public.weekly_visual_refresh_asset_promotions;
create policy "weekly visual refresh promotions: admin read"
  on public.weekly_visual_refresh_asset_promotions
  for select
  to authenticated
  using (public.is_social_admin());

drop trigger if exists weekly_visual_refresh_asset_promotions_immutable
  on public.weekly_visual_refresh_asset_promotions;
create trigger weekly_visual_refresh_asset_promotions_immutable
  before update or delete on public.weekly_visual_refresh_asset_promotions
  for each row execute function public.reject_weekly_digest_immutable_mutation();

-- The generic artifact guard still protects normal draft revisions. These two
-- narrowly proven paths are the only exceptions for a published edition:
-- active private staging and an INSERT/state-transition made by the dedicated
-- promotion RPC. Merely setting the GUC never permits an arbitrary rewrite of
-- a published artifact's identity, bytes, metadata, or text.
create or replace function public.guard_weekly_digest_artifact_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_is_visual_refresh_stage boolean := false;
  v_is_visual_asset_promotion boolean := false;
  v_is_visual_refresh_stage_write boolean := false;
  v_is_visual_refresh_stage_review boolean := false;
  v_is_visual_refresh_direction_write boolean := false;
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if tg_op = 'INSERT'
     and current_setting('app.weekly_digest_artifact_write', true)
       is distinct from 'allowed' then
    raise exception 'Artifact versions may be inserted only by the artifact RPC'
      using errcode = '42501';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = new.weekly_digest_id;

  v_is_visual_refresh_stage_write :=
    current_setting('app.weekly_visual_refresh_asset_stage', true) = 'allowed';
  v_is_visual_refresh_stage_review :=
    current_setting('app.weekly_visual_refresh_asset_stage_review', true) = 'allowed';
  v_is_visual_refresh_direction_write :=
    current_setting('app.weekly_visual_refresh_direction_write', true) = 'allowed';

  if v_digest.id is not null then
    v_is_visual_refresh_stage :=
      v_digest.status = 'published'
      and v_digest.active_revision_id = new.revision_id
      and (
        current_setting('app.weekly_visual_refresh', true) = 'allowed'
        or v_is_visual_refresh_stage_write
        or v_is_visual_refresh_stage_review
        or v_is_visual_refresh_direction_write
      )
      and exists (
        select 1
        from public.weekly_digest_revisions revision
        where revision.id = new.revision_id
          and revision.weekly_digest_id = v_digest.id
          and revision.visual_refresh_source_revision_id = v_digest.published_revision_id
      );
    v_is_visual_asset_promotion :=
      current_setting('app.weekly_visual_asset_promotion', true) = 'allowed'
      and v_digest.status = 'published'
      and v_digest.published_revision_id = new.revision_id
      and exists (
        select 1
        from public.weekly_digest_revisions refresh
        where refresh.id = v_digest.active_revision_id
          and refresh.weekly_digest_id = v_digest.id
          and refresh.visual_refresh_source_revision_id = v_digest.published_revision_id
      );
  end if;

  if v_digest.id is null
     or v_digest.status in ('publishing', 'cancelled')
     or (
       v_digest.status = 'published'
       and not (v_is_visual_refresh_stage or v_is_visual_asset_promotion)
     )
     or (
       v_digest.status <> 'published'
       and v_digest.active_revision_id is distinct from new.revision_id
     ) then
    raise exception 'Artifacts may target only the editable active revision'
      using errcode = '42501';
  end if;
  if v_digest.status = 'scheduled'
     and now() >= coalesce(v_digest.preflight_at, v_digest.release_at) then
    raise exception
      'The 15:45 Europe/Kyiv preflight gate has closed; pause the release before editing'
      using errcode = '55000';
  end if;

  if tg_op = 'INSERT' and v_is_visual_asset_promotion and (
    new.artifact_type not in ('cover', 'story_image')
    or new.locale <> 'neutral'
    or new.generation_status <> 'ready'
    or new.review_status <> 'approved'
    or new.is_current is not true
    or new.published_at is null
    or new.storage_bucket <> 'social-assets'
    or new.storage_path is null
    or new.external_url is not null
  ) then
    raise exception 'Visual refresh promotion may insert only a ready approved public cover or story image'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and (
    new.weekly_digest_id is distinct from old.weekly_digest_id
    or new.revision_id is distinct from old.revision_id
    or new.revision_item_id is distinct from old.revision_item_id
    or new.artifact_type is distinct from old.artifact_type
    or new.locale is distinct from old.locale
    or new.slot_key is distinct from old.slot_key
    or new.version is distinct from old.version
    or new.input_hash is distinct from old.input_hash
    or new.content is distinct from old.content
    or new.storage_bucket is distinct from old.storage_bucket
    or new.storage_path is distinct from old.storage_path
    or new.external_url is distinct from old.external_url
    or new.provider is distinct from old.provider
    or new.provider_id is distinct from old.provider_id
    or new.mime_type is distinct from old.mime_type
    or new.width is distinct from old.width
    or new.height is distinct from old.height
    or new.byte_size is distinct from old.byte_size
    or new.duration_seconds is distinct from old.duration_seconds
    or new.metadata is distinct from old.metadata
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Artifact identity and dependency fields are immutable';
  end if;

  if tg_op = 'UPDATE' and v_is_visual_asset_promotion and (
    old.revision_id is distinct from v_digest.published_revision_id
    or old.artifact_type not in ('cover', 'story_image')
    or old.is_current is not true
    or new.is_current is not false
    or old.review_status <> 'approved'
    or new.review_status <> 'stale'
    or new.generation_status is distinct from old.generation_status
    or new.published_at is distinct from old.published_at
  ) then
    raise exception 'Visual refresh promotion may only supersede an approved current published image'
      using errcode = '42501';
  end if;

  -- Direction updates invalidate only prompt-set versions. This capability is
  -- held by the narrow AAL2 direction RPC, not by the generic artifact review
  -- RPC, so it cannot be used to alter staged or published pixels.
  if tg_op = 'UPDATE' and v_is_visual_refresh_direction_write and (
    old.artifact_type <> 'story_prompt_set'
    or old.is_current is not true
    or new.is_current is not false
    or new.generation_status is distinct from old.generation_status
    or not (
      new.review_status is not distinct from old.review_status
      or (old.review_status = 'approved' and new.review_status = 'stale')
    )
  ) then
    raise exception 'Visual direction updates may only supersede current prompt-set artifacts'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and new.review_status is distinct from old.review_status
     and current_setting('app.weekly_digest_artifact_write', true)
            is distinct from 'allowed'
     and current_setting('app.weekly_digest_artifact_review', true)
            is distinct from 'allowed'
     and not v_is_visual_refresh_direction_write then
    raise exception 'Artifact review state may be changed only by artifact workflow RPCs'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE'
     and new.published_at is distinct from old.published_at
     and not v_is_visual_asset_promotion then
    raise exception 'Only the release worker may publish an artifact'
      using errcode = '42501';
  end if;
  if new.review_status = 'approved'
     and public.social_admin_role() <> 'owner' then
    raise exception 'Only an owner may approve an artifact'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

-- Public readers need only alt copy. Direction, prompts, QA reports, storage
-- provenance and source IDs remain confined to the private staged artifact
-- and immutable promotion record.
create or replace function public.weekly_visual_refresh_public_artifact_content(
  p_content jsonb
)
returns jsonb
language sql
immutable
set search_path = public
as $function$
  select jsonb_strip_nulls(jsonb_build_object(
    'alt', nullif(btrim(left(coalesce(p_content ->> 'alt', ''), 500)), ''),
    'alt_en', nullif(btrim(left(coalesce(p_content ->> 'alt_en', ''), 500)), ''),
    'alt_uk', nullif(btrim(left(coalesce(p_content ->> 'alt_uk', ''), 500)), '')
  ));
$function$;

create or replace function public.save_weekly_visual_refresh_staged_asset(
  p_weekly_digest_id uuid,
  p_revision_id uuid,
  p_revision_item_id uuid,
  p_artifact_type text,
  p_locale text,
  p_slot_key text,
  p_content jsonb,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_width integer,
  p_height integer,
  p_byte_size bigint,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, storage
as $function$
declare
  v_digest public.weekly_digests;
  v_revision public.weekly_digest_revisions;
  v_artifact_id uuid;
  v_version integer;
  v_expected_slot_key text;
  v_expected_prefix text;
begin
  if not public.has_social_role(array['owner']) or not public.has_social_aal2() then
    raise exception 'An AAL2 owner session is required to stage a visual refresh asset'
      using errcode = '42501';
  end if;
  if p_artifact_type not in ('cover', 'story_image') or p_locale <> 'neutral' then
    raise exception 'A visual refresh may stage only neutral cover or story_image assets';
  end if;
  if p_artifact_type = 'cover' and p_revision_item_id is not null then
    raise exception 'A staged cover cannot target a story item';
  end if;
  if p_artifact_type = 'story_image' and p_revision_item_id is null then
    raise exception 'A staged story image requires its refresh revision item';
  end if;
  if p_storage_bucket <> 'weekly-digest-private'
     or nullif(btrim(coalesce(p_storage_path, '')), '') is null
     or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
     or p_width is null or p_height is null or p_byte_size is null
     or p_width not between 1200 and 4096
     or p_height not between 675 and 2304
     or p_width * 9 <> p_height * 16
     or p_byte_size not between 1 and 12582912 then
    raise exception 'A staged visual refresh asset requires a validated 16:9 image upload';
  end if;
  if jsonb_typeof(coalesce(p_content, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Artifact content and metadata must be objects';
  end if;
  if coalesce(p_metadata ->> 'sha256', '') !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'A staged visual refresh asset requires its verified SHA-256';
  end if;
  if exists (
    select 1
    from (values (p_content ->> 'alt'), (p_content ->> 'alt_en'), (p_content ->> 'alt_uk')) alt(value)
    where char_length(coalesce(alt.value, '')) > 500
  ) then
    raise exception 'Image alt text is limited to 500 characters';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null
     or v_digest.status <> 'published'
     or v_digest.active_revision_id is distinct from p_revision_id
     or v_digest.published_revision_id is null then
    raise exception 'An active private visual-refresh revision of a published digest is required';
  end if;

  select revision.*
    into v_revision
  from public.weekly_digest_revisions revision
  where revision.id = p_revision_id
    and revision.weekly_digest_id = p_weekly_digest_id
  for update;
  if v_revision.id is null
     or v_revision.visual_refresh_source_revision_id is distinct from v_digest.published_revision_id then
    raise exception 'A staged asset must target the active private visual-refresh revision';
  end if;
  if p_revision_item_id is not null and not exists (
    select 1
    from public.weekly_digest_revision_items item
    where item.id = p_revision_item_id
      and item.revision_id = p_revision_id
  ) then
    raise exception 'The staged story image does not belong to this visual-refresh revision';
  end if;

  v_expected_slot_key := case
    when p_artifact_type = 'cover' then 'cover:neutral'
    else format('story-image:%s', p_revision_item_id)
  end;
  if btrim(coalesce(p_slot_key, '')) is distinct from v_expected_slot_key then
    raise exception 'The staged asset slot does not match its cover or refresh story target';
  end if;
  v_expected_prefix := format(
    'digests/%s/revisions/%s/uploads/binary-v2/%s/',
    p_weekly_digest_id,
    p_revision_id,
    p_artifact_type
  );
  if left(p_storage_path, char_length(v_expected_prefix)) <> v_expected_prefix
     or substring(p_storage_path from char_length(v_expected_prefix) + 1)
          !~ '^[0-9a-f]{64}[.](jpg|jpeg|png|webp)$'
     or (p_mime_type = 'image/jpeg' and p_storage_path !~* '[.](jpg|jpeg)$')
     or (p_mime_type = 'image/png' and p_storage_path !~* '[.]png$')
     or (p_mime_type = 'image/webp' and p_storage_path !~* '[.]webp$') then
    raise exception 'The staged file is outside the verified private upload namespace';
  end if;
  if not exists (
    select 1
    from storage.objects object
    where object.bucket_id = 'weekly-digest-private'
      and object.name = p_storage_path
  ) then
    raise exception 'The verified private upload object was not found';
  end if;

  perform set_config('app.weekly_digest_artifact_write', 'allowed', true);
  perform set_config('app.weekly_visual_refresh_asset_stage', 'allowed', true);
  select coalesce(max(artifact.version), 0) + 1
    into v_version
  from public.weekly_digest_artifacts artifact
  where artifact.revision_id = p_revision_id
    and artifact.slot_key = v_expected_slot_key;

  update public.weekly_digest_artifacts artifact
  set is_current = false,
      review_status = case when artifact.review_status = 'approved' then 'stale' else artifact.review_status end
  where artifact.revision_id = p_revision_id
    and artifact.slot_key = v_expected_slot_key
    and artifact.is_current;

  insert into public.weekly_digest_artifacts (
    weekly_digest_id, revision_id, revision_item_id, artifact_type, locale, slot_key, version,
    generation_status, review_status, input_hash, content, storage_bucket, storage_path,
    mime_type, width, height, byte_size, metadata, created_by
  ) values (
    p_weekly_digest_id, p_revision_id, p_revision_item_id, p_artifact_type, p_locale,
    v_expected_slot_key, v_version, 'ready', 'in_review',
    public.weekly_digest_artifact_input_hash(
      p_revision_id, p_artifact_type, p_locale, p_revision_item_id
    ),
    coalesce(p_content, '{}'::jsonb),
    'weekly-digest-private',
    p_storage_path,
    p_mime_type, p_width, p_height, p_byte_size,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'visual_refresh_asset_staged', true,
      'visual_refresh_source_revision_id', v_digest.published_revision_id,
      'visual_refresh_direction_hash', v_revision.content_hash
    ),
    auth.uid()
  )
  returning id into v_artifact_id;

  insert into public.weekly_digest_artifact_reviews (
    artifact_id, reviewer_id, action, note, artifact_snapshot
  ) values (
    v_artifact_id, auth.uid(), 'edited',
    'Image uploaded into private visual-refresh staging.',
    jsonb_build_object(
      'slot_key', v_expected_slot_key,
      'artifact_type', p_artifact_type,
      'version', v_version,
      'visual_refresh_asset_staged', true
    )
  );

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    p_weekly_digest_id, p_revision_id, auth.uid(), 'visual_refresh_asset_staged',
    jsonb_build_object(
      'artifact_id', v_artifact_id,
      'artifact_type', p_artifact_type,
      'slot_key', v_expected_slot_key
    )
  );
  return v_artifact_id;
end;
$function$;

-- Direction edits cancel prompt jobs in 241400. They must also make staged
-- pixels ineligible: otherwise an owner can accidentally apply an image that
-- was approved against a prior visual thesis. Keep the historical artifact row
-- reviewable, but mark its current staged version stale and audit that action.
create or replace function public.invalidate_weekly_visual_refresh_staged_assets()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.visual_refresh_source_revision_id is not null
     and new.content_hash is distinct from old.content_hash then
    perform set_config('app.weekly_digest_artifact_review', 'allowed', true);
    perform set_config('app.weekly_visual_refresh_asset_stage_review', 'allowed', true);
    with invalidated as (
      update public.weekly_digest_artifacts artifact
      set review_status = 'stale'
      where artifact.revision_id = new.id
        and artifact.is_current
        and artifact.metadata ->> 'visual_refresh_asset_staged' = 'true'
        and artifact.review_status <> 'stale'
      returning artifact.id, artifact.slot_key, artifact.version, artifact.input_hash
    )
    insert into public.weekly_digest_artifact_reviews (
      artifact_id, reviewer_id, action, note, artifact_snapshot
    )
    select
      invalidated.id,
      auth.uid(),
      'revoked',
      'Visual direction changed; staged image requires a new review.',
      jsonb_build_object(
        'slot_key', invalidated.slot_key,
        'version', invalidated.version,
        'input_hash', invalidated.input_hash,
        'reason', 'visual_direction_changed'
      )
    from invalidated;
  end if;
  return new;
end;
$function$;

drop trigger if exists weekly_visual_refresh_staged_assets_direction_fence
  on public.weekly_digest_revisions;
create trigger weekly_visual_refresh_staged_assets_direction_fence
  after update of content_hash on public.weekly_digest_revisions
  for each row execute function public.invalidate_weekly_visual_refresh_staged_assets();

-- The normal review RPC can still review ordinary draft artifacts. A staged
-- replacement is different: it is eligible to change pixels in an already
-- published edition, so the database enforces owner+AAL2 and the exact staged
-- provenance before allowing its review state to change. It deliberately does
-- not move the published digest through the normal release lifecycle.
create or replace function public.review_weekly_digest_artifact(
  p_artifact_id uuid,
  p_action text,
  p_note text default null
)
returns public.weekly_digest_artifacts
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_artifact public.weekly_digest_artifacts;
  v_status text;
  v_is_private_visual_stage boolean := false;
begin
  if not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  if p_action not in ('approved', 'changes_requested') then
    raise exception 'Artifact review action must be approved or changes_requested';
  end if;
  if p_action = 'approved' and public.social_admin_role() <> 'owner' then
    raise exception 'Only an owner can approve an artifact' using errcode = '42501';
  end if;
  if p_action = 'changes_requested'
     and char_length(btrim(coalesce(p_note, ''))) not between 10 and 2000 then
    raise exception 'A change request note must contain 10 to 2000 characters';
  end if;

  select artifact.*
    into v_artifact
  from public.weekly_digest_artifacts artifact
  where artifact.id = p_artifact_id
    and artifact.is_current
    and artifact.generation_status = 'ready'
  for update;
  if v_artifact.id is null then
    raise exception 'A ready current artifact was not found';
  end if;

  select exists (
    select 1
    from public.weekly_digests digest
    join public.weekly_digest_revisions refresh
      on refresh.id = v_artifact.revision_id
     and refresh.weekly_digest_id = digest.id
    where digest.id = v_artifact.weekly_digest_id
      and digest.status = 'published'
      and digest.active_revision_id = v_artifact.revision_id
      and digest.published_revision_id is not null
      and refresh.visual_refresh_source_revision_id = digest.published_revision_id
  ) into v_is_private_visual_stage;

  if v_is_private_visual_stage then
    if public.social_admin_role() <> 'owner' or not public.has_social_aal2() then
      raise exception 'An AAL2 owner session is required to review a staged visual-refresh image'
        using errcode = '42501';
    end if;
    if v_artifact.artifact_type not in ('cover', 'story_image')
       or v_artifact.locale <> 'neutral'
       or coalesce(v_artifact.metadata ->> 'visual_refresh_asset_staged', 'false') <> 'true' then
      raise exception 'Only a dedicated staged cover or story image may be reviewed in a visual refresh';
    end if;
    perform set_config('app.weekly_visual_refresh_asset_stage_review', 'allowed', true);
  end if;

  perform set_config('app.weekly_digest_artifact_review', 'allowed', true);
  v_status := case when p_action = 'approved' then 'approved' else 'changes_requested' end;
  update public.weekly_digest_artifacts artifact
  set review_status = v_status
  where artifact.id = p_artifact_id
    and artifact.is_current
    and artifact.generation_status = 'ready'
  returning artifact.* into v_artifact;
  if v_artifact.id is null then
    raise exception 'A ready current artifact was not found';
  end if;

  insert into public.weekly_digest_artifact_reviews (
    artifact_id, reviewer_id, action, note, artifact_snapshot
  ) values (
    v_artifact.id,
    auth.uid(),
    p_action,
    nullif(btrim(coalesce(p_note, '')), ''),
    jsonb_build_object(
      'slot_key', v_artifact.slot_key,
      'version', v_artifact.version,
      'input_hash', v_artifact.input_hash,
      'review_status', v_status,
      'visual_refresh_asset_staged', v_is_private_visual_stage
    )
  );

  -- A private visual refresh does not reopen or change a published digest.
  if not v_is_private_visual_stage then
    update public.weekly_digests
    set status = case
          when p_action = 'changes_requested' then 'changes_requested'
          else 'in_review'
        end,
        approved_by = null,
        approved_at = null,
        preflight_override = null,
        preflight_override_by = null,
        preflight_override_at = null,
        preflight_checked_at = null,
        scheduled_at = null,
        publishing_started_at = null,
        last_error = null
    where id = v_artifact.weekly_digest_id
      and active_revision_id = v_artifact.revision_id
      and status not in ('publishing', 'published', 'cancelled');
  end if;

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    v_artifact.weekly_digest_id,
    v_artifact.revision_id,
    auth.uid(),
    'artifact_reviewed',
    jsonb_build_object(
      'artifact_id', v_artifact.id,
      'slot_key', v_artifact.slot_key,
      'action', p_action,
      'visual_refresh_asset_staged', v_is_private_visual_stage
    )
  );

  return v_artifact;
end;
$function$;

-- A passing automated critic is evidence for the owner, not an approval to
-- change pixels on a published edition. The ordinary machine-attestation
-- worker remains available for normal drafts, but it must leave an explicitly
-- staged private-refresh cover/story image in review until an AAL2 owner makes
-- the review decision through the narrow RPC above.
create or replace function public.machine_attest_weekly_digest_artifact(p_artifact_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_artifact public.weekly_digest_artifacts;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  select artifact.*
    into v_artifact
  from public.weekly_digest_artifacts artifact
  where artifact.id = p_artifact_id
    and artifact.is_current;
  if v_artifact.id is null then
    raise exception 'Current artifact was not found';
  end if;
  if v_artifact.generation_status is distinct from 'ready' then
    return null;
  end if;
  if v_artifact.review_status = 'approved' then
    return v_artifact.id;
  end if;

  -- `metadata` is only a signal here; the linked active private revision is
  -- the authoritative provenance check. A malicious marker on an ordinary
  -- draft can at most prevent its automatic attestation, never gain approval.
  if v_artifact.artifact_type in ('cover', 'story_image')
     and coalesce(v_artifact.metadata ->> 'visual_refresh_asset_staged', 'false') = 'true'
     and exists (
       select 1
       from public.weekly_digests digest
       join public.weekly_digest_revisions refresh
         on refresh.id = v_artifact.revision_id
        and refresh.weekly_digest_id = digest.id
       where digest.id = v_artifact.weekly_digest_id
         and digest.status = 'published'
         and digest.active_revision_id = v_artifact.revision_id
         and digest.published_revision_id is not null
         and refresh.visual_refresh_source_revision_id = digest.published_revision_id
     ) then
    return null;
  end if;

  if v_artifact.artifact_type not in (
    'research_pack',
    'content_quality_report',
    'article',
    'pdf',
    'video_script',
    'video_manifest',
    'story_prompt_set',
    'story_image',
    'cover'
  ) then
    return null;
  end if;
  if v_artifact.artifact_type = 'research_pack'
     and jsonb_typeof(coalesce(v_artifact.content -> 'risks', '[]'::jsonb)) = 'array'
     and exists (
       select 1
       from jsonb_array_elements_text(coalesce(v_artifact.content -> 'risks', '[]'::jsonb)) flag
       where flag ~* 'hallucin'
     ) then
    return null;
  end if;
  if v_artifact.artifact_type = 'content_quality_report' then
    if public.weekly_quality_content_has_blockers(v_artifact.content) then
      return null;
    end if;
    if coalesce((v_artifact.metadata ->> 'passed')::boolean, false) is not true then
      return null;
    end if;
  end if;
  if v_artifact.artifact_type = 'article'
     and exists (
       select 1
       from public.weekly_digest_artifacts report
       where report.revision_id = v_artifact.revision_id
         and report.artifact_type = 'content_quality_report'
         and report.is_current
         and public.weekly_quality_content_has_blockers(report.content)
     ) then
    return null;
  end if;

  perform set_config('app.weekly_digest_artifact_review', 'allowed', true);
  update public.weekly_digest_artifacts artifact
  set review_status = 'approved'
  where artifact.id = p_artifact_id
    and artifact.is_current
    and artifact.generation_status = 'ready'
  returning artifact.* into v_artifact;

  insert into public.weekly_digest_artifact_reviews (
    artifact_id,
    reviewer_id,
    action,
    note,
    artifact_snapshot
  ) values (
    v_artifact.id,
    null,
    'approved',
    'machine_attested',
    jsonb_build_object(
      'slot_key', v_artifact.slot_key,
      'version', v_artifact.version,
      'machine_attested', true
    )
  );

  return v_artifact.id;
end;
$function$;

drop function if exists public.promote_weekly_visual_refresh_assets(uuid, uuid);
drop function if exists public.promote_weekly_visual_refresh_assets(uuid, uuid, uuid[], jsonb);
create function public.promote_weekly_visual_refresh_assets(
  p_weekly_digest_id uuid,
  p_revision_id uuid,
  p_staged_artifact_ids uuid[],
  p_public_assets jsonb
)
returns table (
  staged_artifact_id uuid,
  published_artifact_id uuid,
  slot_key text,
  version integer
)
language plpgsql
security definer
set search_path = public, storage
as $function$
declare
  v_digest public.weekly_digests;
  v_refresh public.weekly_digest_revisions;
  v_source public.weekly_digest_revisions;
  v_staged record;
  v_refresh_item public.weekly_digest_revision_items;
  v_target_item public.weekly_digest_revision_items;
  v_existing public.weekly_visual_refresh_asset_promotions;
  v_public jsonb;
  v_target_slot_key text;
  v_target_version integer;
  v_public_path text;
  v_public_sha256 text;
  v_public_bucket text;
  v_expected_public_prefix text;
  v_target_slots text[] := '{}'::text[];
  v_selected_count integer;
  v_source_cover_count integer;
  v_promoted_count integer := 0;
  v_current_hash text;
  v_superseded record;
begin
  if not public.has_social_role(array['owner']) or not public.has_social_aal2() then
    raise exception 'An AAL2 owner session is required to apply visual refresh assets'
      using errcode = '42501';
  end if;
  if cardinality(p_staged_artifact_ids) is null or cardinality(p_staged_artifact_ids) = 0 then
    raise exception 'Select at least one approved staged image to apply';
  end if;
  if (
    select count(*) from unnest(p_staged_artifact_ids) selected(id)
  ) <> (
    select count(distinct selected.id) from unnest(p_staged_artifact_ids) selected(id)
  ) then
    raise exception 'A staged image may be selected only once';
  end if;
  if jsonb_typeof(coalesce(p_public_assets, 'null'::jsonb)) <> 'array' then
    raise exception 'Public copies must be an array';
  end if;
  if jsonb_array_length(p_public_assets) <> cardinality(p_staged_artifact_ids)
     or exists (
       select 1
       from jsonb_array_elements(p_public_assets) entry(value)
       where jsonb_typeof(entry.value) <> 'object'
     )
     or exists (
       select 1
       from jsonb_array_elements(p_public_assets) entry(value)
       group by entry.value ->> 'staged_artifact_id'
       having count(*) <> 1
     )
     or exists (
       select 1
       from jsonb_array_elements(p_public_assets) entry(value)
       where not exists (
         select 1
         from unnest(p_staged_artifact_ids) selected(id)
         where selected.id::text = entry.value ->> 'staged_artifact_id'
       )
     ) then
    raise exception 'Public copies must contain exactly one reference for every selected staged image';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null
     or v_digest.status <> 'published'
     or v_digest.active_revision_id is distinct from p_revision_id
     or v_digest.published_revision_id is null then
    raise exception 'An active private visual-refresh revision of a published digest is required';
  end if;

  select revision.*
    into v_refresh
  from public.weekly_digest_revisions revision
  where revision.id = p_revision_id
    and revision.weekly_digest_id = p_weekly_digest_id
  for update;
  if v_refresh.id is null
     or v_refresh.visual_refresh_source_revision_id is distinct from v_digest.published_revision_id then
    raise exception 'Only the active private visual-refresh revision may apply staged assets';
  end if;
  select revision.*
    into v_source
  from public.weekly_digest_revisions revision
  where revision.id = v_digest.published_revision_id
    and revision.weekly_digest_id = p_weekly_digest_id
  for update;
  if v_source.id is null then
    raise exception 'Published weekly revision was not found';
  end if;
  v_current_hash := v_refresh.content_hash;

  select count(*)
    into v_selected_count
  from public.weekly_digest_artifacts artifact
  where artifact.id = any(p_staged_artifact_ids);
  if v_selected_count <> cardinality(p_staged_artifact_ids) then
    raise exception 'One or more selected staged images no longer exist';
  end if;

  -- Lock every selected source before deriving slots or reading its public
  -- upload record. This prevents a concurrent upload/review/direction edit
  -- from changing a selection halfway through the apply transaction.
  perform 1
  from public.weekly_digest_artifacts artifact
  where artifact.id = any(p_staged_artifact_ids)
  order by artifact.id
  for update;

  -- First pass: fail closed before superseding one public slot. It checks
  -- provenance, direction fence, canonical targets, deterministic public keys
  -- and immutable public-object existence for every selected staged asset.
  for v_staged in
    select artifact.*
    from public.weekly_digest_artifacts artifact
    where artifact.id = any(p_staged_artifact_ids)
    order by artifact.artifact_type, artifact.id
  loop
    if v_staged.weekly_digest_id is distinct from p_weekly_digest_id
       or v_staged.revision_id is distinct from p_revision_id
       or v_staged.is_current is not true
       or v_staged.generation_status <> 'ready'
       or v_staged.review_status <> 'approved'
       or v_staged.artifact_type not in ('cover', 'story_image')
       or v_staged.locale <> 'neutral'
       or v_staged.storage_bucket <> 'weekly-digest-private'
       or v_staged.storage_path is null
       or v_staged.mime_type not in ('image/jpeg', 'image/png', 'image/webp')
       or coalesce(v_staged.metadata ->> 'visual_refresh_asset_staged', 'false') <> 'true'
       or v_staged.metadata ->> 'visual_refresh_direction_hash' is distinct from v_current_hash
       or coalesce(v_staged.metadata ->> 'sha256', '') !~ '^[0-9a-fA-F]{64}$' then
      raise exception 'A selected image is not a current approved asset for this visual direction';
    end if;
    if not exists (
      select 1
      from storage.objects object
      where object.bucket_id = 'weekly-digest-private'
        and object.name = v_staged.storage_path
    ) then
      raise exception 'A selected staged private image no longer exists in Storage';
    end if;

    if v_staged.artifact_type = 'story_image' then
      select refresh_item.*
        into v_refresh_item
      from public.weekly_digest_revision_items refresh_item
      where refresh_item.id = v_staged.revision_item_id
        and refresh_item.revision_id = p_revision_id;
      if v_refresh_item.id is null
         or v_staged.slot_key is distinct from format('story-image:%s', v_refresh_item.id) then
        raise exception 'The selected staged story image has invalid refresh-item provenance';
      end if;
      select source_item.*
        into v_target_item
      from public.weekly_digest_revision_items source_item
      where source_item.revision_id = v_source.id
        and source_item.rank = v_refresh_item.rank
        and source_item.brief_item_id is not distinct from v_refresh_item.brief_item_id;
      if v_target_item.id is null then
        raise exception 'The published story corresponding to this staged image was not found';
      end if;
      v_target_slot_key := format('story-image:%s', v_target_item.id);
    else
      if v_staged.revision_item_id is not null or v_staged.slot_key <> 'cover:neutral' then
        raise exception 'The selected staged cover has invalid provenance';
      end if;
      v_target_item := null;
      -- The private staging lane uses cover:neutral, but generated published
      -- editions historically use cover:main. Reuse the actual published
      -- slot rather than creating a second current cover slot. The mutation
      -- below retires every old current cover row, so the new single cover is
      -- deterministic for every locale after promotion.
      select count(*)
        into v_source_cover_count
      from public.weekly_digest_artifacts artifact
      where artifact.revision_id = v_source.id
        and artifact.artifact_type = 'cover'
        and artifact.revision_item_id is null
        and artifact.locale = 'neutral'
        and artifact.is_current;
      if v_source_cover_count = 0 then
        raise exception 'The published weekly has no current neutral cover slot to replace';
      end if;
      select artifact.slot_key
        into v_target_slot_key
      from public.weekly_digest_artifacts artifact
      where artifact.revision_id = v_source.id
        and artifact.artifact_type = 'cover'
        and artifact.revision_item_id is null
        and artifact.locale = 'neutral'
        and artifact.is_current
      order by case artifact.slot_key
        when 'cover:main' then 0
        when 'cover:neutral' then 1
        else 2
      end, artifact.created_at desc, artifact.id desc
      limit 1;
    end if;
    if v_target_slot_key = any(v_target_slots) then
      raise exception 'Selected staged images collide on the same published visual slot';
    end if;
    v_target_slots := array_append(v_target_slots, v_target_slot_key);

    select entry.value
      into v_public
    from jsonb_array_elements(p_public_assets) entry(value)
    where entry.value ->> 'staged_artifact_id' = v_staged.id::text;
    v_public_bucket := btrim(coalesce(v_public ->> 'storage_bucket', ''));
    v_public_path := btrim(coalesce(v_public ->> 'storage_path', ''));
    v_public_sha256 := lower(btrim(coalesce(v_public ->> 'byte_sha256', '')));
    v_expected_public_prefix := format(
      'weekly/%s/visual-refresh/%s/staged/%s/v%s/%s/%s/binary-v2/',
      p_weekly_digest_id,
      p_revision_id,
      v_staged.id,
      v_staged.version,
      v_staged.input_hash,
      v_public_sha256
    );
    if v_public_bucket <> 'social-assets'
       or v_public_sha256 !~ '^[0-9a-f]{64}$'
       or v_public_sha256 is distinct from lower(v_staged.metadata ->> 'sha256')
       or left(v_public_path, char_length(v_expected_public_prefix)) <> v_expected_public_prefix
       or substring(v_public_path from char_length(v_expected_public_prefix) + 1)
            !~ '^[A-Za-z0-9][A-Za-z0-9._-]*[.](jpg|jpeg|png|webp)$'
       or not exists (
         select 1
         from storage.objects object
         where object.bucket_id = 'social-assets'
           and object.name = v_public_path
       ) then
      raise exception 'The selected staged image has no verified immutable public copy';
    end if;

    select promotion.*
      into v_existing
    from public.weekly_visual_refresh_asset_promotions promotion
    where promotion.staged_artifact_id = v_staged.id
    for update;
    if v_existing.id is not null and (
      v_existing.weekly_digest_id is distinct from p_weekly_digest_id
      or v_existing.refresh_revision_id is distinct from p_revision_id
      or v_existing.source_revision_id is distinct from v_source.id
      or v_existing.staged_direction_hash is distinct from v_current_hash
      or v_existing.staged_version is distinct from v_staged.version
      or v_existing.staged_input_hash is distinct from v_staged.input_hash
      or v_existing.published_slot_key is distinct from v_target_slot_key
      or v_existing.public_storage_bucket is distinct from v_public_bucket
      or v_existing.public_storage_path is distinct from v_public_path
      or v_existing.public_byte_sha256 is distinct from v_public_sha256
    ) then
      raise exception 'This staged image has an incompatible earlier promotion record';
    end if;
    if v_existing.id is not null and not exists (
      select 1
      from public.weekly_digest_artifacts published
      where published.id = v_existing.published_artifact_id
        and published.weekly_digest_id = p_weekly_digest_id
        and published.revision_id = v_source.id
        and published.artifact_type = v_staged.artifact_type
        and published.locale = 'neutral'
        and published.slot_key = v_target_slot_key
        and published.is_current
        and published.generation_status = 'ready'
        and published.review_status = 'approved'
        and published.published_at is not null
        and published.storage_bucket = 'social-assets'
        and published.storage_path = v_public_path
    ) then
      raise exception 'This staged image was superseded after its earlier promotion';
    end if;
  end loop;

  perform set_config('app.weekly_digest_artifact_write', 'allowed', true);
  perform set_config('app.weekly_visual_asset_promotion', 'allowed', true);

  -- Story rows first. A selected cover is inserted only after its selected
  -- stories are current, so its dependency fingerprint observes the applied
  -- public image set rather than the pre-refresh one.
  for v_staged in
    select artifact.*
    from public.weekly_digest_artifacts artifact
    where artifact.id = any(p_staged_artifact_ids)
    order by case artifact.artifact_type when 'story_image' then 0 else 1 end, artifact.id
  loop
    select promotion.*
      into v_existing
    from public.weekly_visual_refresh_asset_promotions promotion
    where promotion.staged_artifact_id = v_staged.id;

    if v_staged.artifact_type = 'story_image' then
      select refresh_item.*
        into v_refresh_item
      from public.weekly_digest_revision_items refresh_item
      where refresh_item.id = v_staged.revision_item_id;
      select source_item.*
        into v_target_item
      from public.weekly_digest_revision_items source_item
      where source_item.revision_id = v_source.id
        and source_item.rank = v_refresh_item.rank
        and source_item.brief_item_id is not distinct from v_refresh_item.brief_item_id;
      v_target_slot_key := format('story-image:%s', v_target_item.id);
    else
      v_target_item := null;
      select artifact.slot_key
        into v_target_slot_key
      from public.weekly_digest_artifacts artifact
      where artifact.revision_id = v_source.id
        and artifact.artifact_type = 'cover'
        and artifact.revision_item_id is null
        and artifact.locale = 'neutral'
        and artifact.is_current
      order by case artifact.slot_key
        when 'cover:main' then 0
        when 'cover:neutral' then 1
        else 2
      end, artifact.created_at desc, artifact.id desc
      limit 1;
    end if;

    if v_existing.id is not null then
      staged_artifact_id := v_staged.id;
      published_artifact_id := v_existing.published_artifact_id;
      slot_key := v_existing.published_slot_key;
      version := v_existing.published_version;
      return next;
      continue;
    end if;

    select entry.value
      into v_public
    from jsonb_array_elements(p_public_assets) entry(value)
    where entry.value ->> 'staged_artifact_id' = v_staged.id::text;
    v_public_path := btrim(v_public ->> 'storage_path');
    v_public_sha256 := lower(btrim(v_public ->> 'byte_sha256'));

    for v_superseded in
      update public.weekly_digest_artifacts artifact
      set is_current = false,
          review_status = 'stale'
      where artifact.revision_id = v_source.id
        and artifact.is_current
        and artifact.artifact_type = v_staged.artifact_type
        and (
          (v_staged.artifact_type = 'cover' and artifact.revision_item_id is null)
          or (v_staged.artifact_type = 'story_image' and artifact.revision_item_id = v_target_item.id)
        )
      returning artifact.id, artifact.slot_key, artifact.version, artifact.input_hash
    loop
      insert into public.weekly_digest_artifact_reviews (
        artifact_id, reviewer_id, action, note, artifact_snapshot
      ) values (
        v_superseded.id, auth.uid(), 'revoked',
        'Superseded by an approved visual-refresh image.',
        jsonb_build_object(
          'slot_key', v_superseded.slot_key,
          'version', v_superseded.version,
          'input_hash', v_superseded.input_hash,
          'reason', 'visual_refresh_asset_applied'
        )
      );
    end loop;

    select coalesce(max(artifact.version), 0) + 1
      into v_target_version
    from public.weekly_digest_artifacts artifact
    where artifact.revision_id = v_source.id
      and artifact.slot_key = v_target_slot_key;

    insert into public.weekly_digest_artifacts (
      weekly_digest_id, revision_id, revision_item_id, artifact_type, locale, slot_key, version,
      generation_status, review_status, input_hash, content, storage_bucket, storage_path,
      mime_type, width, height, byte_size, metadata, created_by, published_at
    ) values (
      p_weekly_digest_id, v_source.id, v_target_item.id, v_staged.artifact_type, 'neutral',
      v_target_slot_key, v_target_version, 'ready', 'approved',
      public.weekly_digest_artifact_input_hash(
        v_source.id, v_staged.artifact_type, 'neutral', v_target_item.id
      ),
      public.weekly_visual_refresh_public_artifact_content(v_staged.content),
      'social-assets', v_public_path,
      v_staged.mime_type, v_staged.width, v_staged.height, v_staged.byte_size,
      jsonb_build_object('sha256', v_public_sha256),
      auth.uid(), now()
    )
    returning id into published_artifact_id;

    insert into public.weekly_digest_artifact_reviews (
      artifact_id, reviewer_id, action, note, artifact_snapshot
    ) values (
      published_artifact_id, auth.uid(), 'approved',
      'Owner applied an approved private visual-refresh image.',
      jsonb_build_object(
        'slot_key', v_target_slot_key,
        'version', v_target_version,
        'input_hash', public.weekly_digest_artifact_input_hash(
          v_source.id, v_staged.artifact_type, 'neutral', v_target_item.id
        ),
        'approval_source', 'reviewed_private_stage'
      )
    );

    insert into public.weekly_visual_refresh_asset_promotions (
      weekly_digest_id, refresh_revision_id, source_revision_id,
      staged_artifact_id, staged_direction_hash, staged_version, staged_input_hash,
      published_artifact_id, published_slot_key, published_version,
      public_storage_bucket, public_storage_path, public_byte_sha256, promoted_by
    ) values (
      p_weekly_digest_id, p_revision_id, v_source.id,
      v_staged.id, v_current_hash, v_staged.version, v_staged.input_hash,
      published_artifact_id, v_target_slot_key, v_target_version,
      'social-assets', v_public_path, v_public_sha256, auth.uid()
    );

    staged_artifact_id := v_staged.id;
    slot_key := v_target_slot_key;
    version := v_target_version;
    v_promoted_count := v_promoted_count + 1;
    return next;
  end loop;

  if v_promoted_count > 0 then
    insert into public.weekly_digest_release_events (
      weekly_digest_id, revision_id, actor_id, event_type, payload
    ) values (
      p_weekly_digest_id, p_revision_id, auth.uid(), 'visual_refresh_assets_promoted',
      jsonb_build_object(
        'published_revision_id', v_source.id,
        'promoted_count', v_promoted_count,
        'published_revision_id_unchanged', v_digest.published_revision_id
      )
    );
  end if;
end;
$function$;

alter table public.weekly_digest_release_events
  drop constraint weekly_digest_release_events_event_type_check;
alter table public.weekly_digest_release_events
  add constraint weekly_digest_release_events_event_type_check
  check (event_type = any (array[
    'revision_created', 'revision_restored', 'artifact_saved', 'artifact_reviewed',
    'generation_queued', 'generation_started', 'generation_succeeded', 'generation_failed',
    'preflight_passed', 'preflight_failed', 'approved', 'scheduled', 'publishing_started',
    'publishing_retried', 'published', 'failed', 'paused', 'resumed', 'override',
    'draft_revision_created', 'visual_refresh_draft_created',
    'visual_refresh_direction_updated', 'job_cancelled', 'attest_failed',
    'visual_refresh_asset_staged', 'visual_refresh_assets_promoted'
  ]::text[]));

revoke all on function public.save_weekly_visual_refresh_staged_asset(
  uuid, uuid, uuid, text, text, text, jsonb, text, text, text, integer, integer, bigint, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.save_weekly_visual_refresh_staged_asset(
  uuid, uuid, uuid, text, text, text, jsonb, text, text, text, integer, integer, bigint, jsonb
) to authenticated;

revoke all on function public.promote_weekly_visual_refresh_assets(uuid, uuid, uuid[], jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.promote_weekly_visual_refresh_assets(uuid, uuid, uuid[], jsonb)
  to authenticated;

commit;
