# Weekly editorial selection

Summary: Правила тижневого editorial-відбору для weekly-дайджесту.
Sources: `src/lib/weekly-digest/content-studio.ts`, `src/lib/weekly-digest/editorial-llm.ts`,
`src/components/admin/weekly-workspace.tsx`, `src/app/globals.css`, owner content-quality
audit 2026-08-09
Last updated: 2026-08-09


`weekly-editorial-v2` replaces the old `impact → recency → daily rank` sort used
for weekly digests. Its purpose is to produce an explainable, evidence-backed
shortlist for an editor, not to publish an algorithmic verdict.

## Selection pipeline

1. Load only published briefs and approved brief items from the seven-day window.
2. Join each brief item to its persisted article ranking telemetry.
3. Apply trust gates before any item receives a score.
4. Score eligible candidates on a 100-point scale.
5. Select up to seven stories with event, category, source, and day diversity.
6. Persist the score, component breakdown, reasons, source, and citations in the
   weekly item snapshot.
7. Persist the complete candidate pool and a concise digest-level rationale in
   `weekly_digest_selection_runs`.
8. Create a yellow-risk package in `in_review`. An editor must verify the central
   claim and approve the package before the digest becomes public.

## Trust gates

A candidate is rejected when any of these conditions is true:

- it is a later canonical copy of an already published story;
- English or Ukrainian title, summary, or `why it matters` copy is missing;
- no valid HTTPS citation is attached;
- either locale has no substantive fact entry;
- the source URL is missing or is not HTTPS;
- the impact assessment is missing;
- the article does not have current normalized ranking telemetry (`score_version = 2`).

These gates validate the evidence package, not the truth of every claim. The
editor still opens the primary source before approval.

## Score

| Component | Points | Purpose |
| --- | ---: | --- |
| Editorial impact | 35 | Prefer material changes over novelty or virality |
| Evidence and authority | 20 | Reward citations, bilingual facts, and trusted sources |
| Corroboration | 15 | Reward independent coverage and source breadth |
| Upstream rank | 10 | Preserve the normalized daily pipeline signal |
| Builder audience fit | 10 | Prefer practical AI engineering value |
| Daily editorial priority | 5 | Use the item's rank within its daily brief |
| Recency | 5 | Break close calls without letting the last day dominate the week |

The score is deterministic and rounded to one decimal. Every selected item's
component breakdown is stored in `weekly_digest_items.snapshot.editorial_selection`.

## Diversity constraints

- one item per event cluster;
- at most two items per category;
- initially at most two items per source domain;
- initially at most two items per brief date.

Source and day limits are relaxed only when needed to fill the digest. Event and
category limits remain hard. This keeps sparse weeks shippable without allowing
one event or one theme to dominate.

## Editorial review

The admin package page shows a concise `Why this Weekly Digest` rationale before
the shortlist. It reports how many candidates were considered, how many passed
the gates, the decisive factors, topic/source coverage, and the main trade-offs.
The summary is deterministic and is built from the persisted selection run; it
is not hidden model reasoning.

The page also shows the shortlist, score, selection reasons, source, and citation
count. The score is decision support only. Approval should check:

1. the headline and central claim match the linked source;
2. numbers, release status, and dates are supported;
3. the story remains important in the context of the whole week;
4. the seven stories form a useful mix rather than seven variations of one trend.

An editor can save a structured change request with one or more reason codes,
a required note, story-level remove/reorder/edit/replace actions, and eligible
stories that appear to be missing. A request revokes variant approvals and
blocks package approval until a later `changes_addressed` review event. Review
events and their item-level labels are append-only so they can calibrate future
versions without losing the original decision context.

The stored review dataset distinguishes:

- a good daily story that was not important enough for the weekly top seven;
- a selected false positive that the editor removed;
- an eligible false negative that the editor asked to add;
- a ranking or writing correction that does not invalidate the underlying story.

## Calibration

Run the legacy script with `--dry-run` to print the current shortlist and scores
without writing or posting:

```bash
npx tsx --env-file=.env.local pipeline/scripts/weekly-digest.ts --dry-run
```

Weight changes must bump `WEEKLY_SELECTION_VERSION` and add a regression fixture
showing the intended ranking change. Calibrate against editor decisions and
reader engagement only after enough weekly observations exist; do not tune to a
single unusually noisy week.

## Межа з editorial voice overhaul (2026-08-06)

Цей відбір (7-story shortlist, score, diversity gates) **не змінився** у перегляді редакційного
голосу — він лишається чистим входом для майстер-промпту. Змінилось те, що відбувається зі
story ПІСЛЯ відбору: `editorial-llm.ts` тепер пише текст через `editorial-voice.ts`
(house-style, exemplars, banned-phrase гейт). Деталі — [editorial-voice](editorial-voice.md).
(source: `src/lib/weekly-digest/editorial-voice.ts`, `editorial-llm.ts`)

## Межа з responsive grid-фіксом (2026-08-09)

Відбір, score і persisted selection runs не змінювались. Змінено лише безпечне стискання
контейнерів у Weekly admin: `.grid > *` може стискатися, а гнучкі колонки використовують
`minmax(0, …)`. Це не дозволяє довгому control або тексту зсунути контент за viewport, але не
змінює склад shortlist чи критерії editorial-рішення.
(source: `src/components/admin/weekly-workspace.tsx`, `src/app/globals.css`)

## Межа з quality hardening v7 (2026-08-09)

Алгоритм shortlist, його ваги й diversity constraints знову не змінювались. Після аудиту
випуску `843975a8-8c19-4eca-96a8-035f76eae3ab` посилено наступну межу: writer має явно
атрибутувати одиничні case studies й не перетворювати їх на універсальну тезу, а critic та
детерміновані гейти блокують вигадані сцени, prompt leakage, абстрактні заголовки, розмиті
energy claims і UK language defects. Хороший selection score підтверджує цінність кандидата,
але не гарантує якість або фактичну обережність готового тексту; числа й одиниці перевіряються
вже на writer/critic boundary, а не під час shortlist scoring. Writer також не має права
видавати diversity shortlist за єдину тему: зв'язок Top 3 мусить випливати з evidence.
(source: `src/lib/weekly-digest/content-studio.ts`, `editorial-llm.ts`, owner audit 2026-08-09)

## Related pages

- [weekly-digest](weekly-digest.md) — Content Studio v2, ревізії, spend-cap, admin UX
- [editorial-voice](editorial-voice.md) — редакційний голос після відбору
- [video-boundary](video-boundary.md)
