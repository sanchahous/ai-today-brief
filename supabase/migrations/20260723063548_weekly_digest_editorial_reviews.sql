begin;

-- Persist every deterministic weekly selection so an editor can understand the
-- final digest and later audit stories that were eligible but not selected.
create table public.weekly_digest_selection_runs (
  id                 uuid primary key default gen_random_uuid(),
  weekly_digest_id   uuid not null references public.weekly_digests(id) on delete cascade,
  algorithm_version  text not null,
  rationale_version  text not null,
  week_start         date not null,
  week_end           date not null,
  candidate_count    integer not null check (candidate_count >= 0),
  eligible_count     integer not null check (eligible_count between 0 and candidate_count),
  rejected_count     integer not null check (rejected_count between 0 and candidate_count),
  selected_count     smallint not null check (selected_count between 0 and 7),
  rationale          jsonb not null check (jsonb_typeof(rationale) = 'object'),
  candidate_pool     jsonb not null check (jsonb_typeof(candidate_pool) = 'array'),
  created_at         timestamptz not null default now(),
  check (week_end >= week_start),
  check (eligible_count + rejected_count = candidate_count),
  check (selected_count <= eligible_count)
);

create index weekly_digest_selection_runs_digest_created_idx
  on public.weekly_digest_selection_runs (weekly_digest_id, created_at desc);

-- Append-only editor decisions. "Changes addressed" is a new event rather than
-- an update so the original request and its labels remain a training signal.
create table public.weekly_digest_reviews (
  id                 uuid primary key default gen_random_uuid(),
  weekly_digest_id   uuid not null references public.weekly_digests(id) on delete cascade,
  package_id         uuid references public.social_packages(id) on delete set null,
  selection_run_id   uuid references public.weekly_digest_selection_runs(id) on delete set null,
  parent_review_id   uuid references public.weekly_digest_reviews(id) on delete set null,
  reviewer_id        uuid references auth.users(id) on delete set null,
  action             text not null
                       check (action in ('changes_requested', 'changes_addressed', 'approved')),
  reason_codes       text[] not null default '{}'::text[]
                       check (reason_codes <@ array[
                         'missing_important_story',
                         'wrong_story_selected',
                         'wrong_priority_or_order',
                         'inaccurate_or_misleading',
                         'weak_summary_or_why',
                         'poor_tone_or_writing',
                         'insufficient_evidence',
                         'other'
                       ]::text[]),
  note               text,
  digest_snapshot    jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(digest_snapshot) = 'object'),
  created_at         timestamptz not null default now(),
  check (
    action <> 'changes_requested'
    or (
      cardinality(reason_codes) > 0
      and char_length(btrim(coalesce(note, ''))) between 10 and 2000
    )
  ),
  check (note is null or char_length(note) <= 2000)
);

create index weekly_digest_reviews_digest_created_idx
  on public.weekly_digest_reviews (weekly_digest_id, created_at desc);
create index weekly_digest_reviews_package_created_idx
  on public.weekly_digest_reviews (package_id, created_at desc);

create table public.weekly_digest_review_items (
  id                 uuid primary key default gen_random_uuid(),
  review_id          uuid not null references public.weekly_digest_reviews(id) on delete cascade,
  brief_item_id      uuid references public.brief_items(id) on delete set null,
  action             text not null
                       check (action in ('keep', 'remove', 'add', 'replace', 'reorder', 'edit')),
  reason_codes       text[] not null default '{}'::text[],
  note               text,
  previous_rank      smallint check (previous_rank between 1 and 7),
  requested_rank     smallint check (requested_rank between 1 and 7),
  candidate_snapshot jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(candidate_snapshot) = 'object'),
  created_at         timestamptz not null default now(),
  check (note is null or char_length(note) <= 1000)
);

create index weekly_digest_review_items_review_idx
  on public.weekly_digest_review_items (review_id, created_at);
create index weekly_digest_review_items_brief_item_idx
  on public.weekly_digest_review_items (brief_item_id, created_at desc)
  where brief_item_id is not null;

alter table public.weekly_digest_selection_runs enable row level security;
alter table public.weekly_digest_reviews enable row level security;
alter table public.weekly_digest_review_items enable row level security;

create policy "weekly selection runs: admin read"
  on public.weekly_digest_selection_runs for select to authenticated
  using (public.is_social_admin());

create policy "weekly reviews: admin read"
  on public.weekly_digest_reviews for select to authenticated
  using (public.is_social_admin());
create policy "weekly reviews: aal2 insert"
  on public.weekly_digest_reviews for insert to authenticated
  with check (
    public.is_social_admin()
    and public.has_social_aal2()
    and reviewer_id = auth.uid()
  );

create policy "weekly review items: admin read"
  on public.weekly_digest_review_items for select to authenticated
  using (public.is_social_admin());
create policy "weekly review items: aal2 insert"
  on public.weekly_digest_review_items for insert to authenticated
  with check (
    public.is_social_admin()
    and public.has_social_aal2()
    and exists (
      select 1
      from public.weekly_digest_reviews review
      where review.id = weekly_digest_review_items.review_id
        and review.reviewer_id = auth.uid()
    )
  );

revoke all on table public.weekly_digest_selection_runs from public, anon, authenticated;
revoke all on table public.weekly_digest_reviews from public, anon, authenticated;
revoke all on table public.weekly_digest_review_items from public, anon, authenticated;
grant select on table public.weekly_digest_selection_runs to authenticated;
grant select, insert on table public.weekly_digest_reviews to authenticated;
grant select, insert on table public.weekly_digest_review_items to authenticated;
grant all on table public.weekly_digest_selection_runs to service_role;
grant all on table public.weekly_digest_reviews to service_role;
grant all on table public.weekly_digest_review_items to service_role;

create or replace function public.request_weekly_digest_changes(
  p_package_id uuid,
  p_reason_codes text[],
  p_note text,
  p_item_feedback jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest_id uuid;
  v_package_status text;
  v_selection_run_id uuid;
  v_rationale jsonb := '{}'::jsonb;
  v_candidate_pool jsonb := '[]'::jsonb;
  v_latest_review_action text;
  v_review_id uuid;
begin
  if not public.is_social_admin() or not public.has_social_aal2() then
    raise exception 'AAL2 social admin session required' using errcode = '42501';
  end if;

  if coalesce(cardinality(p_reason_codes), 0) = 0
     or not (p_reason_codes <@ array[
       'missing_important_story',
       'wrong_story_selected',
       'wrong_priority_or_order',
       'inaccurate_or_misleading',
       'weak_summary_or_why',
       'poor_tone_or_writing',
       'insufficient_evidence',
       'other'
     ]::text[]) then
    raise exception 'Select at least one valid review reason';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) not between 10 and 2000 then
    raise exception 'Review note must contain 10 to 2000 characters';
  end if;
  if jsonb_typeof(coalesce(p_item_feedback, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_item_feedback, '[]'::jsonb)) > 30 then
    raise exception 'Item feedback must be an array of at most 30 entries';
  end if;

  select package.weekly_digest_id, package.status
    into v_digest_id, v_package_status
  from public.social_packages package
  where package.id = p_package_id
    and package.kind = 'weekly_digest'
  for update;

  if v_digest_id is null then
    raise exception 'Weekly digest package was not found';
  end if;
  if v_package_status not in ('in_review', 'approved') then
    raise exception 'Only a reviewable weekly digest can receive change requests';
  end if;
  if exists (
    select 1 from public.social_posts post
    where post.package_id = p_package_id
      and post.status in ('publishing', 'posted', 'cancelled')
  ) then
    raise exception 'Weekly digest can no longer be changed';
  end if;

  select review.action
    into v_latest_review_action
  from public.weekly_digest_reviews review
  where review.weekly_digest_id = v_digest_id
  order by review.created_at desc, review.id desc
  limit 1;
  if v_latest_review_action = 'changes_requested' then
    raise exception 'Weekly digest already has an open change request';
  end if;

  select run.id, run.rationale, run.candidate_pool
    into v_selection_run_id, v_rationale, v_candidate_pool
  from public.weekly_digest_selection_runs run
  where run.weekly_digest_id = v_digest_id
  order by run.created_at desc, run.id desc
  limit 1;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_item_feedback, '[]'::jsonb)) feedback
    where jsonb_typeof(feedback) <> 'object'
      or coalesce(feedback ->> 'action', '') not in
        ('keep', 'remove', 'add', 'replace', 'reorder', 'edit')
      or nullif(feedback ->> 'brief_item_id', '') is null
  ) then
    raise exception 'Item feedback contains an invalid entry';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_item_feedback, '[]'::jsonb)) feedback
    where case
      when feedback ->> 'action' = 'add' then not exists (
        select 1
        from jsonb_array_elements(coalesce(v_candidate_pool, '[]'::jsonb)) candidate
        where candidate ->> 'brief_item_id' = feedback ->> 'brief_item_id'
          and candidate ->> 'status' = 'eligible_not_selected'
      )
      else not exists (
        select 1
        from public.weekly_digest_items item
        where item.weekly_digest_id = v_digest_id
          and item.brief_item_id::text = feedback ->> 'brief_item_id'
      )
    end
  ) then
    raise exception 'Item feedback references a story outside this selection run';
  end if;

  insert into public.weekly_digest_reviews (
    weekly_digest_id,
    package_id,
    selection_run_id,
    reviewer_id,
    action,
    reason_codes,
    note,
    digest_snapshot
  ) values (
    v_digest_id,
    p_package_id,
    v_selection_run_id,
    auth.uid(),
    'changes_requested',
    p_reason_codes,
    btrim(p_note),
    jsonb_build_object(
      'package_status', v_package_status,
      'rationale', coalesce(v_rationale, '{}'::jsonb),
      'selected_items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'brief_item_id', item.brief_item_id,
            'rank', item.rank,
            'snapshot', item.snapshot
          )
          order by item.rank
        )
        from public.weekly_digest_items item
        where item.weekly_digest_id = v_digest_id
      ), '[]'::jsonb)
    )
  )
  returning id into v_review_id;

  insert into public.weekly_digest_review_items (
    review_id,
    brief_item_id,
    action,
    reason_codes,
    note,
    previous_rank,
    requested_rank,
    candidate_snapshot
  )
  select
    v_review_id,
    (feedback ->> 'brief_item_id')::uuid,
    feedback ->> 'action',
    p_reason_codes,
    nullif(left(btrim(coalesce(feedback ->> 'note', '')), 1000), ''),
    (
      select item.rank
      from public.weekly_digest_items item
      where item.weekly_digest_id = v_digest_id
        and item.brief_item_id::text = feedback ->> 'brief_item_id'
    ),
    nullif(feedback ->> 'requested_rank', '')::smallint,
    coalesce((
      select candidate
      from jsonb_array_elements(coalesce(v_candidate_pool, '[]'::jsonb)) candidate
      where candidate ->> 'brief_item_id' = feedback ->> 'brief_item_id'
      limit 1
    ), '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_item_feedback, '[]'::jsonb)) feedback;

  insert into public.social_post_reviews (
    social_post_id,
    package_id,
    reviewer_id,
    action,
    content_version,
    content_hash,
    snapshot,
    note
  )
  select
    post.id,
    post.package_id,
    auth.uid(),
    'auto_revoked',
    post.content_version,
    post.content_hash,
    jsonb_build_object(
      'status', post.status,
      'channel', post.channel,
      'scheduled_for', post.scheduled_for
    ),
    'Weekly digest changes requested'
  from public.social_posts post
  where post.package_id = p_package_id
    and post.status in ('approved', 'scheduled', 'failed');

  update public.social_posts
  set status = 'in_review',
      approval_version = null,
      approved_by = null,
      approved_at = null,
      retry_after = null
  where package_id = p_package_id
    and status in ('draft', 'in_review', 'approved', 'scheduled', 'failed');

  update public.social_packages
  set status = 'in_review', updated_at = now()
  where id = p_package_id;

  update public.weekly_digests
  set status = 'in_review'
  where id = v_digest_id;

  return v_review_id;
end;
$function$;

create or replace function public.address_weekly_digest_changes(
  p_package_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest_id uuid;
  v_selection_run_id uuid;
  v_parent_review_id uuid;
  v_latest_action text;
  v_review_id uuid;
begin
  if not public.is_social_admin() or not public.has_social_aal2() then
    raise exception 'AAL2 social admin session required' using errcode = '42501';
  end if;
  if char_length(coalesce(p_note, '')) > 2000 then
    raise exception 'Resolution note must not exceed 2000 characters';
  end if;

  select package.weekly_digest_id
    into v_digest_id
  from public.social_packages package
  where package.id = p_package_id
    and package.kind = 'weekly_digest'
    and package.status = 'in_review';
  if v_digest_id is null then
    raise exception 'In-review weekly digest package was not found';
  end if;

  select review.id, review.action
    into v_parent_review_id, v_latest_action
  from public.weekly_digest_reviews review
  where review.weekly_digest_id = v_digest_id
  order by review.created_at desc, review.id desc
  limit 1;
  if v_latest_action is distinct from 'changes_requested' then
    raise exception 'Weekly digest has no open change request';
  end if;

  select run.id
    into v_selection_run_id
  from public.weekly_digest_selection_runs run
  where run.weekly_digest_id = v_digest_id
  order by run.created_at desc, run.id desc
  limit 1;

  insert into public.weekly_digest_reviews (
    weekly_digest_id,
    package_id,
    selection_run_id,
    parent_review_id,
    reviewer_id,
    action,
    note,
    digest_snapshot
  ) values (
    v_digest_id,
    p_package_id,
    v_selection_run_id,
    v_parent_review_id,
    auth.uid(),
    'changes_addressed',
    nullif(btrim(coalesce(p_note, '')), ''),
    jsonb_build_object('addresses_review_id', v_parent_review_id)
  )
  returning id into v_review_id;

  return v_review_id;
end;
$function$;

-- Package approval now refuses an unresolved change request and records the
-- positive editorial decision for calibration alongside negative feedback.
create or replace function public.approve_social_package(p_package_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $function$
declare
  post_id uuid;
  approved_count integer := 0;
  v_digest_id uuid;
  v_selection_run_id uuid;
  v_latest_review_action text;
  v_rationale jsonb := '{}'::jsonb;
begin
  if not public.is_social_admin() or not public.has_social_aal2() then
    raise exception 'AAL2 social admin session required' using errcode = '42501';
  end if;

  select package.weekly_digest_id
    into v_digest_id
  from public.social_packages package
  where package.id = p_package_id
    and package.kind = 'weekly_digest';

  if v_digest_id is not null then
    select review.action
      into v_latest_review_action
    from public.weekly_digest_reviews review
    where review.weekly_digest_id = v_digest_id
    order by review.created_at desc, review.id desc
    limit 1;
    if v_latest_review_action = 'changes_requested' then
      raise exception 'Resolve the weekly digest change request before approval';
    end if;
  end if;

  if exists (
    select 1 from public.social_posts
    where package_id = p_package_id
      and (
        content_hash is null
        or jsonb_array_length(coalesce(quality_report -> 'blocking', '[]'::jsonb)) > 0
        or status not in ('draft', 'in_review', 'approved', 'failed')
      )
  ) then
    raise exception 'Package contains a blocked or non-reviewable variant';
  end if;

  for post_id in
    select id from public.social_posts
    where package_id = p_package_id and status <> 'approved'
    order by created_at
  loop
    perform public.approve_social_post(post_id);
    approved_count := approved_count + 1;
  end loop;

  update public.social_packages
  set status = 'approved', updated_at = now()
  where id = p_package_id;

  update public.weekly_digests digest
  set status = 'published', published_at = coalesce(digest.published_at, now())
  where digest.id = v_digest_id;

  if v_digest_id is not null then
    select run.id, run.rationale
      into v_selection_run_id, v_rationale
    from public.weekly_digest_selection_runs run
    where run.weekly_digest_id = v_digest_id
    order by run.created_at desc, run.id desc
    limit 1;

    insert into public.weekly_digest_reviews (
      weekly_digest_id,
      package_id,
      selection_run_id,
      reviewer_id,
      action,
      digest_snapshot
    ) values (
      v_digest_id,
      p_package_id,
      v_selection_run_id,
      auth.uid(),
      'approved',
      jsonb_build_object(
        'rationale', coalesce(v_rationale, '{}'::jsonb),
        'selected_items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'brief_item_id', item.brief_item_id,
              'rank', item.rank,
              'snapshot', item.snapshot
            )
            order by item.rank
          )
          from public.weekly_digest_items item
          where item.weekly_digest_id = v_digest_id
        ), '[]'::jsonb)
      )
    );
  end if;

  return approved_count;
end;
$function$;

revoke all on function public.request_weekly_digest_changes(uuid, text[], text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.address_weekly_digest_changes(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.request_weekly_digest_changes(uuid, text[], text, jsonb)
  to authenticated;
grant execute on function public.address_weekly_digest_changes(uuid, text)
  to authenticated;

commit;
