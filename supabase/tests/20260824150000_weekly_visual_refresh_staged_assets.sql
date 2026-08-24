-- Covers production migration version 20260824150000.
--
-- The second block deliberately exercises the promotion RPC against temporary
-- rows. It uses a synthetic AAL2 owner and rolls everything back: the only
-- mutable public-state transition it permits is the exact staged-id mapping
-- being tested here.
begin;

do $static$
declare
  v_stage text;
  v_promote text;
  v_guard text;
  v_review text;
  v_machine_attest text;
  v_content text;
  v_event_constraint text;
begin
  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'weekly_visual_refresh_asset_promotions'
      and relation.relrowsecurity
  ) then
    raise exception 'visual-refresh promotion mapping must be an RLS-protected table';
  end if;
  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.weekly_visual_refresh_asset_promotions'::regclass
      and constraint_row.contype = 'u'
      and pg_get_constraintdef(constraint_row.oid) like '%staged_artifact_id%'
  ) then
    raise exception 'each staged visual-refresh artifact needs one immutable promotion mapping';
  end if;

  select pg_get_functiondef(
    'public.save_weekly_visual_refresh_staged_asset(uuid,uuid,uuid,text,text,text,jsonb,text,text,text,integer,integer,bigint,jsonb)'::regprocedure
  ) into v_stage;
  if position('has_social_aal2' in v_stage) = 0
     or position('app.weekly_visual_refresh_asset_stage' in v_stage) = 0
     or position('weekly-digest-private' in v_stage) = 0
     or position('visual_refresh_direction_hash' in v_stage) = 0
     or position('storage.objects' in v_stage) = 0
     or position('cover:neutral' in v_stage) = 0
     or position('story-image:%s' in v_stage) = 0 then
    raise exception 'staging must be AAL2/provenance/storage fenced';
  end if;

  select pg_get_functiondef(
    'public.promote_weekly_visual_refresh_assets(uuid,uuid,uuid[],jsonb)'::regprocedure
  ) into v_promote;
  if position('has_social_aal2' in v_promote) = 0
     or position('count(distinct selected.id)' in v_promote) = 0
     or position('visual_refresh_direction_hash' in v_promote) = 0
     or position('v_target_slot_key = any(v_target_slots)' in v_promote) = 0
     or position('when ''story_image'' then 0 else 1' in lower(v_promote)) = 0
     or position('storage.objects object' in v_promote) = 0
     or position('This staged image was superseded after its earlier promotion' in v_promote) = 0
     or position('published_revision_id_unchanged' in v_promote) = 0 then
    raise exception 'promotion must retain exact-id, stale, collision, storage, ordering, and idempotency fences';
  end if;

  select pg_get_functiondef('public.weekly_visual_refresh_public_artifact_content(jsonb)'::regprocedure)
    into v_content;
  if position('alt_en' in v_content) = 0
     or position('alt_uk' in v_content) = 0
     or position('metadata' in lower(v_content)) > 0
     or position('prompt' in lower(v_content)) > 0 then
    raise exception 'published visual-refresh artifact content must be alt-only';
  end if;

  select pg_get_functiondef('public.guard_weekly_digest_artifact_write()'::regprocedure)
    into v_guard;
  if position('app.weekly_visual_refresh_asset_stage' in v_guard) = 0
     or position('app.weekly_visual_asset_promotion' in v_guard) = 0
     or position('Visual refresh promotion may insert only a ready approved public cover or story image' in v_guard) = 0
     or position('Artifact identity and dependency fields are immutable' in v_guard) = 0 then
    raise exception 'artifact guard must admit only narrow staging and promotion lanes';
  end if;

  select pg_get_functiondef('public.review_weekly_digest_artifact(uuid,text,text)'::regprocedure)
    into v_review;
  if position('An AAL2 owner session is required to review a staged visual-refresh image' in v_review) = 0
     or position('visual_refresh_asset_staged' in v_review) = 0
     or position('if not v_is_private_visual_stage then' in lower(v_review)) = 0 then
    raise exception 'staged image review must be AAL2 owner-only and leave published lifecycle untouched';
  end if;

  select pg_get_functiondef('public.machine_attest_weekly_digest_artifact(uuid)'::regprocedure)
    into v_machine_attest;
  if position('visual_refresh_asset_staged' in v_machine_attest) = 0
     or position('visual_refresh_source_revision_id = digest.published_revision_id' in v_machine_attest) = 0
     or position('and digest.active_revision_id = v_artifact.revision_id' in lower(v_machine_attest)) = 0
     or position('return null;' in lower(v_machine_attest)) = 0 then
    raise exception 'a staged visual-refresh image must never be machine-approved';
  end if;

  select pg_get_constraintdef(constraint_row.oid)
    into v_event_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'public.weekly_digest_release_events'::regclass
    and constraint_row.conname = 'weekly_digest_release_events_event_type_check';
  if position('visual_refresh_asset_staged' in coalesce(v_event_constraint, '')) = 0
     or position('visual_refresh_assets_promoted' in coalesce(v_event_constraint, '')) = 0
     or position('attest_failed' in coalesce(v_event_constraint, '')) = 0 then
    raise exception 'visual-refresh events must extend, not erase, existing release event types';
  end if;

  if has_function_privilege(
       'anon',
       'public.save_weekly_visual_refresh_staged_asset(uuid,uuid,uuid,text,text,text,jsonb,text,text,text,integer,integer,bigint,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.promote_weekly_visual_refresh_assets(uuid,uuid,uuid[],jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.promote_weekly_visual_refresh_assets(uuid,uuid,uuid[],jsonb)',
       'EXECUTE'
     ) then
    raise exception 'visual-refresh pixel RPC grants are not least-privilege';
  end if;
end;
$static$;

do $behavior$
declare
  v_owner uuid := '99999999-9999-4999-8999-999999999901';
  v_digest uuid := '99999999-9999-4999-8999-999999999902';
  v_source uuid := '99999999-9999-4999-8999-999999999903';
  v_refresh uuid := '99999999-9999-4999-8999-999999999904';
  v_source_item uuid := '99999999-9999-4999-8999-999999999905';
  v_refresh_item uuid := '99999999-9999-4999-8999-999999999906';
  v_stale_cover uuid := '99999999-9999-4999-8999-999999999907';
  v_cover uuid := '99999999-9999-4999-8999-999999999908';
  v_story uuid := '99999999-9999-4999-8999-999999999909';
  v_stale_hash text := repeat('a', 32);
  v_direction_hash text := repeat('b', 32);
  v_cover_input_hash text := repeat('c', 32);
  v_story_input_hash text := repeat('d', 32);
  v_stale_sha text := repeat('e', 64);
  v_cover_sha text := repeat('f', 64);
  v_story_sha text := repeat('1', 64);
  v_stale_private_path text;
  v_cover_private_path text;
  v_story_private_path text;
  v_stale_public_path text;
  v_cover_public_path text;
  v_story_public_path text;
  v_stale_public jsonb;
  v_public_assets jsonb;
  v_returned_ids uuid[];
  v_current_count integer;
  v_promoted_count integer;
  v_event_count integer;
  v_content jsonb;
  v_metadata jsonb;
begin
  -- Seed rows as service_role so the tests do not need an auth.users fixture.
  -- We switch to authenticated+AAL2 before exercising the actual RPC checks.
  perform set_config(
    'request.jwt.claims',
    format('{"sub":"%s","role":"service_role","aal":"aal2"}', v_owner),
    true
  );
  perform set_config('session_replication_role', 'replica', true);
  insert into public.social_admins (user_id, role, enabled)
  values (v_owner, 'owner', true);
  perform set_config('session_replication_role', 'origin', true);

  insert into public.weekly_digests (
    id, week_start, week_end, period_model, slug, status, title_en, title_uk
  ) values (
    v_digest, date '2099-01-04', date '2099-01-10', 'legacy_mon_sun',
    'visual-refresh-asset-promotion-test', 'draft', 'Canonical SEO title', 'Канонічний SEO заголовок'
  );
  insert into public.weekly_digest_revisions (
    id, weekly_digest_id, revision_number, title_en, title_uk,
    display_title_en, display_title_uk, visual_thesis_en, visual_thesis_uk, content_hash,
    visual_refresh_source_revision_id
  ) values (
    v_source, v_digest, 1, 'Canonical SEO title', 'Канонічний SEO заголовок',
    'Reader title', 'Заголовок читача', 'Explain the consequence clearly.', 'Чітко пояснити наслідок.',
    repeat('0', 32), null
  ), (
    v_refresh, v_digest, 2, 'Canonical SEO title', 'Канонічний SEO заголовок',
    'Reader title', 'Заголовок читача', 'Explain the consequence clearly.', 'Чітко пояснити наслідок.',
    v_stale_hash, v_source
  );
  insert into public.weekly_digest_revision_items (
    id, revision_id, rank, title_en, title_uk, summary_en, summary_uk, body_en, body_uk
  ) values (
    v_source_item, v_source, 1, 'Source story', 'Вихідна історія', 'Summary', 'Коротко', 'Body', 'Текст'
  ), (
    v_refresh_item, v_refresh, 1, 'Refresh story', 'Оновлена історія', 'Summary', 'Коротко', 'Body', 'Текст'
  );
  update public.weekly_digests
  set status = 'published',
      published_at = now(),
      published_revision_id = v_source,
      active_revision_id = v_refresh
  where id = v_digest;

  insert into public.weekly_digest_artifacts (
    weekly_digest_id, revision_id, revision_item_id, artifact_type, locale, slot_key,
    version, is_current, generation_status, review_status, input_hash, content,
    storage_bucket, storage_path, mime_type, width, height, byte_size, metadata, published_at
  ) values (
    v_digest, v_source, null, 'cover', 'neutral', 'cover:main',
    1, true, 'ready', 'approved', repeat('2', 32), '{"alt":"old cover"}',
    'social-assets', 'weekly/test/old-cover.jpg', 'image/jpeg', 1600, 900, 100,
    '{"sha256":"2222222222222222222222222222222222222222222222222222222222222222"}', now()
  ), (
    v_digest, v_source, v_source_item, 'story_image', 'neutral', format('story-image:%s', v_source_item),
    1, true, 'ready', 'approved', repeat('3', 32), '{"alt":"old story"}',
    'social-assets', 'weekly/test/old-story.jpg', 'image/jpeg', 1600, 900, 100,
    '{"sha256":"3333333333333333333333333333333333333333333333333333333333333333"}', now()
  );

  v_stale_private_path := format(
    'digests/%s/revisions/%s/uploads/binary-v2/cover/%s.jpg', v_digest, v_refresh, v_stale_sha
  );
  v_stale_public_path := format(
    'weekly/%s/visual-refresh/%s/staged/%s/v1/%s/%s/binary-v2/%s.jpg',
    v_digest, v_refresh, v_stale_cover, v_stale_hash, v_stale_sha, v_stale_sha
  );
  insert into public.weekly_digest_artifacts (
    id, weekly_digest_id, revision_id, artifact_type, locale, slot_key,
    version, is_current, generation_status, review_status, input_hash, content,
    storage_bucket, storage_path, mime_type, width, height, byte_size, metadata
  ) values (
    v_stale_cover, v_digest, v_refresh, 'cover', 'neutral', 'cover:neutral',
    1, true, 'ready', 'approved', v_stale_hash,
    '{"alt":"stale cover","prompt":"must remain private"}',
    'weekly-digest-private', v_stale_private_path, 'image/jpeg', 1600, 900, 100,
    jsonb_build_object(
      'sha256', v_stale_sha,
      'visual_refresh_asset_staged', true,
      'visual_refresh_direction_hash', v_stale_hash
    )
  );
  insert into storage.buckets (id, name, public)
  values ('weekly-digest-private', 'weekly-digest-private', false), ('social-assets', 'social-assets', true)
  on conflict (id) do nothing;
  insert into storage.objects (bucket_id, name)
  values ('weekly-digest-private', v_stale_private_path), ('social-assets', v_stale_public_path)
  on conflict (bucket_id, name) do nothing;
  v_stale_public := jsonb_build_array(jsonb_build_object(
    'staged_artifact_id', v_stale_cover,
    'storage_bucket', 'social-assets',
    'storage_path', v_stale_public_path,
    'byte_sha256', v_stale_sha
  ));

  -- A direction change revokes the old stage. Its id and public bytes still
  -- exist, but the stale hash cannot claim a published slot.
  -- Use a service claim without `sub` here so the audit row deliberately has
  -- no auth.users foreign-key fixture; the trigger itself still executes.
  perform set_config('request.jwt.claims', '{"role":"service_role","aal":"aal2"}', true);
  perform set_config('app.weekly_visual_refresh_direction_write', 'allowed', true);
  update public.weekly_digest_revisions
  set content_hash = v_direction_hash
  where id = v_refresh;
  perform set_config('app.weekly_visual_refresh_direction_write', '', true);
  if (select review_status from public.weekly_digest_artifacts where id = v_stale_cover) <> 'stale' then
    raise exception 'direction change did not stale the staged image';
  end if;
  -- The regular staging RPC versions a replacement and retires the stale
  -- current slot. Mirror that state here before inserting its version 2.
  update public.weekly_digest_artifacts
  set is_current = false
  where id = v_stale_cover;

  v_cover_private_path := format(
    'digests/%s/revisions/%s/uploads/binary-v2/cover/%s.jpg', v_digest, v_refresh, v_cover_sha
  );
  v_story_private_path := format(
    'digests/%s/revisions/%s/uploads/binary-v2/story_image/%s.jpg', v_digest, v_refresh, v_story_sha
  );
  v_cover_public_path := format(
    'weekly/%s/visual-refresh/%s/staged/%s/v2/%s/%s/binary-v2/%s.jpg',
    v_digest, v_refresh, v_cover, v_cover_input_hash, v_cover_sha, v_cover_sha
  );
  v_story_public_path := format(
    'weekly/%s/visual-refresh/%s/staged/%s/v1/%s/%s/binary-v2/%s.jpg',
    v_digest, v_refresh, v_story, v_story_input_hash, v_story_sha, v_story_sha
  );
  insert into public.weekly_digest_artifacts (
    id, weekly_digest_id, revision_id, revision_item_id, artifact_type, locale, slot_key,
    version, is_current, generation_status, review_status, input_hash, content,
    storage_bucket, storage_path, mime_type, width, height, byte_size, metadata
  ) values (
    v_cover, v_digest, v_refresh, null, 'cover', 'neutral', 'cover:neutral',
    2, true, 'ready', 'in_review', v_cover_input_hash,
    '{"alt":"A clear new cover","prompt":"private prompt","visual_thesis":"private thesis"}',
    'weekly-digest-private', v_cover_private_path, 'image/jpeg', 1600, 900, 100,
    jsonb_build_object(
      'sha256', v_cover_sha,
      'visual_refresh_asset_staged', true,
      'visual_refresh_direction_hash', v_direction_hash
    )
  ), (
    v_story, v_digest, v_refresh, v_refresh_item, 'story_image', 'neutral', format('story-image:%s', v_refresh_item),
    1, true, 'ready', 'in_review', v_story_input_hash,
    '{"alt":"A clear new story","prompt":"private prompt","qa":"private QA"}',
    'weekly-digest-private', v_story_private_path, 'image/jpeg', 1600, 900, 100,
    jsonb_build_object(
      'sha256', v_story_sha,
      'visual_refresh_asset_staged', true,
      'visual_refresh_direction_hash', v_direction_hash
    )
  );
  insert into storage.objects (bucket_id, name)
  values
    ('weekly-digest-private', v_cover_private_path),
    ('weekly-digest-private', v_story_private_path),
    ('social-assets', v_cover_public_path),
    ('social-assets', v_story_public_path)
  on conflict (bucket_id, name) do nothing;
  v_public_assets := jsonb_build_array(
    jsonb_build_object(
      'staged_artifact_id', v_cover,
      'storage_bucket', 'social-assets',
      'storage_path', v_cover_public_path,
      'byte_sha256', v_cover_sha
    ),
    jsonb_build_object(
      'staged_artifact_id', v_story,
      'storage_bucket', 'social-assets',
      'storage_path', v_story_public_path,
      'byte_sha256', v_story_sha
    )
  );

  -- A passing automated critic may record QA, but cannot approve pixels that
  -- are eligible to alter an already-published edition. Only the later AAL2
  -- owner review (represented by the fixture state transition below) may do
  -- that. This calls the real service-only RPC rather than merely inspecting
  -- its definition.
  perform set_config('request.jwt.claims', '{"role":"service_role","aal":"aal2"}', true);
  if public.machine_attest_weekly_digest_artifact(v_cover) is not null
     or public.machine_attest_weekly_digest_artifact(v_story) is not null
     or exists (
       select 1
       from public.weekly_digest_artifacts artifact
       where artifact.id in (v_cover, v_story)
         and artifact.review_status <> 'in_review'
     ) then
    raise exception 'a staged visual-refresh image was machine-approved';
  end if;
  -- The rest of this focused promotion fixture assumes an already reviewed
  -- selection. The separate review RPC behavior is static-tested above.
  update public.weekly_digest_artifacts
  set review_status = 'approved'
  where id in (v_cover, v_story);

  perform set_config(
    'request.jwt.claims',
    format('{"sub":"%s","role":"authenticated","aal":"aal2"}', v_owner),
    true
  );
  -- Keep FK triggers off only for test-only auth.uid() audit references. The
  -- RPC's own exact-id, hash, public-object and row-lock checks still execute.
  perform set_config('session_replication_role', 'replica', true);

  begin
    perform 1
    from public.promote_weekly_visual_refresh_assets(
      v_digest, v_refresh, array[v_stale_cover, v_stale_cover], v_stale_public
    );
    raise exception 'duplicate selected IDs were accepted';
  exception when others then
    if sqlerrm not like '%selected only once%' then raise; end if;
  end;
  begin
    perform 1
    from public.promote_weekly_visual_refresh_assets(
      v_digest, v_refresh, array[v_stale_cover], v_stale_public
    );
    raise exception 'stale direction stage was accepted';
  exception when others then
    if sqlerrm not like '%not a current approved asset for this visual direction%' then raise; end if;
  end;
  begin
    perform 1
    from public.promote_weekly_visual_refresh_assets(
      v_digest,
      v_refresh,
      array[v_cover, v_story],
      jsonb_build_array((v_public_assets -> 0), (v_public_assets -> 0))
    );
    raise exception 'duplicate public mapping IDs were accepted';
  exception when others then
    if sqlerrm not like '%exactly one reference%' then raise; end if;
  end;
  begin
    perform 1
    from public.promote_weekly_visual_refresh_assets(
      v_digest,
      v_refresh,
      array[v_cover],
      jsonb_build_array(jsonb_build_object(
        'staged_artifact_id', gen_random_uuid(),
        'storage_bucket', 'social-assets',
        'storage_path', v_cover_public_path,
        'byte_sha256', v_cover_sha
      ))
    );
    raise exception 'a public mapping for another staged ID was accepted';
  exception when others then
    if sqlerrm not like '%exactly one reference%' then raise; end if;
  end;

  select array_agg(promoted.staged_artifact_id)
    into v_returned_ids
  from public.promote_weekly_visual_refresh_assets(
    v_digest, v_refresh, array[v_cover, v_story], v_public_assets
  ) promoted;
  if v_returned_ids is distinct from array[v_story, v_cover] then
    raise exception 'promotion must apply stories before the dependent cover';
  end if;

  select count(*) into v_current_count
  from public.weekly_digest_artifacts artifact
  where artifact.revision_id = v_source
    and artifact.is_current
    and artifact.artifact_type in ('cover', 'story_image');
  if v_current_count <> 2
     or not exists (
       select 1 from public.weekly_digest_artifacts artifact
       where artifact.revision_id = v_source
         and artifact.artifact_type = 'cover'
         and artifact.slot_key = 'cover:main'
         and artifact.is_current
         and artifact.storage_bucket = 'social-assets'
         and artifact.storage_path = v_cover_public_path
     )
     or not exists (
       select 1 from public.weekly_digest_artifacts artifact
       where artifact.revision_id = v_source
         and artifact.artifact_type = 'story_image'
         and artifact.revision_item_id = v_source_item
         and artifact.slot_key = format('story-image:%s', v_source_item)
         and artifact.is_current
         and artifact.storage_bucket = 'social-assets'
         and artifact.storage_path = v_story_public_path
     ) then
    raise exception 'promotion did not map the actual published cover/story slots to verified public copies';
  end if;

  select artifact.content, artifact.metadata into v_content, v_metadata
  from public.weekly_digest_artifacts artifact
  where artifact.revision_id = v_source
    and artifact.artifact_type = 'cover'
    and artifact.is_current;
  if v_content is distinct from jsonb_build_object('alt', 'A clear new cover')
     or v_metadata is distinct from jsonb_build_object('sha256', v_cover_sha) then
    raise exception 'promotion copied private prompt/thesis/QA metadata into the public artifact';
  end if;
  if (select published_revision_id from public.weekly_digests where id = v_digest) is distinct from v_source
     or (select active_revision_id from public.weekly_digests where id = v_digest) is distinct from v_refresh then
    raise exception 'promotion changed the published or private-active revision pointer';
  end if;

  select count(*) into v_promoted_count
  from public.weekly_digest_artifacts artifact
  where artifact.revision_id = v_source
    and artifact.artifact_type in ('cover', 'story_image');
  perform 1
  from public.promote_weekly_visual_refresh_assets(
    v_digest, v_refresh, array[v_cover, v_story], v_public_assets
  );
  if (select count(*) from public.weekly_digest_artifacts artifact
      where artifact.revision_id = v_source
        and artifact.artifact_type in ('cover', 'story_image')) <> v_promoted_count then
    raise exception 'idempotent apply inserted another public artifact version';
  end if;
  select count(*) into v_event_count
  from public.weekly_digest_release_events event
  where event.weekly_digest_id = v_digest
    and event.event_type = 'visual_refresh_assets_promoted';
  if v_event_count <> 1 then
    raise exception 'idempotent apply wrote another promotion event';
  end if;

  perform set_config('session_replication_role', 'origin', true);
end;
$behavior$;

rollback;
