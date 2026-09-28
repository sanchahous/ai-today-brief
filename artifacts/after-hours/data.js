/* After Hours prototype v3 — demonstration data.
   Everything here is illustrative concept copy. Shapes mirror production payloads
   (src/lib/items.ts, src/content/guides.ts, src/content/tools.ts, src/lib/concepts.ts)
   so templates can be mapped 1:1 during implementation. */

/* Categories: `key` maps to --cat-<key> (theme-aware UI colour) and --art-<key> (banner hue). */
const CATEGORIES = [
  {
    id: "agents-and-mcp", key: "agents", count: 33,
    name: { en: "Agents & MCP", uk: "Агенти та MCP" },
    desc: { en: "How agents connect, remember and act — protocols, harnesses and delegation.", uk: "Як агенти з’єднуються, пам’ятають і діють — протоколи, харнеси, делегування." },
    subtopics: ["MCP", "Claude Code", "Sub-agents", "Tool use"],
  },
  {
    id: "tools-and-releases", key: "tools", count: 33,
    name: { en: "Tools & releases", uk: "Інструменти та релізи" },
    desc: { en: "Releases and changelogs that change the way you build this week.", uk: "Релізи й changelog-и, що змінюють вашу роботу цього тижня." },
    subtopics: ["Cursor", "Codex", "IDE", "CLI"],
  },
  {
    id: "models-and-research", key: "models", count: 9,
    name: { en: "Models & research", uk: "Моделі та дослідження" },
    desc: { en: "Papers, evals and model launches — read the evidence behind the headline.", uk: "Статті, evals і запуски моделей — докази за заголовком." },
    subtopics: ["Reasoning", "Benchmarks", "Evals"],
  },
  {
    id: "vibe-coding-workflow", key: "vibe", count: 7,
    name: { en: "Vibe coding workflow", uk: "Vibe coding процеси" },
    desc: { en: "Agent-assisted development in practice: speed, guardrails and debt.", uk: "Розробка з агентами на практиці: швидкість, запобіжники й техборг." },
    subtopics: ["Prompt-first", "Guardrails", "Solo builders"],
  },
  {
    id: "token-and-cost-optimization", key: "cost", count: 6,
    name: { en: "Token & cost optimization", uk: "Оптимізація токенів і вартості" },
    desc: { en: "More useful work from your context budget: caching, routing, trimming.", uk: "Більше користі з контекстного бюджету: кешування, маршрутизація, скорочення." },
    subtopics: ["Prompt caching", "Routing", "Batching"],
  },
  {
    id: "local-llms", key: "local", count: 5,
    name: { en: "Local LLMs", uk: "Локальні LLM" },
    desc: { en: "Running capable models on your own hardware — quantization to clusters.", uk: "Потужні моделі на власному залізі — від квантування до кластерів." },
    subtopics: ["Ollama", "Quantization", "GGUF"],
  },
  {
    id: "tutorials-and-guides", key: "tutorials", count: 4,
    name: { en: "Tutorials & guides", uk: "Інструкції та гайди" },
    desc: { en: "Step-by-step methods you can take into your own repository today.", uk: "Покрокові методи, які можна застосувати у власному репозиторії сьогодні." },
    subtopics: ["GitHub Actions", "Code review", "Evals"],
  },
  {
    id: "creative-ai", key: "creative", count: 3,
    name: { en: "Creative AI", uk: "Креативний AI" },
    desc: { en: "Image, vector, audio and video generation for product teams.", uk: "Генерація зображень, векторів, аудіо й відео для продуктових команд." },
    subtopics: ["SVG", "Image models", "Video"],
  },
  {
    id: "career-and-monetisation", key: "career", count: 0,
    name: { en: "Career & monetisation", uk: "Кар’єра та монетизація" },
    desc: { en: "Roles, skills and business models around AI engineering.", uk: "Ролі, навички та бізнес-моделі навколо AI-інженерії." },
    subtopics: ["Hiring", "Pricing", "Freelance"],
  },
];
const catById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

/* News items. `period` mirrors the production date filter relative to the prototype's
   "today" (Saturday 26 Sep 2026). No comment/discussion counts: production has none. */
const NEWS_STORIES = [
  {
    id: "claude-code-subagent-memory", cat: "agents-and-mcp", date: "2026-09-26", time: "09:40", read: 3, period: "today", impact: "high", source: "Anthropic", video: true,
    title: { en: "Anthropic upgrades Claude Code with sub-agent delegation and memory isolation", uk: "Anthropic оновлює Claude Code: делегування субагентам та ізоляція пам’яті" },
    summary: { en: "New session boundaries prevent context pollution while task-specific sub-agents explore dependency trees and run test suites independently.", uk: "Нові межі сесій запобігають засміченню контексту, а спеціалізовані субагенти автономно досліджують залежності та запускають тести." },
    why: { en: "Long-running tasks fail when context saturates. Delegation keeps the parent agent’s instructions crisp and focused on the primary objective.", uk: "Тривалі задачі дають збій, коли контекст переповнюється. Делегування тримає інструкції головного агента точними й сфокусованими." },
    takeaways: { en: ["Scratch workspaces are cleaned up when a sub-task exits", "Structured hand-off reports replace raw terminal dumps", "Parallel sub-agents shorten large refactors"], uk: ["Тимчасові робочі простори видаляються після завершення підзадачі", "Структуровані звіти замінюють сирі виводи терміналу", "Паралельні субагенти скорочують великий рефакторинг"] },
    tags: ["Claude Code", "MCP", "Sub-agents"],
  },
  {
    id: "prompt-caching-deep-dive", cat: "token-and-cost-optimization", date: "2026-09-26", time: "09:15", read: 4, period: "today", impact: "medium", source: "Engineering blog",
    title: { en: "The 70% token cut: how prompt caching rewrites production economics", uk: "Мінус 70% токенів: як prompt caching змінює економіку продакшну" },
    summary: { en: "A practical look at stable context windows, cache boundaries and how teams keep agent latency predictable while cutting API bills.", uk: "Практичний погляд на стабільні контекстні вікна, межі кешу та передбачувану затримку агентів за менших витрат на API." },
    why: { en: "Caching turns multi-agent workflows from cost centres into background processes — when instructions and schemas are strictly partitioned.", uk: "Кешування перетворює багатoагентні процеси з центрів витрат на фонові сервіси — якщо інструкції та схеми чітко розділені." },
    takeaways: { en: ["Prefix alignment needs deterministic tool-definition ordering", "Track hit rate with first-token latency, not alone", "Name the reason for every cache miss"], uk: ["Узгодження префікса потребує детермінованого порядку інструментів", "Відстежуйте hit rate разом із first-token latency", "Назвіть причину кожного промаху кешу"] },
    tags: ["Prompt caching", "Token budget"],
  },
  {
    id: "reasoning-models-inference-compute", cat: "models-and-research", date: "2026-09-26", time: "08:50", read: 5, period: "today", impact: "medium", source: "arXiv",
    title: { en: "Reasoning models in production: inference-time compute vs fine-tuning", uk: "Моделі міркувань у продакшні: обчислення під час інференсу проти fine-tuning" },
    summary: { en: "A study compares test-time search budgets with specialised LoRA adapters for coding, planning and tool-call accuracy.", uk: "Дослідження порівнює бюджети пошуку під час тестування зі спеціалізованими LoRA-адаптерами для коду, планування й викликів інструментів." },
    why: { en: "Knowing when to spend compute at inference instead of training defines both your cost curve and perceived response time.", uk: "Розуміння, коли витрачати обчислення на інференс, а не на навчання, визначає і собівартість, і відчутну швидкість відповіді." },
    takeaways: { en: ["Test-time compute generalises better on novel edge cases", "LoRA wins on first-token latency for known schemas", "Hybrid routers send simple calls to tuned small models"], uk: ["Обчислення на інференсі краще узагальнюють нестандартні випадки", "LoRA виграє за first-token latency на відомих схемах", "Гібридні роутери скеровують прості виклики на малі моделі"] },
    tags: ["Reasoning", "Evals"],
  },
  {
    id: "deepseek-quant-report", cat: "local-llms", date: "2026-09-26", time: "08:20", read: 3, period: "today", impact: "low", source: "Community report",
    title: { en: "Quantization field report: a 600B-class MoE on four consumer GPUs", uk: "Звіт про квантування: MoE класу 600B на чотирьох споживчих GPU" },
    summary: { en: "Community benchmarks for running a large mixture-of-experts model with mixed FP8/AWQ kernels on a four-GPU workstation.", uk: "Бенчмарки спільноти: запуск великої mixture-of-experts моделі зі змішаними FP8/AWQ ядрами на робочій станції з чотирма GPU." },
    why: { en: "Privacy rules and offline resilience make local reasoning viable for regulated teams without a cloud dependency.", uk: "Вимоги приватності й автономність роблять локальні міркування реальними для регульованих команд без хмари." },
    takeaways: { en: ["Expert offloading is the main throughput lever", "4-bit weights keep most benchmark quality", "Measure memory ceilings before buying hardware"], uk: ["Розвантаження експертів — головний важіль швидкості", "4-бітні ваги зберігають більшу частину якості", "Виміряйте стелю пам’яті до купівлі заліза"] },
    tags: ["Quantization", "Ollama"],
  },
  {
    id: "cursor-harness-tuning", cat: "agents-and-mcp", date: "2026-09-25", time: "18:10", read: 2, period: "week", impact: "medium", source: "Cursor",
    title: { en: "Cursor shares a harness-tuning prompt to cut agent token overhead", uk: "Cursor ділиться промптом для налаштування харнесу та скорочення оверхеду токенів" },
    summary: { en: "One round of prompt trimming, tool offloading and cache-layout changes cut a production team’s token cost by about 7% with no quality loss.", uk: "Один раунд скорочення промптів, винесення інструментів і перебудови кешу знизив витрати команди на токени приблизно на 7% без втрати якості." },
    why: { en: "Harness overhead can consume a large share of the context window before the user’s request is even read.", uk: "Оверхед харнесу може забирати значну частину контекстного вікна ще до читання запиту користувача." },
    takeaways: { en: ["Trim boilerplate from system prompts first", "Load rarely used tools on demand", "Re-check cache layout after every tool change"], uk: ["Спершу приберіть шаблонний текст із системних промптів", "Рідкісні інструменти завантажуйте на вимогу", "Перевіряйте розкладку кешу після кожної зміни інструментів"] },
    tags: ["Cursor", "MCP", "Token budget"],
  },
  {
    id: "whiteboard-visual-ide", cat: "tools-and-releases", date: "2026-09-25", time: "15:30", read: 2, period: "week", impact: "low", source: "GitHub",
    title: { en: "Whiteboard open-sources a visual IDE for reviewing coding agents", uk: "Whiteboard відкриває код візуального IDE для рев’ю кодуючих агентів" },
    summary: { en: "A desktop app bridges architecture diagrams and code review for agents, with an AST diff viewer and a canvas SDK.", uk: "Десктопний застосунок поєднує архітектурні схеми та код-рев’ю для агентів: AST diff viewer і SDK для канвасу." },
    why: { en: "Seeing structural changes before CI lets leads catch a wrong refactor early.", uk: "Бачити структурні зміни до CI — означає рано ловити хибний рефакторинг." },
    takeaways: { en: ["AST-level diffs beat line diffs for agent refactors", "Canvas SDK exposes the same graph to other tools", "Local-first: repositories stay on the machine"], uk: ["AST-diff кращий за построковий для рефакторингу агентами", "SDK канвасу відкриває той самий граф іншим інструментам", "Local-first: репозиторій лишається на машині"] },
    tags: ["IDE", "Code review"],
  },
  {
    id: "autonomous-code-reviewer-guide", cat: "tutorials-and-guides", date: "2026-09-24", time: "11:00", read: 5, period: "week", impact: "medium", source: "Tutorial",
    title: { en: "Building a grounded code reviewer with MCP and GitHub Actions", uk: "Код-рев’юер на MCP і GitHub Actions, що спирається на факти" },
    summary: { en: "A walkthrough that connects an AST-aware review agent to pull requests, with deterministic verdicts instead of nitpicks.", uk: "Покроковий гайд: AST-агент для рев’ю підключається до pull request-ів і дає детерміновані висновки замість дріб’язкових зауважень." },
    why: { en: "Review bots lose trust with invented style rules. Grounding them in repository tools keeps developers listening.", uk: "Боти-рев’юери втрачають довіру через вигадані правила. Прив’язка до інструментів репозиторію повертає довіру." },
    takeaways: { en: ["Send only changed call graphs to the model", "Reject suggestions that break the test suite", "Keep a human merge gate"], uk: ["Передавайте моделі лише змінені графи викликів", "Відхиляйте пропозиції, що ламають тести", "Залишайте людський merge-gate"] },
    tags: ["MCP", "GitHub Actions", "Code review"],
  },
  {
    id: "vibe-coding-solo-founders", cat: "vibe-coding-workflow", date: "2026-09-23", time: "09:00", read: 3, period: "week", impact: "medium", source: "Essay",
    title: { en: "Vibe coding at seed stage: how solo founders ship without drowning in debt", uk: "Vibe coding на старті: як соло-фаундери запускаються без потопу техборгу" },
    summary: { en: "Prompt-first architecture, the debt it accumulates, and the small safety harnesses that keep a codebase maintainable.", uk: "Prompt-first архітектура, борг, який вона накопичує, і невеликі запобіжники, що зберігають код підтримуваним." },
    why: { en: "Speed is a real advantage — until missing contracts and tests make every change risky.", uk: "Швидкість — реальна перевага, доки відсутні контракти й тести не роблять кожну зміну ризикованою." },
    takeaways: { en: ["Write the API contract before the prompt", "Snapshot-test every generation cycle", "Prefer fewer dependencies"], uk: ["Пишіть API-контракт до промпту", "Знімайте snapshot-тести на кожному циклі", "Менше залежностей — краще"] },
    tags: ["Guardrails", "Solo builders"],
  },
  {
    id: "ollama-distributed-nodes", cat: "local-llms", date: "2026-09-22", time: "17:45", read: 2, period: "week", impact: "low", source: "Ollama",
    title: { en: "Ollama adds distributed inference across machines on a local network", uk: "Ollama додає розподілений інференс між машинами локальної мережі" },
    summary: { en: "Pool workstations into one OpenAI-compatible endpoint over the LAN, with automatic layer partitioning.", uk: "Об’єднайте робочі станції в один OpenAI-сумісний endpoint у локальній мережі з автоматичним поділом шарів." },
    why: { en: "Teams can try large models without buying dedicated servers.", uk: "Команди можуть пробувати великі моделі без купівлі окремих серверів." },
    takeaways: { en: ["Layers are split by measured bandwidth", "mDNS discovery needs no configuration", "Existing clients keep working"], uk: ["Шари діляться за виміряною пропускною здатністю", "mDNS-виявлення без конфігурації", "Наявні клієнти працюють без змін"] },
    tags: ["Ollama", "Local LLMs"],
  },
  {
    id: "svg-generation-benchmarks", cat: "creative-ai", date: "2026-09-18", time: "13:20", read: 3, period: "month", impact: "low", source: "Benchmark",
    title: { en: "SVG generation benchmarks: which models draw usable UI vectors", uk: "Бенчмарки генерації SVG: які моделі малюють придатні UI-вектори" },
    summary: { en: "Coordinate precision, path economy, layer semantics and responsive viewBox scaling across complex icon sets.", uk: "Точність координат, економність path, семантика шарів і масштабування viewBox на складних наборах іконок." },
    why: { en: "Generated vectors can ship UI illustration without heavy raster assets.", uk: "Згенеровані вектори дають UI-ілюстрації без важких растрових файлів." },
    takeaways: { en: ["Valid geometry matters more than style", "Organic shapes still favour larger models", "Vectors stay a fraction of raster weight"], uk: ["Валідна геометрія важливіша за стиль", "Органічні форми краще вдаються великим моделям", "Вектори важать у рази менше за растр"] },
    tags: ["SVG", "Benchmarks"],
  },
  {
    id: "structured-outputs-scale", cat: "tools-and-releases", date: "2026-09-12", time: "10:05", read: 3, period: "month", impact: "medium", source: "Docs",
    title: { en: "Structured outputs at scale: schema libraries vs native JSON schemas", uk: "Структурований вивід у масштабі: бібліотеки схем проти нативних JSON-схем" },
    summary: { en: "Latency, recursion limits and error rates of grammar-constrained decoding when generating nested database migrations.", uk: "Затримка, ліміти рекурсії та помилки граматично обмеженого декодування під час генерації вкладених міграцій БД." },
    why: { en: "Constrained decoding removes parse errors and makes autonomous database work dependable.", uk: "Обмежене декодування прибирає помилки парсингу й робить автономну роботу з БД надійною." },
    takeaways: { en: ["Grammar masking adds little latency", "Keep schemas shallow where possible", "Validate again at the database boundary"], uk: ["Маскування граматики майже не додає затримки", "Тримайте схеми неглибокими", "Перевіряйте ще раз на межі з БД"] },
    tags: ["Structured outputs"],
  },
  {
    id: "eval-harness-drift", cat: "models-and-research", date: "2026-09-08", time: "16:40", read: 4, period: "all", impact: "medium", source: "Research note",
    title: { en: "Eval drift: why the same agent scores differently every month", uk: "Дрейф evals: чому той самий агент щомісяця отримує інші бали" },
    summary: { en: "Harness versions, tool permissions and retry budgets explain more score movement than model updates do.", uk: "Версії харнесу, дозволи інструментів і бюджет повторів пояснюють рух балів більше, ніж оновлення моделей." },
    why: { en: "Without pinned setups, a leaderboard change can be an artefact of the harness, not progress.", uk: "Без зафіксованих умов зміна в рейтингу може бути артефактом харнесу, а не прогресом." },
    takeaways: { en: ["Pin the harness version", "Report retries and permissions", "Keep per-task outcomes"], uk: ["Фіксуйте версію харнесу", "Звітуйте про повтори й дозволи", "Зберігайте результати по кожній задачі"] },
    tags: ["Evals", "Benchmarks"],
  },
];

/* The prototype's "today". Production uses the latest published brief date, never "now". */
const TODAY = { iso: "2026-09-26", weekday: { en: "Saturday", uk: "Субота" } };

/* Daily editions archive (latest first). */
const DAILY_TITLES = {
  26: ["Agents learn to forget", "Агенти вчаться забувати"],
  25: ["The harness is the product", "Харнес — це продукт"],
  24: ["Review before autonomy", "Спершу рев’ю, потім автономність"],
  23: ["Speed has a maintenance bill", "Швидкість має рахунок за підтримку"],
  22: ["One endpoint, many machines", "Один endpoint, багато машин"],
  21: ["Read the setup, then the score", "Спершу умови, потім бал"],
  19: ["Small models, sharp tools", "Малі моделі, гострі інструменти"],
  18: ["Vectors over pixels", "Вектори замість пікселів"],
  17: ["The context budget", "Бюджет контексту"],
  16: ["Grounded review bots", "Рев’ю-боти на фактах"],
  15: ["Routing is a product decision", "Маршрутизація — продуктове рішення"],
  14: ["Caches with contracts", "Кеші з контрактами"],
  12: ["Schemas all the way down", "Схеми до самого дна"],
  11: ["Agents in the CI loop", "Агенти в циклі CI"],
  10: ["When evals drift", "Коли evals дрейфують"],
  9: ["Local-first, finally", "Нарешті local-first"],
  8: ["The permission layer", "Шар дозволів"],
  7: ["Memory with an expiry date", "Пам’ять із терміном дії"],
  5: ["Tomorrow, in context", "Майбутнє з контекстом"],
  4: ["Quiet releases, loud effects", "Тихі релізи, гучні наслідки"],
  3: ["Tool calls you can audit", "Виклики інструментів, які можна перевірити"],
  2: ["A cheaper first token", "Дешевший перший токен"],
  1: ["September, distilled", "Вересень, по суті"],
};
const DAILY_EDITIONS = Object.keys(DAILY_TITLES)
  .map(Number)
  .sort((a, b) => b - a)
  .map((day, index) => ({
    day,
    iso: `2026-09-${String(day).padStart(2, "0")}`,
    title: { en: DAILY_TITLES[day][0], uk: DAILY_TITLES[day][1] },
    items: 5 + ((day * 7) % 4),
    read: 4 + (day % 3),
    lead: NEWS_STORIES[index % NEWS_STORIES.length].id,
    visual: day % 3 !== 0,
  }));

/* Weekly issues: ISO week numbering; the issue covering the current week ships on Monday. */
const WEEKLY_ISSUES = [
  { no: 38, start: "2026-09-14", end: "2026-09-20", published: "2026-09-21", stories: 7, read: 18, sources: 24, pdf: true, video: true,
    title: { en: "The shape of what’s next", uk: "Контури того, що далі" },
    dek: { en: "Memory, context and judgment: agent tooling stops competing on raw capability and starts competing on conditions.", uk: "Пам’ять, контекст і судження: агентні інструменти змагаються вже не сирою потужністю, а умовами роботи." } },
  { no: 37, start: "2026-09-07", end: "2026-09-13", published: "2026-09-14", stories: 6, read: 16, sources: 21, pdf: true, video: true,
    title: { en: "Schemas, sandboxes and the price of a retry", uk: "Схеми, пісочниці й ціна повтору" },
    dek: { en: "Constrained decoding goes mainstream while teams learn what retries really cost.", uk: "Обмежене декодування стає нормою, а команди рахують справжню ціну повторів." } },
  { no: 36, start: "2026-08-31", end: "2026-09-06", published: "2026-09-07", stories: 7, read: 17, sources: 26, pdf: true, video: false,
    title: { en: "Local models get serious", uk: "Локальні моделі стають серйозними" },
    dek: { en: "Quantization, pooling and the new economics of running inference at home.", uk: "Квантування, пулінг і нова економіка інференсу вдома." } },
  { no: 35, start: "2026-08-24", end: "2026-08-30", published: "2026-08-31", stories: 6, read: 15, sources: 19, pdf: true, video: true,
    title: { en: "Evals you can reproduce", uk: "Evals, які можна відтворити" },
    dek: { en: "Why pinned harnesses matter more than leaderboard positions.", uk: "Чому зафіксовані харнеси важливіші за місця в рейтингах." } },
  { no: 34, start: "2026-08-17", end: "2026-08-23", published: "2026-08-24", stories: 7, read: 19, sources: 23, pdf: true, video: true,
    title: { en: "Smaller weights, bigger questions", uk: "Менші ваги, більші питання" },
    dek: { en: "Four-bit models close the gap — and raise questions about who grades whom.", uk: "Чотирибітні моделі скорочують розрив — і ставлять питання, хто кого оцінює." } },
];

/* Glossary: production concept types are concept · pattern · protocol · product · model · library. */
const CONCEPTS = [
  ["agentic-workflow", "Agentic workflow", "pattern", 14, { en: "A process where a model plans, calls tools and checks results over several steps.", uk: "Процес, у якому модель планує, викликає інструменти й перевіряє результат за кілька кроків." }],
  ["ai-agent", "AI Agent", "concept", 41, { en: "A system that works toward a goal through a sequence of actions and observations.", uk: "Система, що рухається до мети через послідовність дій і спостережень." }],
  ["claude-code", "Claude Code", "product", 22, { en: "Anthropic’s terminal-first coding agent that works on files and shell commands.", uk: "Термінальний агент Anthropic для коду, що працює з файлами й командами оболонки." }],
  ["codex", "Codex", "product", 11, { en: "OpenAI’s coding agent for delegated, sandboxed repository tasks.", uk: "Агент OpenAI для делегованих задач у репозиторії в ізольованому середовищі." }],
  ["constrained-decoding", "Constrained decoding", "concept", 6, { en: "Restricting generation to tokens a grammar or schema allows.", uk: "Обмеження генерації токенами, які дозволяє граматика чи схема." }],
  ["context-engineering", "Context engineering", "pattern", 17, { en: "Choosing what information a model sees at each step — and what it must not.", uk: "Вибір інформації, яку модель бачить на кожному кроці, і того, що бачити не повинна." }],
  ["cursor", "Cursor", "product", 19, { en: "An AI-native code editor built around inline and agent modes.", uk: "AI-native редактор коду з inline- та агентним режимами." }],
  ["evals", "Evals", "concept", 12, { en: "Repeatable tests that measure how a model or agent performs on defined tasks.", uk: "Відтворювані тести якості моделі чи агента на визначених задачах." }],
  ["fine-tuning", "Fine-tuning", "concept", 5, { en: "Adapting a pretrained model’s weights to a narrower task or style.", uk: "Донавчання ваг моделі під вужчу задачу чи стиль." }],
  ["function-calling", "Function calling", "pattern", 9, { en: "A model returns structured calls that your code executes and feeds back.", uk: "Модель повертає структуровані виклики, які виконує ваш код." }],
  ["guardrails", "Guardrails", "pattern", 8, { en: "Checks that keep model output inside policy, format and permission limits.", uk: "Перевірки, що тримають результат моделі в межах політик, формату й дозволів." }],
  ["harness", "Agent harness", "concept", 10, { en: "The code around a model: prompts, tools, retries, memory and permissions.", uk: "Код довкола моделі: промпти, інструменти, повтори, пам’ять і дозволи." }],
  ["langchain", "LangChain", "library", 7, { en: "A framework of building blocks for chaining model calls, tools and retrieval.", uk: "Фреймворк блоків для ланцюжків викликів моделей, інструментів і пошуку." }],
  ["local-llm", "Local LLM", "concept", 9, { en: "A language model that runs on your own hardware instead of a hosted API.", uk: "Мовна модель, що працює на вашому залізі замість хмарного API." }],
  ["lora", "LoRA", "concept", 4, { en: "Low-rank adapters that fine-tune a model by training a small set of extra weights.", uk: "Низькорангові адаптери: донавчання через невеликий набір додаткових ваг." }],
  ["mcp", "Model Context Protocol", "protocol", 38, { en: "An open protocol that connects AI applications to external tools and data.", uk: "Відкритий протокол, що з’єднує AI-застосунки із зовнішніми інструментами й даними." }],
  ["mixture-of-experts", "Mixture of experts", "model", 6, { en: "An architecture that routes each token to a few specialised sub-networks.", uk: "Архітектура, що спрямовує кожен токен до кількох спеціалізованих підмереж." }],
  ["ollama", "Ollama", "product", 8, { en: "A runtime for downloading and serving open models locally.", uk: "Середовище для завантаження й локального запуску відкритих моделей." }],
  ["openai-api", "OpenAI API", "library", 13, { en: "The hosted API for OpenAI models, tools and structured outputs.", uk: "Хмарний API моделей OpenAI, інструментів і структурованого виводу." }],
  ["prompt-caching", "Prompt caching", "pattern", 15, { en: "Reusing the processed prefix of a prompt to cut latency and cost.", uk: "Повторне використання обробленого префікса промпту для меншої затримки й вартості." }],
  ["prompt-injection", "Prompt injection", "concept", 7, { en: "Untrusted text that tries to override a model’s instructions.", uk: "Недовірений текст, що намагається переписати інструкції моделі." }],
  ["quantization", "Quantization", "concept", 6, { en: "Storing weights at lower precision to fit models into less memory.", uk: "Зберігання ваг із меншою точністю, щоб модель вмістилась у меншу пам’ять." }],
  ["rag", "RAG", "pattern", 16, { en: "Retrieval-augmented generation: bringing relevant sources into the prompt.", uk: "Retrieval-augmented generation: додавання доречних джерел у промпт." }],
  ["reasoning-models", "Reasoning models", "model", 11, { en: "Models trained to spend extra inference compute on step-by-step thinking.", uk: "Моделі, навчені витрачати додаткові обчислення на покрокові міркування." }],
  ["structured-outputs", "Structured outputs", "pattern", 9, { en: "Responses guaranteed to match a JSON schema.", uk: "Відповіді, що гарантовано відповідають JSON-схемі." }],
  ["sub-agents", "Sub-agents", "pattern", 10, { en: "Child agents with their own context that handle a delegated sub-task.", uk: "Дочірні агенти з власним контекстом для делегованої підзадачі." }],
  ["tool-use", "Tool use", "concept", 21, { en: "A model’s ability to call external functions, APIs and programs.", uk: "Здатність моделі викликати зовнішні функції, API й програми." }],
  ["vibe-coding", "Vibe coding", "pattern", 12, { en: "Building software by steering an agent in natural language, reviewing as you go.", uk: "Створення ПЗ через керування агентом природною мовою з рев’ю по ходу." }],
].map(([slug, name, type, stories, def], index) => ({ slug, name, type, stories, def, verified: index % 5 === 3 ? "partial" : "verified", verifiedAt: `2026-09-${String(8 + (index % 18)).padStart(2, "0")}` }));

/* The concept map: edges the reader can follow from the hub. */
const CONCEPT_LINKS = [
  ["ai-agent", "tool-use"], ["ai-agent", "harness"], ["tool-use", "mcp"], ["mcp", "claude-code"], ["harness", "context-engineering"],
  ["context-engineering", "prompt-caching"], ["context-engineering", "rag"], ["ai-agent", "sub-agents"], ["harness", "evals"], ["tool-use", "function-calling"],
];

const GUIDES = [
  {
    slug: "claude-code-vs-cursor-vs-codex", format: "comparison", level: { en: "Decision guide", uk: "Гайд для рішення" }, read: 12, lastVerified: "2026-09-11", sections: 6,
    title: { en: "Claude Code vs Cursor vs Codex: which AI coding agent fits your workflow", uk: "Claude Code vs Cursor vs Codex: який AI-агент для коду під ваш workflow" },
    description: { en: "A structural comparison of three agentic coding tools — interface model, autonomy, extensibility and team fit — with an honest “choose this if” checklist.", uk: "Структурне порівняння трьох агентних інструментів — модель інтерфейсу, автономність, розширюваність і командний фіт — із чесним чеклістом «обирайте, якщо»." },
    outcome: { en: "Pick the agent whose structural bet matches your bottleneck.", uk: "Оберіть агента, чия структурна ставка відповідає вашому вузькому місцю." },
  },
  {
    slug: "atb-orchestration-bench", format: "benchmark", level: { en: "Reference", uk: "Довідник" }, read: 15, lastVerified: "2026-09-11", sections: 8,
    title: { en: "ATB Orchestration Bench: our reproducible agent-delivery benchmark", uk: "ATB Orchestration Bench: наш відтворюваний бенчмарк агентної розробки" },
    description: { en: "Every notable coding-agent release gets the same end-to-end delivery epic — planning, memory, token economy, code, self-review, tests and tech-debt honesty.", uk: "Кожен помітний реліз кодинг-агента проходить той самий епік — планування, пам’ять, токен-економіка, код, само-рев’ю, тести й чесний техборг." },
    outcome: { en: "Read an agent result by its conditions, not its rank.", uk: "Читайте результат агента за умовами, а не за місцем у рейтингу." },
  },
];

/* Toolbox — mirrors src/content/tools.ts. */
const TOOLS = [
  { slug: "prompt-optimizer", route: "tool", status: "live", lastVerified: "2026-09-11", rules: 38, citations: 24, output: "Findings · model advice",
    title: { en: "Prompt Optimizer", uk: "Оптимізатор промптів" },
    full: { en: "Free prompt optimizer for Claude", uk: "Безкоштовний оптимізатор промптів для Claude" },
    desc: { en: "A local, citation-backed prompt linter: choose the surface and model, get severity-tiered findings.", uk: "Локальний лінтер промптів із цитатами: оберіть середовище й модель — отримайте знахідки за рівнями." } },
  { slug: "settings-builder", route: "settings", status: "live", lastVerified: "2026-07-16", rules: 27, citations: 18, output: "settings.json",
    title: { en: "settings.json Builder", uk: "Білдер settings.json" },
    full: { en: "Claude Code settings.json builder — permissions & hooks", uk: "Білдер settings.json для Claude Code — дозволи й hooks" },
    desc: { en: "Pick a permission mode, safety presets and hook recipes; export deterministic scaffolding.", uk: "Оберіть режим дозволів, безпечні пресети й рецепти hooks — експортуйте детермінований scaffold." } },
  { slug: "claude-md-generator", route: "instructions", status: "live", lastVerified: "2026-07-16", rules: 16, citations: 11, output: "AGENTS.md + CLAUDE.md",
    title: { en: "CLAUDE.md / AGENTS.md Generator", uk: "Генератор CLAUDE.md / AGENTS.md" },
    full: { en: "Project-instructions generator", uk: "Генератор інструкцій проєкту" },
    desc: { en: "Draft portable agent instructions, choose import or symlink wiring, lint before you copy.", uk: "Створіть портативні інструкції, оберіть import чи symlink wiring, перевірте перед копіюванням." } },
];

const TRENDING = [
  { name: "MCP", mentions: 38, delta: 12 }, { name: "Claude Code", mentions: 22, delta: 9 }, { name: "Prompt caching", mentions: 15, delta: 6 },
  { name: "Sub-agents", mentions: 10, delta: 7 }, { name: "Evals", mentions: 12, delta: -2 }, { name: "Ollama", mentions: 8, delta: 3 },
];

const HOME_FAQ = [
  { q: { en: "What is AI Today Brief?", uk: "Що таке AI Today Brief?" }, a: { en: "A daily AI-engineering brief for developers, founders and tech leads. We read 120+ sources and publish what matters, with context and a practical next step.", uk: "Щоденний бриф з AI-інженерії для розробників, фаундерів і техлідів. Ми читаємо 120+ джерел і публікуємо важливе — з контекстом і практичним кроком." } },
  { q: { en: "Who edits it?", uk: "Хто це редагує?" }, a: { en: "Every story is reviewed by a named editor. AI assists with research and drafts; responsibility stays with the editor.", uk: "Кожен матеріал перевіряє названий редактор. AI допомагає з пошуком і чернетками; відповідальність — на редакторі." } },
  { q: { en: "Is it free?", uk: "Це безкоштовно?" }, a: { en: "Yes. Reading and the email edition are free. Sponsored placements are always labelled.", uk: "Так. Читання й email-випуск безкоштовні. Спонсорські розміщення завжди позначені." } },
  { q: { en: "How are sources shown?", uk: "Як показуються джерела?" }, a: { en: "Each story links its primary source and citations. Corrections stay visible next to the text they change.", uk: "Кожен матеріал посилається на першоджерело й цитати. Виправлення лишаються видимими поруч із текстом." } },
];

/* Coverage matrix: production surface → prototype layout. `state`: covered | improved | new | out */
const COVERAGE = [
  ["Global", "Sticky header · search field · categories menu · lang · theme · subscribe", "site-header-chrome, header-search-field, theme-toggle", "header (all routes)", "improved"],
  ["Global", "Mobile full-screen menu with search, categories disclosure, lang, subscribe", "OverlayDrawer (site-mobile-menu)", "header → Menu dialog", "covered"],
  ["Global", "Search preview dropdown · mobile search modal · ⌘K", "search-preview-dropdown, mobile-search-modal", "search dialog", "improved"],
  ["Global", "Footer: Explore / Company / Legal, socials, LinkedIn CTA, cookie settings", "site-footer", "footer", "covered"],
  ["Global", "Cookie consent: Accept all / Essential only / Manage (EU · UA)", "cookie-consent", "consent card + states", "new"],
  ["Home", "Hero: positioning, archive search with popular chips, stats, coverage bar", "home-hero, hero-search, category-mix-bar", "home masthead", "covered"],
  ["Home", "Top 6 categories with latest stories and counts", "category-grid", "home → categories", "covered"],
  ["Home", "Top of the week: lead + ranked list", "top-of-week", "home → radar", "covered"],
  ["Home", "Weekly digest block", "weekly-digest", "home → velvet weekly", "improved"],
  ["Home", "Trending topics with mention chart", "trending-topics", "home → trending", "covered"],
  ["Home", "Newsletter band with proof items; FAQ (FAQPage)", "newsletter-band, faq-section", "home → newsletter, FAQ", "covered"],
  ["Home", "Sponsor slot + “Why am I seeing this?”", "sponsor-card", "home → sponsor", "covered"],
  ["News", "Search · category facets · period · sort (Newest/Oldest/Relevance with query) · URL state", "news-feed, news-sidebar, news-filters", "news", "improved"],
  ["News", "Expandable analysis, save, share, pagination links, mobile drawer “Done (N)”", "news-feed, pagination, OverlayDrawer", "news", "covered"],
  ["Story", "Breadcrumbs, badge, meta, byline, AI note, hero or category banner, video", "news/[category]/[item]", "article", "covered"],
  ["Story", "Why · TL;DR · facts · body · try-it code · when/when-not · actions · editor’s take · community · tools · sources", "story-body", "article (three formats)", "covered"],
  ["Story", "Primary source, share X/LinkedIn/copy, previous/next, related, newsletter", "item-share-bar", "article", "covered"],
  ["Daily", "Hero visual + display title, show more, packs, concepts in brief, AI note", "daily-hero, brief-daily-sections", "daily", "improved"],
  ["Weekly", "Cover hero, period, PDF, video, contents, action board, stories, editor’s view, metrics, FAQ, prev/next", "weekly/*", "weekly", "improved"],
  ["Digests", "Archive of daily + weekly editions", "digests/page", "digests", "improved"],
  ["Concepts", "Hub grid with types; concept header, official site, overview, FAQ, verification, related, stories", "concepts-grid, concept-*", "concepts, concept", "improved"],
  ["Guides", "Guide list with last verified; guide body with TOC and changelog", "guides/*", "guides, guide", "improved"],
  ["Toolbox", "Tool cards (live/coming soon, last verified)", "tool-card", "tools", "improved"],
  ["Toolbox", "Prompt optimizer · settings builder · CLAUDE.md generator with privacy promise, citations, copy", "tools/*-client", "tool, settings, instructions", "improved"],
  ["Category", "Category header, subtopics, feed", "category-header, post-feed", "categories, category", "improved"],
  ["Trust", "About, author profile, editorial policy, AI disclosure, privacy, terms", "about, author, legal-doc, trust-page-shell", "about, author, policy", "covered"],
  ["Growth", "Subscribe (benefits, sample, FAQ) · Advertise (audience, inventory, contact)", "subscribe-*, advertise-inquiry-cta", "subscribe, advertise", "covered"],
  ["System", "404 with search and routes", "not-found-*", "404", "covered"],
  ["Admin", "CMS: weekly workspace, queues, costs, calendar", "admin/*", "—", "out"],
];
