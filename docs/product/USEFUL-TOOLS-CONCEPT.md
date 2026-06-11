# Розділ «AI Toolbox» (Useful Tools) — концепція

**Дата:** 2026-06-11 · **Статус:** концепція на затвердження
**Основа:** офіційний гайд [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5) (повністю опрацьований), стратегія сайту «brief-led product, authority-built architecture».

---

## 1. Чому це стратегічно сильний хід

Міні-тулзи — це **третя нога** контент-стратегії поруч із брифом (свіжість) і концепт-хабами (evergreen):

1. **SEO/AEO-магніти.** Запити «claude prompt optimizer», «llm cost calculator», «which claude model to use» — високоінтентні, а конкуренція серед *безкоштовних no-signup* тулзів слабка. Кожна тулза = окрема сторінка з `TechArticle`+`FAQPage` schema → кандидат на цитування в Perplexity/ChatGPT.
2. **Internal linking hub-and-spoke.** Тулзи лінкують на концепт-хаби (prompt-caching, agent, MCP) і статті; статті лінкують на тулзи («порахуй вартість цього релізу в калькуляторі»).
3. **Retention + бренд.** Тулза — причина повернутись на сайт без нової новини. «Корисний» бренд > «ще один дайджест».
4. **Нульова собівартість.** Всі тулзи першої хвилі — client-side або статичні дані; жодних обовʼязкових LLM-витрат.

## 2. Назва і місце

- **Маршрут:** `/[lang]/tools` + `/[lang]/tools/[slug]` (App Router, ISR).
- **Назва:** рекомендую **«AI Toolbox»** (EN) / **«Інструменти»** (UK). Альтернативи: Dev Tools (конфлікт із категорією tools у брифі), Useful Tools (блідо), Lab (незрозуміло). «AI Toolbox» коротко, брендується, тримає keyword.
- **Позиція в хедері:** після «Guides | Concepts» → «Toolbox».

## 3. Принципи розділу

1. **No signup, no paywall, миттєво.** Друкуєш — отримуєш. Це і UX, і AEO-перевага.
2. **Client-side first.** Поки можливо — нуль серверних витрат і нуль зловживань.
3. **Кожна тулза відповідає на конкретний пошуковий запит** (інакше не будуємо).
4. **Кожна тулза цитує первинні джерела** — це наш E-E-A-T-стиль (як verify-маркери на концептах).
5. **Дані тулз = контент-активи**: цінові таблиці калькулятора — це й майбутня living page «Ціни LLM API».

## 4. Роадмап тулзів (за value/effort)

| # | Тулза | Що робить | Чому виграє | Effort | Cost |
|---|---|---|---|---|---|
| 1 | **Prompt Optimizer for Claude** ⭐ | Лінтить промпт за офіційними гайдами, рекомендує модель/effort | Деталі в §5 — флагман | 2–3 дні | $0 |
| 2 | **LLM Token & Cost Calculator** | Текст/к-сть токенів → вартість по Claude/GPT/Gemini (input/output/cache) | «claude api cost calculator» — стабільний попит; дані = основа living page цін | 1–2 дні | $0 (static data + клієнт) |
| 3 | **CLAUDE.md / AGENTS.md Generator** | Форма (стек, правила, заборони) → готовий файл | Ніша наша до кісток, конкуренції майже нема, лінкує на concept-хаби | 1–2 дні | $0 |
| 4 | **Model Picker** | 5 питань → рекомендація моделі + effort + чому | AEO: «which claude model should i use»; легко цитується | 1 день | $0 (decision tree) |
| 5 | **MCP Config Generator** | Чекбокси серверів → готовий `mcp.json` під Claude Desktop/Code/Cursor | Синергія з запланованим каталогом MCP-серверів (Фаза 3) | 2 дні | $0 |
| 6 | **AI Crawler Checker** | URL → який AI-бот допущений/заблокований у robots.txt (GPTBot, ClaudeBot, PerplexityBot…) | Гаряча тема паблішерів; в нас уже є експертиза (свій robots) | 1 день | ~$0 (route handler) |
| 7 | **Prompt Token Counter** | Підрахунок токенів + скільки лишиться контексту в моделі X | Доповнення до №2, спільний код | 0.5 дня | $0 |

Перша хвиля: **№1 → №2 → №3.** Решта — по одній на ітерацію, кожна з власною FAQ-секцією.

## 5. Флагман: Prompt Optimizer for Claude (Fable 5)

### Позиціонування

«Встав промпт — отримай конкретні поліпшення за **офіційним гайдом Anthropic**, рекомендацію моделі й готові перевірені сніпети». Відмінність від конкурентів:
- Anthropic Console prompt improver — потребує консоль/API-ключ; наш — без порога входу.
- PromptPerfect та інші — платні, generic, не знають специфіки Fable 5.
- Ми — **model-specific, безкоштовно, з цитатами на доки** (AEO-доказовість) і вбудовано в медіа про AI-інженерію.

### Архітектура: дві фази

**Фаза A — детермінований Prompt Linter (запускаємо першою, $0, миттєво, client-side).**
Чиста логіка `src/lib/prompt-lint.ts` (юніт-тести ≥80%) + сторінка. Правила з опрацьованого гайда Fable 5 + загального канону Claude:

| Правило | Тригер | Рекомендація (з джерелом) |
|---|---|---|
| Структура | Довгий промпт без секцій/XML-тегів | Розбити на `<context>` / `<task>` / `<output_format>` |
| Формат виводу | Нема вказівки формату | Додати очікуваний формат/схему відповіді |
| Vague-кваліфікатори | "better", "professional", "good", "якісно" без критеріїв | Замінити вимірюваними критеріями |
| Контекст/намір | Нема «чому/для кого» | Патерн з гайда: «I'm working on [X] for [Y]. They need [Z]. With that in mind: [request]» |
| ⚠️ **Reasoning-echo (Fable-специфічне)** | «show your reasoning», «explain your thinking in the response», «розпиши хід думок» | На Fable 5 тригерить `reasoning_extraction` refusal → читати thinking-блоки adaptive thinking замість цього |
| **Over-prescription (Fable-специфічне)** | Простиня з 20+ мікроінструкцій | Fable сильний в instruction following — «коротка інструкція замість енумерації»; старі over-prescriptive промпти **деградують** якість |
| Агентний без меж | Детект агентної лексики (tools, autonomously, until done) без boundaries | Запропонувати офіційні сніпети (нижче) |
| Effort-підказка | Оцінка складності задачі | Рутина → `medium/low`; складна довга → `high`; capability-critical → `xhigh` |
| Гігієна | Caps lock, ввічливі філери, без абзаців | Прибрати шум |

**Кілер-фіча — бібліотека офіційних сніпетів** (кнопка «вставити в промпт»), прямо з гайда Fable 5:
- *Anti-overplanning*: «When you have enough information to act, act…»
- *Anti-overengineering*: «Don't add features, refactor, or introduce abstractions beyond what the task requires…»
- *Brevity*: «Lead with the outcome…»
- *Checkpoint*: «Pause for the user only when the work genuinely requires them…»
- *Grounded progress*: «Before reporting progress, audit each claim against a tool result…»
- *Autonomy*: «You are operating autonomously…»
- *Boundaries*: «When the user is describing a problem… the deliverable is your assessment»

Вивід лінтера: список карток (севериті ✦ рекомендація ✦ цитата-лінк на доки) + «prompt health score» + кнопка copy поліпшеного скелета. **Все на клієнті — нуль витрат, нуль абʼюзу, миттєвий результат.**

**Рекомендація моделі (rule-based, частина Фази A):**
- коротка/рутинна задача → Haiku 4.5 (дешево/швидко);
- баланс ціна/якість, інтерактив → Sonnet 4.6;
- складна, довга, агентна, end-to-end → **Fable 5** + підказка effort;
- застереження: offensive-security/bio-суміжні запити на Fable можуть ловити refusal → fallback Opus 4.8 (так у доках).

**Фаза B — LLM-переписування (після валідації трафіку Фази A).**
- **B1: BYOK** (bring your own key) — користувач вставляє свій Anthropic-ключ, виклик прямо з браузера (`anthropic-dangerous-direct-browser-access`), ключ не покидає клієнт. $0 для нас, чесний UX для девів (наша аудиторія ключі має).
- **B2: серверний gated-режим** — route handler + Haiku 4.5, rate-limit по IP (~3/день), денний токен-бюджет з kill-switch. Вмикаємо тільки якщо B1 покаже попит. Бюджет ≈ $5–15/міс на старті.

### SEO/AEO-обвʼязка сторінки

- H1 «Free Prompt Optimizer for Claude (Fable 5)» + визначення в перших 300 словах.
- FAQ-блок: «How do I prompt Claude Fable 5?», «What is effort in the Claude API?», «Why does Claude refuse to show its reasoning?» → FAQPage schema.
- Лінки: концепти (agent, prompt-caching, claude-code), статті по тегу, доки Anthropic.
- Кожен реліз моделей = привід оновити правила → жива сторінка з `dateModified`.

### Ризики

- Гайд оновлюється → правила застарівають. Мітигація: блок «Last verified against docs · {дата}» (патерн уже є в guides) + перевірка при кожному релізі моделі.
- Юзери вставляють чутливі промпти → все client-side, нічого не логуємо, явно про це пишемо (trust-фіча).
- LLM-режим без захисту = витік грошей → тільки BYOK/gated, ніколи відкритий ендпойнт.

## 6. Наступні кроки

1. **[затвердити]** назву розділу і флагмана.
2. Сторінка `/tools` + `/tools/prompt-optimizer` з лінтером (Фаза A) — один PR, ~2–3 дні.
3. Анонс: стаття в брифі + соцмережі (готовий інфопривід для запуску соцпрофілів із SOCIAL-LAUNCH.md).
4. Калькулятор вартості (№2) — другий PR, його цінові дані стають основою living page «Ціни LLM API» (Фаза 3 майстер-плану).
