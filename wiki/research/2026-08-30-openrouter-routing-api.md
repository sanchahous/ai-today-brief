# OpenRouter routing API — що реально доступно

Summary: перевірений живими запитами перелік того, що API OpenRouter дає для вибору моделі й
провайдера (категорії, сортування, per-provider ціни, дисконти, кеш-тарифи, суфікси), і чому
сортування за дисконтом обирає дорожче. Окремо — безкоштовний ярус, який ми виключили
помилково, і рішення власника від 2026-08-30.
Sources: живі запити до `https://openrouter.ai/api/v1/*` 2026-08-30 (каталог 396 моделей),
живі тестові виклики `chat/completions` (сумарно $0.0000079), docs
`openrouter.ai/docs/features/model-routing` і `/provider-routing`, сторінка `openrouter.ai/models`,
owner session 2026-08-30
Last updated: 2026-08-30

---

## 1. Навіщо ця сторінка

Після [openrouter-spend-leak](../audits/2026-08-29-openrouter-spend-leak.md) власник планує
переписати принцип вибору моделі цілком. Ця сторінка фіксує **фактаж**, щоб проєктувати не з
пам'яті й не з порад, а з перевіреного API. Кожне твердження нижче перевірене запитом 2026-08-30.

⚠️ Дві порадні відповіді (Gemini), які розглядались, містили правильний напрямок, але хибні
деталі — вони розібрані в §6. Не використовувати їх як джерело без перевірки.

## 2. `GET /api/v1/models` — фільтри й сортування

**`?category=…`** — 12 валідних значень, кожне повертає ~19–20 моделей, ранжованих за
використанням у цій категорії. Невалідне значення → HTTP 400, тобто строгий enum.

```
programming · roleplay · marketing · marketing/seo · technology · science
translation · legal · finance · health · trivia · academia
```

**`?sort=…`** — повний enum витягнутий із Zod-помилки валідації (`?sort=zzz`):

```
most-popular · newest · top-weekly
pricing-low-to-high · pricing-high-to-low
context-high-to-low · throughput-high-to-low · latency-low-to-high
intelligence-high-to-low · coding-high-to-low · agentic-high-to-low
design-arena-elo-high-to-low
```

Три осі якості — `intelligence` / `coding` / `agentic` — збігаються **один-в-один** із
`QUALITY_AXIS` у `pipeline/providers/model-scoring.ts`. Тобто ранжування за якістю можна брати з
сервера замість власного обрахунку з `benchmarks`, яких у аліасів `~*-latest` немає взагалі.

**`?supported_parameters=structured_outputs`** → 297 з 396 моделей.

**Комбінування:** `category` + `sort` працює. `category` + `supported_parameters` → HTTP 400.

```
?category=marketing                                → deepseek-v4-flash-0731  $0.08/M
?category=marketing&sort=pricing-low-to-high       → amazon/nova-micro-v1    $0.05/M
?category=marketing&sort=intelligence-high-to-low  → anthropic/claude-opus-5 $7.00/M
```

**Чого в цьому ендпоінті НЕМАЄ:** поля `discount`, масиву `providers` (є лише `top_provider` —
один об'єкт), поля `cost_tier`. `category` у тілі відповіді існує, але це категорії бенчмарку
`design_arena` (webapps, dataviz, gamedev…), не ті, що у query-параметрі.

**Що в `pricing` є, а ми не читаємо:** `input_cache_read`, `input_cache_write` (235 моделей) і
`overrides` — ступінчаста ціна вище певної довжини промпту (51 модель, наприклад ×2 після
272k токенів). Наш `socialBlendedPricePerMillion` рахує лише `prompt` + `completion`.

## 3. `GET /api/v1/models/{author}/{slug}/endpoints` — тут живуть провайдери

Саме цей ендпоінт дає per-provider дані. Для `deepseek/deepseek-v4-flash` — 17 провайдерів.
Поля на кожному: `provider_name`, `pricing` (з `discount` і `input_cache_read`), `status`,
`uptime_last_5m` / `_30m` / `_1d`, `latency_last_30m`, `throughput_last_30m`,
`supports_implicit_caching`, `quantization`, `max_completion_tokens`, `supported_parameters`.

Розкид цін по одній моделі — до **6.5×**:

| Провайдер | prompt $/M | completion $/M | uptime 1d | implicit caching |
|---|---|---|---|---|
| DigitalOcean | 0.068 | 0.168 | 99.6% | ні |
| StreamLake | 0.080 | 0.160 | 98.6% | ні |
| Baidu | 0.080 | 0.160 | 100.0% | ні |
| Azure | 0.210 | 0.560 | 95.8% | **так** |
| Cloudflare | 0.440 | 1.320 | 100.0% | ні |

`uptime` / `latency` / `throughput` в тому ж payload означають, що вибір за ціною можна одразу
обмежувати аптаймом — це прямо закриває нотатку 2026-08-17 про DeepSeek-лінії, що не вкладались у
first-token budget.

## 4. Дисконт: поле є, але сортувати за ним не можна

`pricing.discount` існує **на endpoints-рівні** (частка, не відсоток: `0.43` = 43% off).
Сторінка `openrouter.ai/collections/discounted-models` віддає HTTP 200, бейджі «15% off» / «5% off»
на картках реальні.

**Але знижка вже врахована в ціні, яку віддає API.** Це підтверджується самим полем:

| Провайдер | prompt $/M | `discount` |
|---|---|---|
| DigitalOcean | **0.068** | 0 |
| StreamLake | 0.080 | 0.43 |
| Baidu | 0.080 | 0.429 |

Провайдер **без знижки дешевший** за двох із 43% знижки. Тобто відсоток знижки не каже нічого про
те, скільки буде заплачено.

По моделях із наших реальних черг ефект ще виразніший:

| Модель | Провайдерів | Зі знижкою | Найдешевший | Провайдер із макс. знижкою |
|---|---|---|---|---|
| `openai/gpt-5.4-mini` | 5 | **0** | OpenAI $0.375 | — |
| `openai/gpt-5.6-terra` | 7 | **0** | OpenAI $1.000 | — |
| `anthropic/claude-haiku-4.5` | 8 | **0** | Anthropic $1.000 | — |
| `deepseek/deepseek-v4-pro-0813` | 16 | 2 | DeepSeek **$0.660** @ 0% | StreamLake **$1.121** @ 15% |
| `qwen/qwen3.7-flash` | 1 | 0 | Alibaba $0.030 | — |

Два висновки: сортування за дисконтом на `deepseek-v4-pro-0813` обрало б **на 70% дорожче**; а на
first-party моделях (OpenAI/Anthropic) дисконтних провайдерів **немає взагалі**, тож дисконт-роутинг
там не робить нічого.

Правильний ключ — ціна, а не відсоток: він уже включає знижку.

## 5. Суфікси — перевірено живими викликами

Тестові виклики `deepseek/deepseek-v4-flash`, `max_tokens: 5`, сумарно $0.0000079:

| Запит | Провайдер | Вартість |
|---|---|---|
| без суфікса | Azure | $0.00000343 |
| `:floor` | DigitalOcean | **$0.00000108** (у 3.2× дешевше) |
| `:nitro` | Baidu | $0.00000168 |
| `:exacto` | StreamLake | $0.00000168 |

Усі три приймаються API. `:floor` = сорт провайдерів за ціною, `:nitro` = за throughput; сучасний
еквівалент — `provider.sort: "price" | "throughput" | "latency"`. `:exacto` в доках
model-routing/provider-routing не описаний, але запит із ним проходить — **призначення не
підтверджене** (needs verification). У каталозі як окремі записи існують лише суфікси `:free` і
`:batch`.

⚠️ Дефолтний роутинг обрав Azure — найдорожчого, але єдиного з `implicit_caching`. `:floor` веде на
DigitalOcean, де `input_cache_read` теж дешевший ($0.0168/M проти $0.031/M у Azure), але
implicit caching немає — кеш працюватиме лише з явними `cache_control`. Для цієї моделі DigitalOcean
виграє на будь-якому відсотку попадань, але **це треба рахувати по кожній моделі окремо**, не
приймати як загальне правило.

## 6. Auto Router — чому не для нас

`openrouter/auto` і `openrouter/auto-beta` існують. Механіка з опису моделі: «routes it to the most
popular model for that task based on aggregate spend». Керується `cost_tier` —
`low` / `medium` / `high` / `xhigh` / `max`.

Не підходить із трьох причин:

1. **`pricing: { "prompt": "-1", "completion": "-1" }`** — ціна невідома до виклику. Наша стеля
   (`socialBlendedPricePerMillion`) відхилить його автоматично за правилом «модель без
   опублікованої ціни виключається».
2. Вибір за **тим, на що витрачає спільнота** — це популярність, не наша якість і не наш бюджет.
   Рівно той механізм, що привів до Fable.
3. `cost_tier` — смуга, не долар. Це прямо конфліктує з `DAILY_GENERATION_BUDGET_USD=1`.

## 7. Хибні поради, які варто пам'ятати

Розібрані відповіді Gemini містили:

- ⚠️ «У відповіді `/api/v1/models` для кожної моделі приходить масив `providers`» — **хибно**.
  Там `top_provider` (один об'єкт). Per-provider дані — на `/endpoints`.
- ⚠️ «Парсити назви провайдерів на кшталт `"StreamLake 10% off"`» — **хибно**. Рядка `% off` у
  payload немає; `name` виглядає як `"StreamLake | deepseek/deepseek-v4-flash-20260423"`.
  Дисконт — числове поле `pricing.discount`.
- ⚠️ Контекст «Next.js 15 + Vercel AI SDK + Agent SDK / `ctx.numberOfTurns`» до цього репозиторію
  не стосується: тут Next.js 16, без Vercel AI SDK, і це батчевий конвеєр, а не чат із ходами.
- ✅ Правильно: `:floor`, `:nitro`, реальність `cost_tier`, відсутність окремого прапорця
  `discount: true` у запиті.

## 8. Пропозиція (НЕ ухвалено — чекає на обговорення)

Дворівневий вибір, обидва рівні з даних OpenRouter, рішення лишається за нами:

**Рівень 1 — модель.** `?category=<роль>&sort=<вісь>-high-to-low`, далі наша цінова стеля і
quality-floor клієнтськи. `marketing` для social, `technology` / `academia` для weekly.
Це викидає саморобні евристики — тири deepseek→qwen→інше, патерни `-pro`,
`DEFAULT_MODEL_PRIORITY` — і закриває діру з аліасами: у категорійному списку модель стоїть за
фактом використання, а не за збігом підрядка в id.

**Рівень 2 — провайдер.** `:floor` (або `provider.sort: "price"`) з відсіканням за
`uptime_last_1d` і врахуванням `supports_implicit_caching` / `input_cache_read`.

⚠️ Категорійні списки ранжовані за популярністю спільноти — той самий сигнал, що в Auto Router.
Різниця в тому, що ми його **фільтруємо**, а не підкоряємось. Цінова стеля має лишитись, інакше
повертаємось до вихідної проблеми.

**Відкриті питання:**

1. Чи зводити два ранкери (`rankSocialOpenRouterModels` і `rankModelsForRole`) в один?
2. Чи враховувати `input_cache_read` у стелі — зараз рахуємо лише `prompt`/`completion`, хоча
   кешування вже працює.
3. Чи безпечний `:floor` для social, де є дедлайни чекпоїнтів (нотатка 2026-08-17).
4. Що робити з `pricing.overrides` — 51 модель має ступінчасту ціну.

## 9. Безкоштовні моделі — ми їх виключили помилково

⚠️ **Стан рахунку на 2026-08-30:** `GET /api/v1/credits` → `total_credits: 50`,
`total_usage: 50.14`. Кошти **вичерпано**. Це не гіпотетичний сценарій — це поточний стан.
(source: живий `api/v1/credits` 2026-08-30)

### Що каже код зараз

Обидва фільтри викидають безкоштовні моделі повністю:

```ts
if (id.includes(':free')) return false;   // openrouter-models.ts + llm-router.ts
```

Обґрунтування в коментарі: «their rate limits are too aggressive for production use».

### Чому це обґрунтування хибне для нашого акаунта

Реальні ліміти free-моделей: **20 запитів/хв**, а денний ліміт залежить від того, скільки
кредитів колись куплено — 50/добу при покупках менше $10 і **1000/добу при $10+**.
У нас `is_free_tier: false` і куплено $50, тобто діє **1000/добу**.

Для порівняння: найгірший день (28.08) — 190 викликів, звичайний — 39. Тобто денний ліміт
у **5 разів вищий за наш найгірший день**. Обмеження 20/хв може заважати сплескам, але наші
виклики послідовні по каналах.
(source: docs `openrouter.ai/docs/api-reference/limits`; живий `api/v1/key` 2026-08-30)

### Що там реально є

21 безкоштовна модель у каталозі (18 із суфіксом `:free`), 12 із бенчмарком Artificial Analysis:

| Модель | AA intelligence | Контекст | JSON |
|---|---|---|---|
| `z-ai/glm-5.2:free` | **52.6** | 256k | так |
| `minimax/minimax-m3:free` | 45.4 | 1M | так |
| `thinkingmachines/inkling:free` | 42.3 | 1M | ні |
| `minimax/minimax-m2.7:free` | 38.9 | 196k | так |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 38.3 | 1M | ні |

Для порівняння — наші **платні** лінії: `openai/gpt-5.6-terra` AA 56.6,
`deepseek/deepseek-v4-flash` AA 42.1.

Тобто **безкоштовна `glm-5.2:free` (52.6) сильніша за нашу платну deepseek-лінію (42.1)** і
відстає від найкращої платної лише на 4 пункти. Платний варіант тієї ж моделі коштує
$1.19/$3.74 за мільйон.

Окремо: `nvidia/nemotron-3-ultra-550b-a55b:free` входить у **топ-5 моделей тижня** за обсягом
токенів на всьому OpenRouter — тобто безкоштовний рівень використовується в проді не лише нами.

### Висновок

Виключати `:free` цілком — помилка, і вона коштувала нам грошей. Правильна конструкція —
**окремий безкоштовний ярус у хвості черги**: платні лінії першими, безкоштовні як
аварійний резерв, коли кошти вичерпано або платні лінії недоступні. Ліміт 1000/добу це дозволяє.

⚠️ Обмеження, які треба врахувати: 20 запитів/хв; частина безкоштовних не підтримує JSON-вивід
(`inkling`, `nemotron-*-ultra`, `nemotron-3.5-lightning`) — для writer/critic вони не годяться;
9 із 21 не мають бенчмарку, тож quality-floor їх відсіє.

## 10. «Value leaders» — ми це вже маємо, але не там

Опис на сайті OpenRouter: «Benchmark performance per dollar. Scores come from the independent
Artificial Analysis benchmarks; price is each model's combined rate for input and output tokens,
weighted toward input to match typical usage. Only models scoring in the top half qualify.»

Це **майже дослівно** те, що робить `pipeline/providers/model-scoring.ts`: якість із
Artificial Analysis, ціна як зважений мікс input/output із перевагою input (`TOKEN_MIX`),
і поріг якості (`QUALITY_FLOOR`) замість «top half».

Тобто логіка value-leaders у проєкті вже написана — просто **social до неї не звертається**,
а аліаси `~*-latest` для неї не існують (немає бенчмарків). Рішення звести два ранкери в один
(§11) закриває саме це.

## 11. Рішення власника 2026-08-30

| Питання | Рішення |
|---|---|
| Звести два ранкери в один | **Так** — окремою роботою |
| Враховувати кеш-тарифи у ціновій стелі | **Так** — «спробуємо точно» |
| `:floor` для вибору провайдера | **Так**, з відсіканням за uptime |
| `pricing.overrides` (ступінчаста ціна) | **Потім**; поки лише попередження в лог |
| Безкоштовний ярус | **Додати** — окремим ярусом у хвості, не змішувати з платними |

Не ухвалено й лишається відкритим: точна форма безкоштовного ярусу (коли саме він вмикається —
за балансом, за помилкою платної лінії, чи обома), і чи потрібен окремий поріг якості для нього.

## Related pages

- [audits/2026-08-29-openrouter-spend-leak](../audits/2026-08-29-openrouter-spend-leak.md)
- [llm-providers](../pipeline/llm-providers.md)
- [now](../now.md)
