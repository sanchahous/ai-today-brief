-- Covers production migration version 20260824110000.
begin;

do $test$
begin
  if has_column_privilege('anon', 'public.weekly_digest_revisions', 'visual_thesis_en', 'SELECT')
     or has_column_privilege('authenticated', 'public.weekly_digest_revisions', 'visual_thesis_uk', 'SELECT') then
    raise exception 'weekly visual thesis must not be readable with a public Supabase key';
  end if;

  if not has_column_privilege('anon', 'public.weekly_digest_revisions', 'display_title_en', 'SELECT')
     or not has_column_privilege('authenticated', 'public.weekly_digest_revisions', 'display_title_uk', 'SELECT') then
    raise exception 'localized display title must remain readable by the public digest mapper';
  end if;

  if not has_column_privilege('anon', 'public.weekly_digest_revisions', 'title_en', 'SELECT') then
    raise exception 'canonical weekly title must retain public access';
  end if;
end;
$test$;

rollback;
