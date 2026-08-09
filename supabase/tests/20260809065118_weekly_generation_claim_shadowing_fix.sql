begin;

do $test$
declare
  v_claim_def text;
begin
  select pg_get_functiondef(
    'public.claim_weekly_digest_generation_jobs_v2(text,text[],integer,uuid,uuid,text,text,integer)'::regprocedure
  ) into v_claim_def;

  if position('#variable_conflict use_column' in lower(v_claim_def)) = 0
     or position('for update of job skip locked' in lower(v_claim_def)) = 0
     or position('where id = v_job.id' in lower(v_claim_def)) = 0 then
    raise exception 'Fenced claim must resolve output-column shadowing while retaining its lock';
  end if;
end;
$test$;

rollback;
