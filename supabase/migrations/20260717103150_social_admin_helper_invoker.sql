-- Membership can be evaluated under the caller because social_admins exposes
-- only a caller's own row. This removes an unnecessary SECURITY DEFINER RPC.
alter function public.is_social_admin() security invoker;
