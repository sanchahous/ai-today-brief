begin;

-- create_service_weekly_digest_revision_draft (migration 20260805120000)
-- inserts a 'draft_revision_created' release event, but this CHECK
-- constraint still only allowed the original event-type list -- every
-- insert failed with a raw constraint-violation error instead of ever
-- completing the draft revision, masking the actual quality-gate failure
-- message behind a SQL error instead of showing it (caught live: Attempt 5
-- on ai-weekly-2026-07-27, 2026-08-05). Add the missing value to the list.
alter table public.weekly_digest_release_events
  drop constraint weekly_digest_release_events_event_type_check;

alter table public.weekly_digest_release_events
  add constraint weekly_digest_release_events_event_type_check
  check (event_type = any (array[
    'revision_created', 'revision_restored', 'artifact_saved', 'artifact_reviewed',
    'generation_queued', 'generation_started', 'generation_succeeded', 'generation_failed',
    'preflight_passed', 'preflight_failed', 'approved', 'scheduled', 'publishing_started',
    'publishing_retried', 'published', 'failed', 'paused', 'resumed', 'override',
    'draft_revision_created'
  ]::text[]));

commit;
