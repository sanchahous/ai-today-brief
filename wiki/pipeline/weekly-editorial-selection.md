# Weekly editorial selection

Summary: Правила тижневого editorial-відбору для weekly-дайджесту.
Sources: `src/lib/weekly-digest/content-studio.ts`, `src/lib/weekly-digest/editorial-llm.ts`,
`src/components/admin/weekly-workspace.tsx`, `src/app/globals.css`, owner content-quality
audit 2026-08-09, follow-up critic-recovery fix 2026-08-10, UK `claimIds` parser fix 2026-08-10
(Actions run `31367921173`), quantified length-repair fix + newer-draft banner 2026-08-10,
Postpone release feature 2026-08-10, experimental Visual Affordance V10 owner review 2026-08-13,
weekly illustration M1 prompt_only 2026-08-15
Last updated: 2026-08-15

---

`weekly-editorial-v2` replaces the old `impact → recency → daily rank` sort used
for weekly digests. Its purpose is to produce an explainable, evidence-backed
shortlist for an editor, not to publish an algorithmic verdict.

> **Scope note (2026-08-15):** Visuals copy-ready prompt cards (`story_prompt_set`) and M1
> `WEEKLY_STORY_IMAGE_MODE=prompt_only` do not change `weekly-editorial-v2` candidates, weights,
> diversity constraints, approval state or release eligibility.
> (source: [weekly-illustration-plan](weekly-illustration-plan.md) P2)

> **Scope note (2026-08-13):** experimental Visual Affordance V10 evaluates visual explanations
> for three selected stories only. It does not alter `weekly-editorial-v2` candidates, weights,
> diversity constraints, approval state or release eligibility.
> (source: `experiments/visual-affordance-v10/targeted-v6-owner-outcome-repair/results/README.md`)

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

Після live run `31324873875` ця межа також коректно переживає форматування та provider-fallback:
преамбула CLI навколо валідного JSON не змінює shortlist, а fallback на UK/revise-кроках лише
продовжує роботу з тим самим approved набором stories і claims. Відбір, його ваги та
diversity constraints не змінюються. (source: `src/lib/weekly-digest/editorial-llm.ts`,
Actions run `31324873875`)

## Межа з v7.1 commercial-balance point fixes (2026-08-09)

Відбір знову не змінювався. Три v7-гейти звужено після емпіричної перевірки на хибнопозитиви:
`ambiguous_energy_claim` тепер реагує лише на явне порівняння («у 600 разів більше енергії»), а
не на будь-яку згадку «energy» у заголовку/meta; UK `uk_language_residue` більше не блокує
`score` і `мейнтейнер` — усталений dev-жаргон цільової аудиторії; uniform-critic-score гейт ловить
будь-яку однакову оцінку нижче 95, а не лише рівно 90, і не чіпає дійсно рівно сильний текст.
Мета — тримати баланс між фактажем і привабливістю, а не лише нарощувати заборони.
(source: `src/lib/weekly-digest/content-studio.ts`, owner review 2026-08-09)

## Межа з durable master recovery (2026-08-09)

Recovery не змінює shortlist, ваги, evidence або diversity constraints. Він повторно
використовує рівно той EN+UK master, який уже був зібраний з current approved research, і
запускає тільки наступну quality/revise межу. Натомість rule про механічні однакові оцінки
critic-а лишається fail-closed: resume не перетворює некалібрований verdict на апрув і не
послаблює редакційний відбір заради швидкості.
(source: `src/lib/weekly-digest/generation-worker.ts`,
`src/lib/weekly-digest/content-studio.ts`)

Якщо critic недоступний після власної provider-драбини, рішення відбору так само не
підміняється припущенням: job є `resumable`, а не `succeeded`, і наступна спроба оцінить той
самий збережений текст. Власник не отримує «проштовхнути без verdict» як шлях до апруву.
(source: `src/lib/weekly-digest/master-engine.ts`, follow-up critic-recovery fix 2026-08-10)

## Межа з UK `claimIds` parser fix (2026-08-10)

Відбір знову не змінювався. Перший живий прогін нового рушія (Actions run `31367921173`)
відкидав кожну коректну UK-відповідь через контракт-мисматч у парсері (UK-промпт не
повертає `claimIds`, парсер їх вимагав) — це формат письма/парсингу однієї конкретної мови,
а не переоцінка чи повторний відбір approved claims. Approved claim ids для кожної story
й далі приходять із того самого selection/research pack і копіюються складальником; фікс
лише дозволив UK-відповіді без цього поля пройти парсинг. (source:
`src/lib/weekly-digest/editorial-llm.ts`, Actions run `31367921173`)

## Межа з quantified length-repair + newer-draft banner (2026-08-10)

Відбір знову не змінювався. Дві незалежні зміни того самого дня, обидві поза shortlist: (1)
`story_length`'s `suggestedFix` тепер називає точну дельту слів замість розпливчастого
«rewrite to N-M words» — вплинуло тільки на те, як ремонт формулює прохання до моделі, не на
те, які claims чи stories потрапляють у випуск; (2) `NewerDraftBanner` у
`weekly-workspace.tsx` — суто UI-індикатор, що активна ревізія не найновіша, без жодного
впливу на сам відбір чи approved research. (source: `src/lib/weekly-digest/content-studio.ts`,
`src/components/admin/weekly-workspace.tsx`)

## Межа з Postpone release (2026-08-10)

Відбір не змінювався. `postponeWeeklyDigestAction` рухає лише `weekly_digests.release_at`/
`preflight_at` і статус релізу — не торкається shortlist, approved research чи самого
контенту статті. Re-approve крок усередині postpone повторно ганяє `weekly_digest_preflight`
на **вже** approved research/artifacts, не переоцінює відбір заново. (source:
`src/app/admin/(cms)/weekly/actions.ts`)

## Межа з semantic illustration v5 (2026-08-11)

Shortlist/rank/diversity відбору не змінювались. `weekly-semantic-story-v5.1` починає роботу вже
після bilingual article master: бере approved story fields і, для Top 3, лише approved
`research_pack`; перетворює їх на illustration contract context → meaning → mechanism →
consequence. Vision score впливає на `story_image` artifact/release preflight, але не переоцінює
selection score і не міняє порядок stories. (source: `src/lib/weekly-digest/generation-worker.ts`,
`pipeline/card-image.ts`, `src/lib/content-sim/vision-critic.ts`)

Перенесення `story_image` з 300-секундного Vercel request у незалежні GitHub Actions workers також
не змінює shortlist або score: це лише execution boundary. Кожна story зберігає власний fenced
`job_id`, input і `revision_item_id`, тому паралельні renders не можуть забрати роботу іншої story.
Під час rollout кілька regenerate rows одного `revision_item_id` не стають кількома renders:
міграція залишає live lease або найновіший запит, а попередні retry/stale jobs фіксує як
superseded.
(source: `src/lib/weekly-digest/generation-control.ts`,
`supabase/migrations/20260811183201_weekly_story_image_async_worker.sql`)

## Related pages

- [weekly-digest](weekly-digest.md) — Content Studio v2, ревізії, spend-cap, admin UX
- [editorial-voice](editorial-voice.md) — редакційний голос після відбору
- [video-boundary](video-boundary.md)
