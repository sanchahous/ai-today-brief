begin;

-- Published weekly artifacts remain row-visible to anonymous readers, but their
-- metadata is an internal working envelope: prompts, semantic QA, editorial
-- direction and review provenance must not become a public REST payload.
-- Admin/service paths retain their existing access; the public renderer needs
-- only explicit content fields plus the immutable image reference.
revoke select on table public.weekly_digest_artifacts from anon;

grant select (
  id,
  weekly_digest_id,
  revision_id,
  revision_item_id,
  artifact_type,
  locale,
  slot_key,
  is_current,
  generation_status,
  review_status,
  external_url,
  storage_bucket,
  storage_path,
  width,
  height,
  duration_seconds,
  content,
  published_at,
  updated_at
) on public.weekly_digest_artifacts to anon;

do $$
begin
  if has_column_privilege('anon', 'public.weekly_digest_artifacts', 'metadata', 'SELECT') then
    raise exception 'weekly artifact metadata must remain private to anonymous readers';
  end if;
  if has_column_privilege('anon', 'public.weekly_digest_artifacts', 'provider_id', 'SELECT') then
    raise exception 'weekly artifact provider provenance must remain private to anonymous readers';
  end if;
  if not has_column_privilege('anon', 'public.weekly_digest_artifacts', 'content', 'SELECT')
     or not has_column_privilege('anon', 'public.weekly_digest_artifacts', 'external_url', 'SELECT')
     or not has_column_privilege('anon', 'public.weekly_digest_artifacts', 'width', 'SELECT') then
    raise exception 'weekly public renderer lost required artifact columns';
  end if;
end;
$$;

commit;
