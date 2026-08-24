begin;

do $$
begin
  if has_column_privilege('anon', 'public.weekly_digest_artifacts', 'metadata', 'SELECT') then
    raise exception 'anon must not read internal weekly artifact metadata';
  end if;
  if has_column_privilege('anon', 'public.weekly_digest_artifacts', 'input_hash', 'SELECT') then
    raise exception 'anon must not read internal weekly artifact dependency hashes';
  end if;
  if not has_column_privilege('anon', 'public.weekly_digest_artifacts', 'content', 'SELECT')
     or not has_column_privilege('anon', 'public.weekly_digest_artifacts', 'external_url', 'SELECT')
     or not has_column_privilege('anon', 'public.weekly_digest_artifacts', 'published_at', 'SELECT') then
    raise exception 'anon lost public weekly artifact rendering columns';
  end if;
end;
$$;

rollback;
