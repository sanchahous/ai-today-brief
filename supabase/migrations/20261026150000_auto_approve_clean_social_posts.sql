-- Auto-approve daily social variants that pass every quality gate.
--
-- No daily post was ever approved without a human, so nothing published on its
-- own (source: prod Supabase 2026-10-26 — 288 posts in `in_review`, last
-- `posted` 2026-09-03, `green_success_count = 0`):
--   * `auto_approve_green_package` (040) was never called from code;
--   * every daily package is composed with risk `yellow`, and that RPC only
--     accepts `green`;
--   * the admin toggle stayed disabled until 30 green deliveries, which
--     therefore could never happen.
--
-- This RPC approves post by post instead: a top-story package carries variants
-- for channels that are not connected yet, and their blocking issues must not
-- hold back a clean Telegram variant. The owner switch `auto_publish_green`
-- remains the opt-in; the quality gate and the per-channel switches remain the
-- guards. Weekly digests keep their editorial release flow.

create or replace function public.auto_approve_clean_social_posts(p_package_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  approved_count integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  with eligible as (
    select post.id
    from public.social_posts post
    join public.social_packages package on package.id = post.package_id
    cross join public.social_settings settings
    where package.id = p_package_id
      and package.kind <> 'weekly_digest'
      and settings.id = true
      and settings.auto_publish_green
      and not settings.global_kill_switch
      and coalesce((settings.channel_enabled ->> post.channel)::boolean, false)
      and post.status = 'in_review'
      and post.publish_enabled
      and post.content_hash is not null
      and jsonb_array_length(coalesce(post.quality_report -> 'blocking', '[]'::jsonb)) = 0
    for update of post
  ),
  approved as (
    update public.social_posts post
    set status = 'approved',
        approval_version = post.content_version,
        approved_at = now(),
        approved_by = null
    from eligible
    where post.id = eligible.id
    returning post.*
  ),
  reviews as (
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
      approved.id,
      approved.package_id,
      null,
      'approved',
      approved.content_version,
      approved.content_hash,
      jsonb_build_object(
        'channel', approved.channel,
        'post_text', approved.post_text,
        'first_comment', approved.first_comment,
        'content_parts', approved.content_parts,
        'asset_urls', approved.asset_urls,
        'scheduled_for', approved.scheduled_for,
        'quality_report', approved.quality_report
      ),
      'Automatic approval: no blocking quality issues on an enabled channel'
    from approved
    returning 1
  )
  select count(*) into approved_count from approved;

  if approved_count > 0 then
    update public.social_packages package
    set status = 'approved',
        updated_at = now()
    where package.id = p_package_id
      and package.status = 'in_review'
      and not exists (
        select 1
        from public.social_posts post
        where post.package_id = package.id
          and post.status in ('draft', 'in_review')
      );
  end if;

  return approved_count;
end;
$function$;

revoke all on function public.auto_approve_clean_social_posts(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.auto_approve_clean_social_posts(uuid) to service_role;
