begin;

-- A revision keeps the canonical editorial/SEO title and may additionally
-- carry a short reader-facing display title. The visual thesis is editorial
-- direction only: it must never become selectable through the public revision
-- endpoint, even when that revision is the published pointer.
--
-- Deliberately no backfill/update: historical published revisions retain their
-- canonical title through the application fallback below.
alter table public.weekly_digest_revisions
  add column if not exists display_title_en text,
  add column if not exists display_title_uk text,
  add column if not exists visual_thesis_en text,
  add column if not exists visual_thesis_uk text;

alter table public.weekly_digest_revisions
  add constraint weekly_digest_revisions_display_title_en_nonblank
    check (display_title_en is null or length(btrim(display_title_en)) > 0),
  add constraint weekly_digest_revisions_display_title_uk_nonblank
    check (display_title_uk is null or length(btrim(display_title_uk)) > 0),
  add constraint weekly_digest_revisions_visual_thesis_en_nonblank
    check (visual_thesis_en is null or length(btrim(visual_thesis_en)) > 0),
  add constraint weekly_digest_revisions_visual_thesis_uk_nonblank
    check (visual_thesis_uk is null or length(btrim(visual_thesis_uk)) > 0);

comment on column public.weekly_digest_revisions.display_title_en is
  'Optional concise English title for the public weekly hero and PDF cover. The canonical title remains SEO/OG/listing truth.';
comment on column public.weekly_digest_revisions.display_title_uk is
  'Optional concise Ukrainian title for the public weekly hero and PDF cover. The canonical title remains SEO/OG/listing truth.';
comment on column public.weekly_digest_revisions.visual_thesis_en is
  'Internal English visual direction for a weekly revision. Never exposed to anon/authenticated public reads.';
comment on column public.weekly_digest_revisions.visual_thesis_uk is
  'Internal Ukrainian visual direction for a weekly revision. Never exposed to anon/authenticated public reads.';

-- RLS is row-level only. The existing table-wide SELECT grant would expose a
-- new internal column to anyone with the public key, so reissue exactly the
-- prior public column set plus display_title, excluding visual_thesis.
revoke select on public.weekly_digest_revisions from anon, authenticated;

grant select (
  id,
  weekly_digest_id,
  revision_number,
  selection_run_id,
  title_en,
  title_uk,
  display_title_en,
  display_title_uk,
  intro_en,
  intro_uk,
  editor_note_en,
  editor_note_uk,
  key_takeaways_en,
  key_takeaways_uk,
  content_hash,
  created_by,
  created_at
) on public.weekly_digest_revisions to anon, authenticated;

do $$
begin
  if has_column_privilege('anon', 'public.weekly_digest_revisions', 'visual_thesis_en', 'SELECT')
     or has_column_privilege('authenticated', 'public.weekly_digest_revisions', 'visual_thesis_uk', 'SELECT') then
    raise exception 'weekly visual thesis must remain private to server/admin paths';
  end if;
  if not has_column_privilege('anon', 'public.weekly_digest_revisions', 'display_title_en', 'SELECT')
     or not has_column_privilege('authenticated', 'public.weekly_digest_revisions', 'display_title_uk', 'SELECT') then
    raise exception 'weekly display titles must remain available to the public published-revision mapping';
  end if;
  if not has_column_privilege('anon', 'public.weekly_digest_revisions', 'title_en', 'SELECT') then
    raise exception 'canonical weekly title lost public access';
  end if;
  if not has_column_privilege('service_role', 'public.weekly_digest_revisions', 'visual_thesis_en', 'SELECT') then
    raise exception 'service_role must retain internal visual thesis access';
  end if;
end;
$$;

commit;
