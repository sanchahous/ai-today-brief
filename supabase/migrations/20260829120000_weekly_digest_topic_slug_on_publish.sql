-- Weekly digest topic-based slug on publish (2026-08-29).
--
-- Public weekly URLs were `ai-weekly-YYYY-MM-DD` -- a date, not a description
-- of the issue. That slug is assigned at digest *creation* time
-- (`src/lib/social/composer.ts`), long before a title exists, so it can only
-- ever be a placeholder. This migration rewrites `finish_weekly_digest_release`
-- (the single choke point where a digest becomes `published`, regardless of
-- whether it got there via the manual Ship flow or the scheduled release
-- worker) to replace that placeholder with a slug derived from the final
-- English title, once it's actually known.
--
-- Scope, per owner decision 2026-08-29: only digests published from here on.
-- Already-published digests keep their existing slug untouched -- their URLs
-- are already shared/indexed and this function only runs once per digest, at
-- first publish (guarded by `status = 'publishing'`).

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
      -- Defensive uniqueness loop: week_start is already unique per
      -- (week_start, is_test), so this should never actually iterate, but a
      -- public URL slug is not the place to trust that blindly.
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
