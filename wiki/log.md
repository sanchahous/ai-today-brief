# Log — журнал операцій

Summary: append-only журнал усіх операцій над базою знань. Нові записи додаються **зверху**,
під заголовком. Старі записи ніколи не редагуються і не видаляються — помилку виправляє новий
запис із поміткою «коригує запис від …».
Sources: самозаписи агента
Last updated: 2026-08-06

**Формат запису:**

```markdown
## YYYY-MM-DD — короткий заголовок

**Джерело:** raw/… | live check | рішення власника | нове
**Змінено:**
- `wiki/path.md` — що саме
**Нотатка:** одне речення, якщо потрібне.
```

---

## 2026-08-06 — LLM provider registry, Phase 1b: DB-driven role chains + admin UI

**Джерело:** «продовжуй далі усі фази по порядку з фіксуванням комітами» (власник, продовження
Фази 1 в межах затвердженого плану, `feat/llm-provider-registry`)

**Змінено:**
- `wiki/pipeline/llm-providers.md` — статус Фази 1b: що збудовано, свідоме обмеження CLI-рядків з БД
- `wiki/now.md` — стан гілки оновлено, наступний крок = Фаза 2

**Код:**
- `supabase/migrations/20260806160000_llm_provider_registry.sql` (авторська, НЕ застосована до
  живої БД) — таблиці `llm_providers`/`llm_provider_models`/`llm_role_chains`, той самий
  admin-read+AAL2-write RLS-патерн що в `040_social_cms.sql`, дві нові Vault RPC
  (`store_llm_provider_secret`/`read_llm_provider_secret`, змодельовані на
  `store_social_oauth_secret`/`read_social_oauth_secret`).
- Нова сторінка `/admin/providers` (`src/app/admin/(cms)/providers/{page.tsx,actions.ts}`) —
  додати/редагувати/видалити провайдера, вставити ключ (write-only, AAL2), редагувати
  ланцюжок провайдерів по кожній з 10 ролей. Посилання в `admin-nav.tsx`.
- `pipeline/providers/registry.ts`'s `loadProviderRegistry` тепер реально читає `db`-параметр
  (у Фазі 1 був зарезервованим): `http`/`gemini`-рядки резолвляться повністю, `cli`-рядки —
  лише для інструментів, зареєстрованих у `KNOWN_CLI_PROVIDERS` (поки що порожньо), інакше
  пропускаються з `logEvent('warn', ...)`. Черговість: `roleOverrides > db > built-in default`.
- 19 нових тестів у `registry.test.ts`; попутно виправлено leak стану моків (`vi.mock()` без
  `afterEach`-скидання) у `http-provider.test.ts` і `registry.test.ts` — читання
  `mock.calls[0]` між тестами давало хибні pass/fail.

**Верифіковано:** 910/910 тестів, `tsc --noEmit` чисто, `eslint` на змінених файлах чисто,
`npm run build` успішний (`/admin/providers` — новий маршрут у білді).

**Нотатка:** нічого в проєкті ще не викликає `generateWithRegistry` для реального LLM-запиту —
admin-сторінка й БД-читання безпечні для експериментів, порожні таблиці = поточна поведінка без
змін. Наступний крок — Фаза 2 (`card-image.ts`'s `runArtDirectorLadder`).

## 2026-08-06 — LLM provider registry, Phase 1: registry core + live NIM verification (2 bugs found+fixed)

**Джерело:** продовження Фази 0 в межах затвердженого плану (`feat/llm-provider-registry`);
живий dry-run проти реального NVIDIA NIM API (ключ власника додано в `.env.local`)

**Змінено:**
- `wiki/pipeline/llm-providers.md` — статус Фази 1: що збудовано, обидва знайдені баги, успішний
  результат live-верифікації
- `wiki/now.md` — стан гілки оновлено

**Код:** новий каталог `pipeline/providers/` (`types.ts`, `http-provider.ts`, `cli-provider.ts`,
`gemini-provider.ts`, `registry.ts`) + 30 нових тестів (раніше 0 покриття цього шару). Адитивні
опційні параметри в `openrouter-summarize.ts`/`openrouter-adaptive.ts` (`requestConfig`/`baseUrl`)
з дефолтами, що 1-в-1 відтворюють поточну поведінку OpenRouter — жоден існуючий виклик не
змінено. `claude-cli.ts` свідомо НЕ чіпався (немає другого споживача скелету CLI-провайдерів
поки що).

**Знайдено й виправлено живим прогоном (2026-08-06):**
1. **Реальний баг, не одноразовий здогад:** `buildChatBody()` (`openrouter-summarize.ts`) і
   **окремо** `streamOpenRouterCompletion()` (`openrouter-adaptive.ts`) обидва незалежно
   хардкодили OpenRouter-специфічне поле `usage: {include: true}` у тілі запиту. NIM валідує
   тіло суворо і повертає HTTP 400 `"Unsupported parameter(s): 'usage'"` — на відміну від
   припущення в плані про "graceful degradation", яке було правильним лише для ВІДПОВІДІ
   (`usage.cost` дійсно деградує в `null`), не для ЗАПИТУ. Перша спроба фіксу (лише в
   `buildChatBody` через `extraBodyForModel`) не спрацювала в живому прогоні — другий,
   незалежний хардкод у `streamOpenRouterCompletion` мовчки перекривав перший фікс. Знайдено
   лише повторним живим прогоном після першого «фіксу», який не змінив реальну поведінку.
2. `moonshotai/kimi-k2.6` — HTTP 404, модель не активована на конкретному NVIDIA-акаунті
   (обліковий нюанс, не код).

**Результат:** `deepseek-ai/deepseek-v4-pro` через реальний NIM API успішно повернув валідний
JSON за 86.9с — підтверджує головну тезу дослідження: generic OpenAI-сумісний HTTP-шар дійсно
працює проти неOpenRouter-провайдера лише зі зміною base URL + ключа.

**Нотатка:** це другий приклад у цій сесії (після PR3's critic-vocabulary фіксу), коли живий
прогін ловить реальний баг, який юніт-тести з мокнутим fetch не могли б виявити — мокнутий
`fetch` ніколи б не повернув справжню 400-помилку суворого валідатора NIM.

---

## 2026-08-06 — LLM provider registry, Phase 0: Gemini removed from default rotation

**Джерело:** рішення власника (session 2026-08-06) — під час обговорення дещо ширшого запиту
(«прибрати Gemini + зробити зручну систему керування провайдерами для всього проєкту, не лише
weekly»); дослідження коду (2 Explore-агенти + 1 Plan-агент) + Plan-mode затверджений план у
`C:\Users\Oleksandr\.claude\plans\06-08-2026-12-32-oleksandr-kuzmenko-prancy-gizmo.md`

**Змінено:**
- Нова гілка `feat/llm-provider-registry` (від tip `feat/weekly-editorial-voice`)
- `wiki/pipeline/llm-providers.md` — нова сторінка: навіщо, ключові знахідки дослідження,
  статус фаз
- `wiki/index.md` — новий рядок
- `wiki/now.md` — стан нової гілки, залежність від `feat/weekly-editorial-voice`

**Код (Фаза 0 з 7+ фаз плану):**
- `src/lib/weekly-digest/editorial-llm.ts`'s `providerOrder()`: дефолт `WEEKLY_MASTER_PROVIDER_ORDER`
  `claude-cli,openrouter,gemini` → `claude-cli,openrouter`
- `src/lib/social/llm-router.ts`'s `DEFAULT_PROVIDER_ORDER`: writer/critic обидва тепер
  `['openrouter','ollama']` (gemini прибрано з обох); незалежність writer/critic і далі йде через
  `excludeProviders` у `generateSocialJson`, не через різний перший провайдер за замовчуванням
- Daily: новий тимчасовий прапорець `DAILY_LLM_PRIMARY_PROVIDER` (`pipeline/config.ts`'s
  `PipelineConfig.primaryTextProvider`), протягнутий через `pipeline/llm-json.ts`,
  `pipeline/summarize.ts`, `pipeline/verify.ts`, `pipeline/auto-publish.ts`,
  `pipeline/custom-news.ts`. Дефолт `'gemini'` — нуль зміни поведінки без явного env override.
  **Свідомо тимчасова конструкція**, видаляється у фазі 6 плану, коли daily переходить на повний
  реєстр провайдерів.
- Gemini-клієнти (`gemini-models.ts`, SDK-виклики) не чіпались — лишаються доступні через явний
  env override у всіх трьох шляхах.

Typecheck/lint/build/vitest зелені (873 тести). Наступний крок — Фаза 1: ядро реєстру
(`pipeline/providers/`) + БД-таблиці + один живий dry-run проти реального NVIDIA NIM API
(ключ власника вже додано в `.env.local` як `NVIDIA_API_KEY`).

**Нотатка:** повний план (типи, БД-схема з Vault-секретами, admin UI, фазовий порядок 0–7) — у
файлі плану вище, тут навмисно лише статус, щоб не дублювати. `docs`-Plan-агент перевірив і
підтвердив реальний, робочий Vault-патерн для зберігання секретів провайдера
(`store_social_oauth_secret`/`read_social_oauth_secret`, `040_social_cms.sql`) — не здогад.

---

## 2026-08-06 — Editorial quality overhaul, PR7: social voice + hook picker + cleanup (all 7 PRs done)

**Джерело:** рішення власника (session 2026-08-06) — «код продовжується» по завершенні PR6;
завершення 7-PR плану `feat/weekly-editorial-voice`

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — новий підрозділ «PR7»: socialAngles видалено з майстра,
  self-generated angle, voice-модуль у social-adapter, banned-openers ranking, originality
  critic-вимір, hook picker UI, dead-code cleanup, plan-correction на `GENERIC_PRACTICAL_PATTERNS`
- `wiki/now.md` — усі 7 PR позначені готовими; наступний крок явно передано власнику
  (code review / shadow-прогін / klein-оцінка)

**Код:** `WeeklyMasterBundle.socialAngles` видалено end-to-end (тип, `englishPrompt` CONTRACT+JSON
SHAPE, `parseEnglishPackage`, `normalizeWeeklySocialAngles`, `social_angle_grounding` гейт) --
`social-adapter.ts` тепер сам пропонує кут для кожного каналу в тому ж writer-виклику, що пише
3 hook-кандидати (`{"angle":"","text":"...","firstComment":""}`), замість читати заздалегідь
згенерований, каналево-сліпий кут з майстра. Імпортовано `VOICE_EN`/`VOICE_UK` з `editorial-voice.ts`
(PR1) у writer-промпт; `scoreCandidate` тепер штрафує за `bannedPhrasesFor(locale)`-спрацювання.
Новий critic-вимір `originality` (`src/lib/social/critic.ts`, `src/lib/social/types.ts` --
optional-field патерн, daily social-пайплайн не зачеплений) з порогом 70/100. Social tab: hook-
кандидати клікабельні (`src/components/admin/hook-candidate-picker.tsx`, новий client-компонент).

**Видалено:** мертвий `src/lib/weekly-digest/editorial-draft.ts` + тест (передував Content Studio
v2, ніде не імпортувався окрім власного тесту).

**Виправлення плану:** початковий план казав видалити й `GENERIC_PRACTICAL_PATTERNS` як нібито
дублікат `detectTemplateLeaks` -- читання коду показало, що це активний, протестований гейт
(`generic_practical`) для іншого класу проблеми (reused generic template phrases в полі
practical), не дублікат. Залишено як є.

**Нове покриття:** `social-adapter.test.ts` (5 тестів, раніше -- нуль тестів на цей модуль):
self-generated angle, banned-opener ranking, originality blocking/non-blocking, originality-flag
surfacing. Typecheck/lint/build/vitest зелені (872 тести, 99 файлів).

**Нотатка:** як і PR6, немає окремого live-прогону в межах цієї сесії -- новий originality-вимір
критика жодного разу не бачив реальну відповідь моделі. Усі 7 PR плану тепер на гілці
`feat/weekly-editorial-voice`; злиття, shadow-прогін і фінальна візуальна оцінка klein-стилю
(PR5) лишаються рішенням власника.

---

## 2026-08-06 — Editorial quality overhaul, PR6: video script stage + manifest v3

**Джерело:** рішення власника (session 2026-08-06) — «кодити PR6–7 паралельно» під час двох
live-верифікацій PR3/PR5; продовження 7-PR плану `feat/weekly-editorial-voice`

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — новий підрозділ «PR6» під «Editorial voice overhaul»:
  video виключено з майстер-виклику, новий standalone job `video_script`, WPS-валідатор,
  manifest v3 з per-scene `revisionItemId`, оновлений порядок job-пайплайну
- `wiki/pipeline/video-boundary.md` — попередження про застарілий приклад схеми (`v1` замість
  живого `v3`), лінк на актуальний контракт
- `wiki/now.md` — стан гілки (PR1–6 закомічені, PR7 останній), PR6 позначено «не верифіковано
  наживо» (на відміну від PR3/PR5)
- `wiki/index.md` — лічильник міграцій ~66 → ~67

**Код:** `WeeklyMasterBundle.video` видалено з типу; новий `src/lib/weekly-digest/video-script-llm.ts`
(TV-news драматургія: cold open → anchor → b-roll×3 (по одній на feature-історію) → radar
quick-hits → outro, той самий Claude CLI → OpenRouter → Gemini ladder через щойно експортований
`generateFirstAvailable`); новий `validateVideoScript` (`content-studio.ts`) — WPS-гейт
`durationSeconds ≈ words(voiceover)/2.6 ±20%` б'є задокументований корінь «німого слайдслайду»
з `ai-today-brief-video`; `video_script` — тепер queueable job type (раніше писався синхронно
всередині `editorial_master`); міграція `20260806150000_weekly_video_script_job.sql`
(job_type CHECK + обидва RPC) написана, **не застосована до прод-БД**; попутний фікс —
`generateSocialCopy` більше не залежить від існування video_script-артефакту (побічний баг
старого коду). Typecheck/lint/vitest зелені (152 тести, +17 нових на `validateVideoScript` і
`generateWeeklyVideoScript`).

**Нотатка:** на відміну від PR3 (critic shadow-run) і PR5 (klein dry-run), тут не було окремого
live-прогону в межах цієї сесії — рекомендовано запустити `video_script` на реальному
approved-артикулі перед shadow-розкаткою всього пайплайну.

---

## 2026-08-06 — Editorial quality overhaul, PR1: editorial-voice.ts core

**Джерело:** рішення власника (session 2026-08-06) — забракував якість усього weekly-контенту
(текст/ілюстрації/відео/соц) як «машинну»; опитування власника (аудиторія, голос, спекуляції,
AEO-блоки, людина-в-циклі, формат відео, бюджет) + 7-PR план `feat/weekly-editorial-voice`

**Змінено:**
- `wiki/pipeline/editorial-voice.md` — нова сторінка: архітектура голосу, exemplars,
  contrast-pairs, banned-phrase гейт, Unicode-regex пастка
- `wiki/pipeline/weekly-digest.md` — секція «Editorial voice overhaul (2026-08-06)»,
  `weekly-master-v4` → `weekly-master-v5`
- `wiki/pipeline/weekly-editorial-selection.md` — межа з overhaul (selection незмінний, лише
  вхід для нового voice-майстер-промпту)
- `wiki/ops/weekly-admin-runbook.md` — нові блокери `editors_view_missing` /
  `discussion_question_missing` / `template_leak:*` у кроці Research
- `wiki/now.md` — активна робота п.1 = редакційний перегляд; trial release
  `ai-weekly-2026-07-27` свідомо призупинено до PR1–3
- `wiki/index.md` — новий рядок для `pipeline/editorial-voice.md`; лічильник міграцій 63 → 65
  (pre-existing drift, не повʼязаний з цією роботою, виправлено заразом бо блокував `wiki:check`)

**Нотатка:** код PR1 (`src/lib/weekly-digest/editorial-voice.ts` + переписані промпти в
`editorial-llm.ts` + `detectTemplateLeaks`/нові поля `editorsView`/`discussionQuestion` в
`content-studio.ts` і `generation-worker.ts`) готовий локально — typecheck/lint/vitest (832
тестів) зелені; ще не закомічено/запушено, чекає рішення власника. PR2–7 заплановані, не
почато.

---

## 2026-08-06 — Editorial quality overhaul, PR2: render new story anatomy

**Джерело:** продовження 7-PR плану (PR1 запис вище); власник підтвердив підхід «AEO-блоки
поза прозою» під час опитування 2026-08-06

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — секція PR2: `digests.ts`/`weekly-story.tsx`/`pdf.ts` зміни
- `wiki/pipeline/editorial-voice.md` — позначено рендеринг як вирішений, приберано з «НЕ вирішує»

**Нотатка:** `src/lib/digests.ts` читає нові поля з `source_snapshot.content_studio`
(`contentStudioFrame`); `weekly-story.tsx` рендерить `limitation` (приглушений рядок),
«Погляд редакції» (пунктирна рамка + дисклеймер) і `discussionQuestion` (завершальне питання) —
усі умовно, зворотна сумісність зі старими випусками. PDF отримав панель `limitation` тим самим
шляхом; `editorsView`/`discussionQuestion` свідомо НЕ додані в PDF. Живо перевірено на єдиному
опублікованому випуску (`ai-weekly-2026-06-29`) — 200 OK, без regressions (dev-сервер довелось
піднімати напряму через Bash, не через preview_start: харнес-тул під час запуску `next dev`
ловить відомий subst-drive path-duplication баг з `dev-env-subst-drive-e2e-2026-07`, тепер він
проявляється і поза Playwright-контекстом; `turbopack.root` у `next.config.ts` не допоміг і був
відкочений — ENOENT стосується internal dev-manifest шляху, не module resolution).

---

## 2026-08-06 — Editorial quality overhaul, PR3: critic rubric + line-edit pass

**Джерело:** продовження 7-PR плану (PR1/PR2 записи вище)

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — секція PR3: engagement/voice виміри, revise loop, latest-only
  retry guidance, `weekly-master-v6`
- `wiki/pipeline/editorial-voice.md` — PR3 позначено вирішеним із застереженням «не змержено»
- `wiki/now.md` — зупинка перед мержем PR3 явно виділена

**Нотатка:** `criticPrompt` тепер несе якорьовану рубрику (3 приклади на вимір: як виглядає
90/75/55) і вимагає цитованих спанів для оцінок нижче 80. `generateWeeklyMaster` отримав
in-process revise-loop (макс 2 спроби): на revisable провалі (`reportIsRevisable` —
виключає grounding/структурні коди) шле targeted `reviseArticlePrompt` замість повної
регенерації; англійська правка завжди тягне за собою переадаптацію української (не наосліп).
Вартість по кожному кроку (english/ukrainian/critic) сумується по всіх спробах в межах одного
виклику — інакше revise тихо занижував би облік витрат. `priorMasterRetryGuidance` звужено з
«усі історичні звіти, змерджені» до «лише останній звіт» — стара версія ніколи не забувала
код, навіть після виправлення, тому ретраї монотонно звужувались і сіріли.
**НЕ змержено:** потребує critic-only shadow-прогону на `ai-weekly-2026-07-27` (реальний
виклик OpenRouter, ~$0.30) — власник має підтвердити, що нова рубрика справді провалює
старий текст по voice/engagement, перш ніж це можна мержити.

---

## 2026-08-06 — Editorial quality overhaul, PR4: owner-set story angle

**Джерело:** продовження 7-PR плану (PR1–3 записи вище); перша точка «людина-в-циклі»
(~30–60 хв/випуск), яку власник обрав на опитуванні 2026-08-06

**Змінено:**
- `supabase/migrations/20260806140000_weekly_digest_story_directions.sql` — нова таблиця
  (написана, **не застосована** до живої БД)
- `src/lib/database.types.ts` — ручний тип для `weekly_digest_story_directions` (codegen
  неможливий, доки міграція не задеплоєна)
- `wiki/pipeline/weekly-digest.md` — секція PR4 + виправлено дублікат абзацу (залишок від
  вставки PR2/PR3 між старим текстом PR1)
- `wiki/pipeline/editorial-voice.md` — PR4 позначено вирішеним зі спрощенням (без AI-пропозицій)
- `wiki/now.md`, `wiki/index.md` (лічильник міграцій 65 → 66)

**Нотатка:** таблиця keyed by `brief_item_id` (не `revision_item_id`) — щоб кут подачі не
губився при кожному Save, який карбує нову ревізію (той самий урок з #177/#187). Спрощено
проти плану: research pack лишається 100% детермінованим (без LLM-викликів), тому AI-пропозиції
кута (2-3 варіанти на вибір) НЕ реалізовані — тільки вільний текст власника. Це і economy
рішення (не додавати платний LLM-виклик у надійний детермінований етап), і узгоджується з
принципом сесії «не витрачати гроші власника без питання» — згенеровані пропозиції довелося б
показувати без live-перевірки якості. `masterInputStories` і адмін-читання деградують до
порожньої мапи/масиву, якщо таблиця ще не задеплоєна — жодна сторінка не падає.

---

## 2026-08-06 — Editorial quality overhaul, PR5: reportage illustrations + variants

**Джерело:** продовження 7-PR плану (PR1–4 записи вище); друга точка «людина-в-циклі»
(вибір з варіантів + редагована сцена), яку власник обрав на опитуванні 2026-08-06

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — секція PR5, включно з відхиленням від початкового плану
  щодо зберігання варіантів (RPC не підтримує кілька `is_current` на один slot_key)
- `wiki/pipeline/editorial-voice.md` — PR5 позначено вирішеним, «не змержено»

**Нотатка:** `pipeline/card-image.ts` отримав повністю окремий шлях для weekly
(`weeklyReportageSceneBrief`/`buildWeeklyPrompt`/`generateWeeklyReportageIllustrations`) —
daily-пайплайн (`sceneBrief`/`buildPrompt`/`fillCardImages`) не чіпали, спільний лише
provider-ladder. Головний фікс: `buildWeeklyPrompt` вшиває avoid-list у позитивний промпт,
бо на дефолтному провайдері (FLUX.2 klein, multipart) окремий `negative_prompt` фізично не
надсилався — мертвий код, який показувався в адмінці, але ніколи не діяв. Дизайн зберігання
варіантів довелося переглянути після прочитання реального `save_weekly_digest_artifact` RPC:
план описував «3 артефакти в одному slot», але RPC демотує попередній `is_current` рядок при
кожному save — кілька одночасних is_current на один slot_key неможливі. Використано вже
наявний `content.preview_paths`/`preview_urls` механізм (той самий, яким PDF підписує превʼю
сторінок) замість нової архітектури — нуль нових DB-запитів у admin-data.ts.
**НЕ змержено:** потребує dry-run 9 klein-рендерів — власник має підтвердити, що модель
тримає репортажний стиль (не галюцинує чи не зісковзує назад у метафору), перш ніж це
можна вважати готовим.

---

## 2026-08-06 — Editorial quality overhaul: PR3 + PR5 live verification, critic vocab fix

**Джерело:** власник дав дозвіл запустити обидві відкладені live-перевірки (реальні платні
виклики OpenRouter + Cloudflare) замість чекати окремого рішення по кожній

**Змінено:**
- `src/lib/weekly-digest/editorial-llm.ts` — `criticPrompt` тепер задає закритий словник із
  6 кодів для non-factual issues (знайдено живим прогоном, критик вигадував власні коди)
- `src/lib/weekly-digest/content-studio.ts` — `REVISABLE_ISSUE_CODES` розширено цими 6 кодами
- `src/lib/weekly-digest/content-studio.test.ts` — тести на новий і старий (відхилений) словник
- `wiki/pipeline/weekly-digest.md` — результати обох live-перевірок у секціях PR3/PR5
- `wiki/now.md`

**Нотатка:** PR3 acceptance test **PASSED** — новий критик дав 73/100 (voice 68, naturalness 70)
на точно тому контенті, що раніше отримав 93/100, і самостійно процитував фрази з оригінальної
скарги власника («Обмеження полягає в тому, що…», «For product and security leaders…»). Рубрика
дискримінує за призначенням. PR5 dry-run дав 9 генуїнно фотореалістичних репортажних кадрів —
технічна перевірка пройдена, зображення надіслані власнику для фінальної візуальної оцінки;
одна самостійно помічена проблема — композиційна одноманітність між історіями (не хиба
регістру, радше брак сценарної різноманітності, вартий уваги в майбутньому тюнінгу
`weeklyReportageSceneBrief`). Скрипти верифікації — `tmp/pr3-shadow-critic/`,
`tmp/pr5-klein-dryrun/` (одноразові, за конвенцією директорії `tmp/` цього репо).

---

## 2026-08-04 — Weekly Social: preview assets + safe save/approve

**Джерело:** live fail Telegram Save & approve (`schedule_past`) + founder report
«бачу alt text, не бачу image»

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — нотатки Social tab (preview `asset_urls`, Destination URL,
  blockers, збереження provenance)
- `wiki/ops/social-cms-runbook.md` — Weekly Social tab notes
- `wiki/now.md` — поточний фокус на Social save/UX

**Нотатка:** ілюстрації вже були в БД; UI показував лише alt/JSON без превʼю.

## 2026-08-04 — Weekly admin runbook + Research next-step UX

**Джерело:** запит власника (незрозумілий gate: master queued після succeeded packs)

**Змінено:**

- `wiki/ops/weekly-admin-runbook.md` — **нова** покрокова інструкція адмінки
- `wiki/index.md` — рядок ops/weekly-admin-runbook
- `wiki/pipeline/weekly-digest.md` — лінк на runbook + Research UX note
- `wiki/now.md` — runbook як primary pointer для редакції

**Нотатка:** succeeded ≠ approved — головна пастка human research gate.

## 2026-08-04 — Vercel Fluid CPU: lazy imports + checkpoint-merge + admin prefetch

**Джерело:** live check Vercel dashboard 2026-08-04 (Fluid Active CPU 3h58m/4h Hobby, `ai-today-brief` = 99.8% акаунта)

**Змінено:**
- `wiki/pipeline/weekly-digest.md` — новий розділ «Fluid CPU / вартість»: lazy `import()`
  для sharp/pdfkit/pdfjs-dist/canvas у `generation-worker.ts`, RPC-мерж замість overwrite
  для checkpoint editorial_master, `prefetch={false}` на admin weekly Links
- `wiki/now.md` — нова секція «Vercel Fluid CPU» з поточним статусом
- `wiki/index.md` — лічильник міграцій 62 → 63 (`20260804180000_weekly_digest_generation_job_output_merge.sql`)

**Нотатка:** міграція вже застосована в прод-Supabase. pdfkit Helvetica.afm ENOENT (окрема
підозра з тієї ж інвентаризації) виявився вже полагодженим PR #152 (24.07) — дій не було.
Content-hash caching для retry image/pdf-джобів розглянуто і відхилено: живого бага не
знайдено (`retryableGenerationFailure` вже коректно не ретраїть детерміновані помилки).

## 2026-08-04 — Master critic grounds on primary excerpts

**Джерело:** live fail `ai-weekly-2026-07-27` (`UNSUPPORTED_DETAIL` Python/Sage vs вузький claim set)

**Змінено:**

- `wiki/pipeline/weekly-digest.md` — evidence grounding: claims + primary excerpt (12k),
  studio `v2.1` / research `v3` / master `v4`
- `wiki/now.md` — після деплою: regen research packs → re-approve Top 3 → retry master

**Нотатка:** старі packs з 2.4k excerpt не містили mid-article деталей; потрібна перегенерація.

## 2026-08-04 — Preflight blockers: sectioned release path

**Джерело:** запит власника (порядок ворнінгів)

**Змінено:**

- `wiki/pipeline/weekly-digest.md` — preflight згруповано по Steps 1–8 (вкладки) з
  порядком усередині секції

**Нотатка:** порожні секції приховані; шлях зверху вниз = Stories→…→Video.

## 2026-08-04 — Preflight blockers: fix + tab links

**Джерело:** запит власника (UX Release preflight)

**Змінено:**

- `wiki/pipeline/weekly-digest.md` — Admin UX: actionable preflight (`fix` + лінк на вкладку;
  Master quality на Research)

**Нотатка:** `content_quality_report` не окремий upload — з’являється після Content Studio critic.

## 2026-08-04 — Dependabot #164 → #179 (safe patch/minor)

**Джерело:** live check #178/#179 CI; Playwright run 30899512987 (339 passed)

**Змінено:**

- `wiki/now.md` — #164 закрито, #179 змерджено; `main` = deps bump без pdfkit

**Нотатка:** recreate #164 не знадобився — Dependabot закрив групу після pdfkit ignore і відкрив #179 (12 updates).

---

## 2026-08-04 — Dependabot інфра (automerge + secrets + pdfkit ignore)

**Джерело:** live check PR #164 CI / `gh api .../dependabot/secrets`; план safe deps infra

**Змінено:**

- `.github/workflows/dependabot-automerge.yml` — прибрано `gh pr review --approve` (GITHUB_TOKEN не апрувить)
- `.github/dependabot.yml` — ignore `pdfkit` minor/major (окремий PR після PDF smoke)
- Dependabot secrets — `SCRAPPER_BASE_URL` + `SCRAPPER_BASE_ANON_KEY` (e2e на Dependabot PR)
- `wiki/ops/owner-checklist.md`, `wiki/now.md` — стан secrets / #164

**Нотатка:** без Dependabot copies e2e #164 падав на порожніх `NEXT_PUBLIC_SUPABASE_*`.

---

## 2026-08-04 — wiki:sync гейт (код ↔ специфікація)

**Джерело:** запит власника; live check після #177 wiki refresh

**Змінено:**

- `wiki/_meta/project-sync.json` — контракт watchers/facts/counts/index
- `wiki/_tools/lib/project-sync.mjs` + `wiki-project-sync.mjs` + `*.test.mjs`
- `package.json` — `wiki:sync`, `wiki:sync:test`, `wiki:check`; `pr:check` включає `wiki:check`
- `.cursor/rules/pr-gate.mdc`, `CLAUDE.md`, `wiki/architecture/agentic-workflow.md` — опис гейту
- `wiki/pipeline/weekly-digest.md` — формулювання `default $4` під fact-check

**Нотатка:** зміна коду під watcher без оновлення listed wiki-сторінок тепер валить `pr:check`.

---

## 2026-08-04 — актуалізація wiki під main + weekly stability

**Джерело:** live check `git log` / `gh pr list` / Supabase preflight 2026-08-04; PR #166–#177

**Змінено:**

- `wiki/now.md` — повне оновлення: `main`=#176, відкриті #177/#164, закрита docs→wiki,
  активна редакція `ai-weekly-2026-07-27`, owner/code next steps
- `wiki/pipeline/weekly-digest.md` — **нова** сторінка Content Studio v2 + revision stability
- `wiki/marketing/card-images.md` — FLUX.2 klein, no-text policy, multipart Node, costs
- `wiki/overview.md` §4 — FLUX.2, spend-cap, `generation_cost_events` / `/admin/costs`
- `wiki/open-questions.md` #2/#4 — ledger існує; критерій shadow→production ще відкритий
- `wiki/index.md` — `weekly-digest` ✅; ~62 міграції; дати live check

**Нотатка:** `now.md` від 2026-08-03 був застарілий (ще описував docs→wiki як активну роботу).

---

## 2026-08-03 — fix: Last updated + дрібні шляхи після ревʼю #166

**Джерело:** ревʼю PR #166

**Змінено:**

- усі 33 мігровані сторінки — `Last updated` перештамповано з contentful `git log --follow`
  (міграційні коміти пропущені); `Sources:` → `none (analysis)`
- `wiki/architecture/prototype-to-production.md` — історичний шлях `docs/STARTUP-PLAN.md` відновлено
- `wiki/strategy/master-roadmap.md`, marketing/pipeline посилання — старі імена файлів → поточні wiki-шляхи
- `wiki/ops/mcp.md` — лінк на reddit-compliance спростити до `./`
- коментарі e2e/sonar workflows: `docs/` → `wiki/`

**Нотатка:** виправляє п. 1–5 ревʼю #166 до мержу.

---

## 2026-08-03 — міграція docs/** → wiki/** · raw/ · artifacts/


**Джерело:** [ADR 2026-08-02](decisions/2026-08-02-knowledge-base-restructure.md) кроки 2–8;
гілка `chore/migrate-docs-to-wiki`

**Змінено:**

- `raw/db/2025-07a-supabase-mvp-migration.sql` — `git mv` з `docs/07a — Supabase MVP migration.sql`
- `raw/reference/prototypes/**` — `git mv` з `docs/reference/prototypes/`
- `artifacts/brand-kit/**` — `git mv` з `docs/marketing/brand-kit/`
- `artifacts/card-samples/**` — локальний (gitignore) переніс із `docs/marketing/card-samples/`
- 33 markdown-сторінки перенесено з `docs/` у тематичні розділи `wiki/` (strategy, architecture,
  pipeline, analytics, marketing, product, ops, audits) зі збереженням історії (`git mv`)
- шапки `Summary` / `Sources` / `Last updated` додано всім мігрованим сторінкам
- посилання `docs/…` переписано в `wiki/` · `raw/` · `artifacts/` у коді, конфігах і ядрі wiki
- `tsconfig.json`, `eslint.config.mjs`, `.vercelignore`, `sonar-project.properties`,
  `.gitignore`, `.cursor/rules/{00-core,pr-gate}.mdc`, workflows e2e/sonar — прибрано / оновлено
  згадки `docs/`
- `wiki/index.md`, `wiki/now.md`, `wiki/overview.md` — статуси ✅ після міграції
- `wiki/decisions/2026-08-02-knowledge-base-restructure.md` — статус: кроки 1–8 виконано
- папку `docs/` видалено (`git ls-files docs` → 0)

**Нотатка:** історичні згадки `docs/` у тексті ADR (команди `git mv`) залишено навмисно як
документацію плану. Зовнішні URL на `docs.claude.com` / `platform.claude.com` не чіпались.

---

## 2026-08-02 — bootstrap agentic-архітектури бази знань

**Джерело:** `WorkShop 23-25_07 Prompts. Personal.pdf` (поза репозиторієм, у Downloads власника) +
інвентаризація репозиторію (live check)

**Змінено:**

- `CLAUDE.md` — переписано з опису продукту на **системний контекст поведінки**: два режими
  (engineer / wiki-curator), мовна політика, карта зон, 10 жорстких правил, ingest workflow,
  question answering, lint, page format, citation rules, MCP-екосистема, сумісність із Knowledge
  Work Plugins. Бізнес-факти винесено звідси у `wiki/overview.md`.
- `AGENTS.md` — додано «Agent contract» для Codex/Cursor/Copilot поверх наявного
  `nextjs-agent-rules` блоку (блок збережено дослівно).
- `raw/` — створено скелет: `exports/`, `research/`, `scrapes/`, `db/`, `reference/`, `_local/` + `README.md`.
- `artifacts/` — створено з `README.md` і `_local/`.
- `wiki/index.md` — створено головний зміст + мапу міграції `docs/** → wiki/**`.
- `wiki/overview.md` — створено; зібрано бізнес-контекст, ринок, бюджетні обмеження, 8 жорстких
  обмежень, вузьке місце й розділ «Що НЕ спрацювало» (10 позицій) — усе з посиланнями на джерела.
- `wiki/now.md` — створено; стан `main` (`c4abe06`), відкритий PR #157, 5 останніх PR, 5 блокерів
  на власникові, 3 найближчі дії в коді.
- `wiki/log.md` — створено (цей файл).
- `wiki/open-questions.md` — створено; 7 відкритих питань, зокрема конфлікт GA4-property.
- `wiki/_meta/page-template.md` — створено шаблон сторінки.
- `wiki/architecture/agentic-workflow.md` — створено; опис самої системи.
- `wiki/ops/mcp.md` — створено; налаштування chrome-devtools / apify / supabase / ahrefs / vercel.
- `wiki/decisions/2026-08-02-knowledge-base-restructure.md` — створено ADR + покроковий план міграції.
- `wiki/_tools/wiki-lint.mjs` + `npm run wiki:lint` — лінтер формату сторінок, посилань і сирітства.
- `README.md` — переписано з дефолтного `create-next-app` на реальний вступ: чотири зони,
  команди, правило «ніколи не пушити в `main`».
- `.mcp.json` — створено (chrome-devtools + apify), обидва opt-in.
- `package.json` — додано скрипт `wiki:lint` (не входить у `pr:check`, щоб не міняти гейт).
- `.gitignore` — додано `raw/_local/*`, `artifacts/_local/*` із винятком для `.gitkeep`.
- `eslint.config.mjs`, `.prettierignore`, `.vercelignore`, `sonar-project.properties` — `raw/`,
  `wiki/`, `artifacts/` додано до ignore-списків (шар знань не проходить через code-гейти).
- `.github/workflows/e2e.yml`, `.github/workflows/sonarqube.yml` — `wiki/**`, `raw/**`,
  `artifacts/**` додано в `paths-ignore` (зміни в базі знань не запускають Playwright і Sonar).

**Нотатка:** фізичне перенесення 40+ файлів `docs/**` у `wiki/**` **не виконано** — це окремий
PR за планом у
[decisions/2026-08-02-knowledge-base-restructure](decisions/2026-08-02-knowledge-base-restructure.md),
щоб не змішувати створення каркасу з масовим `git mv` і переписуванням посилань.
Вихідний PDF воркшопу навмисно не скопійовано в `raw/research/` — рішення за власником
(файл особистий, репозиторій має remote на GitHub).
