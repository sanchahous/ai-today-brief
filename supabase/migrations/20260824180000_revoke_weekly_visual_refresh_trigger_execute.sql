begin;

-- This is a SECURITY DEFINER trigger helper, not an RPC surface. PostgreSQL
-- grants EXECUTE to PUBLIC by default, so revoke it explicitly after creating
-- the trigger. The table owner still invokes it through the trigger itself.
revoke all on function public.invalidate_weekly_visual_refresh_staged_assets()
  from public, anon, authenticated, service_role;

-- The machine attester mutates artifact review state and is guarded in its
-- body as service-only. Make the SQL privilege match that boundary as well;
-- otherwise its inherited PUBLIC EXECUTE grant leaves an unnecessary RPC URL.
revoke all on function public.machine_attest_weekly_digest_artifact(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.machine_attest_weekly_digest_artifact(uuid)
  to service_role;

commit;
