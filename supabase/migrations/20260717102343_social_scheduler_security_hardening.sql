-- Enable the scheduler dependencies before creating production jobs.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- `REVOKE ... FROM public` does not remove direct grants that Supabase gives
-- to API roles. Keep CMS RPCs inaccessible to anon users, and only expose
-- each routine to the minimum role that calls it.
revoke all on function public.is_social_admin() from public, anon, authenticated, service_role;
revoke all on function public.has_social_aal2() from public, anon, authenticated, service_role;
revoke all on function public.approve_social_post(uuid) from public, anon, authenticated, service_role;
revoke all on function public.edit_social_post(uuid, integer, text, text, text, timestamptz, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function public.approve_social_package(uuid) from public, anon, authenticated, service_role;
revoke all on function public.claim_due_social_posts(integer) from public, anon, authenticated, service_role;
revoke all on function public.reconcile_stale_social_posts() from public, anon, authenticated, service_role;
revoke all on function public.reserve_x_budget(numeric) from public, anon, authenticated, service_role;
revoke all on function public.auto_approve_green_package(uuid) from public, anon, authenticated, service_role;
revoke all on function public.record_green_delivery_success(uuid) from public, anon, authenticated, service_role;
revoke all on function public.store_social_oauth_secret(text, text, timestamptz, text) from public, anon, authenticated, service_role;
revoke all on function public.read_social_oauth_secret(text) from public, anon, authenticated, service_role;

grant execute on function public.is_social_admin() to authenticated, service_role;
grant execute on function public.has_social_aal2() to authenticated, service_role;
grant execute on function public.approve_social_post(uuid) to authenticated;
grant execute on function public.edit_social_post(uuid, integer, text, text, text, timestamptz, jsonb, text) to authenticated;
grant execute on function public.approve_social_package(uuid) to authenticated;
grant execute on function public.claim_due_social_posts(integer) to service_role;
grant execute on function public.reconcile_stale_social_posts() to service_role;
grant execute on function public.reserve_x_budget(numeric) to service_role;
grant execute on function public.auto_approve_green_package(uuid) to service_role;
grant execute on function public.record_green_delivery_success(uuid) to service_role;
grant execute on function public.store_social_oauth_secret(text, text, timestamptz, text) to service_role;
grant execute on function public.read_social_oauth_secret(text) to service_role;

alter function public.has_social_aal2() set search_path = '';

-- Objects in a public bucket remain readable through their public object URL;
-- this broad RLS rule is not needed and would otherwise enable object listing.
drop policy if exists "social assets: public read" on storage.objects;
