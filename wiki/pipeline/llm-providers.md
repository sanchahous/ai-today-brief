# LLM providers — уніфікований реєстр (у розробці)

Summary: план і статус переходу від трьох окремих Gemini→OpenRouter реалізацій (daily/weekly/social)
до одного спільного, власником-керованого реєстру провайдерів для всього проєкту.
Sources: owner session 2026-08-06, дослідження коду (Explore-агенти) + Plan-агент,
`supabase/migrations/040_social_cms.sql` (Vault secret-патерн), план у
`C:\Users\Oleksandr\.claude\plans\06-08-2026-12-32-oleksandr-kuzmenko-prancy-gizmo.md`
Last updated: 2026-08-06

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

**Фази 3–7 (міграція решти ланцюжків) — не почато.**
(source: `pipeline/providers/*.ts`, `pipeline/card-image.ts`,
`supabase/migrations/20260806160000_llm_provider_registry.sql`,
`src/app/admin/(cms)/providers/*.tsx`, `tmp/nim-http-provider-dryrun/run.ts`, live dry-run
2026-08-06)

## Related pages

- [pipeline/weekly-digest](weekly-digest.md) — weekly-майстер, який фаза 4 мігрує на реєстр
- [pipeline/guide](guide.md) — daily-пайплайн, LLM-маршрутизація до цього рефакторингу
- [index](../index.md) — карта бази знань
