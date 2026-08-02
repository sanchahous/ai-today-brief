-- Cover every foreign key added by Weekly Content Studio v2. The existing
-- digest-leading analytics index cannot efficiently service lookups that
-- begin with one of these referenced IDs.
create index if not exists weekly_digest_engagement_revision_idx
  on public.weekly_digest_engagement_events (revision_id);

create index if not exists weekly_digest_engagement_social_post_idx
  on public.weekly_digest_engagement_events (social_post_id)
  where social_post_id is not null;

create index if not exists weekly_digest_engagement_story_idx
  on public.weekly_digest_engagement_events (story_id)
  where story_id is not null;

create index if not exists weekly_locale_map_updated_by_idx
  on public.weekly_locale_map (updated_by)
  where updated_by is not null;

-- A FOR ALL policy also contributes a permissive SELECT policy. Keep the
-- single admin-read policy and express owner writes per mutation instead.
drop policy if exists "weekly locale map: owner write" on public.weekly_locale_map;

drop policy if exists "weekly locale map: owner insert" on public.weekly_locale_map;
create policy "weekly locale map: owner insert"
  on public.weekly_locale_map for insert to authenticated
  with check (public.social_admin_role() = 'owner' and public.has_social_aal2());

drop policy if exists "weekly locale map: owner update" on public.weekly_locale_map;
create policy "weekly locale map: owner update"
  on public.weekly_locale_map for update to authenticated
  using (public.social_admin_role() = 'owner' and public.has_social_aal2())
  with check (public.social_admin_role() = 'owner' and public.has_social_aal2());

drop policy if exists "weekly locale map: owner delete" on public.weekly_locale_map;
create policy "weekly locale map: owner delete"
  on public.weekly_locale_map for delete to authenticated
  using (public.social_admin_role() = 'owner' and public.has_social_aal2());
