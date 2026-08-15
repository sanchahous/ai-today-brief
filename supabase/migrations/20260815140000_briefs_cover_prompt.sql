begin;

-- Daily edition cover prompt (illustration plan P3). Text only — never auto-rendered.
-- Anon already reads published briefs; this column is not selected on public pages.

alter table public.briefs
  add column if not exists cover_prompt jsonb;

comment on column public.briefs.cover_prompt is
  'Copy-ready ManualImagePrompt for the edition cover. Written after the draft pack lands. Null until then.';

commit;
