# Now — поточний операційний стан

Summary: над чим іде робота **прямо зараз**, що чекає на власника, що щойно відвантажено.
Живий файл — оновлювати при кожній зміні стану, не рідше раз на тиждень.
Sources: `git log` / `gh pr list` (live check 2026-08-04), Supabase preflight live check 2026-08-04,
`wiki/ops/owner-checklist.md`, `wiki/audits/2026-07-01-seo-organic.md`, `.env.example`,
owner session 2026-08-06/07 (editorial quality feedback, LLM provider registry), post-merge tech
review 2026-08-07 (`claude/tech-review-pr-189-190-859ena`), live `auto-publish --dry-run` check
2026-08-07, owner session 2026-08-08 (admin mobile-responsive fix, screenshot report),
owner-approved Weekly Digest reliability plan 2026-08-08
Last updated: 2026-08-09

---

## Стан репозиторію

- **Гілка `agent/weekly-content-quality-hardening` (локально, 2026-08-09)** — критичний аудит
  згенерованого weekly master виявив дослівний витік voice exemplar у вступ, вигадані сцени,
  абстрактні titles, непояснені energy claims і системні UK spelling/grammar/localization
  дефекти, які critic пропустив із сімома однаковими 90/100. Підготовлено `weekly-master-v7`:
  exemplars вилучено з prompt, додано deterministic blockers, `language_mechanics`, жорсткішу
  critic calibration і зрозумілі Article labels. Повний `npm run pr:check` зелений: 957/957
  тестів із coverage, typecheck, lint, affected E2E map, wiki contract і production build;
  writer окремо заборонено форсувати umbrella-тему без доказового зв'язку Top 3. Деталі —
  [pipeline/editorial-voice § Аудит 2026-08-09](pipeline/editorial-voice.md#аудит-згенерованого-випуску-2026-08-09).
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
- [pipeline/weekly-digest](pipeline/weekly-digest.md) — Content Studio v2 + revision stability
- [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md) — як вести випуск у адмінці
- [ops/owner-checklist](ops/owner-checklist.md) — env / Dependabot secrets
- [index](index.md) — карта бази знань
- [open-questions](open-questions.md) — невирішені питання
- [log](log.md) — журнал операцій
