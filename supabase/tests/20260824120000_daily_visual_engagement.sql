-- Covers production migration version 20260824120000.
begin;

do $test$
declare
  v_function_oid oid := to_regprocedure(
    'public.record_daily_visual_engagement(uuid,uuid,text,text,text,text)'
  );
  v_function_definition text;
begin
  if has_table_privilege('anon', 'public.daily_visual_engagement_events', 'SELECT')
     or has_table_privilege('anon', 'public.daily_visual_engagement_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.daily_visual_engagement_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.daily_visual_engagement_events', 'INSERT') then
    raise exception 'daily visual engagement rows must remain service-only';
  end if;

  if not has_table_privilege('service_role', 'public.daily_visual_engagement_events', 'INSERT') then
    raise exception 'daily visual engagement route lost its service insert access';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.daily_visual_engagement_events'::regclass) then
    raise exception 'daily visual engagement events must have RLS enabled';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_visual_engagement_events'
      and column_name in (
        'ip', 'raw_ip', 'user_agent', 'ua', 'url', 'pathname', 'referrer',
        'cursor_x', 'cursor_y', 'gaze', 'screen', 'session_id', 'cookie_id'
      )
  ) then
    raise exception 'daily visual engagement schema must not persist raw identifiers or behavioural traces';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.daily_visual_engagement_events'::regclass
      and pg_get_constraintdef(oid) like '%visual_impression%'
      and pg_get_constraintdef(oid) like '%visual_exposure_3s%'
      and pg_get_constraintdef(oid) like '%visual_exposure_8s%'
      and pg_get_constraintdef(oid) like '%story_open%'
      and pg_get_constraintdef(oid) like '%scroll_50%'
      and pg_get_constraintdef(oid) like '%outbound_click%'
      and pg_get_constraintdef(oid) like '%signup_click%'
  ) then
    raise exception 'daily visual engagement must retain the approved event buckets';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.daily_visual_engagement_events'::regclass
      and pg_get_constraintdef(oid) like '%entry_hero%'
      and pg_get_constraintdef(oid) like '%scrolled%'
  ) then
    raise exception 'daily visual engagement must retain the approved source buckets';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.daily_visual_engagement_events'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%UNIQUE (daily_visual_set_id, candidate_id, event_type, lang, session_hash)%'
  ) then
    raise exception 'daily visual engagement events must deduplicate across client instances';
  end if;

  if v_function_oid is null then
    raise exception 'daily visual engagement must have a server-side recording gate';
  end if;

  if has_function_privilege('anon', v_function_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_function_oid, 'EXECUTE')
     or not has_function_privilege('service_role', v_function_oid, 'EXECUTE') then
    raise exception 'daily visual recording gate must remain service-only';
  end if;

  if (select prosecdef from pg_proc where oid = v_function_oid) then
    raise exception 'daily visual recording gate must preserve caller RLS via security invoker';
  end if;

  v_function_definition := pg_get_functiondef(v_function_oid);
  if v_function_definition not like '%p_event_type = ''visual_impression''%'
     or v_function_definition not like '%from public.daily_visual_engagement_events as impression%'
     or v_function_definition not like '%impression.daily_visual_set_id = p_daily_visual_set_id%'
     or v_function_definition not like '%impression.candidate_id = p_candidate_id%'
     or v_function_definition not like '%impression.lang = p_lang%'
     or v_function_definition not like '%impression.session_hash = p_session_hash%' then
    raise exception 'daily visual recording gate must require a matching prior impression';
  end if;
end;
$test$;

rollback;
