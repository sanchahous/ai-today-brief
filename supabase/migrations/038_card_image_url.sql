-- 038_card_image_url.sql
-- Per-item generated brand card illustration.
--
-- The pipeline generates a unique AI hero image per brief item (cinematic style,
-- category-accented), stores it in the `card-images` Storage bucket, and records
-- the public URL here. The OG card (opengraph-image.tsx) and article hero
-- composite the brand overlay over it. NULL → branded duotone fallback renders.
-- Filled post-publish (pipeline/card-image.ts), so it never blocks the brief write.

alter table public.brief_items
  add column if not exists card_image_url text;

-- Public, read-only bucket for the generated card images. Writes go through the
-- pipeline's service-role client (bypasses RLS); anon reads hit the public path.
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;
