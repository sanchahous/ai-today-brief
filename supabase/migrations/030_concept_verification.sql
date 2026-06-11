-- ============================================================================
-- 030 — Concept body verification metadata (soft fact-control marker)
-- ============================================================================
-- The concept backfill now distinguishes claim kinds when fact-checking a
-- generated body against the official page:
--   * specific claims (numbers, prices, dates, named features) that the source
--     does not support still BLOCK publication (revise → re-verify → skip);
--   * definitional/background statements that simply cannot be confirmed from
--     a thin or SPA official page are published but recorded here, and the hub
--     renders a soft "general industry knowledge" note instead of a scary
--     warning.
--
--   verification_status:
--     'verified'  — official page fetched; all specifics confirmed, no
--                   unconfirmed background statements
--     'partial'   — specifics confirmed/removed, but some background
--                   statements could not be cross-checked (listed below)
--     'unchecked' — no official page text available to check against
--     NULL        — human-curated body (seeded hubs); no marker rendered
--   unverified_claims: jsonb string[] — the recorded background statements
--   verified_at: when the fact-control pass ran

ALTER TABLE public.concepts
  ADD COLUMN IF NOT EXISTS verification_status text,
  ADD COLUMN IF NOT EXISTS unverified_claims jsonb,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.concepts
  DROP CONSTRAINT IF EXISTS concepts_verification_status_check;

ALTER TABLE public.concepts
  ADD CONSTRAINT concepts_verification_status_check
  CHECK (verification_status IS NULL OR verification_status IN ('verified', 'partial', 'unchecked'));
