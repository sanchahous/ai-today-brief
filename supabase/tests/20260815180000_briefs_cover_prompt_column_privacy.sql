-- Covers production migration version 20260815180000.
begin;

do $test$
begin
  if has_column_privilege('anon', 'public.briefs', 'cover_prompt', 'SELECT') then
    raise exception 'anon must not be able to select briefs.cover_prompt (R3.3 / F15)';
  end if;

  if has_column_privilege('authenticated', 'public.briefs', 'cover_prompt', 'SELECT') then
    raise exception 'authenticated must not be able to select briefs.cover_prompt (R3.3 / F15)';
  end if;

  if not has_column_privilege('service_role', 'public.briefs', 'cover_prompt', 'SELECT') then
    raise exception 'service_role (pipeline) must keep read access to briefs.cover_prompt';
  end if;

  -- Every other briefs column stays untouched by this migration.
  if not has_column_privilege('anon', 'public.briefs', 'title_en', 'SELECT') then
    raise exception 'anon should still read the rest of a published brief';
  end if;
end;
$test$;

rollback;
