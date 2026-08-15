# Now — поточний операційний стан

Summary: над чим іде робота **прямо зараз**, що чекає на власника, що щойно відвантажено.
Живий файл — оновлювати при кожній зміні стану, не рідше раз на тиждень.
Sources: `git log` / `gh pr list`, owner sessions 2026-08-06…15, Content Sim plan 2026-08-11,
experimental Visual Affordance V10 owner review 2026-08-13, weekly illustration B1-fix 2026-08-15
Last updated: 2026-08-15

---

## Стан репозиторію

- **B3 — N/3 промпти готові на Visuals (2026-08-15).** Біля кожної story: `2/3 промпти готові · немає consequence` (або `фолбек: mechanism`). Дані з `story_prompt_set` (лінзи + `sceneSource` журі) або з metadata `story_image` у режимі `render`. Cover не чіпали. Вага гейта без змін. `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) B3,
  `src/lib/weekly-digest/story-prompt-set.ts`)
- **M3 — preflight веде до промпту, не до Regenerate (2026-08-15).**
  `story_image` / `cover` `artifact_missing`: Visuals → скопіюй промпт → згенеруй у своєму
  інструменті → завантаж файл. Вага гейта не змінена — зображення лишається обовʼязковим.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) M3,
  `src/lib/weekly-digest/preflight.ts`)
- **M2 — post-upload QA попереджає, не блокує (2026-08-15).** Після upload story/cover
  `after()` ганяє image-only critic (без headline/scene) і пише `metadata.post_upload_qa`.
  Visuals: «QA чисто» або жовтий рядок + Ігнорувати / Замінити файл.
  `contentSimCleared` для ручних файлів лишається `undefined` — `simulation_not_passed` не
  спрацьовує. `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) M2,
  `src/lib/weekly-digest/post-upload-qa.ts`, `src/app/admin/(cms)/weekly/actions.ts`)
- **M1 — weekly story/cover більше не рендерять FLUX (2026-08-15).** Дефолт
  `WEEKLY_STORY_IMAGE_MODE=prompt_only`: `story_image` без `source_url` і `cover` пишуть
  `story_prompt_set` (essence + концепти + `prompt-export`) і завершуються
  `succeeded` + `needs_owner_review`. Гілка `source_url` лишається ingest. `render`
  повертає старий FLUX + vision loop. `story_image` лишається на GitHub Actions.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін. Картинки **новин** далі на авто-FLUX.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) M1,
  `src/lib/weekly-digest/story-prompt-job.ts`, `src/lib/weekly-digest/generation-worker.ts`,
  `.env.example`)
- **P2 — story_prompt_set + Visuals copy/upload (2026-08-15).** Artifact type
  `story_prompt_set` (текст, не публічний). Visuals: картки концептів Canonical /
  Midjourney / Negative + слот upload. Worker пише сет у M1.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) P2,
  `supabase/migrations/20260815120000_weekly_story_prompt_set.sql`,
  `src/components/admin/story-prompt-set-panel.tsx`)
- **P1 — промпт як продукт (2026-08-15).** `pipeline/prompt-export.ts` видає канонічний
  промпт (субʼєкт першим) + Midjourney + negative без номерів версій моделей. P2 підключив
  це до Visuals.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) P1,
  `pipeline/prompt-export.ts`)
- **B2 — не три копії одного essence (2026-08-15).** Журі більше не добиває кількість
  фолбеками: 1–2 прийняті лінзи → 1–2 брифи; повний провал → один `fallback_essence`.
  `sibling_motif_family_reuse` ловить шафи/каруселі в одній майстерні як одну родину.
  Наступне за планом — P1 (промпт як продукт).
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) B2,
  `pipeline/card-image.ts`)
- **B1-fix craft-ban literal exception (2026-08-15).** `validateMetaphorPitch` більше не
  відхиляє pitch за словом зі списку craft-cliché, якщо це слово вже є в новині
  (`storyContext` / `mechanism` / entities). Голий `terminal` дозволений і коли джерело каже
  `command line` / `CLI` — інакше story про командний рядок неможливо було описати, усі три
  лінзи падали в fallback. `terminal window` і `glowing brain` лишаються забороненими навіть
  на CLI-новині. Наступне за планом — B2 (не добивати кількість трьома однаковими фолбеками).
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) B1-fix,
  `pipeline/card-image.ts`, `experiments/jury-blockers/2026-08-digest-843975a8.md`)

- **Переоцінка виправленим харнесом — перевага V10 не підтвердилась (2026-08-13).** Ті самі
  пікселі, той самий суддя `google/gemini-2.5-flash`, змінені лише правила оцінювання:
  **V10 hard integrity 3/3 → 0/3**, blind preference **3-0 → 1-1 з нічиєю**, розрив зважених
  балів 33.1 → **0.5** пункта (шум того самого судді на незмінних пікселях раніше вимірювався
  у 15.5). V8 headline-grounded зріс 0/3 → 2/3, щойно його перестали оцінювати за специфікацією
  конкурента — baseline був strawman. Блокери V10: `generated_text` на обох детермінованих
  сценах (впечені лістинги і підписи, заборонені політикою `weekly-semantic-story-v5.1`),
  `labels_carry_claim` на Claude-thresholds, пʼять блокерів на Deep Work. Обидві гілки провалюють
  hard integrity за однаковими правилами. **Висновок: заявлена перевага була артефактом
  вимірювання, а не якості картинок.** Питання «чи краще за продакшн» лишається відкритим для
  **цих** прогонів: у targeted-серії V10 порівнювали v10 проти v8, а продакшн-гілку прибрали.
  У ранніших прогонах v6/v7 продакшн **брав** участь як гілка `current` — див. коригування в
  [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md).
  (source: Actions run
  `31739283280`, `experiments/visual-affordance-v10/targeted-v7-corrected-harness/`,
  [open-questions](open-questions.md) §8)

- **PR #229 W0 cleanup виконано (2026-08-13):** гілка `chore/visual-v11-hygiene` готує #229 до
  мержу в `main`. Видалено 83 МБ бінарників з git, 35 one-shot скриптів, 3 осиротілі модулі і
  66 з 67 workflow (лишився один `workflow_dispatch`-харнес `visual-experiment.yml` без
  `contents: write` і без `git push`). Знято три маніпуляції в evaluator: waiver `generated_text`
  для гілки-кандидата, підписані назвами гілок спостереження в промпті судді і рубрику,
  зібрану зі специфікації кандидата; три перевірки (`beam_purpose`, обидва invariant) повернуто
  з story-aware у blind-стадію. `experiments/` описано як зону в `CLAUDE.md`, її пікселі —
  у `.gitignore`. **Наслідок: усі числа V6 невалідні до платної переоцінки** — див.
  [open-questions](open-questions.md) §8. Далі W1 (стабільність) від `main`.
  (source: `scripts/visual-affordance-v10-targeted-evaluate.ts`, `.github/workflows/visual-experiment.yml`,
  [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md))

- **PR #229 review (2026-08-13):** детальний технічний + функціональний review зафіксовано в
  [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md)
  (PR [#230](https://github.com/sanchahous/ai-today-brief/pull/230), змержено в гілку
  експерименту). Вердикт: **не мерджити як є**. V10 покриває 3
  захардкожені treatment, unmatched → `null`/throw; 3/3 V6 eval не є доказом (n=3, rubric leak,
  `generated_text` waiver). Executor spec для Sonnet 5: хвилі W0–W5. (source: PR #229,
  `wf_40755980-8f7` findings dump)

- **Visual Affordance V10 owner local repairs (2026-08-13):** isolated experimental candidate
  оновив три візуальні пояснення за конкретним owner feedback: Gemini показує два різні code
  artifacts; Claude — послідовність `cache → split → BOUNDED 1/2/3` та monitor на кожній сесії;
  Deep Work — промінь до картки-підказки й завершену людську дію на маршруті. Targeted V6 звітував
  3/3 hard-integrity, 3/3 headline-grounded і 3/0 blind preference для V10 — **ці числа спростовано
  переоцінкою 2026-08-13** (0/3 і 1-1, див. запис вище). Це не production
  rollout: `main`, production visuals і Supabase не змінювалися. (source: owner review 2026-08-13,
  `experiments/visual-affordance-v10/targeted-v6-owner-outcome-repair/results/evaluation-report.md`,
  commit `720b1a2`)

- **Weekly illustration cost/quality loop hardening (2026-08-11):** owner-аудит Story 2/3/5/6
  підтвердив, що 5-round repair loop був дорогим seed roulette, фінальний repair лишав один variant,
  а critic пропускав opaque tubes/switchboards із високими шаблонними scores. Новий контракт —
  максимум 2 раунди по 3 паралельні renders + 3 паралельні vision reviews; batch critiques
  агрегуються й суцільний semantic fail змінює метафору. Додано `opaque_abstraction`, обовʼязковий
  pixel evidence/headline-substitution test, до двох character scenes для human-centered stories,
  provider-call cost ledger і cumulative Story revision spend у Visuals. (source: owner incident
  report 2026-08-11, `pipeline/card-image.ts`, `src/lib/content-sim/`,
  `src/lib/weekly-digest/generation-worker.ts`, `src/components/admin/weekly-workspace.tsx`)

- **Three independent illustration concepts (2026-08-11):** кожна story тепер має не три
  косметичні seed-варіації однієї сцени, а до трьох сценаріїв із різних editorial lenses:
  literal context, mechanism і consequence. Один jury call тримає planning cost обмеженим;
  validator відхиляє повтори subject/motif/setting/action до FLUX spend. Кожен concept має власні
  scene/prompt/vision metadata; Visuals показує назву/лінзу, а owner promotion і ручний regenerate
  зберігають правильний concept contract. (source: owner follow-up 2026-08-11,
  `pipeline/card-image.ts`, `src/lib/content-sim/adapters/weekly-image.ts`,
  `src/app/admin/(cms)/weekly/actions.ts`, `src/components/admin/weekly-workspace.tsx`)

- **v5.1 concept-collapse repair (2026-08-12):** production review Story 2/3/5 показав, що
  різні jury motifs відкидалися через semantic token mismatch, після чого fallback-и виглядали як
  один motif. Critic replacement також копіювався в усі три prompts. Тепер structural gates
  відділені від paid vision semantic review, а rejected critic direction використовується лише як
  jury feedback. (source: worker logs, Supabase artifact metadata 2026-08-12, `pipeline/card-image.ts`,
  `src/lib/content-sim/adapters/weekly-image.ts`, `generation-worker.ts`)

- **Reviewable illustration history (2026-08-12):** усі зображення, реально відрендерені у кожному
  repair round, тепер зберігаються як підписані private previews із concept/score metadata і
  показуються у Visuals до owner approval. Після approval extra storage previews видаляються,
  лишається один selected primary; artifact/review ledger не стирається. (source: owner request
  2026-08-12, `generation-worker.ts`, `admin-data.ts`, `weekly-workspace.tsx`, `weekly/actions.ts`)

- **Async story-image recovery (2026-08-11):** production v4 jobs підтвердили архітектурний
  конфлікт: Vercel poller запускав лише одну image job кожні 5 хв, а послідовні art-director
  calls/retry тричі досягли platform timeout рівно 300 с. `story_image` перенесено у fenced
  GitHub Actions backend; admin dispatch-ить її одразу, safety poll — batch до 10, різні stories
  мають per-job concurrency. Production rollout виявив ще один edge case: deploy не застосував DB
  migration, а ручний Regenerate створив нові jobs поруч зі старими retry/stale rows. Виправлена
  migration атомарно залишає одну winner-job на `revision_item_id`, скасовує старі як superseded,
  переводить winners без обриву живого lease і повертає їм durable attempts. Production migration
  `20260811183201` застосована; safety poll о 21:35 запустив рівно сім незалежних Actions workers
  на актуальні regenerate jobs, старі дублікати не dispatch-ились. (source: Vercel production
  runtime logs, Supabase queue snapshot і GitHub Actions runs `31523472069`…`31523483477`
  2026-08-11,
  `src/lib/weekly-digest/generation-control.ts`, `.github/workflows/weekly-master-cli-worker.yml`,
  `supabase/migrations/20260811183201_weekly_story_image_async_worker.sql`)

- **Manual retry idempotency (2026-08-11):** аварійний composite SQL-виклик manual-retry RPC
  повторно обчислив volatile function для кожної з 32 колонок job і створив 32 children одного
  terminal `story_image`. 31 duplicate child скасовано (22 до dispatch, 9 GitHub runs після
  dispatch), один канонічний retry продовжив роботу. Production migration `20260811185251`
  серіалізує retry по source-row lock, повертає вже live/succeeded child і додає partial unique
  index для активного child; повторний клік/виклик більше не створює паралельні копії. (source:
  owner incident report і production Supabase/GitHub snapshot 2026-08-11,
  `supabase/migrations/20260811185251_weekly_manual_retry_idempotency.sql`)

- **Weekly semantic illustration v4 foundation (2026-08-11):** policy v4 (тепер замінений v5)
  замінив self-referential essence-only перевірку на contract
  `context → meaning → mechanism → consequence → visual thesis`. Worker тепер передає
  practical/limitation/takeaway й approved research замість `[object Object]` claims; gate не
  зараховує невидимий `why_it_fits`; `dual_contrast` більше не інʼєктить backstage у кожну
  story; critic gate-ить чотири semantic dimensions, а repair patch реально потрапляє в наступний
  FLUX request. Visuals показує semantic contract + `semantic · news · craft`. (source:
  `pipeline/card-image.ts`, `src/lib/content-sim/vision-critic.ts`,
  `src/lib/weekly-digest/generation-worker.ts`, owner prompt review 2026-08-11)

- **Vision critic JSON soft-fail (2026-08-11):** prose/empty vision response →
  `critic_parse_error` + repair, не terminal `story_image` fail. Див.
  [content-sim](pipeline/content-sim.md).

- **Weekly illustration fidelity v3 (2026-08-11):** policy `weekly-editorial-concept-v3` —
  `mechanism` + `reader_test` на essence; gate `mechanism_not_visible`; ban motion-blur у
  pitch; vision `off_news` / `melted_motion` + `news_legibility` (overall clamp); Visuals
  показує `news · craft` поруч з overall. Див. [card-images](marketing/card-images.md),
  [content-sim](pipeline/content-sim.md).

- **Weekly illustration overhaul v2 (2026-08-11):** policy `weekly-editorial-concept-v2` —
  прибрано theater/journal bias у metaphor prompt/score; `motif_class` + sibling structural
  gates (reuse / scene echo / character budget / dual_contrast cap); vision physics blockers;
  per-variant QA + auto-pick primary; Visuals показує scores на alternates. Див.
  [card-images](marketing/card-images.md), [content-sim](pipeline/content-sim.md).

- **Content Sim / backtest (2026-08-11):** універсальний harness `src/lib/content-sim` +
  `npm run content-sim` (capture/run/gates/hypothesis). Weekly `story_image` — vision critic
  loop максимум 2 раунди з escalation у admin Visuals; release preflight `simulation_not_passed`. Roles
  `weekly.image_critic` / `daily.image_critic`. Docs — [pipeline/content-sim](pipeline/content-sim.md).
  Опційний CI: `.github/workflows/content-sim.yml` (label `run-content-sim`).

- **PR [#199](https://github.com/sanchahous/ai-today-brief/pull/199) змержено в `main` 2026-08-09**
  (`6f6d875`, власник змержив вручну одразу після зеленого CI) — критичний аудит згенерованого
  weekly master виявив дослівний витік voice exemplar у вступ, вигадані сцени, абстрактні titles,
  непояснені energy claims і системні UK spelling/grammar/localization дефекти, які critic
  пропустив із сімома однаковими 90/100. `weekly-master-v7`: exemplars вилучено з prompt, додано
  deterministic blockers, `language_mechanics`, жорсткішу critic calibration і зрозумілі Article
  labels; writer окремо заборонено форсувати umbrella-тему без доказового звʼязку Top 3. Той самий
  PR звузив три хибнопозитиви (v7.1) — `ambiguous_energy_claim` реагує лише на явне порівняння,
  UK-блоклист більше не чіпає `score`/`мейнтейнер`, uniform-critic-score гейт має escape valve
  для тексту ≥95. Деталі — [pipeline/editorial-voice § Аудит 2026-08-09](pipeline/editorial-voice.md#аудит-згенерованого-випуску-2026-08-09),
  [log](log.md).
- **PR [#200](https://github.com/sanchahous/ai-today-brief/pull/200) змержено в `main` 2026-08-09**
  (`d63b583`) — додав кнопку «Regenerate master» (`WeeklyGenerationJobsLive`, Research/Article-таби)
  для вже `succeeded` `editorial_master` job, бо raw retry RPC приймає лише `failed`/`cancelled`,
  а «Start / retry Content Studio» б'ється об незмінний ідемпотентний ключ. **Живо на
  `843975a8-8c19-4eca-96a8-035f76eae3ab` кнопка не зʼявилась** — знайдено реальний баг: умова
  рендеру звіряла `job.revision_id === активна ревізія`, а успішний `editorial_master`
  (`createMasterRevision` у `generation-worker.ts`) завжди мінтить і активує НОВУ ревізію, тобто
  `job.revision_id` після успіху назавжди лишається прив'язаним до вже витісненої ревізії —
  умова була недосяжною для будь-якого реально успішного job. Фікс — гілка
  `fix/weekly-master-regenerate-condition`: кнопка тепер орієнтується на «останній
  `editorial_master` job цього дайджесту» (за `created_at`), а не на збіг `revision_id`; нова
  job все одно заводиться проти поточної активної ревізії (`revision_id={revisionId}` у формі).
  `843975a8-8c19-4eca-96a8-035f76eae3ab` (`ai-weekly-2026-08-02`) досі `in_review` з
  `editorial_master`, згенерованим ДО v7-гейтів (job `fe82f82c…`, успішний прогін 09.08 07:27) —
  після мержу цього фіксу варто натиснути кнопку, щоб отримати текст, перевірений новими гейтами,
  перш ніж апрувити випуск.
- **`main` тепер включає PR #189, #190, #191 і #192** (Phase 0-6a злито `9d32347`). Senior-рівневе
  технічне ревʼю обох PR постфактум (гілка `claude/tech-review-pr-189-190-859ena`) знайшло і
  виправило три поведінкові баги в `pipeline/providers/registry.ts` (порожній DB-чейн затіняв
  робочий дефолт; збій каталогу OpenRouter валив побудову всього реєстру; DB-override провайдер у
  weekly/social не мав фолбеку) плюс UX/безпекові дірки в `/admin/providers` (сирі throw замість
  редиректу з повідомленням, відсутні `loading.tsx`/`error.tsx`, сирітський Vault-секрет при
  видаленні провайдера, non-atomic заміна списку моделей) — повний перелік і обґрунтування у
  [pipeline/llm-providers § Пост-мерж ревʼю](pipeline/llm-providers.md#статус). Нова міграція
  `20260807120000_llm_provider_registry_fixes.sql` (author-only, не застосована до прод-БД).
  927/927 тестів, `tsc`/`eslint`/`wiki:check`/build зелені.
- **PR [#192](https://github.com/sanchahous/ai-today-brief/pull/192) змержено в `main` 2026-08-07**
  (`290eaf5`; гілка `feat/llm-registry-phase-6b`, автоматично видалена після мержу) —
  **Фаза 6b виконана: daily `auto-publish.ts` (суддя) мігровано на реєстр, daily-смуга
  закрита повністю. Реєстровою є вся LLM-маршрутизація проєкту (daily+weekly+social), Фази 0-6b
  готові.** Judge-виклик іде роллю `daily.auto_publish_judge` з `db`; `pipeline/llm-json.ts`
  став registry-only (мертву `primaryProvider`-гілку видалено, сигнатуру перероблено на об'єкт
  опцій, `verify.ts`/`run-daily.ts` спрощено відповідно). Новий `createRegistryLoader` резолвить
  реєстр один раз на весь 7-денний sweep (без нього кожна чернетка окремо била живий каталог
  OpenRouter — та сама проблема, що фіксили у Фазі 2). Заодно полагоджено тиху регресію Фази 6a:
  `geminiMaxAttempts` губився при переході на реєстр. Fail-closed поведінка судді не змінилась.
  930/930 тестів, `tsc`/`eslint` чисті. **Умову плану «6b лише після ≥1 доби роботи 6a» не
  витримано** — 6a у `main` менш ніж добу. **Живий `auto-publish --dry-run` виконано 2026-08-07**
  (не запис у БД/Telegram, суддя викликається по-справжньому): дефолтне 7-денне вікно зараз
  порожнє (`window_drafts: 0`) — прод має 9 старих `draft`-брифів, усі свідомо поза вікном;
  `--window-days 90` підняв їх у вікно й отримав 3 реальні успішні виклики через
  `daily.auto_publish_judge` → реєстр → OpenRouter (`deepseek/deepseek-v4-pro`), БД без змін.
  Деталі й що лишається — [pipeline/llm-providers](pipeline/llm-providers.md#що-лишається).
  **Обидві реєстрові міграції застосовано до прод-БД 2026-08-07** (Supabase MCP, проєкт
  `mdiqfatpqczwqghwttpm`) — `llm_providers`/`llm_provider_models`/`llm_role_chains` тепер існують
  у проді (порожні, RLS увімкнено), `/admin/providers` реально впливає на реєстр. `get_advisors`
  знайшов 2 дрібні WARN на нових функціях (mutable `search_path` на
  `replace_llm_provider_models`; `store_/read_/delete_llm_provider_secret` технічно
  RPC-викличні для anon/authenticated, функціонально безпечно через внутрішню
  `service_role`-перевірку) — не пофіксено, деталі й обґрунтування у
  [pipeline/llm-providers § Що лишається](pipeline/llm-providers.md#що-лишається).
- **Гілка `feat/llm-registry-phase-7`** (відгалужена 2026-08-07 від `main`) — **Фаза 7 (Codex
  CLI) виконана.** Новий `pipeline/providers/cli/codex.ts` — перший реальний другий споживач
  `cli-provider.ts`'s Фаза-1-скелету (доти — нуль споживачів). Автентифікація `CODEX_API_KEY`,
  `codex exec --json --skip-git-repo-check --sandbox read-only`, NDJSON-парсер бере `text` з
  останньої `agent_message`-події. Зареєстровано в `registry.ts`'s `KNOWN_CLI_PROVIDERS['codex-cli']`
  — робить DB-ланцюжок з `codex-cli` резолвним через `/admin/providers`, **нічого не вмикає за
  замовчуванням** (не входить у жоден `defaultChain`). ⚠️ **Не верифіковано живим прогоном** —
  немає `CODEX_API_KEY`/бінарника в сесії; флаги й env var узяті з офіційної документації
  OpenAI (звірено між кількома сторінками), не з реального запуску. 940/940 тестів (+10),
  `tsc`/`eslint`/`npm run build` чисті. Деталі —
  [pipeline/llm-providers § Фаза 7](pipeline/llm-providers.md#статус). **З плану лишається:**
  тільки спостереження живого прод-циклу 6a/6b (не dry-run) з часом — усе інше зроблено.
- **Гілка `feat/llm-provider-registry`** (PR [#190](https://github.com/sanchahous/ai-today-brief/pull/190),
  **змержено в `main` 2026-08-07**, `9d32347`; відгалужена 2026-08-06 від tip
  `feat/weekly-editorial-voice`) — уніфікований реєстр
  LLM-провайдерів для всього проєкту (daily+weekly+social), план у
  [pipeline/llm-providers](pipeline/llm-providers.md). **Фаза 0 (прибрати Gemini), Фаза 1
  (ядро реєстру), Фаза 1b (БД + admin `/admin/providers`), Фаза 2 (card-image.ts), Фаза 3
  (custom-research.ts), Фаза 4 (editorial-llm.ts, частково), Фаза 5 (llm-router.ts, частково) і
  Фаза 6a (verify.ts + summarize.ts, частково) виконані.** Фаза 6a — реальна поведінкова зміна:
  `verify.ts` тепер іде через реєстр із його дефолтним порядком (OpenRouter першим, не
  Gemini-first як стара `primaryProvider`-заглушка обіцяла прибрати ще з Фази 0);
  `summarize.ts` лишився на `primaryProvider` (gemini-first) через реальне архітектурне
  обмеження — прямий імпорт з `registry.ts` створив би циклічну залежність
  (`summarize.ts`↔`gemini-provider.ts`), тож БД-override для `daily.summarize` резолвиться
  викликачем (`run-daily.ts`/`custom-news.ts`), а не самим файлом. **Живо верифіковано
  2026-08-07:** повний `run-daily.ts --dry-run` пройшов end-to-end — реальний Gemini
  retry-ланцюжок, реальний OpenRouter-виклик через новий реєстровий шлях (deepseek-v4-pro,
  ~36с), валідний 3-айтемний бриф. Сильніша верифікація, ніж Фази 4/5 (там дефолтний шлях лише
  успадковував Фазу 1; тут Фаза 6a's власний дефолтний шлях протестовано наживо). 927 тестів,
  `tsc`/`eslint`/build зелені. Власник дав добро йти по всіх фазах послідовно з комітом на
  кожну. `feat/weekly-editorial-voice` (PR #189) змержено в `main` 2026-08-07
  (squash) — PR #190 автоматично перенацілено на `main`; злиття `main` в цю гілку і резолюція
  конфліктів (card-image.ts, editorial-llm.ts + тести, кілька wiki-сторінок) зроблені в цьому ж
  коміті.
- **PR [#189](https://github.com/sanchahous/ai-today-brief/pull/189) змержено в `main` 2026-08-07** (squash-мерж,
  `e5d8df5`): повний перегляд редакційної якості weekly-дайджесту (власник забракував увесь
  контент як «машинний» — див. [editorial-voice](pipeline/editorial-voice.md)). **Усі 7
  запланованих PR** (voice-модуль, нова анатомія історії + рендер, критик-рубрика + revise-loop,
  owner-set angle, репортажні ілюстрації + вибір варіантів, відеосценарій як окремий job +
  manifest v3, соц-голос + self-generated angle + hook picker — деталі в
  [pipeline/weekly-digest § Editorial voice overhaul](pipeline/weekly-digest.md#editorial-voice-overhaul-2026-08-06)).
  Гілка `feat/weekly-editorial-voice` автоматично видалена після мержу. Ще не запущено
  shadow-прогін на весь пайплайн.
- `main` tip до PR #189 (звідки відгалужено PR1): draft-revision constraint + video-guidance
  routing fixes (#188, включає #186/#187). Гайд редакції — [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md).
  (source: `git log` / live work 2026-08-06)

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
| 3 | **Звірити GA4-property** (540467725 vs документована 540206735) | інакше конверсії недостовірні (там само §6) |
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
