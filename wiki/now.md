# Now — поточний операційний стан

Summary: над чим іде робота просто зараз. Живий статус кожної задачі — окремий файл у каталозі фрагментів, не список у цьому файлі.
Sources: wiki/tasks/README.md; заморожений факт sync нижче; історична шапка — у wiki/tasks/archive-shared-lines.md (ATB-67, PR #405)
Last updated: 2026-10-03
Summary: над чим іде робота **прямо зараз**, що чекає на власника, що щойно відвантажено.
Живий файл — оновлювати при кожній зміні стану, не рідше раз на тиждень.
Sources: `git log` / `gh pr list`, owner sessions 2026-08-06…29, catalog 2026-08-30,
YouTube 120s + Supabase egress 2026-09-02,
SSG skip + local `build:ci` skip + ElevenLabs TTS 2026-09-03,
LinkedIn PDF skip on public promote 2026-09-03,
social URLs follow the published slug 2026-09-03,
weekly digest two-phase release (Ship / Publish video) 2026-09-03,
X self-reply is USE + compact `?s=` URL 2026-09-03,
LinkedIn comment is compact `?s=` + native article card on the post 2026-09-03
desktop nav surfaces Digests; homepage weekly card and SEO snippet updated 2026-09-03 (#360); redesign epic + code live check 2026-09-29; AH-0.1 G01–G20 status reconciliation + production live check 2026-09-29; AH-0.6 GA4 baseline 2026-09-29, повторна звірка PR / CWV / Admin-доступу й рішення власника щодо двох зайвих GA4-акаунтів 2026-09-30; AH-2.6 navigation consolidation 2026-10-01 (#392); AH-3.1 brand mark PR #393; AH-3.4 newsletter form and states 2026-10-02 (#395); AH-3.6 consent PR #396; AH-3.7 mark in generators PR #402; AH-3.8 brand-kit PR #403; per-PR owner signature removed 2026-10-02 (ATB-64, #397); Singapore bot diagnosis + Fast Origin Transfer check 2026-10-02
Last updated: 2026-10-02 (AH-3.8 PR #403)
desktop nav surfaces Digests; homepage weekly card and SEO snippet updated 2026-09-03 (#360); redesign epic + code live check 2026-09-29; AH-0.1 G01–G20 status reconciliation + production live check 2026-09-29; AH-0.6 GA4 baseline 2026-09-29, повторна звірка PR / CWV / Admin-доступу й рішення власника щодо двох зайвих GA4-акаунтів 2026-09-30; AH-2.6 navigation consolidation 2026-10-01 (#392); AH-3.1 brand mark PR #393; AH-3.2 SearchDialog PR #394; AH-3.3 header chrome 2-row layout; AH-3.4 newsletter form and states 2026-10-02 (#395); AH-3.5 footer PR #404; AH-3.6 consent PR #396; AH-3.7 mark in generators PR #402; per-PR owner signature removed 2026-10-02 (ATB-64, #397); Singapore bot diagnosis + Fast Origin Transfer check 2026-10-02
Last updated: 2026-10-03 (AH-3.3 review fixes)

---

<!-- task-status: fragments -->

## Стан репозиторію

- **AH-4.4 відкрито в [#412](https://github.com/sanchahous/ai-today-brief/pull/412)** на `feat/ah-4.4-news-search`: сторінка `/[lang]/news/search` — breadcrumb, H1 за `q`, велике поле пошуку, discovery з Relevance, idle з популярними запитами (trending), empty → Concepts; `noindex,follow`, canonical на `/news`. E2E `news-search.spec.ts`. **Наступна задача епіку — AH-4.5.** (source: PR #412; [епік §5.3 AH-4.4](product/after-hours-redesign-epic.md#ah-44--сторінка-пошуку-langnewssearch))

- **AH-5.15 відкрито в [#409](https://github.com/sanchahous/ai-today-brief/pull/409)** на `feat/ah-5.15-not-found-loading`: After Hours 404 (celadon-нуль, eyebrow, форма пошуку → `/news/search`, suggested links) без нескінченних анімацій; loading-скелетони home/news/category. E2E `not-found.spec.ts`. **Наступна задача епіку — AH-6.1.** (source: PR #409; [епік §5.3 AH-5.15](product/after-hours-redesign-epic.md#ah-515--404-і-loading-стани))

- **AH-3.3 реалізовано (2026-10-03)** на `feat/ah-3.3-header-layout`: 2-рівневий header-chrome (desktop), compact sticky навігація через `IntersectionObserver`, мобільний sheet (Categories і Search) та перемикання брейкпойнтів на 960px (`@variant tablet`). E2E тести оновлено (`e2e/helpers/viewports.ts`). Виправлено review findings: `isActive` для `digests` підтримує daily briefs, пошук у mobile menu використовує i18n, додано тест активного стану. (source: PR AH-3.3; [епік §5.3](product/after-hours-redesign-epic.md#53-зведена-таблиця-задач))

- **AH-3.2 відкрито в [#394](https://github.com/sanchahous/ai-today-brief/pull/394)** на `feat/ah-3.2-search-dialog`: один `SearchDialog` (Ctrl/Cmd+K, trending idle, aria-live, keyboard nav, error+retry) замінив `HeaderSearchField`, `MobileSearchModal` і `SearchPreviewDropdown`; header/hero/menu/404 ведуть у той самий сценарій. У `site-header-chrome.tsx` mobile menu: categories `<summary>` і lang toggle — `h-12` (≥44px tap target після E2E). E2E `header-layout` і `category-colours` відкривають dialog через `SearchTrigger`, не inline `role="search"`. **Наступна після інтеграції — AH-3.4.** (source: PR #394; [епік §5.3 AH-3.2](product/after-hours-redesign-epic.md#ah-32--searchdialog-ctrlcmdk))

Живий статус задач сюди не дописується. Кожна задача пише лише `wiki/tasks/<id>.md`. Зведення друкує `npm run wiki:tasks` і нічого не комітить.

Історичні пункти цього розділу перенесені дослівно у фрагменти. Розділи нижче — заморожений знімок; PR задач їх не править.

Заморожений факт sync: `WEEKLY_CONTENT_STUDIO_V2=off`.

(source: ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

## Щойно відвантажено (останні 8 PR)

| PR | Що |
|---|---|
| #179 | Dependabot npm-patch-minor (12 deps; без pdfkit) — next 16.2.12, react 19.2.8, … |
| #178 | Harden Dependabot automerge + pdfkit ignore + secrets docs |
| #177 | Weekly digest revision stability (`input_hash` / no-op Save / restore) |
| #176 | Ребренд favicon / app icons / header-footer logo; expand-on-focus search |
| #175 | Ілюстрації без впеченого тексту (FLUX.2 prompt policy v5-no-text) |
| #174 | Persist illustration prompts + сильніші scene briefs |
| #173 | Stop weekly admin 5s auto-refresh blink |
| #172 | Stale weekly admin previews після visual regen |

(source: `gh pr list --state merged` live check 2026-08-04)

## Vercel Fluid CPU (2026-08-04)

Hobby-план був на **3h58m з 4h** включеного Fluid Active CPU (99.8% — проєкт `ai-today-brief`).
Корінь: `generation-worker.ts` еagerly імпортував `sharp`/`pdfkit`/`pdfjs-dist`/canvas на
кожному 5-хвилинному `pg_cron`-опитуванні `/api/internal/weekly/generate`, навіть при порожній
черзі; плюс `<Link>` prefetch самостійно бомбардував найважчий route (`/admin/weekly/[id]`) з
таб-навігації. Фікс на гілці `fix/vercel-fluid-cpu-cost` (деталі —
[pipeline/weekly-digest](pipeline/weekly-digest.md#fluid-cpu--вартість-2026-08-04)); RPC
output-overwrite checkpoint-баг editorial_master вже полагоджено і застосовано в прод-Supabase.
(source: live check Vercel dashboard 2026-08-04)

## Активна робота

−10. **Master quality report губився після Restore — змержено в `main` 2026-08-17, PR
[#275](https://github.com/sanchahous/ai-today-brief/pull/275) (`f137c39`).** Власник побачив
на випуску
`6cbcf0b3-187d-4d7d-9eb9-66bdff1c72d4` (Attempt 1, `succeeded`): «Master quality report is
missing», хоча `editorial_master` реально відпрацював. Живий розбір прод-Supabase
(`mdiqfatpqczwqghwttpm`) показав справжню причину: критик не зійшовся (82/100, 1 unresolved),
воркер зберіг звіт на ревізії 3 (активній на старті job) і окремо створив draft-ревізію 4 з
тим самим текстом; власник відновив ревізію 4 через **Restore this version** — а
`revert_weekly_digest_revision` лише перемикає `active_revision_id`, артефактів не чіпає, тож
звіт лишився сиротою на вже неактивній ревізії 3. Перша спроба фіксу — прямий `UPDATE
revision_id` через Supabase MCP — впала: `revision_id` в `weekly_digest_artifacts` навмисно
**immutable** (`guard_weekly_digest_artifact_write`), і окремо не було сесії з потрібною
роллю для прямого SQL. Правильний фікс — новий
[quality-report-carryover.ts](../src/lib/weekly-digest/quality-report-carryover.ts): вставляє
свіжу копію звіту на активну ревізію тим самим RPC, яким пише воркер
(`save_weekly_digest_artifact`), не мутуючи старий рядок. Підключено в **Restore this
version** автоматично (best-effort, закриває проблему для майбутніх non-converged циклів) і
окремою кнопкою **Attach this report to the current version** на Research tab — рендериться
лише коли `workspace.orphanedQualityReport` реально знаходить осиротілий звіт (для дайджестів,
відновлених ще до фіксу, включно з `6cbcf0b3`). Approve лишається окремим кроком людини.
`tsc`/`eslint`/`vitest` (preflight/content-studio/generation-control/prompt-promotion-gate,
78 тестів) зелені; UI-верифікація в браузері не зроблена — той самий subst-drive `next dev`
глюк середовища. Деталі —
[weekly-digest § Master quality report carry-over при Restore](pipeline/weekly-digest.md#master-quality-report-carry-over-при-restore-2026-08-17),
[weekly-admin-runbook § Research](ops/weekly-admin-runbook.md#2-research-критичний-human-gate).
(source: прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-17,
`src/lib/weekly-digest/quality-report-carryover.ts`,
`src/app/admin/(cms)/weekly/actions.ts`, `src/components/admin/weekly-workspace.tsx`,
owner session 2026-08-17)

−9. **Postpone release — гілка `feat/weekly-postpone-release`, PR ще не відкрито.** Власник
попросив ручний спосіб переносити реліз, бо не завжди встигає. `schedule_weekly_digest`
приймає лише понеділок 16:00 Kyiv і лише зі статусу `approved` — для вже `scheduled` випуску
єдиний шлях був три ручні кроки (Pause з причиною → Resume, що ре-апрувить → перевписати
обидва datetime-local поля на нову дату). Новий `postponeWeeklyDigestAction` компонує ті самі
три вже наявні RPC (`pause_weekly_digest` → `approve_weekly_digest` → `schedule_weekly_digest`)
за одну кнопку: 1–4 тижні, одна причина. Нової RPC немає — жодних нових грантів ризикувати
(враховуючи, що знайшлось сьогодні вище). Дата рахується в календарі Kyiv (`addKyivWeeks`),
не додаванням фіксованої UTC-тривалості — перевірено вручну на обох DST-переходах 2026
(жовтень і березень), час лишається 16:00 Kyiv по обидва боки. Кнопка видима лише коли
`status === 'scheduled'`. Якщо проміжний крок впаде — випуск лишається в тому стані, який цей
крок залишив (`paused` або `approved`), банер каже точно, що саме не вдалось. `pr:check`
зелений; UI/JS-верифікація в браузері не зроблена — той самий відомий subst-drive `next dev`
глюк середовища, не повʼязаний зі зміною. Деталі —
[weekly-digest § Postpone release](pipeline/weekly-digest.md#admin-ux-нотатки-серп-2026),
[weekly-admin-runbook § Release](ops/weekly-admin-runbook.md#release-approve--schedule--за-потреби-postpone--pause).
(source: `src/app/admin/(cms)/weekly/actions.ts`, `src/components/admin/weekly-workspace.tsx`,
owner request 2026-08-10, manual DST verification 2026-08-10, local `pr:check` 2026-08-10)

−8. **Живий розбір "Needs your review" на `ai-weekly-2026-08-02` — власник не розумів, що
робити, і хіт реальний production-баг при спробі Restore, підтверджений двічі й виправлений
у прод-БД того ж дня.** Розбір прод-БД показав: 7 із 8 нерозв'язаних пунктів джоби `3c60e3bc…`
зводяться до **однієї** задовгої історії (EN 1203 / UK 1121 слів проти 400–650) — вона сама
тягнула обидва `article_length`-блокери. Активна ревізія цього дайджесту (Revision 2)
виявилась написаною **09.08 о 07:27, до жодного з v7-гейтів** — містила буквально банерний
приклад «Зсув до агентів» (той самий рядок, що UK-промпт наводить як заборонений зразок —
класичний LLM-провал «не роби X» → відтворює X) і зламане слово «доп'яти» (те саме, що вже в
`UKRAINIAN_LANGUAGE_RESIDUE` блоклісті). Три новіші ревізії (3, 4, 5) існували як ніколи не
активовані drafts, і Article tab про це жодним чином не сигналив.
> ⚠️ **Коригує запис вище (перша спроба діагнозу):** перший клік власника на **Restore this
> version** упав з `Minified React error #441`; я спершу приписав це «транзиентній сесії» —
> **виявилось хибним, власник підтвердив, що помилка стабільна.** Реальна причина: SQL-функції
> `create_weekly_digest_revision` («Save») і `revert_weekly_digest_revision` («Restore»)
> викликані як `security invoker` намагаються `UPDATE weekly_digest_generation_jobs`, а ролі
> `authenticated` цю таблицю з 23.07 видано лише `SELECT` — жодного `UPDATE` (постгрес
> перевіряє право на рівні таблиці ще до WHERE, тож навіть 0 підхожих рядків усе одно валить
> запит `42501`). Це б'є **кожен** owner/editor-виклик, не рідкісний випадок; за весь час у
> проді був рівно один успішний людський Save (04.08) і жодного відтоді — Save, судячи з усього,
> так само тихо ламався весь цей час. Відтворено напряму в БД через `set local role authenticated`
> у транзакції з відкатом — 100% детерміновано.
**Зроблено й застосовано до прод-БД 2026-08-10:**
- `security definer` на обидві функції (`supabase/migrations/20260810160000_weekly_revision_rpc_security_definer.sql`)
  — той самий патерн, що вже мають `retry_weekly_digest_generation_job`/
  `claim_weekly_digest_generation_jobs_v2` для тієї ж таблиці; перевірка `has_social_role`
  усередині лишається незмінною — авторизація не послаблена, дано лише права на конкретний
  запис. Перевірено в транзакції з відкатом ДО застосування — виклик успішно повернув нову
  активну ревізію, прод не чіплявся;
- `NewerDraftBanner` (`weekly-workspace.tsx`) — жовтий банер на кожній вкладці, коли
  найновіша ревізія не активна, з посиланням на Editorial versions;
- `restoreWeeklyDigestRevisionAction` більше не кидає сиру помилку — редіректить із
  `?save_error=…`, той самий банер, що й інші revision-дії, тож наступний збій покаже
  реальний текст, а не opaque `Ref: …`;
- `story_length`'s `suggestedFix` тепер називає точну дельту слів і вимагає структурної
  правки при великому розриві («Cut at least 550 words… a 46% cut needs structural
  editing»), а не розпливчасте «rewrite to 400–650 words»;
- `WEEKLY_MASTER_MAX_REPAIR_ATTEMPTS` дефолт 2→3 — важкий випадок ремонту отримує ще одну
  спробу.
Повний `pr:check` зелений; міграція живе в БД, PR [#213](https://github.com/sanchahous/ai-today-brief/pull/213)
з рештою коду ще відкритий. Деталі —
[weekly-master-engine § Чому ремонт задовгого body не сходився сам](pipeline/weekly-master-engine.md#чому-ремонт-задовгого-body-не-сходився-сам--і-що-змінено-2026-08-10),
[weekly-digest § Admin UX нотатки](pipeline/weekly-digest.md#admin-ux-нотатки-серп-2026).
(source: production Supabase read job `3c60e3bc-e0d9-4c5f-b1b1-34123c587129` + digest
`843975a8-8c19-4eca-96a8-035f76eae3ab` 2026-08-10, Supabase API/postgres logs live read
2026-08-10, `set local role authenticated` reproduction 2026-08-10, production migration
`20260810160000_weekly_revision_rpc_security_definer.sql` applied 2026-08-10,
`src/components/admin/weekly-workspace.tsx`, `src/app/admin/(cms)/weekly/actions.ts`,
`src/lib/weekly-digest/content-studio.ts`, `src/lib/weekly-digest/master-engine.ts`,
local `pr:check` 2026-08-10)

−7. **Перший живий прогін нового рушія — Actions run
[`31367921173`](https://github.com/sanchahous/ai-today-brief/actions/runs/31367921173),
2026-08-10 — знайшов реальну регресію, не редакційну.** UK feature story #1 не могла пройти
жодного разу: `ukrainianStorySegmentPrompt` наказує моделі не повертати `claimIds` (поле
копіюється з англійського оригіналу), а `parseStorySegment` вимагав його безумовно й
відкидав кожну відповідь, що слухалась промпту — `claude-cli` і всі 6 моделей
OpenRouter-черги писали валідний текст і падали на тому самому рядку, «Every editorial
provider failed» після ~40 хв на нуль результату. Резюм-прогін
([`31371078952`](https://github.com/sanchahous/ai-today-brief/actions/runs/31371078952))
продовжив із тих самих 8/16 durable-сегментів і впав так само (власник скасував вручну).
**Фікс на гілці `fix/weekly-master-uk-claimids`:** `parseStorySegment` отримав
`requireClaimIds = true` за замовчуванням, UK-виклик передає `false` (значення все одно
негайно перезаписується `english.claimIds`, EN-контракт лишається строгим); заразом
виключено з черги `openai/gpt-5.6-luna:batch` — Batch-only варіант, що 404-ив 6 разів
поспіль і забирав слот у кожному циклі ретраю. 85 фокусних тестів + повний `pr:check`
зелені. **Змержено в `main` 2026-08-10** (PR [#212](https://github.com/sanchahous/ai-today-brief/pull/212)). Деталі —
[pipeline/weekly-master-engine § Перший живий прогін](pipeline/weekly-master-engine.md#перший-живий-прогін--2026-08-10-знайшов-реальну-регресію).
(source: Actions runs `31367921173`/`31371078952`, `src/lib/weekly-digest/editorial-llm.ts`,
`src/lib/weekly-digest/master-engine.ts`, `pipeline/openrouter-models.ts`, local `pr:check`
2026-08-10)

−6. **Follow-up після PR #209: critic outage тепер не відкидає завершений випуск.** Єдиний
прямий виклик незалежного critic-а у `master-engine` був unguarded: якщо всі його provider-и
падали, `editorial_master` викидав exception, попри 14 durable сегментів. Тепер він повертає
retryable `resumable`, зберігає checkpoint і підказує **Resume saved master**; наступна спроба
переоцінює збережений текст. Додано регресійний test на цей шлях. (source:
`src/lib/weekly-digest/master-engine.ts`, `master-engine.test.ts`, local test 2026-08-10)

−5. **`editorial_master` переписано на ітеративний рушій — гілка
`claude/editorial-master-refactor-i6n8zl`.** Власник відмовився від подальших точкових фіксів
старої схеми: цілий день правок 09.08 дав шість послідовних червоних прогонів, кожен по
20–35 хвилин, і жодного випуску. Корінь був спільний — **найменшою одиницею роботи була ціла
стаття**, тож будь-яка проблема на 12-й хвилині коштувала пів години. Що зроблено:
   - **посегментний запис**: одна історія — один короткий виклик, плюс рамка випуску на локаль
     (14 сегментів для 3 feature + 3 radar); кожен сегмент durable у
     `output.master_run_state`, тож повтор **продовжує**, а не починає спочатку;
   - **точковий ремонт поля** замість перегенерації статті: блокер → адреса
     `{locale, story, field}` → маленький промпт із контрактом поля, доказами і цитованим
     спаном → `{"value": …}` → сплайс назад → повторна перевірка. Раунд коштує секунди й
     частки цента, тому ітерувати до збіжності дешево;
   - **безкоштовний детермінований раунд до критика** — приблизно половина блокерів
     (довжина метаданих, template-leaks, `numeric_parity`, українські мовні залишки)
     лагодиться до першого платного виклику критика;
   - **якість більше не валить джобу**: невирішені перевірки дають неактивну draft-ревізію,
     `succeeded` + `needs_owner_review` і перелік `unresolved` із причиною кожного;
     ненадійний вердикт критика (сім однакових оцінок) тепер переоцінюється, а не вважається
     термінальним провалом; вихід `resumable` (retryable) — коли скінчився бюджет часу;
   - **структурно неможливі блокери**: `revisionItemId`, `placement` і українські `claimIds`
     тепер копіює складальник, а не модель — `story_set_mismatch`, `placement_mismatch`,
     `bilingual_claim_parity` зникли за побудовою.
   Редакційні гейти v7 і пороги (85 / 75 / 80) **не послаблені** — перенесені в посегментні
   промпти дослівно. 1023 тести зелені, `pr:check` чистий. **Живого прогону ще не було** —
   перевірено юніт-тестами та типами, не реальним випуском.
   Деталі — [pipeline/weekly-master-engine](pipeline/weekly-master-engine.md). **Перший живий
   прогін відбувся 2026-08-10 і знайшов реальну регресію — деталі в пункті −7 вище.**
   (source: `src/lib/weekly-digest/master-engine.ts`, `master-segments.ts`, `master-repair.ts`,
   owner session 2026-08-09)

−4. **Emergency recovery для `editorial_master` — draft PR
[#208](https://github.com/sanchahous/ai-today-brief/pull/208).** Після live failure Actions
`31327537969` виявлено, що job
`a3c2f8a6-e8b8-4609-992c-21f284f4820a` уже має durable EN+UK checkpoint, але quality failure
падав під час спроби записати article artifact у неактивну draft revision. Фікс додає owner-only
**Resume saved master**: він створює linked job, повторно перевіряє source/current revision і
пропускає EN/UK writer calls; також quality path зберігає draft та його IDs без забороненого
artifact write. Правило про uniform critic verdict навмисно не послаблюється.
(source: production Supabase + Actions live check 2026-08-09,
`src/lib/weekly-digest/generation-worker.ts`, `src/app/admin/(cms)/weekly/actions.ts`)

−3. **Прогін `31324873875` (16:51 UTC) — перший уже з фіксами: дійшов значно далі, впав на
   новому місці.** Підтвердив три попередні фікси наживо: preflight 9/9 за 6 секунд (токен у
   Secrets **живий** — питання нижче закрите), `--tools ""` дав 1 turn, EN+UK через claude-cli
   зайняли 12 хв 18 с (стара 4-хвилинна стеля вбила б це знову), critic мовчав 315 секунд і
   **завершився** (за старим кодом — убитий на 90-й), провал зробив прогін червоним. Впало на
   revise-кроці: CLI повернув `**Applying…` перед JSON, а UK і revise взагалі не мали драбини
   провайдерів. Обидві причини виправлені у follow-up `fix/weekly-master-revise-parse-fallback`.
   Деталі — [pipeline/weekly-master-failures](pipeline/weekly-master-failures.md).

−2. **PR [#206](https://github.com/sanchahous/ai-today-brief/pull/206) змержено 2026-08-09 (`fix/weekly-master-numeric-parity`).** За рішенням
   власника воркер переведено на ланцюжок `claude-cli,openrouter` — падіння CLI більше не
   вбиває джобу, а видимість забезпечують preflight-крок і червоний прогін на провалі. Плюс
   новий блокер `numeric_parity`: sandbox показав, що EN «600x» став українською «на 600%»
   (два порядки різниці), критик пропустив це з `parity` 88/100. Наступний живий прогін
   підтвердив, що `CLAUDE_CODE_OAUTH_TOKEN` у GitHub Secrets працює.

−1. **`editorial_master` падав тричі поспіль 09.08 — знайдено п'ять окремих причин, усі
   інфраструктурні, жодної редакційної.** Гілка `fix/weekly-master-provider-timeouts`, PR
   ще не створено. Коротко: 4-хвилинна стеля `claude-cli` вбивала здоровий EN-write на
   240-й секунді (SIGTERM/143 при `duration_api_ms` 178с і 233с); CLI ганяв агентні
   tool-use цикли там, де треба один текст; stall-детектор OpenRouter рахував лише
   `delta.content`, тому reasoning-моделі помирали як «мовчазні» (≈20 хвилин ротації по
   12 моделях у прогоні 07:27); провалена джоба лишала Actions-прогін **зеленим**; а
   master-write мав рівно одного кандидата-модель без фолбеку. Повний розбір —
   [pipeline/weekly-master-failures](pipeline/weekly-master-failures.md).
   **Разом із фіксами додано sandbox** — [ops/weekly-sandbox](ops/weekly-sandbox.md):
   `npm run weekly:doctor` (префлайт провайдерів за хвилину) і `npm run weekly:sandbox`
   (capture реального входу з прода read-only → повний прогін `generateWeeklyMaster` без
   хендла БД → безкоштовний повтор детерміністичних гейтів). П'яту причину знайшов саме
   sandbox: за 138 секунд і за центи, замість 40-хвилинного Actions-прогону.

0. **Weekly Digest durable worker control plane — DB migration застосовано; application deploy ще очікує merge PR.** Attempt/event ledger, fenced lease + heartbeat/reaper, linked retry та per-call cost attribution вже працюють у production Supabase. Старий `editorial_master` для digest `843975a8-8c19-4eca-96a8-035f76eae3ab` закрито як `legacy_worker_timeout` зі збереженими 5 спробами; створено пов’язаний GitHub job `fe82f82c-7ceb-458e-9889-b5890b0e6d11` у `queued` з `Attempt 1/3`. Він стартує після merge/deploy цього PR, який додає dispatch і worker. (source: production Supabase verification 2026-08-09; `supabase/migrations/20260809060929_weekly_generation_control_plane.sql`, `src/lib/weekly-digest/generation-worker.ts`)

1. ~~Редакційний перегляд якості weekly-дайджесту (7 PR)~~ — **усі 7 PR у `main` з 2026-08-07**
   (PR #189). Деталі — [editorial-voice](pipeline/editorial-voice.md). **Жодного живого прогону
   повного пайплайну через реальний job-worker після мержу ще не було** (останній прогін у
   БД — 2026-08-05, до мержу) — завтрашній (08.08) новий weekly буде першим.
2. **Готовність до weekly 08.08 — перевірено 2026-08-07, знайдено й виправлено 3 речі:**
   - PDF-генерація стабільно валилась (5/5 спроб, 2 останні реальні edition, 20-21 стор. проти
     контракту 10-16) — `buildStory()` рендерив повний розворот для кожної історії незалежно від
     рангу. Фікс — гілка `fix/weekly-pdf-page-cap`: повний розворот лише для `rank<=3`, решта —
     компактна radar-секція. 13 сторінок на реалістичній фікстурі. Деталі —
     [weekly-digest § PDF page-count contract violation](pipeline/weekly-digest.md#pdf-page-count-contract-violation--фікс-2026-08-07).
   - Дві міграції PR4/PR6 (`weekly_digest_story_directions`, `weekly_video_script_job`) не були
     застосовані до прод-БД — **застосовано 2026-08-07** (Supabase MCP). Без цього кнопка
     «Generate script» на Video-табі падала б з помилкою CHECK-констрейнту, а фіча
     «Кут подачі» мовчки не працювала.
   - Два старі випуски досі `in_review`, не опубліковані: `ai-weekly-2026-07-26`,
     `ai-weekly-2026-07-27` — уточнити з власником, чи «новий weekly» означає третій паралельний.
3. **Редакція `ai-weekly-2026-07-27`.** Packs v3 уже ready — **Approve 3/3** на Research
   (succeeded ≠ approved), далі `editorial_master` → Master quality. Гайд:
   [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md).
4. **Weekly Content Studio v2 — розкатка.** `.env.example` документує дефолт `off`, але жива
   активність у прод-БД (джоби `succeeded` ще 05.08) доводить, що в реальному Vercel-середовищі
   прапорець вже `shadow`/`production` — не звірено напряму (Vercel MCP цієї сесії підключений до
   іншого проєкту, `portfolio`/sashakuzmenko.com, не ai-today-brief) — власнику варто глянути
   дашборд самому.
   (source: `.env.example`)
4. **Опційно:** окремий `pdfkit` 0.19 після `npm run weekly:pdf:sample` / PDF smoke.
5. **Мобільна адаптивність `/admin` — гілка `claude/admin-mobile-responsive-pfb65o`
   (2026-08-08), PR не змержено.** Власник надіслав скріншот: контент в адмінці на
   телефоні горизонтально обрізається. Знайдено й виправлено: `AdminNav` мав
   `grid-cols-7` на 8 пунктів (Settings-сирота на непорахованому другому рядку);
   `PreflightBlockerList` рендерив сирі UUID у вкладених `grid` без `min-w-0` —
   потенційний grid-blowout, невидимий через `overflow-x:clip` на `html`/`body`;
   таб-бар секцій workspace отримав `ScrollFade`-підказку скролу. Перевірено
   ізольовано (прод-білд + Playwright, 375px) — деталі й що НЕ вдалось перевірити
   (реальний Supabase-логін, Safari/WebKit) — [log](log.md#2026-08-08--admin-mobile-responsive-fix).
6. **Grid overflow у Weekly admin — готово до PR.** На Article tab intrinsic minimum width
   двох формових колонок розтягувала 1193 px wrapper до 1258 px, отже права колонка виходила за
   viewport; `p-5` не був причиною, а робив дефект помітним. `globals.css` тепер задає
   `min-width: 0` для прямої дитини кожної Tailwind `.grid`, а голі гнучкі `1fr`-треки замінено
   на `minmax(0, …)` у Weekly admin та інших уразливих layout-компонентах. На 390 px усі дев’ять
   вкладок workspace не мають document overflow; горизонтальний swipe лишається тільки в
   навмисному tab-bar `ScrollFade`.
   (source: `src/app/globals.css`, `src/components/admin/weekly-workspace.tsx`, owner screenshot
   + Chrome layout measurement 2026-08-09)
7. **Згортання desktop sidebar — готово до PR.** Кнопка у лівій навігації перемикає повне
   240 px меню у 64 px rail, тому робоча область отримує додаткову ширину без втрати способу
   повернути навігацію. Mobile bottom nav не змінюється.
   (source: `src/components/admin/admin-nav.tsx`)

## Чекає на власника (не код)

| # | Дія | Чому блокер |
|---|---|---|
| 1 | **5–10 якісних дофолов за місяць** + Request indexing для 10 топ-сторінок у GSC | єдиний реальний важіль проти 232 неіндексованих сторінок (source: `wiki/audits/2026-07-01-seo-organic.md` §4) |
| 2 | **Активувати IndexNow**: ключ → `INDEXNOW_KEY` у Vercel + pipeline → Bing WMT → `npm run indexnow:backfill` | Bing → ChatGPT/Copilot AEO (там само §3) |
| 3 | ✅ **Історичний пункт:** вибрати GA4-property (540467725 vs 540206735); вирішено на користь 540206735 2026-09-30 | актуальний Admin-чекліст — [ga4-gsc](analytics/ga4-gsc.md) (source: повідомлення власника 2026-09-30; HYPD live check) |
| 4 | **Фікс воронки розсилки** (41 показів → 8 стартів → 1 підписка) | утримання ≈ 0 (там само §5) |
| 5 | Апрув PDF + social variants на `ai-weekly-2026-07-27`; вирішити video override vs повний video pipeline | блокує trial release (source: preflight live check 2026-08-04) |
| 6 | Перевести `WEEKLY_CONTENT_STUDIO_V2` у `shadow` на 3 історичних випусках і зняти витрати з `/admin/costs` | критерій `production` ще відкритий ([open-questions](open-questions.md) #4) |

## Найближчі 3 дії в коді

1. PR1–5 закомічені й запушені на PR [#189](https://github.com/sanchahous/ai-today-brief/pull/189)
   (одна гілка `feat/weekly-editorial-voice`, комітяться туди послідовно).
2. **Обидві live-перевірки виконано 2026-08-06 (з дозволу власника):**
   - **PR3 critic shadow-прогін — PASSED.** Новий критик проти `ai-weekly-2026-07-27` дав
     73/100 (voice 68, naturalness 70) замість старих 93/100, і сам процитував рівно ті
     фрази, на які скаржився власник. Живий прогін заодно знайшов і виправив реальний баг:
     критик вигадував власні коди issues, які не співпадали з revise-логікою — тепер
     закритий словник із 6 кодів.
   - **PR5 klein dry-run — виконано, 9 зображень надіслано власнику.** Технічно
     фотореалістичний репортажний стиль тримається добре; помічена (не власником — мною)
     потенційна проблема: композиції по трьох історіях занадто схожі одна на одну.
     Остаточна оцінка стилю — за власником.
3. **PR6 (відеосценарій, manifest v3) закомічено 2026-08-06** — `video` виключено з
   майстер-виклику повністю; новий standalone job `video_script` (окремий LLM-виклик,
   TV-news драматургія, WPS-валідатор `validateVideoScript` б'є корінь «німого слайдшоу»);
   manifest `weekly-video-v3` з per-scene `revisionItemId` (кінець `index % assets.length`);
   міграція `20260806150000_weekly_video_script_job.sql` написана, **не застосована до прод-БД**.
   Typecheck/lint/vitest зелені (152 тести); **live-верифікацію (реальний `video_script` на
   approved-статті) ще не запущено** — на відміну від PR3/PR5, тут не було окремого дозволу
   власника на живий прогін у межах цієї сесії.
4. **PR7 (соц-голос, hook picker, чистка) закомічено 2026-08-06 — усі сім PR плану готові.**
   `socialAngles` видалено з майстра повністю; `social-adapter.ts` сам пропонує кут для кожного
   каналу; `VOICE_EN`/`VOICE_UK` + banned-openers у ранжуванні кандидатів; новий critic-вимір
   `originality` (поріг 70/100); hook-кандидати на Social tab тепер клікабельні
   (`HookCandidatePicker`). Видалено мертвий `editorial-draft.ts`; `GENERIC_PRACTICAL_PATTERNS`
   свідомо НЕ видалено (план помилявся — це активний, протестований гейт). Нове покриття:
   `social-adapter.test.ts` (5 тестів, раніше — нуль). Typecheck/lint/build/vitest зелені
   (872 тести). **Не верифіковано наживо** (як і PR6) — новий originality-вимір критика жодного
   разу не бачив реальну відповідь моделі; перед `shadow`-прогоном варто прочитати кілька
   реальних weekly social-адаптацій вручну.
5. **Наступний крок — власник:** усі 7 PR готові на гілці, PR #189 не змержено. Рішення, що
   лишається за власником: (а) code review гілки, (б) `shadow`-прогін усього пайплайну на
   історичному випуску перед мержем, (в) остаточна оцінка klein-стилю з PR5's dry-run.

## Related pages

- [overview](overview.md) — бізнес-контекст і жорсткі обмеження
- [pipeline/editorial-voice](pipeline/editorial-voice.md) — редакційний голос, чому старий контент бракований
- [pipeline/weekly-master-engine](pipeline/weekly-master-engine.md) — ітеративний рушій `editorial_master`
- [pipeline/weekly-digest](pipeline/weekly-digest.md) — Content Studio v2 + revision stability
- [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md) — як вести випуск у адмінці
- [ops/owner-checklist](ops/owner-checklist.md) — env / Dependabot secrets
- [index](index.md) — карта бази знань
- [open-questions](open-questions.md) — невирішені питання
- [log](log.md) — журнал операцій
