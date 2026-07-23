-- The published-artifact RLS policy is intentionally public, but Supabase's
-- Data API also requires an explicit table grant before RLS can be evaluated.
-- Draft/current operational rows remain protected by the existing policy.
grant select on table public.weekly_digest_artifacts to anon;
