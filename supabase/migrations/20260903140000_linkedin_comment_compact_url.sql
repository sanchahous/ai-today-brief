-- LinkedIn comments never unfurl OG. Copy rewrite must keep a compact page?s=
-- URL in the first comment; Destination / utm_url stays fully tagged.
-- Auto-publish attaches content.article on the post itself.

begin;

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
  v_copy_tracked text;
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
           post.channel,
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
    v_copy_tracked := case
      when v_post.channel in ('x', 'linkedin') then public.with_social_click_token(v_page, v_post.tracking_token)
      else v_tracked
    end;
    if jsonb_typeof(v_post.content_parts) = 'array' then
      select coalesce(
        jsonb_agg(
          to_jsonb(
            public.rewrite_weekly_social_copy_urls(
              elem,
              v_post.tracking_token,
              v_copy_tracked,
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
             v_copy_tracked,
             p_old_slug,
             p_new_slug
           ),
           first_comment = public.rewrite_weekly_social_copy_urls(
             first_comment,
             tracking_token,
             v_copy_tracked,
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

commit;
