-- Rewrite weekly social URLs in the same transaction as publish.
--
-- `finish_weekly_digest_release` may replace `ai-weekly-YYYY-MM-DD` with a
-- topic slug. Social copy is composed against the placeholder, so Destination
-- and hop `/r/s/{token}` in the admin would 404 after Ship. Direct updates of
-- `post_text` hit `guard_social_content_approval` (scheduled → in_review,
-- posted → immutable). This GUC lets the publish RPC rewrite URLs without
-- dropping approval.

begin;

create or replace function public.guard_social_content_approval()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if current_setting('app.weekly_digest_social_url_rewrite', true) = 'allowed' then
    return new;
  end if;
  -- Cover/story replacement remaps artifactId only; copy approval must stay.
  if current_setting('app.weekly_digest_social_asset_relink', true) = 'allowed' then
    if old.status in ('publishing', 'posted') then
      raise exception 'A publishing or posted variant is immutable';
    end if;
    return new;
  end if;
  if new.post_text is distinct from old.post_text
    or new.content_parts is distinct from old.content_parts
    or new.first_comment is distinct from old.first_comment
    or new.asset_urls is distinct from old.asset_urls
    or new.alt_text is distinct from old.alt_text
    or new.scheduled_for is distinct from old.scheduled_for
    or new.locale is distinct from old.locale
    or new.format is distinct from old.format
  then
    if old.status in ('publishing', 'posted') then
      raise exception 'A publishing or posted variant is immutable';
    end if;
    if new.content_version = old.content_version then
      new.content_version := old.content_version + 1;
    end if;
    if new.content_hash is not distinct from old.content_hash then
      new.content_hash := null;
    end if;
    new.approval_version := null;
    new.approved_by := null;
    new.approved_at := null;
    new.status := 'in_review';
  end if;
  return new;
end;
$function$;

create or replace function public.with_social_click_token(p_url text, p_token uuid)
returns text
language sql
immutable
as $function$
  select case
    when p_url is null then null
    when p_url ~ ('[?&]s=' || p_token::text || '(&|$)') then p_url
    when position('?' in p_url) > 0 then p_url || '&s=' || p_token::text
    else p_url || '?s=' || p_token::text
  end;
$function$;

create or replace function public.rewrite_weekly_social_copy_urls(
  p_text text,
  p_token uuid,
  p_tracked_url text,
  p_old_slug text,
  p_new_slug text
)
returns text
language plpgsql
immutable
as $function$
declare
  v_text text := p_text;
  v_origin text;
  v_slug text;
  -- Marker has no regexp-replace specials (`&` `\n` `\1`). URLs contain `&`.
  v_marker constant text := 'WEEKLYTRACKEDURLTOKEN';
begin
  if p_text is null or p_text = '' then
    return p_text;
  end if;
  v_origin := regexp_replace(p_tracked_url, '^(https?://[^/]+).*$', '\1');
  v_text := replace(v_text, v_origin || '/r/s/' || p_token::text, v_marker);
  v_text := replace(v_text, '/r/s/' || p_token::text, v_marker);
  foreach v_slug in array array[p_old_slug, p_new_slug]
  loop
    if coalesce(v_slug, '') = '' then
      continue;
    end if;
    v_text := regexp_replace(
      v_text,
      v_origin || '/(en|uk)/weekly/' || v_slug || '(\?[^[:space:]]*)?',
      v_marker,
      'g'
    );
  end loop;
  v_text := regexp_replace(
    v_text,
    v_marker || '([[:space:]]+' || v_marker || ')+',
    v_marker,
    'g'
  );
  return replace(v_text, v_marker, p_tracked_url);
end;
$function$;

create or replace function public.rewrite_weekly_digest_social_urls(
  p_weekly_digest_id uuid,
  p_old_slug text,
  p_new_slug text
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_count int := 0;
  v_post record;
  v_locale text;
  v_origin text := 'https://aitodaybrief.com';
  v_page text;
  v_source text;
  v_tracked text;
  v_parts jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if coalesce(p_new_slug, '') = '' then
    return 0;
  end if;

  perform set_config('app.weekly_digest_social_url_rewrite', 'allowed', true);
  perform set_config('app.weekly_digest_social_action', 'allowed', true);

  for v_post in
    select post.id,
           post.locale,
           post.tracking_token,
           post.url,
           post.utm_url,
           post.post_text,
           post.first_comment,
           post.content_parts
      from public.social_posts post
      join public.social_packages pkg on pkg.id = post.package_id
     where pkg.weekly_digest_id = p_weekly_digest_id
  loop
    v_locale := case when v_post.locale = 'uk' then 'uk' else 'en' end;
    v_page := v_origin || '/' || v_locale || '/weekly/' || p_new_slug;
    v_source := coalesce(nullif(v_post.utm_url, ''), nullif(v_post.url, ''), v_page);
    if position('/r/s/' || v_post.tracking_token::text in v_source) > 0 then
      v_source := v_page;
    end if;
    if coalesce(p_old_slug, '') <> '' then
      v_source := replace(v_source, '/weekly/' || p_old_slug, '/weekly/' || p_new_slug);
    end if;
    v_tracked := public.with_social_click_token(v_source, v_post.tracking_token);
    if jsonb_typeof(v_post.content_parts) = 'array' then
      select coalesce(
        jsonb_agg(
          to_jsonb(
            public.rewrite_weekly_social_copy_urls(
              elem,
              v_post.tracking_token,
              v_tracked,
              p_old_slug,
              p_new_slug
            )
          )
        ),
        '[]'::jsonb
      )
        into v_parts
        from jsonb_array_elements_text(v_post.content_parts) as elem;
    else
      v_parts := v_post.content_parts;
    end if;

    update public.social_posts
       set url = v_page,
           utm_url = v_tracked,
           post_text = public.rewrite_weekly_social_copy_urls(
             post_text,
             tracking_token,
             v_tracked,
             p_old_slug,
             p_new_slug
           ),
           first_comment = public.rewrite_weekly_social_copy_urls(
             first_comment,
             tracking_token,
             v_tracked,
             p_old_slug,
             p_new_slug
           ),
           content_parts = v_parts
     where id = v_post.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

create or replace function public.finish_weekly_digest_release(
  p_weekly_digest_id uuid,
  p_succeeded boolean,
  p_error text default null
)
returns public.weekly_digests
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_revision public.weekly_digest_revisions;
  v_base_slug text;
  v_candidate_slug text;
  v_claimed_slug text;
  v_suffix int := 1;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  select digest.*
    into v_digest
    from public.weekly_digests digest
   where digest.id = p_weekly_digest_id
     and digest.status = 'publishing'
     for update;
  if v_digest.id is null then
    select digest.*
      into v_digest
      from public.weekly_digests digest
     where digest.id = p_weekly_digest_id;
    if v_digest.status = 'published' and p_succeeded then
      return v_digest;
    end if;
    raise exception 'Publishing weekly digest was not found';
  end if;

  v_claimed_slug := v_digest.slug;

  if p_succeeded then
    select revision.*
      into v_revision
      from public.weekly_digest_revisions revision
     where revision.id = v_digest.active_revision_id;

    -- Only replace the auto-generated placeholder (`ai-weekly-<date>` /
    -- `ai-weekly-test-<date>`). A slug set any other way -- manually, or by a
    -- future editor-facing field -- is left alone.
    if v_digest.slug ~ '^ai-weekly(-test)?-\d{4}-\d{2}-\d{2}$'
       and coalesce(v_revision.title_en, '') <> '' then
      v_base_slug := regexp_replace(
        regexp_replace(lower(v_revision.title_en), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)', '', 'g'
      );
      if length(v_base_slug) > 60 then
        v_base_slug := regexp_replace(left(v_base_slug, 60), '-[^-]*$', '');
      end if;
      if v_base_slug = '' then
        v_base_slug := 'weekly';
      end if;
      v_candidate_slug := v_base_slug || '-' || to_char(v_digest.week_start, 'YYYY-MM-DD');
      while exists (
        select 1 from public.weekly_digests d
        where d.slug = v_candidate_slug and d.id <> p_weekly_digest_id
      ) loop
        v_suffix := v_suffix + 1;
        v_candidate_slug := v_base_slug || '-' || to_char(v_digest.week_start, 'YYYY-MM-DD') || '-' || v_suffix;
      end loop;
      v_digest.slug := v_candidate_slug;
    end if;

    update public.weekly_digest_artifacts
       set published_at = coalesce(published_at, now())
     where revision_id = v_digest.active_revision_id
       and is_current
       and generation_status = 'ready'
       and review_status = 'approved';

    update public.weekly_digests
       set status = 'published',
           published_revision_id = active_revision_id,
           published_at = coalesce(published_at, now()),
           publishing_started_at = null,
           last_error = null,
           slug = v_digest.slug,
           title_en = v_revision.title_en,
           title_uk = v_revision.title_uk,
           intro_en = v_revision.intro_en,
           intro_uk = v_revision.intro_uk
     where id = p_weekly_digest_id
     returning * into v_digest;

    insert into public.weekly_digest_release_events (
      weekly_digest_id, revision_id, event_type, payload
    ) values (
      v_digest.id,
      v_digest.published_revision_id,
      'published',
      jsonb_build_object('published_at', v_digest.published_at, 'slug', v_digest.slug)
    );

    perform public.rewrite_weekly_digest_social_urls(
      p_weekly_digest_id,
      v_claimed_slug,
      v_digest.slug
    );
  else
    update public.weekly_digests
       set status = 'failed',
           publishing_started_at = null,
           last_error = left(coalesce(nullif(btrim(p_error), ''), 'Release worker failed.'), 2000)
     where id = p_weekly_digest_id
     returning * into v_digest;

    insert into public.weekly_digest_release_events (
      weekly_digest_id, revision_id, event_type, payload
    ) values (
      v_digest.id,
      v_digest.active_revision_id,
      'failed',
      jsonb_build_object('error', v_digest.last_error)
    );
  end if;

  return v_digest;
end;
$function$;

revoke all on function public.with_social_click_token(text, uuid)
  from public, anon, authenticated;
revoke all on function public.rewrite_weekly_social_copy_urls(text, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.rewrite_weekly_digest_social_urls(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.with_social_click_token(text, uuid) to service_role;
grant execute on function public.rewrite_weekly_social_copy_urls(text, uuid, text, text, text) to service_role;
grant execute on function public.rewrite_weekly_digest_social_urls(uuid, text, text) to service_role;

commit;
