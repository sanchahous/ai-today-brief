# AI Trends Research & Content Selection Strategy

> **Звіт станом на 2026-06-13.** Динамічна модель — переглядати щотижня (наступний реврю: 2026-06-20).
> Горизонт прогнозу: 2–4 тижні (тиждень публікації 2026-06-15 … 06-21).
> Джерела позначені інлайн; повний список — у кінці документа.

Цей документ — стратегічний шар над пайплайном `fetch → rank → summarize → publish`
(`pipeline/`). Він **не замінює** інженерний скоринг у `pipeline/rank.ts` (6 сигналів
залученості), а додає **редакційний фрейм відбору** поверх нього: машина відбирає
«що зараз гаряче», редакційний фрейм вирішує «що варте *нашого* читача».

---

## 0. TL;DR — що робити цього тижня

1. **Домінуючий наратив червня 2026:** перехід від «агент як демо» до **«агент у
   проді»** — надійність, оркестрація мульти-агентів, і **пам'ять як архітектурний
   примітив** (три рівні: in-context / vector / persistent). Це — головна тема №1.
2. **Подія тижня в моделях:** реліз **Claude Fable 5** (09.06, 95.0% SWE-bench
   Verified, 1M контекст) на тлі Opus 4.8, GPT-5.5, Gemini 3.1 Pro. Порівняння
   «хто для чого» — гарантований трафік.
3. **Зсув на ринку відео:** **Sora згортають** (web/app — 26.04.2026, API —
   24.09.2026). Лідери — Kling v3, Veo 3.1, Runway Gen-4.5. Це відкриває серію
   «чим замінити Sora» — висока практична цінність для контент-мейкерів.
4. **Конфіг-війни кодинг-агентів:** AGENTS.md vs CLAUDE.md vs Cursor Rules vs
   SKILL.md. Тема прямо в нашій ніші (defensible dev niche) — наш контент-конкурент.
5. **Рекомендація по вагах:** залишити інженерний скоринг `rank.ts` як є, але
   ввести **другий редакційний гейт** (Трендовість 40 / Практична цінність 35 /
   Актуальність 15 / Унікальність 10) з відсіканням < 60%. Деталі — §3.

---

## 1. Аналіз AI-трендів (поточні + прогноз 2–4 тижні)

### 1.1 Топові теми, що домінують медіапростором (червень 2026)

| # | Тема | Сигнал зростання | Категорія (наш slug) |
|---|------|------------------|----------------------|
| 1 | **Агенти в проді / надійність** | «Рік в agentic AI = десятиліття»; фокус зсунувся з демо на reliability у проді | `agents-and-mcp` |
| 2 | **Мульти-агентна оркестрація** | Gartner: **+1445%** запитів про multi-agent системи (Q1'24→Q2'25) | `agents-and-mcp` |
| 3 | **Пам'ять агентів (3 рівні)** | Пам'ять стала «first-class архітектурним примітивом»; головний біль — context inconsistency | `agents-and-mcp` / `optimization` |
| 4 | **MCP як універсальний шар** | Широке впровадження у 2025; plug-and-play інтеграції замість кастомних | `agents-and-mcp` |
| 5 | **Нові флагманські LLM + порівняння** | Fable 5, Opus 4.8, GPT-5.5, Gemini 3.1 Pro, Grok 4, DeepSeek V4 — каскад релізів | `models-and-research` |
| 6 | **Browser automation** | Ринок +45% р/р на хвилі агентів, що клікають/заповнюють форми | `agents-and-mcp` |
| 7 | **Context engineering** (еволюція prompt eng.) | «Не ідеальний промпт, а проєктування всього інфо-середовища моделі» | `tutorials-and-guides` |
| 8 | **Зсув ринку AI-відео після Sora** | Sora згортають; Kling v3 / Veo 3.1 / Runway Gen-4.5 діляться ринком | `creative-ai` |
| 9 | **Ефективність моделей** | 7B робить те, що рік тому вимагало 70B; «post-GPU era» у TLDR | `optimization` / `local-llms` |
| 10 | **Монетизація AI / micro-SaaS** | Сервіси (чатботи, short-form editing) дають дохід за 30–60 днів; agency-моделі $10–50K/міс | `career-and-money` |

### 1.2 Прогноз на 2–4 тижні (на основі сигналів)

- **Сплеск «агент-пам'ять» контенту.** Перехід від оркестрації (вирішена, «легка»
  частина) до **управління пам'яттю** («що пам'ятати, що дропати, як не отруїти
  новий контекст старим»). Прогноз: гайди й кейси про tiered memory, project memory,
  shared context між кількома моделями зростатимуть. → прямо корелює з нашими
  пріоритетними темами «управління пам'яттю» та «мульти-модельні системи».
- **Друга хвиля «порівняння моделей».** Після релізу Fable 5 (09.06) ринок 2–3 тижні
  переварюватиме «хто для чого»: кодинг (SWE-bench), reasoning (GPQA/ARC-AGI-2),
  ціна/токен. Прогноз: порівняльні таблиці й «який LLM для задачі X» — пік трафіку.
- **«Заміна Sora» як стійка серія.** Дедлайн API 24.09 створює 3+ місяці попиту на
  «куди мігрувати». Прогноз: туторіали Kling/Veo/Runway workflow ростуть до осені.
- **Конфіг-стандарти кодинг-агентів стабілізуються** навколо markdown-у в корені репо
  (AGENTS.md як відкритий стандарт; CLAUDE.md/SKILL.md як Anthropic-конвенції).
  Прогноз: «як налаштувати правила/скіли/code-style для агента» — стабільний
  evergreen-попит у dev-ніші.

### 1.3 Тренди за категоріями

- **Інструменти / сервіси:** AI-відео (Kling v3, Veo 3.1, Runway Gen-4.5, Pika,
  Seedance 2.0), newsletter-tooling, browser-automation утиліти.
- **Моделі:** Fable 5, Opus 4.8, GPT-5.5, Gemini 3.1 Pro, Grok 4, DeepSeek V4 Pro,
  MiniMax M3 (open-weights), Qwen3.7 Max (найдешевший топ-10).
- **Бізнес-застосування:** AI-консалтинг/автоматизація, micro-SaaS, prompt-eng для
  enterprise, кастомні агенти під замовлення, контент-монетизація.
- **Автоматизація:** browser automation, оркестрація воркфлоу, агентні «цифрові
  колеги» (прогноз: 40% Global 2000 матимуть human↔agent колаборацію).
- **Агенти:** мульти-агентні команди спеціалістів, subagents із власним контекстом
  (Task tool), A2A + MCP протоколи, tiered memory.

---

## 2. Конкурентний аналіз AI-медіа (останні 2 тижні)

### 2.1 Таблиця конкурентів

| Медіа | Аудиторія | Формат / частота | Звідки беруть новини | Як визначають тренди | Сильна сторона |
|-------|-----------|------------------|----------------------|----------------------|----------------|
| **The Rundown AI** | 2M+, +10K/день | Денний дайджест; **~50% open rate** (vs ~31% сер.) | Курація trending проєктів, research, туторіали (Rowan Cheung) | Бифуркація: «Rundown AI» (індустрія) + «Rundown Tech» (продукти) | Масштаб + «digital coworker» наратив |
| **Superhuman AI** | 1.5M+ | Денний; продуктивність/«як застосувати» | Tools-first курація | Орієнтація на use-case і робочі сценарії | Практична цінність для не-інженерів |
| **TLDR AI** | 1.25M+ | Денний; сухі булети | Технічні релізи + arXiv | «Технічний фільтр індустрії»: компресія LLM, synthetic data, post-GPU | Глибина для девелоперів |
| **The Neuron** | 500K+ | Денний дайджест | Курація з сильним редакторським голосом | Editorial voice + відбір | Тон/особистість |
| **Ben's Bites** | 400K+ (166K Substack) | Регулярний; для фаундерів/інвесторів | Стартапи, pre-seed сигнали | Founder/VC-оптика | Бізнес-кут, нетворк |
| **Mindstream** | (топ-7) | Денний | Mainstream AI-новини | Широка аудиторія | Доступність |
| **The Batch (DeepLearning.AI)** | (Andrew Ng) | Тижневий | Research + індустрія | Academic-grade відбір | Авторитет/довіра |

**Джерела трендів у конкурентів (узагальнено):** офіційні блоги лабораторій
(first-party релізи), arXiv, Hacker News / Reddit (соц-сигнал залученості), X/соцмережі,
GitHub-тренди. Це **збігається** з нашими джерелами в `pipeline/sources/`
(bluesky, hacker-news, reddit, feeds, inbrief) — наша перевага не в джерелах, а в
**фільтрі під dev-нішу** (`rank.ts` демоутить consumer-кут, напр. The Verge: 33
fetched / 0 published).

### 2.2 Патерни залученості (що працює)

- **Brevity-first:** «3-хвилинний» формат — стандарт. Складне → дайджестно.
- **Стабільні секції:** «Big Picture» (головна історія дня) + **«Fresh Tools»**
  (свіжі інструменти, якими хочеться поділитись) — найвищий шер.
- **Персоналізація/курація через AI** з великого обсягу статей.
- **High open rate = довіра до відбору**, а не обсяг (Rundown 50% при безкоштовності).
- **Бенчмарк відкриттів:** beehiiv 2026 — open rate >41%.

**Висновок для нас:** наш диференціатор — **вимірювана практична цінність + dev-кут +
EN/UK**. Не змагаємось обсягом із дейлі-гігантами; виграємо **глибиною застосовності**
(промпти, що працюють; конфіги агентів; tiered-memory сетапи) і topical authority.

---

## 3. Фреймворк відбору новин (динамічна модель)

### 3.1 Дворівнева архітектура відбору

```
СТАДІЯ 1 — Машинний скоринг (pipeline/rank.ts, БЕЗ ЗМІН)
  6 сигналів залученості → composite score [0,1]:
  velocity .30 · cross_source .22 · authority .18 · recency .15 · inbrief .10 · breadth .05
  + кластеризація дублів, демоут клікбейту, cap per source/topic
        │
        ▼  (топ-пул кандидатів)
СТАДІЯ 2 — Редакційний гейт (ЦЕЙ фрейм, перед/замість LLM-editor вибору)
  4 критерії під НАШОГО читача → editorial score [0,100%]:
  Трендовість 40 · Практична цінність 35 · Актуальність 15 · Унікальність 10
  Відсікання: editorial score < 60% → DROP
```

> **Чому два рівні.** `rank.ts` відповідає на «що гаряче в інтернеті». Він не знає,
> чи новина *корисна нашому* читачу. Редакційний гейт додає `Практичну цінність` (35%)
> і `Унікальність` (10%) — те, чого немає в сигналах залученості.

### 3.2 Критерії редакційного гейту

| Критерій | Вага | Як рахувати (0–100 кожен) | Звідки сигнал |
|----------|------|---------------------------|----------------|
| **Трендовість** | 40% | Збіг із топ-10 тем §1.1 (повний бал) або зі зростаючим трендом §1.2 (частковий). Можна мапити з `detectTopic`/`categoryForTitle`. | §1 + `pipeline/topics.ts` |
| **Практична цінність** | 35% | Чи дає **вимірювану** користь: готовий промпт/скрипт/конфіг/сетап, який читач застосує сьогодні? Чисті «X сказав Y» → низько. | редакція |
| **Актуальність** | 15% | Вийшла за 48–72 год. Прямо з `recency` компонента `rank.ts` (12h half-life). | `rank.ts` recency |
| **Унікальність** | 10% | Чи є наш кут оригінальним vs дейлі-гіганти (§2)? Дублікат їхнього лиду → низько. | редакція + §2 |

**Формула:** `editorial = 0.40·T + 0.35·P + 0.15·A + 0.10·U` (кожен 0–100).
**Гейт:** `editorial < 60 → відхилити`.

### 3.3 Динамічні ваги тем (оновлювати щотижня)

Множник трендовості за темою на **тиждень 2026-06-15 … 06-21** (boost у балі
Трендовості): використовувати при ручному реврю та як підказку LLM-редактору.

| Тема (topic-tag) | Вага-множник | Нотатка |
|------------------|:------------:|---------|
| `agents` / `mcp` (пам'ять, оркестрація, subagents) | **1.30** | Тренд №1; пам'ять — зростаючий |
| `models-and-research` (порівняння нових LLM) | **1.25** | Хвиля після Fable 5 |
| `creative-ai` (відео: Kling/Veo/Runway, «заміна Sora») | **1.20** | Стійка серія до осені |
| `vibe-coding` / конфіги агентів (AGENTS.md/CLAUDE.md/skills/rules) | **1.20** | Прямо наша ніша |
| `career-and-money` (монетизація, micro-SaaS) | **1.10** | Стабільний попит |
| `optimization` (context/memory eng., ефективність) | **1.10** | Зростає з пам'яттю |
| `tools-and-releases` (дайджести сервісів, знижки на LLM) | **1.05** | Базовий «Fresh Tools» |
| `local-llms` (open-weights: MiniMax M3, post-GPU) | **1.00** | Нейтрально |
| `tutorials-and-guides` (research/investigate-промпти) | **1.00** | Залежить від теми |

> **Реврю-процес (щотижня, ~15 хв):** (1) перечитати §1.1/§1.2 на свіжих сигналах;
> (2) скоригувати множники вище; (3) за потреби — підкрутити floor `minScore` у пулі,
> якщо тиждень «шумний/тихий»; (4) зафіксувати зміни в цьому файлі (git history = аудит).

---

## 4. Пріоритетні категорії контенту

Публікуємо **лише** новини з вимірюваною практичною цінністю. Маппінг побажань
замовника на наші 9 категорій (`CATEGORY_SLUGS` у `topics.ts`):

| Пріоритетна тема (замовник) | Наш slug | Приклад «вимірюваної цінності» |
|------------------------------|----------|-------------------------------|
| Промпти із застосуванням (відео, текст, музика, аналіз коду/безпеки/БД, тест верстки, research/investigate) | `tutorials-and-guides`, `creative-ai` | Готовий копі-пейст промпт + очікуваний результат |
| Бізнес і монетизація (скрипти бізнесу, ідеї, заробіток, навчання AI) | `career-and-money` | Конкретний воркфлоу з timeline/доходом |
| Інструменти та сервіси (дайджести, промо/знижки на LLM) | `tools-and-releases` | Лінк + ціна/знижка + для чого |
| Нові моделі (релізи, порівняння) | `models-and-research` | Таблиця SWE-bench/ціна/контекст |
| Автоматизація та AI-агенти (воркфлоу, оркестрація, скіли/правила, code-style) | `agents-and-mcp` | Готовий конфіг/правило/скіл |
| Управління пам'яттю (коротко/довгострокова, проєктна, мульти-проєкт) | `agents-and-mcp` + `optimization` | Сетап tiered memory крок-за-кроком |
| Мульти-модельні системи (кілька моделей, спільний контекст/пам'ять) | `agents-and-mcp` + `optimization` | Архітектура зі спільним контекстом |
| Трендові промпти (постійний моніторинг) | `tutorials-and-guides` | Промпт тижня + чому зараз |

---

## 5. Рекомендації: 10–15 тем на тиждень 2026-06-15 … 06-21

Кожна тема: формат, slug, чому зараз (трендовий сигнал), і кут практичної цінності.

1. **«Claude Fable 5 vs Opus 4.8 vs GPT-5.5 vs Gemini 3.1 Pro — який для якої задачі»**
   · `models-and-research` · сигнал: реліз Fable 5 09.06 · цінність: таблиця
   SWE-bench / reasoning / ціна-токен / контекст + рекомендація по сценаріях.
2. **«6 інструментів, що замінять Sora» (Kling v3, Veo 3.1, Runway Gen-4.5, Pika,
   Seedance 2.0)** · `creative-ai` · сигнал: API Sora гасять 24.09 · цінність: для
   кого який + промпт-приклади + ціни.
3. **«Tiered memory для агентів: in-context vs vector vs persistent»** · `agents-and-mcp`
   · сигнал: пам'ять = тренд №1, що зростає · цінність: коли який рівень, схема рішень.
4. **«Мульти-агентна оркестрація без хаосу пам'яті: що пам'ятати, що дропати»** ·
   `agents-and-mcp` · сигнал: +1445% Gartner-запитів · цінність: патерни проти
   context inconsistency.
5. **«AGENTS.md vs CLAUDE.md vs Cursor Rules vs SKILL.md — що коли»** · `vibe-coding`
   · сигнал: конфіг-стандарти стабілізуються · цінність: готові шаблони під code-style.
6. **«Subagents у Claude Code: test-runner, schema-migration, frontend-styling»** ·
   `vibe-coding` · сигнал: subagents із власним контекстом — гаряча фіча · цінність:
   копі-пейст сетап.
7. **«MCP за 20 хвилин: підключити агента до своїх інструментів/БД»** · `agents-and-mcp`
   · сигнал: plug-and-play MCP домінує · цінність: крок-за-кроком інтеграція.
8. **«Context engineering: 5 промптів, що б'ють „ідеальний один промпт“»** ·
   `tutorials-and-guides` · сигнал: еволюція prompt→context eng. · цінність: готові
   промпти (role/context/format/constraints).
9. **«Research/Investigate-промпти для девів: аналіз коду, безпеки, БД»** ·
   `tutorials-and-guides` · сигнал: трендові промпти + XML-структура для Claude ·
   цінність: бібліотека промптів під аудит.
10. **«Спільний контекст між кількома моделями (multi-model, shared memory)»** ·
    `optimization` · сигнал: мульти-модельні системи — наш пріоритет + зростання ·
    цінність: архітектура й інструменти.
11. **«Micro-SaaS на AI за 30–60 днів: чатбот / short-form editing»** ·
    `career-and-money` · сигнал: моделі доходу $5–10K/міс · цінність: покроковий offer.
12. **«Найдешевші топ-моделі: Qwen3.7 Max, Gemini 3 Flash, MiniMax M3»** ·
    `tools-and-releases`/`local-llms` · сигнал: ефективність/ціна · цінність:
    cost/токен таблиця + коли open-weights.
13. **«Browser automation: агенти, що клікають за вас»** · `agents-and-mcp` ·
    сигнал: ринок +45% р/р · цінність: інструменти + перший воркфлоу.
14. **«Fresh Tools тижня: 5 сервісів для контенту + актуальні знижки на LLM»** ·
    `tools-and-releases` · сигнал: «Fresh Tools» — топ-шер формат конкурентів ·
    цінність: лінки + ціни/промо.
15. **«Промпт тижня: відео-генерація під соцмережі (toyification, film-grain)»** ·
    `creative-ai` · сигнал: віральні візуальні тренди TikTok/Pinterest · цінність:
    готовий промпт + платформа.

**Баланс пулу (рекомендація):** ~40% агенти/пам'ять/MCP, ~20% моделі/порівняння,
~20% промпти/туторіали, ~10% creative-AI/відео, ~10% бізнес/інструменти. Тримати
diversity-cap із `select.ts`, щоб не вийшов «вал Claude-історій».

---

## Джерела

**Тренди / агенти / моделі**
- [Firecrawl — Top 13 Agentic AI Trends 2026](https://www.firecrawl.dev/blog/agentic-ai-trends)
- [MachineLearningMastery — 7 Agentic AI Trends 2026](https://machinelearningmastery.com/7-agentic-ai-trends-to-watch-in-2026/)
- [Salesforce — 8 Ways AI Agents Are Evolving 2026](https://www.salesforce.com/blog/ai-agent-trends-2026/)
- [LLM-Stats — AI Trends (June 2026)](https://llm-stats.com/ai-trends)
- [LLM-Stats — AI News / Model Releases](https://llm-stats.com/ai-news)
- [Morph — Best AI Model for Coding (June 2026)](https://www.morphllm.com/best-ai-model-for-coding)
- [OneReach — MCP & Multi-Agent AI 2026](https://onereach.ai/blog/mcp-multi-agent-ai-collaborative-intelligence/)
- [O'Reilly — The AI Agents Stack (2026 Edition)](https://www.oreilly.com/radar/the-ai-agents-stack-2026-edition/)
- [Atlan — Multi-Agent Orchestration at Scale 2026](https://atlan.com/know/multi-agent-system-orchestration/)

**Конкуренти / newsletter**
- [Demandsage — Top 10 AI Newsletters 2026](https://www.demandsage.com/ai-newsletters/)
- [Readless — The Rundown AI Review 2026](https://www.readless.app/blog/the-rundown-ai-newsletter-review-2026)
- [Dupple — Best AI Newsletters 2026](https://dupple.com/learn/best-ai-newsletters-2026)
- [Junia — Best AI Newsletter Tools 2026](https://www.junia.ai/blog/ai-tools-newsletters)

**Промпти / кодинг-агенти / відео / монетизація**
- [BuildFastWithAI — Best ChatGPT Prompts 2026](https://www.buildfastwithai.com/blogs/best-chatgpt-prompts-in-2026-200-prompts-for-work-writing-and-coding)
- [Codersera — AGENTS.md vs CLAUDE.md vs Cursor Rules 2026](https://codersera.com/blog/agents-md-vs-claude-md-vs-cursor-rules-comparison-2026/)
- [Agensi — Cursor Rules vs Claude Skills vs AGENTS.md 2026](https://www.agensi.io/learn/ai-coding-tools-comparison-2026)
- [eWeek — Sora Alternatives / AI Video Tools 2026](https://www.eweek.com/news/sora-alternatives-ai-video-tools-2026/)
- [DigitalApplied — AI Video Market After Sora](https://www.digitalapplied.com/blog/ai-video-market-after-sora-runway-kling-veo-2026)
- [Shopify — How to Make Money With AI (2026)](https://www.shopify.com/blog/how-to-make-money-using-ai)
- [Emergent — Make Money with AI 2026](https://emergent.sh/learn/how-to-make-money-with-ai)

> **Застереження.** Зовнішні джерела можуть містити маркетинговий або неточний контент;
> числа (open rate, кількість підписників, бенчмарки) перевіряти перед публічним
> цитуванням. Внутрішні факти про пайплайн узяті з коду (`pipeline/rank.ts`,
> `pipeline/select.ts`, `pipeline/topics.ts`).
