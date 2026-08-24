begin;

-- Daily-cover exposure and outcomes are narrowly scoped, first-party quality
-- signals. They deliberately store neither raw request identifiers nor
-- behavioural traces: just the active public visual, a fixed event, entry
-- bucket and the same daily-rotating session hash used by item_events.
create table if not exists public.daily_visual_engagement_events (
  id bigint generated always as identity primary key,
  daily_visual_set_id uuid not null references public.daily_visual_sets(id) on delete restrict,
  candidate_id uuid not null references public.daily_visual_candidates(id) on delete restrict,
  event_type text not null check (
    event_type in (
      'visual_impression', 'visual_exposure_3s', 'visual_exposure_8s',
      'story_open', 'scroll_50', 'outbound_click', 'signup_click'
    )
  ),
  entry_source text not null check (entry_source in ('entry_hero', 'scrolled')),
  lang text not null check (lang in ('en', 'uk')),
  session_hash text not null check (length(session_hash) = 64),
  occurred_at timestamptz not null default now(),
  unique (daily_visual_set_id, candidate_id, event_type, lang, session_hash)
);

create index if not exists daily_visual_engagement_events_set_type_occurred_idx
  on public.daily_visual_engagement_events (daily_visual_set_id, event_type, occurred_at desc);

comment on table public.daily_visual_engagement_events is
  'Append-only daily-cover exposure and outcome beacons. Stores only public visual IDs, fixed event/source buckets, locale and the daily-rotating session_hash; never raw IP, user-agent, URL, referrer, cursor, gaze or screen data.';

alter table public.daily_visual_engagement_events enable row level security;

-- The browser never writes or reads these rows. The same-origin route derives
-- the rotating hash transiently and writes via the service-role client.
revoke all on table public.daily_visual_engagement_events from public, anon, authenticated;
grant insert, select on table public.daily_visual_engagement_events to service_role;
grant usage, select on sequence public.daily_visual_engagement_events_id_seq to service_role;

-- Do not trust the client-side ordering of beacons. An outcome (including the
-- longer exposure milestones) is admissible only after this exact public
-- visual, locale and daily-rotating session hash have an impression row. The
-- existence predicate and insert are deliberately one statement: a racing
-- outcome is conservatively dropped rather than creating an orphaned signal.
create or replace function public.record_daily_visual_engagement(
  p_daily_visual_set_id uuid,
  p_candidate_id uuid,
  p_event_type text,
  p_entry_source text,
  p_lang text,
  p_session_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_recorded boolean;
begin
  if p_daily_visual_set_id is null
     or p_candidate_id is null
     or p_event_type is null
     or p_entry_source is null
     or p_lang is null
     or p_session_hash is null
     or p_event_type not in (
       'visual_impression', 'visual_exposure_3s', 'visual_exposure_8s',
       'story_open', 'scroll_50', 'outbound_click', 'signup_click'
     )
     or p_entry_source not in ('entry_hero', 'scrolled')
     or p_lang not in ('en', 'uk')
     or p_session_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  insert into public.daily_visual_engagement_events as event (
    daily_visual_set_id,
    candidate_id,
    event_type,
    entry_source,
    lang,
    session_hash
  )
  select
    p_daily_visual_set_id,
    p_candidate_id,
    p_event_type,
    p_entry_source,
    p_lang,
    p_session_hash
  where p_event_type = 'visual_impression'
     or exists (
       select 1
       from public.daily_visual_engagement_events as impression
       where impression.daily_visual_set_id = p_daily_visual_set_id
         and impression.candidate_id = p_candidate_id
         and impression.event_type = 'visual_impression'
         and impression.lang = p_lang
         and impression.session_hash = p_session_hash
     )
  on conflict (daily_visual_set_id, candidate_id, event_type, lang, session_hash)
    do nothing
  returning true into v_recorded;

  return coalesce(v_recorded, false);
end;
$function$;

revoke all on function public.record_daily_visual_engagement(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.record_daily_visual_engagement(
  uuid, uuid, text, text, text, text
) to service_role;

commit;
