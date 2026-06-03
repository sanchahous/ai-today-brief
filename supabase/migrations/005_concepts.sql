-- Phase 2 of the SEO closure: dedicated hub pages for tools and concepts
-- that come up across multiple briefs. Each concept gets its own URL like
-- /ai-news-scrapper/:lang/concepts/cursor or /:lang/concepts/mcp, listing
-- every brief item that mentioned it. That's an internal-linking flywheel:
-- one item → multiple concept pages → many other items → topical authority.
--
-- Lookup model: tool chips on ItemPage match a concept by name (case-
-- insensitive) or by alias. The aliases column lets one concept absorb
-- common variants — e.g. "MCP" matches the canonical "Model Context
-- Protocol" entry.

CREATE TABLE IF NOT EXISTS public.concepts (
  slug            text PRIMARY KEY,
  name_en         text NOT NULL,
  name_uk         text NOT NULL,
  description_en  text,
  description_uk  text,
  -- 'product' | 'concept' | 'service' | 'library' | 'model'
  type            text NOT NULL DEFAULT 'concept',
  -- 'ide' | 'agent' | 'protocol' | 'optimization' | 'sdk' | 'service' | …
  category        text,
  official_url    text,
  -- alternative names to match in tools_mentioned (lowercase, no dups)
  aliases         text[] DEFAULT ARRAY[]::text[],
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Public-read RLS so the static frontend can fetch concept rows directly
-- (same pattern as the briefs / brief_items tables).
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "concepts_public_read" ON public.concepts;
CREATE POLICY "concepts_public_read"
  ON public.concepts
  FOR SELECT
  USING (true);

-- Aliases array search helper — Postgres can use a GIN index over text[].
CREATE INDEX IF NOT EXISTS concepts_aliases_gin
  ON public.concepts USING GIN (aliases);
