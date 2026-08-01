begin;

-- A manual edition is keyed to the same Sunday trigger as the scheduled job.
-- Persist its origin so the scheduled job can explicitly skip it, even before
-- it checks for a completed social package.
alter table public.weekly_digests
  add column if not exists is_manually_created boolean not null default false;

commit;
