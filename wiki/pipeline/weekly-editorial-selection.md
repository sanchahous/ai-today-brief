# Weekly editorial selection

Summary: Правила тижневого editorial-відбору для weekly-дайджесту.
Sources: `src/lib/weekly-digest/content-studio.ts`, `editorial-llm.ts`,
`pipeline/weekly-digest.ts`, owner audits / production runs 2026-08-09…17,
[weekly-digest](weekly-digest.md), staged social-copy recovery and LinkedIn 7-page bounds
2026-08-17.
Last updated: 2026-08-22

---

`weekly-editorial-v3` (раніше `-v2`) replaces the old `impact → recency → daily rank`
sort used for weekly digests. Its purpose is to produce an explainable,
evidence-backed shortlist for an editor, not to publish an algorithmic verdict.
Що саме змінила v3 і чому — [нижче](#що-змінила-v3-2026-08-16).

> **Scope note (2026-08-15):** Visuals copy-ready prompt cards (`story_prompt_set`), M1
> `WEEKLY_STORY_IMAGE_MODE=prompt_only`, M2 post-upload QA, M3 preflight copy and B3
> `N/3 промпти готові` do not change
> `weekly-editorial-v2` candidates, weights, diversity constraints, approval state or release
> eligibility. Images remain required for release; only the missing-image hint and Visuals
> readiness line changed. P3 (daily cover prompt) is the daily pipeline, not this selector.
> D2 post-upload advice is Visuals copy only — it does not change release eligibility.
> D3 `human_dignity_risk` is critic/QA copy only — it does not change this selector.
> E1 owner-feedback is Visuals calibration copy only — it does not change this selector.
> E2 two-stage critic is the vision loop, not this selector.
> E3 prompt-promotion readout is Visuals calibration only — it does not change this selector
> or release eligibility.
> Site WebP encoding (2026-08-17) changes `story_image` persist/upload and the public
> image loader only — it does not change this selector.
> F3 OpenRouter daily ranking writes `llm_model_rank_audit` / `llm_provider_models` and does
> not change this selector.
> G illustration budget is `/admin/costs` ledger split only — it does not change this selector.
> F5 strips pinned generation ids from production code — it does not change this selector.
> Social package master-artifact hydration (2026-08-17) is downstream generation compatibility:
> it rehydrates approved revision stories for social/LinkedIn rendering and does not change this
> selector's candidates, weights, ranks, diversity, or approval state.
> Weekly release autopilot (2026-08-21) machine-attests green `research_pack` /
> article / pdf / social / script artifacts and adds a Hallucination board; it does not
> change this selector's candidates, weights, ranks, or diversity.
> (source: `src/lib/weekly-digest/generation-worker.ts`)
> GitHub dispatch 503 recovery (2026-08-17) is control-plane transport resilience only: it
> retries an already-created worker request and keeps an unconfirmed lease fenced; it does not
> change this selector's candidates, weights, ranks, diversity, or approval state.
> (source: `src/lib/weekly-digest/github-dispatch.ts`)
> Staged social-copy checkpoints and the approval-ready Social boundary (2026-08-17) are
> downstream persistence/quality controls: linked retries reuse only blocker-free channel copy,
> while failed channels are repaired against the same approved article. They do not change
> candidates, weights, ranks, diversity, or editorial approval state.
> The social-only 60 s per-model OpenRouter ceiling, two-model call cap, low-reasoning request
> OpenAI-first writer lane, true saved-role override check and one-candidate-per-repair-round
> budget are downstream runtime controls;
> editorial-master timeouts and this selector are unchanged.
> (source: `.github/workflows/weekly-master-cli-worker.yml`,
> `src/lib/weekly-digest/social-adapter.ts`, `src/lib/social/llm-router.ts`)
> Writer candidate-serialization validation is likewise a downstream social provider-fallback
> boundary and does not alter selected stories or their editorial weights.
> (source: `src/lib/weekly-digest/social-adapter.ts`)
> Social critic score/flag alignment is also downstream: factual and platform observations are
> warnings when their dimension passes 85, and blockers only below that threshold. It does not
> alter selected stories, ranks, diversity, or owner editorial approval.
> (source: `src/lib/weekly-digest/social-adapter.ts`, production run `32062624113`)
> Legacy Social post repair ordering is downstream persistence only: it updates an existing
> package/channel row with the already accepted adaptation before the final review guard and does
> not change selected stories, weights, evidence, or approval state.
> (source: `src/lib/weekly-digest/generation-worker.ts`, production run `32063924268`)
> Collapsed Social generation history is downstream admin presentation only: superseded linked
> attempts remain available for diagnostics but do not change candidates, ranks, evidence or
> approval state.
> (source: `src/components/admin/weekly-generation-jobs-live.tsx`,
> `src/lib/weekly-digest/generation-job-visibility.ts`)
> (source: `src/lib/weekly-digest/social-checkpoint.ts`,
> `src/lib/weekly-digest/generation-worker.ts`)
> LinkedIn 7-page bounds (2026-08-17) clip only presentation copy inside fixed native-document
> regions while preserving clickable source URLs; they do not change selected stories, ranks,
> evidence, article artifacts or approval state.
> (source: `src/lib/weekly-digest/linkedin-document.ts`)
> (source: [weekly-illustration-plan](weekly-illustration-plan.md) P2/M3/B3/P3/D2/D3/E1/E2/E3/F3/G/F5)

> **Scope note (2026-08-15):** the `feat/weekly-illustration-fixes` review-fix branch
> (siblings-diversification, mapping-gate soft-fail, OpenRouter rerank queue-truncation fix,
> grammar cap to one concept, craft-ban exception narrowing, owner scene-override plumbing,
> cross-digest write ownership checks) touches `story_prompt_set` generation and Visuals only —
> it does not change `weekly-editorial-v2` candidates, weights, diversity constraints, approval
> state or release eligibility.
> (source: [audits/2026-08-15-illustration-pr-stack-review](../audits/2026-08-15-illustration-pr-stack-review.md))

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
| Evidence and authority | 25 | Publisher authority (16) + bilingual facts (5) + citation depth (4) |
| Corroboration | 13 | Cross-source (7) + breadth (3) + independent citation hosts (3) |
| Upstream rank | 10 | Preserve the normalized daily pipeline signal |
| Builder audience fit | 10 | Prefer practical AI engineering value |
| Daily editorial priority | 5 | Use the item's rank within its daily brief |
| Recency | 5 | Flat inside the digest week; ≤1 point separates Monday from Saturday |

The score is deterministic and rounded to one decimal. Every selected item's
component breakdown is stored in `weekly_digest_items.snapshot.editorial_selection`.

**Authority means the publisher, not the feed.** `articles.score_authority` is
`sourceTrust(source_name)` — the trust of whatever feed surfaced the link — so a
personal blog found on Hacker News carried the same 0.9 as the vendor's own
release note. Weekly scoring calls `publisherAuthority(source_name, url)`
(`pipeline/source-authority.ts`): for an aggregator feed the destination host
decides (first-party lab 1.0 · preprint/standards 0.9 · code hosting 0.85 ·
known engineering author 0.8 · trade press 0.7 · unknown company domain 0.6 ·
hosted blog platform 0.45 · social post 0.35); for a publisher feed the feed name
stays authoritative and a known host may only lift it. The daily composite in
`rank.ts` is unchanged — it still uses the feed-level table.
(source: `pipeline/source-authority.ts`, `pipeline/weekly-digest.ts`)

## Diversity is a price, not a wall

- one item per event cluster — **hard** (that is deduplication, not balance);
- free allowance of two items per category, per source domain and per brief date;
- every item beyond an allowance pays **−5 category / −4 source / −3 day**, and
  competes on the adjusted score.

Selection is a greedy max-marginal pick: after each choice the pool is re-priced
and re-ranked. A story that is clearly stronger buys its way past the allowance;
a near-tie yields to variety. Both `diversity_penalty` and `adjusted_score` are
stored per candidate, so review reads «програв 0.8 після 5-балного штрафу за
категорію» instead of the previous silent «capped».
(source: `pipeline/weekly-digest.ts`)

## Що змінила v3 (2026-08-16)

Аудит власника на прод-прогоні `05cc4e6a-a709-44ca-b56a-382f21c40292` (тиждень
2026-08-09…15, 27 кандидатів → 22 eligible → 7) знайшов три дефекти відбору. Усі три
підтверджені на живій БД до фіксу.

**1. Свіжість вирішувала замість якості.** `editorialImpact` — константа 35 для
кожного `high`, а таких серед eligible було 10, тож усередині тіру вона не
розрізняла нічого. Найбільший розкид у решті балів давала `recency` (1.4 → 5.0),
тому в тижневому огляді дата фактично сортувала топ: bearblog-допис про контест
(67.3 за новою шкалою) обійшов IBM ALTK-Evolve. Тепер усі новини всередині вікна
ділять плато, а різниця понеділок↔субота ≤ 1 бала; спад починається лише за межами
семиденного вікна. На тому самому пулі `recency` селекції тепер 4.4–4.9 замість
1.4–5.0. (source: прод-`weekly_digest_selection_runs` live check 2026-08-16)

**2. `category_balance` видаляв, а не штрафував.** Кап відсіював historії з 68.1 і
67.4, лишаючи в дайджесті 63.9 — тобто коштував 4.2 бала якості без жодного сліду в
даних. Дефолтний `perDayCap` робив те саме тихо: сім обраних розкладались рівно
2+2+2+1 по днях, тож 67.4 насправді впав на денному капі, а звіт показував
`category_balance`. Замінено на штраф (див. вище); у бектесті новина, яку кап
видаляв, повертається в дайджест на 7-й позиції, заплативши 3 бала.

**3. `evidence` міряв заповненість полів, `corroboration` був вимкнений.**
`evidence = 5 + citations` (стеля 8) `+ facts + 1` (стеля 4) `+ authority×8` давало
14.4–18.0 на весь тиждень, і 17.2 однаково для Hacker News і для особистого блогу —
бо authority брався з назви фіду. Після фіксу розкид 7.6 → 22.0 (медіана 14.6) на
тому самому пулі. `corroboration` був 0 у 21 з 22 айтемів, бо читав лише
`score_cross_source`/`score_breadth`, які в проді мертві (середнє `mentions_count`
≈ 1). Тепер він додатково рахує **незалежні** хости цитат — не власний домен новини
й не тред HN/Reddit/X, з якого її взяли. Це підіймає покриття з 1/22 до 3/33: сигнал
більше не вимкнений структурно, але дані все ще рідкісні, тому бюджет компонента
зменшено 15 → 13 на користь `evidence`. Daily rank з 2026-08-16 клеїть ownership-події
(дві спільні сутності) і `storyIdentityKeys`; історичні рядки з `mentions_count ≈ 1`
лишаються, поки їх не перескорять. Research-паки Top 3
з 2026-08-16 шукають sibling-сторінки вже в таблиці `articles` — це інший лічильник,
див. [weekly-digest § Corpus corroboration](weekly-digest.md#corpus-corroboration-in-research-packs-2026-08-16).
Retry Content Studio після `succeeded` паків (2026-08-16) ставить нові `research_pack`
jobs; він не змінює кандидатів, ваги чи diversity `weekly-editorial-v3`.
(source: `src/lib/weekly-digest/orchestrator.ts`,
[weekly-digest § Start / retry](weekly-digest.md#content-studio-retry-after-succeeded-jobs-2026-08-16))
> ⚠️ (needs verification) Гіпотеза: доки `mentions_count ≈ 1`, будь-який
> **selection**-corroboration лишатиметься рідкісним. Див. [overview](../overview.md) §7 #6.

**Наслідок для контенту.** Ці зміни стосуються лише `selectEditorialDigestItems`.
Порожні поля історій виправлено окремо — див.
[weekly-digest § Seed-контент історій](weekly-digest.md#seed-контент-історій-2026-08-16).

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

## Межа з Fix remaining issues на Master quality (2026-08-22)

Відбір не змінювався. Кнопка на панелі Research лише перезапускає writer/critic на **вже**
approved Top 3 research packs і поточному quality report; shortlist, rank і claims не
перераховуються. Неблокуючі warnings (`story_length`, `trust_attribution`) тепер потрапляють
у retry guidance разом із below-floor dimensions — це інструкція до моделі, не зміна відбору.
(source: `src/components/admin/weekly-workspace.tsx`, `src/lib/weekly-digest/generation-worker.ts`)

## Related pages

- [weekly-digest](weekly-digest.md) — Content Studio v2, ревізії, spend-cap, admin UX
- [editorial-voice](editorial-voice.md) — редакційний голос після відбору
- [video-boundary](video-boundary.md)
