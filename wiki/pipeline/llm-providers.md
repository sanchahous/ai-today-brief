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

**Фаза 1b (БД + admin UI) і Фази 2–7 (міграція існуючих ланцюжків) — не почато.**
(source: `pipeline/providers/*.ts`, `tmp/nim-http-provider-dryrun/run.ts`, live dry-run
2026-08-06)

## Related pages

- [pipeline/weekly-digest](weekly-digest.md) — weekly-майстер, який фаза 4 мігрує на реєстр
- [pipeline/guide](guide.md) — daily-пайплайн, LLM-маршрутизація до цього рефакторингу
- [index](../index.md) — карта бази знань
