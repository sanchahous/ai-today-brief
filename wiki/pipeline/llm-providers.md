# LLM providers — уніфікований реєстр (у розробці)

Summary: план і статус переходу від трьох окремих Gemini→OpenRouter реалізацій (daily/weekly/social)
до одного спільного, власником-керованого реєстру провайдерів для всього проєкту.
Sources: owner session 2026-08-06/07, дослідження коду (Explore-агенти) + Plan-агент,
`supabase/migrations/040_social_cms.sql` (Vault secret-патерн), план у
`C:\Users\Oleksandr\.claude\plans\06-08-2026-12-32-oleksandr-kuzmenko-prancy-gizmo.md`,
live dry-run `run-daily.ts` 2026-08-07
Last updated: 2026-08-07

---

## Навіщо

Під час weekly-редакційного перегляду власник підняв ширшу проблему: у проєкті є **три окремі,
майже дублюючі** реалізації ланцюжка Gemini→OpenRouter (daily-пайплайн, weekly-майстер,
social-адаптер) плюс четверта бліда копія в `card-image.ts`'s `runArtDirectorLadder`. Кожна має
свій набір env vars, свою логіку фолбеку.

Тригер: (1) прибрати безкоштовний Gemini з ротації — немає прийнятної преміум-моделі на free tier;
(2) власник хоче **самостійно**, без інженера й без деплою, підключати нових провайдерів, коли
з'являється акція з безкоштовним доступом до топових моделей (приклад: NVIDIA NIM —
https://build.nvidia.com/ — Kimi K3, DeepSeek V4, GLM 5.2 через OpenAI-сумісний ключ/URL); (3)
можливість додати CLI-підписки понад Claude Code CLI (названо: Codex CLI); (4) явна вимога —
те, що будується, має стати єдиним способом вибору LLM-провайдера для **всього проєкту**
(daily-новини, daily-дайджест, weekly-дайджест, соцмережі), не лише weekly-фічею.

## Ключові знахідки дослідження

(source: код-рев'ю читанням файлів нижче, live 2026-08-06 — не здогад)

- HTTP-запит `generateWithOpenRouterChain()` (`pipeline/openrouter-summarize.ts`/
  `openrouter-adaptive.ts`) — стандартний OpenAI-сумісний `chat/completions` JSON; працюватиме
  проти NVIDIA NIM (`https://integrate.api.nvidia.com/v1`) лише зі зміною base URL + ключа.
  OpenRouter-специфічне — лише 2 хардкоджені URL-рядки, 2 header'и-атрибуції (нешкідливі деінде)
  і поле `usage.cost` (деградує в `null`, не падає). (source: `pipeline/openrouter-summarize.ts`,
  `pipeline/openrouter-adaptive.ts`)
- Секрети нового провайдера в БД — **вже є готовий продакшн-патерн**:
  `store_social_oauth_secret`/`read_social_oauth_secret` (`040_social_cms.sql`) —
  `service_role`-only RPC через `vault.create_secret`/`vault.decrypted_secrets`; у таблиці
  лишається лише `secret_reference`. (source: `supabase/migrations/040_social_cms.sql`, перевірено
  читанням реального SQL)
- Каталог/ранжування моделей OpenRouter (`openrouter-models.ts`, `openrouter-value.ts`)
  прив'язані до власних полів OpenRouter (`pricing`, `benchmarks.artificial_analysis.*`) —
  для провайдера без такого каталогу (NIM має лише голий `/v1/models`) вибір моделі має бути
  **конфігурованим списком**, не живим ранжуванням. (source: `pipeline/openrouter-models.ts`,
  `pipeline/openrouter-value.ts`)
- Gemini йде через SDK (`@google/generative-ai`), не HTTP — завжди лишиться окремим клієнтом.
  (source: `pipeline/gemini-models.ts`, `pipeline/summarize.ts`)
- CLI-провайдери (Claude CLI, майбутній Codex CLI) — спільний скелет spawn можливий, але кожен
  новий CLI-інструмент все одно потребує реального коду (свої флаги, свій парсер виводу) — чесно
  НЕ «нуль коду», на відміну від HTTP-провайдерів. (source: `pipeline/claude-cli.ts`)

Повна архітектура (типи, БД-схема, admin UI, фазовий план 0–7) — у плані (шлях вище); тут —
лише статус виконання, щоб не дублювати.

## Статус

**Фаза 0 — виконано (2026-08-06).** Прибрано Gemini з дефолтної ротації:
- Weekly (`src/lib/weekly-digest/editorial-llm.ts`'s `providerOrder()`): дефолт
  `WEEKLY_MASTER_PROVIDER_ORDER` змінено з `claude-cli,openrouter,gemini` на `claude-cli,openrouter`.
- Social (`src/lib/social/llm-router.ts`'s `DEFAULT_PROVIDER_ORDER`): writer/critic обидва
  дефолтять на `['openrouter','ollama']` (було `gemini` першим для writer). Незалежність
  writer/critic від однакового провайдера й далі забезпечує `excludeProviders` у
  `generateSocialJson`, не порядок за замовчуванням.
- Daily: новий тимчасовий прапорець `DAILY_LLM_PRIMARY_PROVIDER` (`pipeline/config.ts` →
  `PipelineConfig.primaryTextProvider`), протягнутий через `pipeline/llm-json.ts`'s
  `generateJsonWithFallback`, `pipeline/summarize.ts`'s `runSummarizeFromPrompt`/`summarize`/
  `summarizeEditorPick`, `pipeline/verify.ts`'s `verifyClaims`/`reviseFlaggedItems`,
  `pipeline/auto-publish.ts`'s judge-виклик. Дефолт `'gemini'` — без зміни env, поведінка
  ідентична попередній. **Це свідомо тимчасова конструкція, видаляється у фазі 6**, коли daily
  переходить на повний реєстр.
- В усіх трьох випадках код Gemini-клієнта лишається — можна повернути явним env override.

Gemini код у `pipeline/gemini-models.ts`/`pipeline/summarize.ts`'s `generateWithModelQueue` не
чіпався — лишається special-cased клієнтом (SDK, не HTTP) за архітектурою плану.

**Фаза 1 — ядро реєстру виконано (2026-08-06).** Новий каталог `pipeline/providers/`:

- `types.ts` — спільний `ProviderCallResult`/`ProviderUsage`/`ProviderUnavailableError`.
- `http-provider.ts` — генеричний OpenAI-сумісний HTTP-адаптер, обгортка над
  `generateWithOpenRouterChain`; пресети `OPENROUTER_HTTP_DEFAULTS`/`NIM_HTTP_DEFAULTS`.
- `cli-provider.ts` — узагальнений spawn/timeout/ENOENT-скелет із `claude-cli.ts`. `claude-cli.ts`
  сам НЕ чіпався (свідоме рішення — нуль споживачів цього скелету поки що, немає сенсу ризикувати
  єдиним $0-шляхом weekly-майстра заради абстракції без другого користувача).
- `gemini-provider.ts` — тонка обгортка над `resolveGeminiModelQueue`/`generateWithModelQueue`.
- `registry.ts` — `ProviderRole` (10 ролей: daily×4, weekly×3, social×2, custom_research),
  `generateWithRegistry` (обхід ланцюга, fast-skip на `ProviderUnavailableError`,
  `RegistryExhaustedError` з повним логом спроб при повному провалі), `loadProviderRegistry`
  (env-only, async — резолвить реальну живу чергу OpenRouter-моделей, а не порожній масив;
  `db`-параметр зарезервовано під Фазу 1b).

Адитивні параметри (`requestConfig`/`baseUrl`) додані в `openrouter-summarize.ts`/
`openrouter-adaptive.ts` з дефолтами, що відтворюють поточну поведінку OpenRouter 1-в-1 —
жоден існуючий виклик не змінено.

**Живий dry-run проти реального NVIDIA NIM API (2026-08-06) знайшов і виправив 2 реальні
баги:**

1. `buildChatBody()` (`openrouter-summarize.ts`) і **окремо** `streamOpenRouterCompletion()`
   (`openrouter-adaptive.ts`) **обидва** незалежно хардкодили `usage: { include: true }` —
   OpenRouter-специфічне поле. NIM валідує тіло запиту суворо і повертає HTTP 400
   `"Unsupported parameter(s): 'usage'"` для будь-якого провайдера без цього поля — це НЕ
   тихий no-op, як припускав план на етапі дослідження (`usage.cost` у ВІДПОВІДІ справді
   деградує в `null` без падіння; але поле в ЗАПИТІ, яке провокує цю відповідь, суворі
   провайдери відхиляють). Виправлено: `http-provider.ts` передає `extraBodyForModel: () =>
   ({usage: undefined})` коли `reportsCost: false` (spread у `buildChatBody` перекриває
   дефолт, `JSON.stringify` прибирає ключ з `undefined`-значенням); і другий, незалежний
   хардкод у `streamOpenRouterCompletion` видалено повністю (`body` вже несе правильне
   `usage`-поле від `buildChatBody`, повторний оверрайд там був зайвим і шкідливим).
2. `moonshotai/kimi-k2.6` дав HTTP 404 (модель не активована на конкретному NVIDIA-акаунті) —
   не баг коду, обліковий нюанс.

Після фіксу: **`deepseek-ai/deepseek-v4-pro` через NIM успішно повернув валідний JSON за
86.9с**, підтверджуючи головну тезу дослідження — `generateWithOpenRouterChain`'s HTTP-шар
дійсно generic OpenAI-сумісний і працює проти зовсім іншого провайдера лише зі зміною
base URL + ключа. Регресійні тести додані (`http-provider.test.ts`: перевіряють, що
`usage`-поле дійсно відсутнє в запиті для `reportsCost: false`).

Нове покриття: 30 тестів на `pipeline/providers/*` (типи не тестуються окремо — вони
tested-by-use в інших файлах), раніше — 0.

**Фаза 1b — БД + admin UI виконано (2026-08-06).**

- Нова міграція `supabase/migrations/20260806160000_llm_provider_registry.sql` (**авторська,
  НЕ застосована до живої БД** — застосування через `supabase db push`/деплой окремо): три
  таблиці — `llm_providers` (id/kind/enabled/base_url/secret_reference/extra_headers/
  reports_cost/binary_name/auth_env_var/notes), `llm_provider_models` (provider_id/model_id/
  rank/enabled), `llm_role_chains` (role/chain jsonb). RLS — той самий admin-read + AAL2-write
  патерн, що й у решті social-cms таблиць (`040_social_cms.sql`). Дві нові Vault RPC —
  `store_llm_provider_secret`/`read_llm_provider_secret`, змодельовані 1-в-1 на
  `store_social_oauth_secret`/`read_social_oauth_secret`: `service_role`-only, ключ ніколи не
  лежить у звичайній колонці, лише `secret_reference`.
- Нова сторінка `/admin/providers` (`src/app/admin/(cms)/providers/page.tsx` +
  `actions.ts`): додати/редагувати/видалити провайдера, вставити API-ключ (write-only поле,
  вимагає AAL2, ніколи не повертається в браузер), редагувати список моделей і ланцюжок
  провайдерів для кожної з 10 ролей (`kind:id` по рядку). Посилання в `admin-nav.tsx`.
  UI чесно попереджає: CLI-провайдери (Claude Code, Codex) все одно потребують env var у
  Vercel/GitHub secrets заздалегідь — рядок у БД керує лише порядком/увімкненням, не
  встановленням бінарника.
- `pipeline/providers/registry.ts`'s `loadProviderRegistry` тепер реально читає `db`-параметр
  (у Фазі 1 був зарезервованим і невикористаним): `resolveDbProvider` резолвить `http`-рядки
  (читає секрет через `read_llm_provider_secret`, пропускає якщо секрету ще нема) і
  `gemini`-рядки (env `GEMINI_API_KEY`) повністю; `cli`-рядки — лише якщо CLI-інструмент
  зареєстрований у `KNOWN_CLI_PROVIDERS` (поки що порожній список — `claude-cli.ts` не
  рефакторено на `cli-provider.ts`'s форму, бо другого споживача ще нема), інакше пропускається
  з `logEvent('warn', ...)`, а не тихо ламається. Пріоритет вирішення ланцюжка для ролі:
  `roleOverrides[role] ?? dbChains?.get(role) ?? defaultChain` (явний виклик коду > збережено в
  БД > вбудований env-only дефолт).
- Тести: 19 нових у `registry.test.ts` (позитивна/негативна резолюція http/gemini,
  unregistered-CLI-skip, три-рівнева черговість `roleOverrides > db > default`), плюс фікс
  leak-стану моків (`vi.mock()` без `afterEach`-скидання давав хибні pass/fail між тестами) у
  `http-provider.test.ts` і `registry.test.ts`. Повний прогін: 910/910 тестів,
  `tsc --noEmit` чисто, `eslint` чисто, `npm run build` успішний (`/admin/providers` — новий
  маршрут у білді).
- Нічого в проєкті ще не читає реєстр для реального виклику LLM (це й далі робить Фази 2–6) —
  admin-сторінка на цьому етапі безпечна для експериментів, порожні таблиці = поточна
  поведінка без змін.

**Фаза 2 — `card-image.ts`'s art-director ladder мігровано (2026-08-06).**

- `runArtDirectorLadder()` (`pipeline/card-image.ts`) — раніше хардкоджений Gemini SDK-виклик
  (`GoogleGenerativeAI`) + сирий `fetch` на `~openai/gpt-mini-latest` через OpenRouter — тепер
  викликає `generateWithRegistry(role, instruction, registry)`, де `role` —
  `daily.card_image_scene` (`sceneBrief`) або `weekly.card_image_scene`
  (`weeklyReportageSceneBrief`). Обидві ці ролі вже існували в `PROVIDER_ROLES` з Фази 1.
  `GoogleGenerativeAI`/`resolveGeminiModelQueue` імпорти прибрано з файлу — тепер живуть лише
  всередині `gemini-provider.ts`.
- `CardImageConfig` отримав два нових опційних поля: `db?: PipelineDb` (дозволяє
  БД-керованим ланцюжкам з Фази 1b перекрити дефолт для цих двох ролей) і
  `registry?: ProviderRegistry` (готовий реєстр — уникає повторного резолву).
- **Продуктивність:** `resolveOpenRouterModelQueue` (жива черга з каталогу) робить реальний
  HTTP-запит без кешування. `fillCardImages` (daily, до `MAX_PER_RUN=12` айтемів за прогін)
  резолвить реєстр **один раз на весь батч** і повторно використовує його для кожного айтема —
  без цього кожен айтем окремо бив би живий каталог OpenRouter. `generateWeeklyReportageIllustrations`
  (weekly) викликає ladder лише раз на джобу — batching там не потрібен.
- **Свідомий компроміс:** стара реалізація на OpenRouter-фолбеку хардкодила дешеву модель-псевдонім
  (`~openai/gpt-mini-latest`) саме для цього дешевого «опиши сцену» виклику. Новий шлях іде через
  `loadProviderRegistry`'s спільний `defaultChain`, який використовує той самий
  benchmark-ранжований каталог, що й усі інші ролі (потенційно дорожча модель на OpenRouter-фолбеку).
  Свідомо НЕ компенсовано через `roleOverrides` — `roleOverrides` в `loadProviderRegistry`
  має пріоритет НАД БД-ланцюжком (`roleOverrides > db > default`), тож жорстке зашивання дешевої
  моделі тут назавжди заблокувало б власника від керування цією роллю через `/admin/providers` —
  а це якраз ціль усього реєстру. Оскільки Gemini зазвичай сконфігурований у проді, цей
  OpenRouter-фолбек — рідкісний шлях (Gemini rate-limit/збій); вартість прийнятна за уніфікацію.
- `SceneBriefResult.source` (`SceneSource`) розширено з фіксованого `'gemini' | 'openrouter' |
  'fallback' | 'owner'` до `string` — тепер може бути будь-який provider id з реєстру (напр.
  `'nim'`, якщо власник додасть NIM у ланцюжок цієї ролі через адмінку). UI вже рендерив це як
  довільний рядок (`weekly-workspace.tsx`), зміна типу не торкається жодного споживача.
- Тести: 4 нових у `card-image.test.ts` (registry reuse пропускає `loadProviderRegistry`;
  правильні env-ключі/`db` передаються при побудові; повний успішний шлях через
  registry → CLI-адаптер зі stub `spawnFn` → `source`/`scene` заповнюються коректно; weekly-роль
  передається правильно) — існуючі 29 тестів пройшли без жодної зміни (порожні/falsy ключі →
  порожній ланцюжок → `RegistryExhaustedError` → та сама поведінка фолбеку, що й раніше).
  914/914 тестів, `tsc`/`eslint`/build чисті.

**Фаза 3 — `custom-research.ts` мігровано (2026-08-06).**

- `researchCustomStory()` — раніше окремий `new GoogleGenerativeAI(apiKey)`-виклик через
  `createResearchGenerate()` + `generateWithModelQueue`, без жодного реального OpenRouter-фолбеку
  (поле `openRouterApiKey` в опціях існувало, але ніде не використовувалось — **реальний,
  раніше неозвучений баг**, знайдений під час читання коду для цієї фази). Тепер —
  `generateWithRegistry('custom_research', prompt, registry, {validateResponse})`, роль
  `custom_research` вже існувала в `PROVIDER_ROLES` з Фази 1.
- **Gemini structured-output задача:** ця роль вимагає власну `RESEARCH_SCHEMA`
  (Gemini-native `responseSchema`), яку реєстрова `dispatch()`-гілка для `gemini` не приймає як
  per-call параметр (тільки CLI-провайдери отримують `options.jsonSchema`). Рішення — новий
  експортований `withResearchSchema(registry)`: обгортка, яка патчить `RESEARCH_SCHEMA` лише на
  `gemini`-записи чорги ролі `custom_research`, хоч би звідки вони прийшли (env-дефолт чи
  БД-ланцюжок з `/admin/providers`) — DB/env-резолюція лишається незайманою, тільки-scheme-injected
  для gemini. OpenRouter/CLI-записи в тому ж ланцюжку не чіпаються — вони й так отримують
  «Return JSON only» текстову інструкцію з `buildResearchPrompt` і перевіряються через
  `validateResearchJson` (легкий валідатор — прогін через `parseResearchResult`, що просуває
  ланцюжок до наступного провайдера при невалідній формі).
- `pipeline/custom-news.ts`'s `runCustomNews` тепер будує `db` (дешево, без I/O) ДО виклику
  research (раніше — тільки після dry-run-гілки), щоб БД-ланцюжок для `custom_research` теж
  спрацьовував навіть у dry-run режимі.
- Поведінка Gemini-черги не змінилась (стара і нова реалізація однаково використовували
  `resolveGeminiModelQueue` без env-оверрайду — breadth 5, 2 спроби на модель).
- Тести: 2 нових для `withResearchSchema` (патчить лише gemini-записи для `custom_research`,
  не протікає в інші ролі); `researchCustomStory` сам лишається поза юніт-покриттям
  (`/* v8 ignore start -- Gemini integration */`, як і раніше — жодних нових вимог до
  live-верифікації цієї фази). 916/916 тестів, `tsc`/`eslint`/build чисті.

**Фаза 4 — weekly-майстер (`editorial-llm.ts`) мігровано (2026-08-06), навмисно ЧАСТКОВО.**

Це найскладніший і найризикованіший файл із досі мігрованих — власна value-ранжована модель-
селекція для OpenRouter (`premiumOpenRouterModels`, врахований токен-профіль 12k/20k, поріг
якості `WEEKLY_MASTER_MIN_QUALITY_INDEX`), критик-незалежність через vendor-exclusion
(`excludeVendors`), і той факт, що ОДИН і той самий провайдер навмисно перевикористовується
через write→translate→revise (не заново обирається щоразу). Пряме заміщення на generic
`generateWithRegistry`-обхід ланцюжка зламало б цю бізнес-логіку. Тому:

- **Мігровано:** транспортний шар OpenRouter-кроку — `generateWithOpenRouterChain` (прямий
  виклик) замінено на `generateWithHttpProviderChain` (`pipeline/providers/http-provider.ts`,
  Фаза 1) через новий `OPENROUTER_HTTP_DEFAULTS`-пресет — той самий request/response контракт,
  доведений живим NIM-тестом у Фазі 1, тепер спільний з рештою реєстру. Value-ранжування моделей
  (`premiumOpenRouterModels`) лишилось незайманим — воно й далі формує `modelQueue`, просто
  передає його в generic-адаптер замість прямого виклику.
- **Нова можливість:** новий `resolveWeeklyDbHttpProvider(role, db)` перевіряє БД-ланцюжок ролі
  (`weekly.master_writer`/`weekly.master_critic`) на `http`-запис ПЕРЕД тим, як впасти на
  дефолтний value-ранжований шлях. Якщо власник додав провайдера (напр. NIM) через
  `/admin/providers` для однієї з цих ролей — саме він обслуговує виклик, з власним
  сконфігурованим списком моделей (без value-ранжування — для каталог-less провайдера воно й
  неможливе, той самий висновок, що й у Фазі 1). Якщо нічого не сконфігуровано — поведінка
  100% ідентична попередній.
- **Свідомо НЕ мігровано:** Gemini-крок (`generateGemini`) — лишається прямим SDK-викликом.
  Причина: він єдиною генеричною функцією обслуговує ТРИ різні JSON-форми (`parseEnglishPackage`/
  `parseArticle`/`parseCritic`) без native `responseSchema` (лише `responseMimeType:
  'application/json'` + постфактум-валідація парсером) — `generateWithGemini`-адаптер з Фази 1,
  навпаки, дефолтить на `GEMINI_SCHEMA` (daily-brief-схема) коли `cfg.schema` не задано, що було б
  прямим регресійним багом тут. Побудова трьох окремих Gemini-схем для weekly — поза обсягом цієї
  фази. Claude CLI-крок (`generateClaudeCli`) — лишається на `pipeline/claude-cli.ts`, узгоджено з
  рішенням Фази 1 не чіпати цей файл (немає другого споживача `cli-provider.ts`'s скелету, weekly
  лишається його єдиним $0-шляхом).
- Ролі `weekly.master_writer`/`weekly.master_critic` вже існували в `PROVIDER_ROLES` з Фази 1.
  `generateWeeklyMaster` отримав новий `options.db?: PipelineDb`; `generation-worker.ts` передає
  `getSupabaseAdmin()`.
- Тести: 2 нових (DB-override дійсно обходить value-ранжування і не викликає
  `fetchOpenRouterModels`; без `db` реєстр взагалі не чіпається). Усі 22 наявні тести пройшли БЕЗ
  ЗМІН — важливий сигнал: вони мокають `generateWithOpenRouterChain` на рівні
  `openrouter-summarize.ts`, а `generateWithHttpProviderChain` викликає ту саму функцію на рівень
  глибше — той самий мок прозоро перехоплює новий шлях, підтверджуючи побайтову ідентичність
  запиту. 918/918 тестів, `tsc`/`eslint`/build чисті.
- **Живої shadow-верифікації (план це передбачав) для цієї фази НЕ проведено** — свідомо, з двох
  причин: (1) дефолтний шлях фактично успадковує живу верифікацію Фази 1 (та сама
  `http-provider.ts`-обгортка, доведена live проти NIM, тепер лише викликається з іншого файлу);
  (2) нову БД-override можливість неможливо живо перевірити зараз — міграція `llm_role_chains`
  свідомо НЕ застосована до прод-БД (авторський артефакт, той самий підхід, що й у Фазі 1b).
  Перша реальна live-перевірка цього шляху відбудеться природно, коли власник і застосує міграцію,
  і реально додасть перший HTTP-провайдер через `/admin/providers`.

**Фаза 5 — social writer/critic (`llm-router.ts`) мігровано (2026-08-06), той самий частковий
підхід, що й Фаза 4.**

- **Мігровано:** `generateOpenRouter()`'s транспорт — `generateWithOpenRouterChain` (прямий
  виклик) замінено на `generateWithHttpProviderChain` через `OPENROUTER_HTTP_DEFAULTS`.
  Власне ранжування моделей (`rankSocialOpenRouterModels`, provider-diverse — один сімейний
  представник на family, freshness-вікно) лишилось незайманим.
- **Нова можливість:** `resolveSocialDbHttpProvider(role, db)` перевіряє БД-ланцюжок ролі
  (`social.writer`/`social.critic` — обидві вже існували в `PROVIDER_ROLES` з Фази 1) на
  `http`-запис перед дефолтним value-ранжованим шляхом. Той самий патерн, що й Фаза 4.
- **Свідомо НЕ мігровано:** `generateGemini` (пряма Gemini-SDK-логіка з per-role
  `GEMINI_SCHEMAS`/env-оверрайдами моделі/max-attempts — на відміну від weekly, тут ролі мають
  власні коректні схеми, але env-специфічні нюанси (`SOCIAL_WRITER_GEMINI_MODEL`,
  `SOCIAL_GEMINI_MAX_MODEL_ATTEMPTS`, critic's "уникати lite" фільтр) все одно не покриваються
  generic `generateWithGemini`-адаптером без ризику зміни поведінки) і `generateOllama`
  (локальний self-hosted сервер із власною loopback/HTTPS-security перевіркою
  (`safeOllamaBaseUrl`) — за межами того, що registry's `http-provider.ts` взагалі покликаний
  обслуговувати).
- `generateSocialJson` отримав новий `options.db?: PipelineDb`. Протягнуто через усі реальні
  продакшн-виклики (`attachCriticReport` у `src/lib/social/critic.ts` — 2 виклики:
  `src/lib/social/composer.ts`, `src/app/admin/actions.ts`; `adaptWeeklySocialChannel` у
  `src/lib/weekly-digest/social-adapter.ts` — виклик з `generation-worker.ts`; і прямий
  `generateSocialJson('writer', ...)` у `src/app/admin/actions.ts`'s ручному regenerate-екшені)
  — усюди `getSupabaseAdmin()`, вже дешевий кешований синглтон у цих файлах.
- **Важлива відмінність від тестів Фаз 1-4:** `llm-router.test.ts` НІКОЛИ не викликав реальний
  `generateOpenRouter` — усі наявні тести підміняють його через `deps.generators` injection,
  тож (на відміну від card-image/custom-research/editorial-llm, де існуючі тести прозоро
  перехопили новий шлях) міграція транспорту тут не мала жодного наявного захисту тестів.
  Додано 2 нових тести, що вперше реально викликають `generateOpenRouter` (без injection):
  дефолтний value-ранжований шлях і БД-override шлях.
- Усі 14 наявних + нових тестів пройшли. 920/920 тестів у проєкті, `tsc`/`eslint`/build чисті.
- Той самий чесний застережний коментар, що й у Фазі 4: живої shadow-верифікації не проведено
  (та сама причина — БД-шлях фізично не перевірити, доки міграція не застосована до прод-БД;
  дефолтний шлях успадковує живу верифікацію `http-provider.ts` з Фази 1).

**Фаза 6a — daily `verify.ts` + `summarize.ts` мігровано (2026-08-06/07), верифіковано ЖИВИМ
прогоном `run-daily.ts --dry-run`.**

- `pipeline/llm-json.ts`'s `generateJsonWithFallback()` (спільний Gemini→OpenRouter шар для
  `verify.ts`, і досі й для `auto-publish.ts`) отримав два нових опційних параметри —
  `role?: ProviderRole` і `db?: PipelineDb`. Коли `role` передано — виклик іде через
  `generateWithRegistry(role, ...)`, з новою `withJsonSchema()`-обгорткою (той самий патерн,
  що й `custom-research.ts`'s `withResearchSchema`, потрібен бо роль `daily.verify`
  використовується ДВОМА різними викликами з різними схемами — `VERIFY_SCHEMA` і
  `GEMINI_SCHEMA`). Коли `role` не передано (поки що `auto-publish.ts` — Фаза 6b) — стара
  `primaryProvider`-логіка лишається побайтово незмінною.
- **Реальна, свідома зміна поведінки:** реєстровий шлях використовує ВЛАСНИЙ дефолтний порядок
  ланцюжка (`loadProviderRegistry`'s `defaultChain` — OpenRouter першим, Gemini другим,
  узгоджено з рештою проєкту з Фази 0), а НЕ старий `primaryProvider`-прапорець (типово
  `'gemini'`). Це саме те, що коментар цієї «тимчасової заглушки» в коді обіцяв від самого
  початку («deleted once that migration reaches the daily lane») — `verify.ts` тепер справді
  йде на OpenRouter першим, не Gemini.
- `verify.ts`'s `verifyClaims`/`reviseFlaggedItems` отримали `role?`/`db?`, обидва завжди
  передають `'daily.verify'` з `run-daily.ts` (усі 3 виклики: перевірка, revise, повторна
  перевірка після revise).
- `summarize.ts`'s `runSummarizeFromPrompt` — **інша конструкція, свідомо**: пряме
  `import` з `pipeline/providers/registry.ts` сюди створило б циклічну залежність
  (`summarize.ts` → `registry.ts` → `gemini-provider.ts` → `summarize.ts`, бо
  `gemini-provider.ts` вже імпортує `generateWithModelQueue` звідси). Тому транспорт
  OpenRouter-плеча замінено на `generateWithHttpProviderChain` (імпорт лише з
  `http-provider.ts`, без циклу), а БД-override резолвиться ЗАКЛИЧНИКОМ
  (`run-daily.ts`/`custom-news.ts`, де імпорт з `registry.ts` безпечний) і передається як
  готовий `dbHttpOverride?: HttpProviderConfig | null` параметр. Gemini-плече незаймане.
  `primaryProvider`-прапорець тут НЕ прибрано (типово `'gemini'` лишається дефолтом
  gemini-first для summarize — асиметрія з verify.ts, задокументована свідомо: обидва файли
  тепер мають DB-override, але порядок дефолту різний через архітектурне обмеження, не забаганку).
- **Живо верифіковано (2026-08-07):** `npx tsx --env-file=.env.local pipeline/run-daily.ts
  --dry-run` — повний реальний прогін: fetch (214 статей) → rank → enrich → summarize (Gemini
  503/429 retry-ланцюжок відпрацював коректно, зрештою `gemini-3.5-flash-lite` встиг) → verify
  (реальний виклик через новий реєстровий шлях, живий `deepseek/deepseek-v4-pro` через
  OpenRouter відповів за ~36с) → валідний 3-айтемний бриф надруковано. Сильніша верифікація,
  ніж у Фаз 4/5 (там дефолтний шлях лише успадковував Фазу 1; тут дефолтний шлях самого Phase 6a
  протестовано наживо end-to-end).
- Тести: `pipeline/llm-json.test.ts` (новий файл, 4 тести — `withJsonSchema` + dispatch-wiring
  на мокнутому реєстрі); `summarize.test.ts` +3 тести для `llmUsageFromProviderUsage`. 927/927
  тестів у проєкті, `tsc`/`eslint`/build чисті.

**Фаза 6b — daily `auto-publish.ts` (суддя) мігровано (2026-08-07). Daily-смуга закрита
повністю.**

- `processDraft`'s judge-виклик тепер іде через `generateJsonWithFallback` з роллю
  `daily.auto_publish_judge` (роль існувала в `PROVIDER_ROLES` з Фази 1) і `db` — тобто
  БД-ланцюжок з `/admin/providers` перекриває дефолт і для судді теж.
- **`pipeline/llm-json.ts` став registry-only.** Після 6b жоден виклик не лишився на старому
  шляху, тож мертву `primaryProvider`-гілку (Gemini→OpenRouter вручну) видалено разом із
  параметром — рівно те, що обіцяв її власний коментар («deleted once that migration reaches
  the daily lane»). Сигнатура з 9 позиційних параметрів перероблена на об'єкт опцій
  (`JsonRoleCallOptions`), `role` тепер обов'язковий. `verify.ts`'s `verifyClaims`/
  `reviseFlaggedItems` втратили параметри `primaryProvider`/`role` (роль там може бути лише
  `daily.verify` — зашито в самі функції), `run-daily.ts` спрощено в трьох викликах.
  `PipelineConfig.primaryTextProvider`/`DAILY_LLM_PRIMARY_PROVIDER` **лишаються** — вони й далі
  керують `summarize.ts`, єдиним daily-викликом, який фізично не може імпортувати реєстр
  (циклічна залежність, Фаза 6a).
- **Батчинг реєстру (та сама проблема, що у Фазі 2).** `auto-publish` за один прогін обходить
  усі чернетки за 7-денне вікно; кожен `loadProviderRegistry` — живий HTTP до каталогу
  OpenRouter плюс три читання `llm_*`-таблиць, без кешу. Новий `createRegistryLoader` резолвить
  реєстр **один раз на весь sweep** і мемоїзує в тому числі *відмову* (збій каталогу/Supabase
  оплачується раз, а не на кожну чернетку). Лінивий — прогін, де всі чернетки вже повністю
  відрев'ю'єні (суддя не потрібен), взагалі не чіпає мережу заради реєстру.
- **Полагоджено регресію Фази 6a:** `geminiMaxAttempts` (run-daily розширює бюджет спроб до 3
  на останньому слоті доби — `geminiMaxAttemptsForSlot`) при переході на реєстр тихо губився,
  фіксуючи всі виклики на дефолті `gemini-provider.ts` (2). `withJsonSchema` перейменовано на
  `withGeminiCallConfig` і тепер несе на gemini-запис ланцюга і схему, і бюджет спроб.
- **Свідома зміна даних:** `reviewed_by`/`item_reviews.reviewer` тепер завжди
  `auto:{provider}:{model}` (напр. `auto:openrouter:deepseek/deepseek-v4-pro`); раніше
  Gemini-плече давало `auto:{model}` без імені провайдера. Обидва споживачі цього поля
  (`excludeAutoReviewer`, `loadReviewHistory`'s `not.like 'auto:%'`) дивляться лише на префікс
  `auto:` — не ламаються; історія стає точнішою (видно провайдера, не лише модель).
- **Fail-closed збережено без змін:** `RegistryExhaustedError` при повному провалі ланцюга ловить
  той самий `catch`, що й раніше — `judgeUnavailable = true`, pending-айтеми лишаються
  недоторканими (RLS ховає їх від публіки), раніше схвалене вручну публікується.
- Тести: `llm-json.test.ts` переписано під нову сигнатуру (+4: бюджет спроб на записі ланцюга,
  реюз готового реєстру, мемоізація успіху й відмови в `createRegistryLoader`; −1 тест старого
  `primaryProvider`-шляху, який більше не існує). 930/930 тестів, `tsc`/`eslint` чисті.
- **Умову плану «6b лише після ≥1 доби стабільної роботи 6a» не витримано** — 6a змержено в
  `main` 2026-08-07 (PR #190), 6b написано того ж дня на прохання власника. Отже реального
  прод-циклу 6a у ролі `daily.verify` ще не спостережено. Живого прогону `auto-publish` теж
  **не робив** — на відміну від `run-daily --dry-run`, цей скрипт у не-dry режимі реально
  публікує чернетки; `--dry-run` пропускає всі записи, але суддю викликає по-справжньому, тож
  це найдешевша реальна перевірка перед першим нічним прогоном (див. «Що лишається»).

**Фаза 7 (опційно Codex CLI) — не почато.**
(source: `pipeline/providers/*.ts`, `pipeline/llm-json.ts`, `pipeline/verify.ts`,
`pipeline/auto-publish.ts`,
`pipeline/summarize.ts`, `pipeline/run-daily.ts`, `pipeline/custom-news.ts`,
`pipeline/card-image.ts`, `pipeline/custom-research.ts`, `src/lib/weekly-digest/editorial-llm.ts`,
`src/lib/weekly-digest/generation-worker.ts`, `src/lib/social/llm-router.ts`,
`src/lib/social/critic.ts`, `src/lib/social/composer.ts`,
`src/lib/weekly-digest/social-adapter.ts`, `src/app/admin/actions.ts`,
`supabase/migrations/20260806160000_llm_provider_registry.sql`,
`src/app/admin/(cms)/providers/*.tsx`, `tmp/nim-http-provider-dryrun/run.ts`, live dry-run
2026-08-06/07)

**Пост-мерж ревʼю + фікси (2026-08-07).** Senior-рівневе технічне ревʼю PR #189/#190 після мержу
в `main` знайшло і виправило три поведінкові баги в `pipeline/providers/registry.ts`, підтверджені
тестами до і після фіксу:

- **Порожній DB-чейн затіняв робочий дефолт.** `loadDbRoleChains` записувала `resolved: []` у
  мапу навіть коли жоден рядок чейну не резолвився (відсутній секрет, disabled провайдер,
  незареєстрований CLI id) — а `chainForRole`'s `dbChains?.get(role) ?? defaultChain` вважає
  присутній (навіть порожній) запис у Map явним оверрайдом, що вигравав над `??`. Наслідок: одна
  недоналаштована роль в `/admin/providers` (наприклад, `nim` доданий у чейн, але ключ ще не
  вставлено) повністю вбивала роль, хоч OpenRouter/Gemini лишались живими. Фікс: порожній
  резолвлений чейн більше не записується в мапу — falls through на `defaultChain`, з
  `logEvent('warn', ...)` коли вихідний (непорожній) чейн так і не резолвився в жодного провайдера.
- **Збій каталогу OpenRouter валив побудову всього реєстру.** `resolveOpenRouterModelQueue` кидає
  на HTTP-помилці/порожньому списку/порожньому ранкінгу; `loadProviderRegistry` це не ловила —
  429/мережевий збій каталогу клав `loadProviderRegistry` цілком, навіть коли Gemini був живий.
  Той самий захист додано навколо `loadDbRoleChains` (мережевий збій Supabase). Обидва тепер
  логують і деградують до наявного дефолту замість кидати. Побічно: `run-daily.ts`'s
  `resolveDbHttpProvider('daily.summarize', db)` не мав `.catch()`, на відміну від сусідніх
  викликів — додано для узгодженості.
- **DB-override провайдер у weekly master (`editorial-llm.ts`) і social (`llm-router.ts`) не мав
  фолбеку.** Обидва Phase 4/5 «partial by design» шляхи резолвили лише перший `http`-запис
  DB-чейну і викликали його без try/catch — збій під час виклику валив увесь виклик замість
  падіння на звичайну ranked-OpenRouter драбину нижче (як уже робив `dbHttp === null`). Обидва
  тепер ловлять і логують, потім падають на дефолтний шлях.

Плюс дрібніші: `/admin/providers`'s копірайт більше не тверджує «нічого це не читає» (читає, з
Фази 2); `deleteLlmProviderAction` більше не лишає сирітський Vault-секрет
(`delete_llm_provider_secret`, нова міграція); `upsertLlmProviderAction`'s заміна списку моделей
атомарна (`replace_llm_provider_models`) і більше не губить disabled-моделі; Server Actions на
`/admin/providers` більше не кидають сирі `Error` (Next ковтає їх generic-дайджестом) — редіректять
на `?error=`, за патерном `redirectWeeklySocialError`. Деталі: `git log` на
`claude/tech-review-pr-189-190-859ena`.
(source: live review + fixes 2026-08-07, `pipeline/providers/registry.test.ts`,
`supabase/migrations/20260807120000_llm_provider_registry_fixes.sql`)

## Що лишається

1. Живий `npx tsx --env-file=.env.local pipeline/scripts/auto-publish.ts --dry-run` — суддя
   викликається по-справжньому, жодного запису в БД/Telegram. Не запускав: рішення власника.
2. Застосувати міграції реєстру (`20260806160000_llm_provider_registry.sql`,
   `20260807120000_llm_provider_registry_fixes.sql`) до прод-БД — доти БД-ланцюжки з
   `/admin/providers` фізично не діють у жодній фазі.
3. Фаза 7 (Codex CLI) — лише якщо власник справді хоче його в ротації.

(source: план `06-08-2026-12-32-…md` §«Порядок впровадження», статус фаз вище)

## Related pages

- [pipeline/weekly-digest](weekly-digest.md) — weekly-майстер, який фаза 4 мігрує на реєстр
- [pipeline/guide](guide.md) — daily-пайплайн, LLM-маршрутизація до цього рефакторингу
- [index](../index.md) — карта бази знань
