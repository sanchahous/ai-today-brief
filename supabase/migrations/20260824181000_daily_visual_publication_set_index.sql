begin;

-- A frozen daily visual set has exactly one public projection. This unique
-- index makes that invariant explicit and turns the public engagement lookup
-- from a table scan into an indexed lookup by daily_visual_set_id.
create unique index if not exists daily_visual_publications_daily_visual_set_key
  on public.daily_visual_publications (daily_visual_set_id);

commit;
