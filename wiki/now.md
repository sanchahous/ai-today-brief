# Now — поточний операційний стан

Summary: над чим іде робота **прямо зараз**, що чекає на власника, що щойно відвантажено.
Живий файл — оновлювати при кожній зміні стану, не рідше раз на тиждень.
Sources: `git log` / `gh pr list`, owner sessions 2026-08-06…18, Content Sim plan,
weekly illustration B1-fix, Social package recovery 2026-08-17, Social tab implementation 2026-08-18,
video_script undefined.map 2026-08-18, missing video_manifest companion 2026-08-18,
video script Save dropped v3 plan 2026-08-18, Video4 Remotion render 2026-08-18,
Video shooting package in admin 2026-08-19,
Schedule release arbitrary date/time 2026-08-20,
queue bulk cancel 2026-08-21
Last updated: 2026-08-21

---

## Стан репозиторію

- **GA4 coverage + SEO hardening на гілці `feat/ga4-coverage-and-seo-hardening`, PR готується (2026-08-21).**
  Аналітика: закриті прогалини подій (домашня, хаби, брифи, дайджести, воронка підписки,
  dwell) — каталог у [analytics/event-taxonomy](analytics/event-taxonomy.md). SEO: 11 фіксів
  on-site аудиту (og:image, свіжість хабів, дедуп схеми, RSS UK, manifest, canonical
  пагінації, автолінки концептів, security headers) —
  [seo/on-site-audit-2026-08-21](seo/on-site-audit-2026-08-21.md). Після мержу: звірити
  GA4-property (пункт 3 «Чекає на власника») і подивитись перші дані нових подій.
  (source: код-ревʼю 2026-08-21, гілка `feat/ga4-coverage-and-seo-hardening`)

- **Соц-копія тепер зобовʼязана давати дію; Telegram рендерить розмітку; LinkedIn-лінк
  переїхав у 1-й коментар (2026-08-21).** Розбір релізу `ai-weekly-2026-08-09` проти прод-БД
  показав, що «сухість» постів — не стиль, а відсутній блок: `practical_*` заповнене в усіх
  7 історій і вже передавалось письменнику, але промпт його не просив. `CHANNEL_CONTRACT`
  тепер вимагає верстки й практики (діє і на письменника, і на критика); Telegram шлеться з
  `parse_mode: HTML` через whitelist-конвертер; ті самі маркери заборонені в решті каналів
  (`raw_markup`); `linkedin.rootUrlStrategy` → `'none'` + автопостинг `firstComment`;
  `/r/s/[token]` віддає ботам 200 HTML з OG замість 302 `no-store` і більше не рахує
  скрапери як кліки (було 34 з 42). На сайті: новий блок «Що взяти в роботу цього тижня»
  під героєм і **відео перенесено з кінця статті на початок**.
  **Не перевірено наживо:** скрапер Facebook (Sharing Debugger після деплою) і рендер
  розмітки в Telegram (поточна копія її не містить — перший чесний тест на випуску 23.08).
  Прод-рядок LinkedIn пакета `612df95c` виправлено вручну під нову політику; гард відкликав
  апрув і повернув його в `in_review` — потребує повторного Approve власником.
  (source: [marketing/omni-channel-publishing-matrix](marketing/omni-channel-publishing-matrix.md),
  прод-`social_posts` / `social_click_events` live check 2026-08-21)

- **Cancel future posts зі списку Today, з multi-select (2026-08-21).**
  На `/admin` черга за замовчуванням показує **Daily**. Weekly (і інші kind)
  ховаються, доки не обереш фільтр; **Select all** діє лише на видимі картки.
  Confirm називає kind і окремо попереджає, якщо в виділенні є weekly digest.
  (source: `src/components/admin/package-queue-list.tsx`,
  `src/lib/social/package-queue.ts`, [social-cms-runbook](ops/social-cms-runbook.md))

- **Schedule release приймає будь-яку дату/час, не лише понеділок 16:00 (2026-08-20).**
  Власник закінчив ревʼю поза стандартним вікном 15:45/16:00 Kyiv і не міг натиснути
  Schedule release взагалі — `schedule_weekly_digest` кидав виняток на будь-яке інше
  значення. Реліз-воркер уже був day-agnostic, тож досить було прибрати
  isodow/hour/minute-перевірку з RPC; `preflight_at` лишається `release_at − 15 хв`, реліз
  досі мусить бути в майбутньому, digest — `approved` із чистим preflight. PR
  [#305](https://github.com/sanchahous/ai-today-brief/pull/305), ще не змерджено — обидва
  фікси нижче вже застосовані напряму на production Supabase (owner request), незалежно від
  мержу.
  (source: `supabase/migrations/20260820121000_weekly_digest_arbitrary_release_time.sql`,
  [weekly-digest](pipeline/weekly-digest.md), [weekly-admin-runbook](ops/weekly-admin-runbook.md))

- **Approve був структурно недосяжний з 2026-07-23: threads en/uk розсинхрон (2026-08-20).**
  Окремий, серйозніший баг — навіть після Monday-фіксу вище Approve падав на
  нездоланному `social_variant_missing` для `threads`. SQL-копія матриці каналів у
  `weekly_digest_preflight` досі вимагала `threads`+`en`, а `WEEKLY_SOCIAL_MATRIX` (реальне
  джерело для генератора) ще у вихідному PR #162 змінили на `threads`+`uk` — SQL-копію забули
  синхронізувати. Перевірено: **усі** threads-пости в проді мають `locale='uk'`, тобто жоден
  випуск з 2026-07-23 не міг пройти Approve без ручного `weekly_digest_preflight_override`
  на неоверрайдний код. Виправлено й застосовано на проді; `ai-weekly-2026-08-09` тепер
  `scheduled` на 20.08.2026 13:30 Kyiv.
  (source: `supabase/migrations/20260820123400_weekly_digest_preflight_threads_locale_fix.sql`,
  [weekly-digest](pipeline/weekly-digest.md))

- **Video shooting package is the Video tab (2026-08-19).**
  Сценарій, тексти губ, i2v-промти і назва сервісу (Hailuo / HeyGen) показуються в
  `/admin/weekly/[id]?tab=video`. `ai-today-brief-video` тільки зводить кліпи з
  `public/broll/` і `public/avatar/`. Не вести другий пакет у wiki рендерера.
  (source: owner session 2026-08-19, `src/lib/weekly-digest/video-shoot-pack.ts`)

- **Video4: L0 не випуск; зйомка в адмінці (2026-08-19).**
  `ai-weekly-2026-08-09` / rev. `3e955086`: `video_script` v2 і
  `video_manifest` v1 (`weekly-video-v3`) **approved**. Локальний
  `atb-weekly-2026-08-09.mp4` — Ken Burns + Edge TTS, **не** для YouTube.
  Далі: вкладка Video → **Shooting package** (Hailuo / HeyGen) → кліпи в
  `ai-today-brief-video` `public/broll|avatar/` → `media:refresh` + Remotion →
  лише тоді YouTube id у `weekly-video-result-v2`. Не Save Video contract
  (крім result JSON), не регенерувати approved script.
  (source: owner sessions 2026-08-19, `src/lib/weekly-digest/video-shoot-pack.ts`)

- **Немає рядка `video_manifest` після approved script (2026-08-18), PR #298.**
  Кнопка **Generate manifest** і companion upsert — у `main`. На цьому
  випуску рядок уже створено вручну й job succeeded; кнопка для наступних.
  (source: PR #298, `weekly-workspace.tsx`)

- **`video_script` hydration на `main` (2026-08-18, #297).** Production job
  `43b9fcf1…` на `ai-weekly-2026-08-09` rev. `3e955086` падав на
  `undefined.map`. Скрипт уже approved; linked retry більше не потрібен.
  Далі — Generate manifest з #298.
  (source: production job `43b9fcf1-e9ba-46b8-80a8-93d775cec8f0`, Actions
  heartbeat 2026-08-18 11:55 UTC, artifact `cfd41b17…`,
  `src/lib/weekly-digest/generation-worker.ts`,
  `src/lib/weekly-digest/video-script-llm.ts`)

- **Social package `612df95c` approved (2026-08-18, #296).** Instagram owner апрувнув у UI;
  повторний Save на `approved` падав: «Social approval/schedule transitions require a workflow RPC».
  Решту каналів увімкнено й апрувнуто; package `approved`. Save metadata тепер іде через
  admin client. Copy/approve CLI: `weekly:social:repair-copy`, `weekly:social:approve`.
  Пости не публікуються, доки digest не `published` (слоти 2026-08-24).
  (source: production live check 2026-08-18, `src/app/admin/(cms)/weekly/actions.ts`,
  `scripts/repair-weekly-social-copy.ts`, `scripts/approve-weekly-social-package.ts`)

- **Social tab media contract на `main` (2026-08-18, #294) + repair follow-up.** `artifactId`
  замість 7-денного signed URL, selector не бере LinkedIn PDF як картинку, Instagram —
  7 JPEG 1080×1350. Legacy 8-slide `content_parts` у `weekly:social:repair` мапляться на
  7-slide spec (takeaway = останній слайд, headline/body під 72/54/120).
  (source: `src/lib/social/asset-ref.ts`, `src/lib/weekly-digest/repair-social-package.ts`,
  `src/lib/social/hook-candidate.ts`, `src/lib/weekly-digest/instagram-carousel-render.ts`,
  `scripts/repair-weekly-social-package.ts`)

- **PDF weekly digest v3 на `main` (2026-08-18, #293).** Фіксована сітка `pdfkit-weekly-v3`,
  6–8 сторінок (типово 7), клікабельний зміст, сирий `body` більше не друкується в PDF.
  (source: `src/lib/weekly-digest/pdf.ts`, PR #293)

- **Social package clean і готовий до owner approval (2026-08-17), гілка
  `codex/clean-social-job-history`.** Final linked recovery
  `df663262-1481-4f31-af0b-35d21e42caa7` / Actions `32065312557` завершився `succeeded`: package
  та всі шість posts мають `in_review`, нуль blockers, versioned generated reviews збігаються з
  current content hashes. Старі failed attempts більше не заповнюють активну Social-вкладку:
  поточний/останній run лишається видимим, а superseded історія згорнута в нейтральний
  diagnostics block. Інші workspace tabs не змінені.
  (source: production DB live check 2026-08-17, Actions run `32065312557`,
  `src/components/admin/weekly-generation-jobs-live.tsx`,
  `src/lib/weekly-digest/generation-job-visibility.ts`)

- **Malformed Social writer response falls through in-provider (2026-08-17), гілка
  `codex/social-candidate-fallback`.** Production run `32061374498` підтвердив здоровий routing:
  OpenAI mini writer 6 s, Terra critic 13 s. Другий repair writer повернув JSON без двох
  `<CANDIDATE>`; check стояв після provider cascade і завершив job. Candidate contract тепер є
  частиною response validator, тому malformed model response переходить на наступну модель.
  (source: production Actions run `32061374498`,
  `src/lib/weekly-digest/social-adapter.ts`)

- **Social router reliability follow-up (2026-08-17), гілка
  `codex/social-router-reliable-fallback`.** Bounded run `32059830080` швидко показав точний
  routing failure: default registry chain помилково виконувався як owner override з
  `deepseek-v4-pro`, потім social DeepSeek не дав first token за 30 s, а Qwen повернув HTTP 429;
  OpenAI mini був поза cap=2. Router тепер визнає лише реально збережений role chain і ставить
  current OpenAI mini writer lane першою, з bounded provider tail. Live probe з production DB і
  prompt 63 147 chars завершився через 1 507 ms (`first_token=921 ms`, no fallback). Повне
  social-provider exhaustion тепер retryable `provider_exhausted`, а не terminal `unknown`.
  (source: production Actions run `32059830080`, `src/lib/social/llm-router.ts`,
  `src/lib/weekly-digest/generation-control.ts`)

- **Social provider ladder bounded end-to-end (2026-08-17), гілка
  `codex/social-bounded-reasoning`.** Другий production recovery
  `1d255a95-d410-479e-9a6b-06d703dbee0d` лишався на Telegram без channel checkpoint понад
  13 хв. 180 s ceiling був per-model, тоді як кожен writer/critic call міг послідовно спробувати
  три моделі, а repair — три rounds. Social call тепер має максимум дві моделі, 60 s/model,
  30 s first token, 20 s idle, low reasoning і короткий role-specific output budget. Editorial
  master не змінений.
  (source: production Actions run `32057477211`, `src/lib/social/llm-router.ts`,
  `.github/workflows/weekly-master-cli-worker.yml`)

- **Social provider budget follow-up (2026-08-17), гілка
  `codex/social-provider-budget`.** Перший live recovery на approval-ready boundary лишався на
  Telegram без checkpoint понад 12 хв: social call успадкував 720 s editorial-master ceiling,
  а adapter міг аудіювати до дев'яти кандидатів. Для `social_copy` ceiling тепер 180 s / first
  token 45 s / idle 30 s; кожен із максимум трьох repair rounds аудіює один найкращий candidate.
  Інші job types не змінені.
  (source: production job `ee0d727e-6e43-48be-b147-d759c25717a7`, Actions run `32054964740`,
  `.github/workflows/weekly-master-cli-worker.yml`, `src/lib/weekly-digest/social-adapter.ts`)

- **Social critic flags поважають score boundary (2026-08-17), гілка
  `codex/social-critic-threshold`.** Production recovery зберіг Telegram і X checkpoints, але
  Threads тричі ремонтувався й завершився лише з `critic_flag`, без `critic_score` або
  `platform_fit`: будь-яке critic-зауваження помилково блокувало навіть dimension score 85+.
  Passing factual/platform flags тепер warnings; blocking і repair лишаються тільки для score
  нижче 85. Terminal quality exhaustion має code `quality_gate` і точні blocker messages.
  (source: production job `dc11b12f-58db-4944-8284-e3d646153e4c`, Actions run `32062624113`,
  `src/lib/weekly-digest/social-adapter.ts`, `src/lib/weekly-digest/generation-control.ts`)

- **Legacy Social posts проходять repair до фінального guard (2026-08-17), гілка
  `codex/social-existing-post-repair`.** Recovery `606d0463…` успішно відновив 2/6, довів усі
  6/6 channels до clean checkpoints, створив 8 Instagram assets, LinkedIn document і package,
  але на 92% guard побачив старі reports у всіх posts. Причина: fallback lookup за
  `package_id + channel` виконувався після update branch, тож existing post знаходився, але не
  ремонтувався. Lookup тепер передує спільному versioned update; додано regression helper tests.
  (source: production job `606d0463-d479-49a3-828a-cf48232b8dff`, Actions run `32063924268`,
  `src/lib/weekly-digest/generation-worker.ts`, `generation-worker.test.ts`)

- **Social approval boundary ремонтує канал до owner review (2026-08-17), гілка
  `codex/social-approval-ready`.** Production package був `in_review`, хоча всі 6 posts мали
  3–12 blocking checks: worker зберігав audit, але безумовно піднімав `draft → in_review`.
  Додатково critic бачив Instagram/Threads без нативних markers і приймав all-zero template як
  аудит. Тепер bounded candidate/repair loop зберігає тільки blocker-free adaptations, checkpoint
  відкидає старі blocked results, writer/critic мають той самий approved fact snapshot, а post
  repair версіонується in place. UI показує clean readiness; legacy details згорнуті в amber.
  Final production recovery `df663262…` / Actions `32065312557` пройшов `succeeded`; package і
  всі шість posts — clean `in_review`, без автоматичного approve.
  (source: `src/lib/weekly-digest/social-adapter.ts`,
  `src/lib/weekly-digest/social-checkpoint.ts`, `src/lib/weekly-digest/generation-worker.ts`,
  `src/components/admin/weekly-workspace.tsx`, production `social_posts` live check 2026-08-17)

- **`social_copy` відновлюється поетапно через linked retry (2026-08-17), гілка
  `codex/social-step-checkpoints`.** Legacy job уже зберігав шість channel adaptations, але
  child читав лише власний `output`, тому ручний retry повторював усі writer/critic calls.
  Versioned state тепер проходить `retry_of_job_id` chain і зберігає окремо channel results,
  кожен Instagram slide, LinkedIn document, draft package та кожен post/generated review.
  Source hash не дає відновити copy на іншу approved revision; expiring signed URLs
  перевидаються без повторного render. Read-only prod query підтвердив legacy output keys і
  наявні durable social/artifact tables; нова міграція не потрібна. Тести: targeted 39/39,
  typecheck і scoped ESLint зелені. Два наступні live retries дійшли до LinkedIn render і
  впали на `8 pages; expected 7`: production standfirst має 1018 символів, а старий тест — 101.
  У цій самій гілці fixed-layout regions тепер мають bounded height/ellipsis, sources показують
  compact host із повним clickable URL, а production-sized regression підтверджує рівно 7
  сторінок. Цільові worker/PDF тести: 25/25.
  (source: `src/lib/weekly-digest/social-checkpoint.ts`,
  `src/lib/weekly-digest/generation-worker.ts`, `src/lib/weekly-digest/generation-control.ts`,
  `src/lib/weekly-digest/linkedin-document.ts`, прод-Supabase `mdiqfatpqczwqghwttpm` live check
  2026-08-17, Actions runs `32043513443` / `32044207908`)

- **Linked social retry не має валити CMS при GitHub 503 (2026-08-17), гілка
  `codex/fix-gh-dispatch-503`.** Після створення durable child `social_copy`
  `f39b2429-63b1-4e08-82f9-fa496fa34840` GitHub Actions повернув 503; server action пробросила
  його як Server Components render error, а mobile CMS показала React #441 / ref `2087663833`.
  Dispatcher тепер тричі повторює 408/429/5xx або transport failure, а за непідтвердженої
  доставки лишає той самий fenced lease для database recovery та повертає UI без crash. Це не
  створює другий linked job.
  (source: Vercel production runtime logs 2026-08-17 15:37 UTC;
  production `weekly_digest_generation_jobs`; `src/lib/weekly-digest/github-dispatch.ts`)

- **Social package падає після успішних шести каналів (2026-08-17), гілка
  `codex/fix-social-linkedin-document`.** Production `social_copy` job пройшов writer/critic
  для всіх шести каналів і зберіг 8 Instagram slides, але впав на старті LinkedIn document із
  `Cannot read properties of undefined (reading 'map')`. Причина: approved `article` artifact
  нормалізований (`editor_note`, `key_takeaways`) і не несе `stories`, а builder очікував
  `bundle.en.stories`. Патч відновлює stories із active revision і приймає обидві форми
  artifact; regression test відтворює production-shaped дані. Після мержу створити linked retry
  для terminal job — не шість окремих channel jobs.
  (source: production `weekly_digest_generation_jobs` / `weekly_digest_artifacts` live check
  2026-08-17; `src/lib/weekly-digest/generation-worker.ts`)

- **Site images → WebP (2026-08-17), гілка `feat/site-webp-origins`.** Браузер на сайті
  отримує WebP через `image-loader` (`format=webp` на Supabase transform), навіть якщо
  origin у бакеті JPEG. Нові weekly `story_image` (Visuals upload і render-persist)
  пишуться як WebP 1600×900 q82. **Не** чіпали origin новинних карток і weekly cover —
  це `og:image` / Satori, які WebP не декодують; Instagram/social лишаються JPEG.
  Уже завантажені 7 JPEG на `ai-weekly-2026-08-09` на сайті теж підуть як WebP після
  деплою, без повторного upload. (source: `src/lib/encode-site-image.ts`,
  `src/lib/image-loader.ts`, [ops/vercel-image-quota](ops/vercel-image-quota.md))

- **Кнопка Start / retry Content Studio знову ставить паки після succeeded (2026-08-16),
  гілка `fix/weekly-content-studio-retry`.** Живий клік 16.08 12:46 UTC на
  `ai-weekly-2026-08-09` rev.3 записав `generation_queued`, але RPC повернув уже
  `succeeded`/`waiting` рядки: ключ
  `weekly-content-studio-v2.1:{digest}:{rev}:research:{item}` незмінний, а
  `queue_weekly_digest_generation_job` скидає лише `failed`/`cancelled`. Кнопка тепер
  викликає `retryWeeklyContentStudio`: нові jobs з `:retry:{uuid}`, in-flight слоти
  пропускає, waiting `editorial_master` не дублює. Composer лишає стабільний ключ.
  Після деплою натиснути кнопку на rev.3 — **не** Rebuild selection. Треба знову
  Approve трьох паків.
  (source: прод `weekly_digest_generation_jobs` live check 2026-08-16 12:46 UTC,
  `src/lib/weekly-digest/orchestrator.ts`)

- **Research pack шукає підтвердження в корпусі `articles` (2026-08-16), follow-up
  `fix/weekly-research-spa-and-page` (#270).** #268 змерджено (`7584d4f`), прод READY.
  Перезбір трьох Feature-паків на `ai-weekly-2026-08-09` rev.3 прогнав уже новий
  limitations-текст («or the ingest corpus»), але `independent_source_count` лишився
  **0/3**. Корінь: PostgREST max-rows 1000 при 2440 статтях у вікні + JS-картки HF/
  ModelScope без 160 символів прози. Не натискати Rebuild selection.
  (source: прод-`articles` count 2026-08-16, pack artifacts `2301b650` / `1ce6801c` /
  `812586fa`, live GET HF+ModelScope extractMainText=0)

- **Daily rank більше не дропає угоду про щоденний тул (2026-08-16), #269.** SpaceX→Cursor
  $60B close (14–15.08) fetch бачив (офіційний блог HN 98, TechCrunch, Engadget), але
  **жоден** рядок не став `brief_item`: жанровий штраф ×0.5 посадив «$60 billion» під
  `minScore` 0.15, кластер не склеївся (Jaccard 0.28 при порозі 0.6), LLM-промпт казав
  DROP all M&A, а червневий custom-бриф з URL **2024** («$60M, спростовує чутки») міг
  труїти семантичний дедуп. Фікс: виняток ownership для Cursor/Claude Code/Codex/…;
  кластер за двома спільними сутностями; cosine-hit ігнорується, якщо це інша подія
  або close через >14 днів після announce; custom-research не бере primary зі шляхом
  `/2024/` у 2026. `SCORE_VERSION` лишається 2 (ваги/нормалізація ті самі).
  (source: прод-`articles` live check 2026-08-16, `pipeline/reader-tools.ts`,
  [guide §3](pipeline/guide.md))

- **Прод-випуск `ai-weekly-2026-08-09` — ручна заміна Radar (2026-08-16, ~13:10 Kyiv).**
  Ревізія **№3** (`5b1aa70f`), статус `in_review`. Needle 2 (rank 6, `cactuscompute.com`)
  замінено на Anthropic 60-subagent / Lean (`96b2cec4`, TechCrunch, штраф різноманіття 8
  лишився в знімку). Top 3 без змін. Стара ревізія №2 (`e922c928`) на місці — Restore
  працює. Research packs і master переставлені в чергу на нову ревізію (паки rev.2 не
  переносяться: input_hash рахує всі 7 історій). Не натискати **Rebuild selection** —
  алгоритм знову викине Anthropic штрафом.
  (source: прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-16,
  `weekly_digest_revisions.revision_number=3`, `weekly_digest_revision_items`)

- **Суддя авто-публікації мовчки не працював 8 ночей — виправлено (2026-08-16), гілка
  `fix/auto-publish-silent-judge`.** `pipeline_runs` вісім ранів поспіль (08-08…15) писав
  `status='ok'`, `error=NULL`, `{action:'left_draft', approved:0, rejected:0,
  judge_unavailable:false}`, а випуски не виходили. **Корінь не той, що здавався:** суддя
  не падав — він відповідав правильно (`{"ref":0,"verdict":"approve","confidence":0.86,…}`),
  але **без конверта `{results:[…]}`**, а парсер читав тільки `obj.results` → порожній масив
  → кожен айтем ішов у `continue // no coverage` → нуль рішень без винятку. Другий,
  незалежний дефект: `logPipelineRun` писав `status:'ok'` **безумовно**, `error` не
  заповнювався ніколи. Виправлено: (1) парсер читає 5 варіантів конверта + голий масив +
  голий обʼєкт; (2) `judgeResponseIssue` як семантичний валідатор у провайдерному ланцюжку —
  нечитабельна відповідь **перемикає модель**; (3) непорожній бриф із 0 рішень = `action:'error'`;
  (4) `status='failed'` + `error` (значення `'error'` неможливе — `pipeline_runs_status_check`
  дозволяє лише `ok/failed/skipped`); (5) Telegram-алерт із сирою причиною; (6) щоденний пінг
  «N брифів чекають рев'ю»; (7) CLI виходить кодом 1, тож Actions-ран червоніє.
  **Перевірено наживо** на досі залиплому брифі `9deed7d1` (08-08 пак 2): до фіксу
  `left_draft approved=0 rejected=0`, після — `published approved=1`. Ціна дефекту: 20
  матеріалів довелось схвалювати вручну 16.08. Деталі —
  [audits/2026-08-16-auto-publish-silent-judge](audits/2026-08-16-auto-publish-silent-judge.md).
  (source: прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-16, пряма проба судді,
  `pipeline/auto-publish.ts`, `pipeline/llm-json.ts`)

- **Кнопка «Rebuild selection» (2026-08-16).** Overview → owner-only перезбір відбору
  поточним селектором по тому самому тижню + seed історій з денних айтемів; нова активна
  ревізія через новий RPC `rebuild_weekly_digest_selection` (міграція `20260816120000`,
  **застосована до прода 2026-08-16**, `service_role` only, перевірена викликом у транзакції
  з відкатом). Руйнівна за задумом: `in_review` + скидання всіх апрувів; стара ревізія
  лишається і відновлюється через Restore. Перевірено наскрізь на **тестовому** випуску
  `ai-weekly-test-2026-07-24` (34 кандидати → 24 eligible → 7, ревізія 3, 4 нові / 4 вибули,
  усі 5 полів заповнені у всіх 7 історіях). Прод-випуск `6cbcf0b3` **не чіпав** — його
  перезбирає власник кнопкою.
  (source: `src/lib/weekly-digest/rebuild-selection.ts`,
  `supabase/migrations/20260816120000_weekly_rebuild_selection.sql`, live run 2026-08-16)

- **Weekly відбір `weekly-editorial-v3` + seed-контент історій — гілка
  `fix/weekly-selection-and-seed-content` (2026-08-16), PR ще не відкрито.** Аудит власника
  на прод-прогоні `05cc4e6a-a709-44ca-b56a-382f21c40292` (тиждень 09–15.08) знайшов чотири
  реальні дефекти, усі підтверджені на живій БД до фіксу:
  (1) **свіжість вирішувала замість якості** — `editorialImpact` константа 35 для кожного з
  10 `high`, тож усередині тіру не розрізняла нічого, а найбільший розкид давала `recency`
  (1.4 → 5.0); bearblog-допис обходив IBM ALTK-Evolve просто за датою. Тепер вікно тижня —
  плато, різниця понеділок↔субота ≤ 1 бала (на тому ж пулі 4.4–4.9);
  (2) **`category_balance` видаляв, а не штрафував** — кап різав 68.1 і 67.4, лишаючи 63.9;
  `perDayCap` робив те саме тихо (обрані розкладались рівно 2+2+2+1 по днях). Замінено на
  штраф −5 категорія / −4 джерело / −3 день і greedy max-marginal вибір; у бектесті новина,
  яку кап видаляв, повертається в дайджест 7-ю позицією, заплативши 3 бала. `diversity_penalty`
  і `adjusted_score` тепер зберігаються по кожному кандидату;
  (3) **`evidence` міряв заповненість полів** — 17.2 однаково в Hacker News і в особистого
  блогу, бо authority брався з назви **фіду**. Новий `pipeline/source-authority.ts` рахує
  authority **видавця** (для агрегатора — за хостом призначення): розкид evidence 7.6 → 22.0
  замість 14.4 → 18.0. `corroboration` (0 у 21 з 22) додатково рахує незалежні хости цитат,
  не рахуючи тред HN/Reddit/X — 3/33 замість 1/22; бюджет компонента 15 → 13. Повне лікування
  (крос-джерельне звʼязування на `fetch`) лишається окремою роботою: `mentions_count ≈ 1`;
  (4) **контент-генерація**: з `WEEKLY_CONTENT_STUDIO_V2=off` composer писав заглушку
  `body = summary`, `takeaway = why_matters`, `practical = null` — у прод-дайджесті
  `6cbcf0b3-187d-4d7d-9eb9-66bdff1c72d4` це 7/7 історій із двома заповненими полями з пʼяти.
  Причина не в LLM: щоденний айтем **уже** мав `body_md` (305–1553 симв.), `takeaways`,
  `action_items`, `when_to_use` — composer просто не вибирав ці колонки. Новий
  `src/lib/weekly-digest/seed-content.ts` мапить їх; replay проти прод-даних дає 5/5
  заповнених полів без дублів. Модуль нічого не генерує — переносить уже схвалений текст,
  порожнє лишає порожнім.
  1419 тестів зелені, `wiki:check` чистий. **Фікси діють на нові дайджести** — наявні
  ревізії імутабельні, поточний випуск треба перескладати або дописувати руками.
  (source: прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-16 —
  `weekly_digest_selection_runs`, `weekly_digest_revision_items`, `articles.score_authority`;
  бектест `selectEditorialDigestItems` на реальному пулі 2026-08-16;
  [weekly-editorial-selection § Що змінила v3](pipeline/weekly-editorial-selection.md#що-змінила-v3-2026-08-16),
  [weekly-digest § Seed-контент історій](pipeline/weekly-digest.md#seed-контент-історій-2026-08-16))

- **Пре-мерж перевірка стека #241–#265 проти живих систем (2026-08-15) — три фікси самі були
  дефектні, виправлено.** Перед мержем у `main` фікси R1–R4 перевірено не тестами, а прод-БД і
  живим каталогом OpenRouter. Знайдено: (1) `revoke select (cover_prompt)` — **no-op**, бо
  `anon`/`authenticated` тримають *табличний* `SELECT` на `briefs`, а колонковий REVOKE від
  нього не віднімає (доведено пробою на прод-Postgres у транзакції з відкатом); супутній
  SQL-тест стверджував протилежне і впав би, якби CI його запускав — CI SQL-тести не запускає
  взагалі; (2) виправлення «не обрізати чергу» стало перекорекцією — `rankModelsForRole` дає
  **197 id** на реальному каталозі (413 моделей), реєстр віддавав їх у `modelQueue` без стелі
  `OPENROUTER_MAX_MODEL_ATTEMPTS` (=6), а `llm_role_chains` у проді порожній, тож усі 13 ролей
  успадкували б 197-модельну ротацію (12 моделей уже коштували ~20 хв 09.08); (3)
  `scoreModelForRole` не застосовував `isEligibleModel`, тож `:batch`-варіанти (404 на chat
  completions, спалили 6 слотів 10.08) були повноцінними кандидатами quality/$; (4) kill-switch
  `OPENROUTER_RERANK_APPLY=off` писав `applied=true` без запису в чергу, отруюючи базу
  quality-drop guard наступного дня. Усе виправлено, 197 → **6**, `:batch`/`:free` у черзі
  немає, `skip_reason='apply_disabled'` рендериться в `/admin/providers`. Деталі —
  [audits/2026-08-15-illustration-pr-stack-review § Пре-мерж перевірка](audits/2026-08-15-illustration-pr-stack-review.md#пре-мерж-перевірка-самих-фіксів-2026-08-15-друга-ітерація).
  (source: прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-15, живий каталог OpenRouter
  2026-08-15, `pipeline/providers/model-rerank.ts`, `model-scoring.ts`, `registry.ts`,
  `supabase/migrations/20260815180000_briefs_cover_prompt_column_privacy.sql`)

- **Увесь ілюстраційний стек змержено в `main` 2026-08-15** — PR
  [#265](https://github.com/sanchahous/ai-today-brief/pull/265), merge-коміт `294fe4e`,
  99 файлів, +12962/−509. PR перецілено з вершини стека на `main`, бо `e2e.yml`/`sonarqube.yml`
  тригеряться лише на `pull_request → main` і за 24 стековані PR **жодного разу не відпрацювали** —
  реально ганявся тільки `npm ci`. Перецілення само по собі їх не запускає (подія `edited` не
  входить у `opened/synchronize/reopened`) — знадобилось close+reopen. Результат першого
  прогону: **Playwright smoke pass (14m55s), SonarQube pass (3m11s)**, Deps integrity pass,
  Vercel pass. PR #241 закрився автоматично, #242–#264 закриті вручну з посиланням, 24 гілки
  видалено.

  **Стан прода після мержу:** усі 4 міграції `20260815*` застосовано і перевірено
  (`anon`/`authenticated` більше не читають `briefs.cover_prompt`, публічні колонки й
  `service_role` не постраждали — перевірено запитом під `set local role anon`: реальний
  `PACK_COLUMNS`-select віддає рядки, `cover_prompt` дає `insufficient_privilege`).
  `get_advisors` нових зауважень не дав. Живий сайт віддає контент без console-помилок.
  Repo Actions variable `OPENROUTER_RERANK_APPLY=off` виставлено **до** мержу — cron
  `0 4 * * *` писатиме audit-рядки в `/admin/providers`, але черги не змінюватиме, доки власник
  не подивиться кілька діб і не вимкне switch сам.

  **Що це змінює операційно:** `WEEKLY_STORY_IMAGE_MODE=prompt_only` тепер дефолт, а preflight
  на `story_image`/`cover` лишається **жорстким** блокером — жоден weekly не вийде, поки власник
  не згенерує і не завантажить картинки вручну. Це задум PR #240, але це нова обовʼязкова ручна
  робота перед кожним релізом.
  (source: `gh pr checks 265` / `gh run list` live check 2026-08-15, прод-Supabase
  `list_migrations` + `get_advisors` після застосування, https://aitodaybrief.com live check
  2026-08-15)

- **Review 24 PR ілюстраційного стека + виправлення на гілці `feat/weekly-illustration-fixes`
  (2026-08-15) — завершено.** Технічне ревʼю PR #241–#264 (усі хвилі
  [weekly-illustration-plan](pipeline/weekly-illustration-plan.md)) знайшло 4 блокери,
  8 дефектів якості, 4 безпекові/цілісні прогалини й 7 операційних — 22 виправлено, 1 (F23,
  e2e для Visuals prompt-карток) задокументовано без фіксу, бо потребує рішення власника про
  тестову інфраструктуру (авторизованого Playwright для `/admin/*` у репо взагалі немає).
  Ключове: крос-story диверсифікація ілюстрацій мовчки відмирала після M1 (siblings читались
  лише з метаданих `story_image`, яку prompt_only-режим більше не пише); grammar-cap на всі
  3 концепти замість одного при появі метрики в новині; owner-feedback/QA дії не звіряли
  `weekly_digest_id` з реальним власником артефакту; daily rerank обрізав спільну чергу
  OpenRouter для ВСІХ ролей до 3 моделей одного writer'а; новий
  `pipeline/scripts/export-owner-calibration.ts` збирає вердикти власника в один датасет
  (раніше не збирались ніде). `npm run pr:check` живий наскрізь — exit code 0. Деталі —
  [audits/2026-08-15-illustration-pr-stack-review](audits/2026-08-15-illustration-pr-stack-review.md).
  **Гілка ще не змержена** — 27 фіксувальних+doc-комітів поверх вершини стека
  (`feat/weekly-card-origin-reencode`), чекає на власника: чи мержити основний стек спочатку.
  (source: [audits/2026-08-15-illustration-pr-stack-review](audits/2026-08-15-illustration-pr-stack-review.md))
- **Origin JPEG новинних карток (2026-08-15).** Нові `brief_items.card_image_url`
  пишуться як `${slug}.jpg` 1280×720 q82 (`encodeCardOrigin`). Історичні PNG —
  `npx tsx scripts/backfill-card-images.ts --reencode-png` (спочатку `--dry-run`),
  без FLUX. Loader і модель новин без змін. Картинки дайджесту ручні.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [ops/vercel-image-quota](ops/vercel-image-quota.md),
  [marketing/card-images](marketing/card-images.md), `pipeline/card-image.ts`)
- **F5 — без пінів версії моделі в прод-коді (2026-08-15).** `pipeline/` і `src/` поза тестами
  не містять `sonnet-5` / `gpt-5` / `gemini-3.x`. Вибір іде з живого каталогу. Vision-модель
  A2 не перемикали. `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) F5,
  `pipeline/model-version-pin.test.ts`)
- **A2 — bake-off vision-критика (2026-08-15).** Actions `31879588071`: усі три моделі
  `Kept the good = 0/1` (зарубали єдину owner-схвалену картку). `claude-sonnet-5` unfit.
  `gemini-3.1-pro-preview` ще й пропустив reject. Модель **не** перемикали — лишаємось на
  `google/gemini-2.5-flash`. Позитив n=1. `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) A2,
  `experiments/critic-bakeoff/2026-08-15/`)
- **G — бюджет ілюстрацій з ledger (2026-08-15).** `/admin/costs` ділить новини / weekly API /
  промпти+QA з `generation_cost_events`, не з лімітів політики. Weekly image API має бути $0
  у `prompt_only`. `CONTENT_SIM_MAX_IMAGE_SPEND_USD=0.2` не піднімається. `WEEKLY_CONTENT_STUDIO_V2=off`
  без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) G,
  `src/lib/generation-costs.ts`)
- **F3 — добовий rerank OpenRouter (2026-08-15).** Job раз на добу пише `llm_model_rank_audit`
  і оновлює чергу `openrouter` топ-3 `weekly.master_writer`, якщо якість не впала >5 пунктів.
  Live-каталог на кожен виклик не ходиться. `/admin/providers` показує latest pick на роль.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) F3,
  `pipeline/providers/model-rerank.ts`)
- **F2 — scoreModelForRole (2026-08-15).** Текстові моделі: бал = quality / $/M за віссю ролі.
  Floor 40 на `weekly.master_writer`. Модель з intelligence 14.2 @ $0.01/M не в ланцюжку.
  Топ-3 + family-хвіст. Добовий job — F3. `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) F2,
  `pipeline/providers/model-scoring.ts`)
- **E3 — promotion gate промптів (2026-08-15).** Visuals: ≥60% концептів прийнятні з 1–2
  спроби (`used` / `used_with_edits`), 0 misleading у прийнятих, ≤10 хв на story, 3 різні
  промпти (B2). Не блокує реліз. Пороги новин без змін.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) E3,
  `src/lib/weekly-digest/prompt-promotion-gate.ts`)
- **E2 — двостадійний критик (2026-08-15).** Авто-цикл спершу image-only (без headline);
  story-aware лише якщо пікселі пройшли. M2 upload лишається одним image-only проходом.
  Вага гейта без змін. `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) E2,
  `src/lib/content-sim/adapters/weekly-image.ts`)
- **E1 — owner-feedback contract (2026-08-15).** На кожному концепті Visuals: використано /
  з правками / відхилено + закриті `reasonTags`. Пишеться в `story_prompt_set` і поруч із
  `post_upload_qa`. Вага гейта без змін. `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) E1,
  `src/lib/weekly-digest/owner-feedback.ts`)
- **D3 — етичний блокер `human_dignity_risk` (2026-08-15).** Критик ловить принизливі
  сцени (напр. робот тримає дитину за голову): на новинах — fail, на upload — попередження
  «ризик гідності». Вага гейта без змін. `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) D3,
  `src/lib/content-sim/vision-critic.ts`)
- **D2 — QA радить, не ремонтує (2026-08-15).** Після upload Visuals показує do/dont:
  впечений текст → inpaint/crop, не перегенеровувати; геометрія → той самий промпт;
  хибна теза → інший концепт. Авто-repair лишається лише на новинах. Вага гейта без змін.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) D2,
  `src/lib/weekly-digest/post-upload-qa.ts`)
- **C3 — mapping gate перед промптом (2026-08-15).** Концепт без таблиці
  source → visible object → outcome не потрапляє в `story_prompt_set`.
  `visibleElementId` (не підпис); порожній `semanticProps` не проходить вакуумно.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) C3,
  `pipeline/concept-mapping-gate.ts`, `src/lib/weekly-digest/story-prompt-job.ts`)
- **C2 — роутер грамматики від essence (2026-08-15).** Метрика в title/summary або claim
  essence → `deterministic_technical_hybrid`. Duration у `practical` і `40%` у takeaway не
  перемикають (C5.2). Один `caching` не є process grammar (C5.3); окремого process prompt немає.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) C2,
  `pipeline/scene-grammar.ts`)
- **C1 — grammar на брифі журі (2026-08-15).** Прийняті лінзи: `cinematic_domain_scene`;
  fallback: `source_led_fallback`. `prompt-export` пише схему, якщо бриф уже має
  `deterministic_technical_hybrid`. Роутер метрики — C2 ✅. C0: моста `autoClaim` немає.
  `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) C0/C1,
  `pipeline/card-image.ts`, `pipeline/prompt-export.ts`)
- **P3 — промпт обкладинки daily в review-чаті (2026-08-15).** Після publish пайплайн пише
  `briefs.cover_prompt` (один виклик `daily.cover_scene` на випуск: топ-3 заголовки + intro) і
  шле окреме Telegram-повідомлення з Canonical / Midjourney / Negative у `<pre>`. Картинку не
  рендерить. Картинки **новин** лишаються авто-FLUX. `WEEKLY_CONTENT_STUDIO_V2=off` без змін.
  (source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) P3,
  `pipeline/daily-cover-prompt.ts`, `pipeline/notify.ts`)
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
