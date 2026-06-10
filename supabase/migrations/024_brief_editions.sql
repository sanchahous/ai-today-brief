-- Multiple brief packs per calendar day (edition 1, 2, 3…).
-- Site aggregates published packs into one daily brief; pipeline/Telegram keep separate rows.

ALTER TABLE public.briefs
  ADD COLUMN IF NOT EXISTS edition smallint NOT NULL DEFAULT 1;

UPDATE public.briefs
SET edition = 1
WHERE edition IS NULL;

ALTER TABLE public.briefs
  DROP CONSTRAINT IF EXISTS briefs_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS briefs_date_edition_uniq
  ON public.briefs (date, edition);
