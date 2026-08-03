# Розділ «AI Toolbox» (Useful Tools) — концепція v2

Summary: Концепт AI Toolbox (Useful Tools): принципи, роадмеп, вердикт ринку.
Sources: none (analysis)
Last updated: 2026-06-11


**Дата:** 2026-06-11 (v2 — після конкурентного research і adversarial-критики) · **Статус:** на затвердження
**Основа:** офіційний гайд [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5), веб-research конкурентів (червень 2026), критика спеки незалежним агентом (вердикт: ship-with-fixes — виправлення внесені нижче).

---

## 1. Чому це стратегічно сильний хід

Міні-тулзи — **третя нога** контент-стратегії поруч із брифом (свіжість) і концепт-хабами (evergreen):

1. **SEO/AEO-магніти** на high-intent запити. Важливо (висновок research): **захисний актив — не віджет, а evergreen-контент навколо нього** (повний каталог правил із цитатами як SSG-HTML) — це те, що цитують Perplexity/ChatGPT; сам віджет копіюється за вікенд.
2. **Internal linking hub-and-spoke**: тулзи ↔ концепт-хаби ↔ статті.
3. **Retention + бренд:** причина повертатись без нової новини.
4. **Нульова собівартість:** перша хвиля — повністю client-side.

## 2. Назва і місце

- **Маршрут:** `/[lang]/tools` + `/[lang]/tools/[slug]` (ISR).
- **Назва:** **«AI Toolbox»** (EN) / **«Інструменти»** (UK).
- **Хедер:** після «Guides | Concepts» → «Toolbox».

## 3. Принципи

1. No signup, no paywall, миттєво.
2. Client-side first; **counts-only телеметрія** (запуски лінта, спрацювання правил, копіювання сніпетів — ніколи текст промпта) — без неї нема сигналу для рішень по Фазі B. Privacy-обіцянка формулюється точно: **«ми не бачимо текст вашого промпта»**.
3. Кожна тулза відповідає на конкретний запит, який реально шукають (перевірено research-ом, див. вердикти).
4. Кожна рекомендація цитує первинне джерело (наш E-E-A-T-стиль).
5. Правила тулз = **дані, ключовані за моделлю** (не хардкод): селектор моделі в UI + CI-джоб, що хешує docs-сторінку і фейлиться при її зміні (а не лише ручний «Last verified»).

## 4. Роадмап після валідації ринку

### Будуємо (перша хвиля)

| # | Тулза | Вердикт research | Effort |
|---|---|---|---|
| 1 | **Prompt Optimizer for Claude (Fable 5)** ⭐ | **build** — диференціація реальна, але вікно тікає (fable5.io зʼявився за ~48 год після релізу моделі — keyword-capture на GPT-4o під капотом). Маркетувати як «for Claude Fable 5» long-tail, НЕ як generic «prompt optimizer» (та SERP насичена) | 2–3 дні |
| 2 | **Claude Code settings.json Builder** 🆕 | **build** — нульова тулз-конкуренція при доведеному попиті (по запитах «claude code hooks/permissions» лише статті, жодного інтерактивного інструмента); ідеальний fit аудиторії; ми дογфудимо ці конфіги щодня = миттєвий E-E-A-T. Visual-білдер permission-правил + бібліотека hook-рецептів з цитатами | дні |
| 3 | **CLAUDE.md / AGENTS.md Generator** | **build** — попит росте швидко (AGENTS.md став крос-тулзовим стандартом), конкуренція фрагментована і слабка; диференціація: подвійний вихід + encoded best practices з цитатами | 1–2 дні |

### Друга хвиля

| Тулза | Вердикт | Нотатка |
|---|---|---|
| **Claude Plan Breakeven Calculator** 🆕 (API vs Pro/Max) | build-later | «Який план Claude мені треба» — контент ранжується, інтерактиву майже нема; agent-aware математика (мульти-турн цикли, cache-hit) — наша диференціація. Дані = вхід для living page цін |
| **Claude API Error Decoder** 🆕 | build-later | Вставив error-payload (529/429/refusal/overflow) → діагноз+фікс+цитати. Error-запити — те, що деви вставляють у Perplexity = чистий AEO-актив; зараз цю SERP фармлять блог-ферми без тулзів |
| **OpenAI→Claude Snippet Converter** 🆕 | build-later (після трьох вище) | Інтерактивного конвертера не існує; ultra-high-intent аудиторія (ті, хто мігрує). Найважчий інженерно (week+) |
| Model Picker | fold-in | Вбудувати в Prompt Optimizer (рекомендація моделі вже в спеці); standalone — тільки якщо вбудована версія почне збирати цитати |
| Prompt Token Counter | fold-in | Віджет всередині Optimizer (live-оцінка токенів + context-fit бар); SERP насичена, окрема сторінка не виграє. Чесно позначати як апроксимацію (токенізатор Anthropic не публічний) |

### Не будуємо (насичені ніші — підтверджено research-ом)

- **LLM Token & Cost Calculator** — SERP окупована exact-match доменами (pricepertoken.com, llmpricingcalculator.com та ін.). Датасет цін лишаємо для living page «Ціни LLM API» + інлайн-віджет там.
- **AI Crawler Checker / llms.txt-генератори** — лід-магнет кожного GEO-стартапа; персона (паблішер-маркетолог) — не наш читач. Тема варта однієї evergreen-статті, не тулзи.
- **MCP Config Generator standalone** — ніша комодитизується one-click інсталами (`claude mcp add`, .mcpb, deeplinks). Реалізувати як **фічу каталогу MCP-серверів** (Фаза 3): copy-ready конфіг під кожен клієнт у картці сервера.

## 5. Флагман: Prompt Optimizer for Claude (Fable 5)

### Конкурентний ландшафт (перевірено, червень 2026)

- **Anthropic Console improver** — авторитет, але потребує консоль+білінг; продукує verbose CoT/XML-шаблони, що частково суперечать власному гайду Fable 5 (over-prescription) — легітимний wedge.
- **OneClickTool** (найближчий субститут): free, no-signup, client-side, Claude-tier-aware — але без цитат доків, з бездоказовими твердженнями, рекламою, і знання моделей закінчуються до Fable 5.
- **fable5.io** — доказ попиту на keyword і швидкості вікна: «оптимізація під Fable» на GPT-4o/Llama.
- **DocsBot** — SERP-інкамбент по «claude prompt generator» (домен-авторитет), але таргетинг застряг на Claude 3.5.
- **Вердикт:** позиціонування виграшне сьогодні; **моат = freshness + citations**, тому (а) шипити швидко, (б) детермінізм+цитати зробити видимою бренд-обіцянкою, (в) ритуал оновлення на кожен реліз моделі — обовʼязковий.

### Фаза A — детермінований Prompt Linter ($0, client-side)

`src/lib/prompt-lint.ts` (чиста логіка, тести ≥80%; **тригери білінгвальні EN+UK** — половинчаста українська детекція виглядатиме зламаною для UK-аудиторії). Перед лінтом — **селектор «де запускатимеш»: API / Claude Code / claude.ai** — він гейтить effort/model-правила (для claude.ai effort нерелевантний, у Claude Code — свій дефолт).

Правила (з виправленнями критики):

| Правило | Тригер | Рекомендація | Severity |
|---|---|---|---|
| Структура | Довгий промпт без секцій/тегів | `<context>/<task>/<output_format>` | suggestion |
| **Приклади (multishot)** 🆕 | Format-чутлива задача без жодного прикладу | 3–5 різноманітних прикладів у `<example>`-тегах — «найнадійніший спосіб керувати виводом» (docs) | issue |
| **Long-context ordering** 🆕 | Великий вставлений блоб ПІСЛЯ інструкцій | Дані зверху, запит у кінці (до ~30% поліпшення, docs), `<document>`-теги, grounding quotes first. Найбільш детерміновано-лінтоване правило з усіх | issue |
| **Негативні інструкції** 🆕 | Висока щільність don't/never/не роби | «Кажи що робити замість чого не робити» (docs: "Do not use markdown" → "Write in flowing prose") | suggestion |
| **Constraint без причини** 🆕 | NEVER/ALWAYS без пояснення навіщо | Пояснена причина суттєво покращує компліанс (docs, приклад ellipses/TTS) | suggestion |
| Формат виводу | Нема вказівки формату | Додати очікуваний формат | suggestion |
| Vague-кваліфікатори | "better"/"professional"/«якісно» без критеріїв | Вимірювані критерії | suggestion |
| Контекст/намір | Нема «чому/для кого» | Патерн «I'm working on [X] for [Y]…» | suggestion |
| ⚠️ Reasoning-echo (Fable) | **Тільки** echo/transcribe/reproduce-формули («відтвори свій хід міркувань у відповіді»), НЕ легітимне «обґрунтуй оцінку для клієнта» | «**Може** тригерити reasoning_extraction-refusal (elevated fallbacks)». Ремедіація повна: thinking-блоки за замовчуванням **omitted** — треба `thinking: {type:'adaptive', display:'summarized'}` (і це summarized-only); для прогресу — send-to-user tool; для claude.ai-користувачів правило не показується | issue (API/Code) |
| Over-prescription (Fable) | Патерни поведінкового стирінгу (списки «always X, never Y»), **НЕ** сирий підрахунок інструкцій — повна специфікація задачі апфронт офіційно заохочується | «Коротка інструкція замість енумерації поведінок» (docs) | info |
| Аж-надто-наголоси | CRITICAL/MUST/капс-педалювання | Офіційне: агресивні наголоси спричиняють **overtriggering** на 4.6+ — нормалізувати тон (цитата, не «гігієна») | suggestion |
| Effort-підказка | Тільки для API/Claude Code | `high` — офіційний дефолт; рівні low/medium/high/xhigh/**max**; «нижчі рівні на Fable часто перевершують xhigh попередніх моделей» (docs) | info |

**Вивід:** severity-tiered список («2 issues, 3 suggestions») з цитатою-лінком на кожній картці + дисклеймер «евристика, не вирок». **Без єдиного "health score"** — один скріншот хибної оцінки від відомого дева вбиває довіру.

**Бібліотека офіційних сніпетів** — кожен з **міткою призначення: system prompt / user message / harness** (autonomy/checkpoint/grounded-progress — це системні інструкції для агент-білдерів, кнопка «вставити в user-промпт» для них — неправильне використання): anti-overplanning, anti-overengineering, brevity, checkpoint, grounded progress, autonomy, boundaries.

**Рекомендація моделі** (rule-based, gated селектором): рутина → Haiku 4.5 (⚠️ **не підтримує effort** — ніколи не емітити «Haiku + effort»); баланс → Sonnet 4.6; складна/довга/агентна → Fable 5 + effort; **Opus 4.8 — окремий tier** (дешевший потужний варіант і офіційний fallback для refusal-категорій cyber/bio).

### Фаза B — LLM-переписування (тільки після трафік-сигналу з телеметрії Фази A)

- **B1 BYOK** — технічно фізибельно (SDK офіційно підтримує браузер через `dangerouslyAllowBrowser`), але доки фреймлять це для «internal tools, trusted users» — тон обережний. **Безпековий мінімум:** ключ тільки в памʼяті (ніколи localStorage), strict CSP `connect-src api.anthropic.com`, **нуль third-party скриптів** на сторінці, SRI, порада використовувати workspace-scoped key зі spend-капом, відкритий код сторінки + явна інструкція «перевір Network tab». Репутаційний ризик «медіа вчить вставляти ключі в чужий сайт» — закривається тільки цією прозорістю.
- **B2 gated** — IP-ліміт сам по собі НЕ захист (IPv6 /64, CGNAT карає чесних) → Turnstile/proof-of-work + денний токен-бюджет + kill-switch. Санітизація LLM-виводу перед рендером (prompt-injection/XSS).
- **Privacy-обіцянка стає per-mode:** «Lint — повністю локально; AI-rewrite — надсилається на наш сервер і в Anthropic». Без цього Фаза B мовчки ламає головну trust-обіцянку Фази A.

### SEO/AEO-обвʼязка (виправлено)

- **Повний каталог правил із цитатами = SSG-HTML на сторінці** (не тільки в JS-логіці) — це і є citable-актив для «how to prompt claude fable 5»; інакше сторінка для краулерів — порожня інтерактивна оболонка.
- Schema: **SoftwareApplication/WebApplication** (основна) + TechArticle для explainer-частини. FAQPage — лише для LLM-інгесту (rich results для звичайних сайтів Google прибрав ще 2023-го — не продавати собі це як SERP-фічу).
- H1 «Free Prompt Optimizer for Claude (Fable 5)», визначення в перших 300 словах, лінки на концепти/доки.
- Перед лончем: одноразова перевірка brand guidelines Anthropic (nominative use + цитування сніпетів з атрибуцією — ймовірно ок, але Anthropic у 2026 активніше захищає бренд).

## 6. Наступні кроки

1. **[затвердити]** v2: назву розділу, першу хвилю (Optimizer → settings.json Builder → CLAUDE.md Generator).
2. PR: `/tools` + `/tools/prompt-optimizer` (Фаза A; правила-як-дані + SSG-каталог правил + телеметрія counts-only) — ~2–3 дні.
3. Анонс-звʼязка з запуском соцмереж (`social-launch.md`): тулза = ідеальний перший інфопривід.
4. CI-джоб хешування docs-сторінки гайда (фейл при зміні → ритуал оновлення правил).
