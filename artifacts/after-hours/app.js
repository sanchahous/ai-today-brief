/* Standalone design prototype. Illustrative editorial content; no production API calls. */
let lang = "en";
let theme = "night";
let activeFilter = "all";
let saved = false;
const savedStories = new Set();
const t = (en, uk) => (lang === "uk" ? uk : en);
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const routes = [
  "home",
  "news",
  "article",
  "digests",
  "daily",
  "weekly",
  "concepts",
  "concept",
  "guides",
  "guide",
  "tools",
  "tool",
  "categories",
  "category",
  "about",
  "subscribe",
  "search",
  "saved",
  "advertise",
  "policy",
  "404",
  "system",
  "states",
];
const labels = () => ({
  home: t("Home", "Головна"),
  news: t("News", "Новини"),
  article: t("News article", "Матеріал новини"),
  digests: t("Digests", "Дайджести"),
  daily: t("Daily brief", "Щоденний бриф"),
  weekly: t("Weekly edition", "Тижневий випуск"),
  concepts: t("Concepts", "Концепти"),
  concept: t("Concept detail", "Сторінка концепту"),
  guides: t("Guides", "Гайди"),
  guide: t("Guide detail", "Сторінка гайду"),
  tools: "Toolbox",
  settings: "settings.json Builder",
  instructions: "AGENTS.md Generator",
  tool: t("Tool workspace", "Робочий простір утиліти"),
  categories: t("Categories", "Категорії"),
  category: t("Category hub", "Хаб категорії"),
  about: t("About", "Про нас"),
  subscribe: t("Subscribe", "Підписка"),
  search: t("Search", "Пошук"),
  saved: t("Reading list", "Збережене"),
  advertise: t("Advertise", "Співпраця"),
  policy: t("Editorial & legal", "Політики"),
  system: t("Design system", "Дизайн-система"),
  states: t("UI states", "Стани UI"),
  motion: t("Motion atlas", "Атлас руху"),
  404: "404",
});
const href = (route) => `#/${route}`;
const link = (route, text, cls = "") => `<a class="${cls}" href="${href(route)}">${text}</a>`;
const btn = (route, text, outline = false) =>
  link(route, `${text}<span aria-hidden="true">↗</span>`, `button${outline ? " outline" : ""}`);
const eyebrow = (text) => `<p class="eyebrow">${text}</p>`;
const arrow = '<span aria-hidden="true">↗</span>';
const art = (caption = true) => {
  const comparison = document.getElementById("motion-lab");
  const direction = new URLSearchParams(location.search).get("concept");
  const tensionHome = !comparison || (direction !== "signal" && direction !== "tide");
  // Render vector art immediately: do not download the old 1.8 MB hero only to replace it.
  if (currentRoute() === "home" && tensionHome && typeof TensionMotion !== "undefined") return TensionMotion.brandMarkup(lang);
  return `<div class="lead-art"><img src="assets/after-hours.png" alt="${t("Abstract brass sculpture with a pale green glass edge", "Абстрактна латунна скульптура зі світло-зеленим скляним краєм")}" width="1672" height="941">${caption ? `<span class="art-caption">${t("CONCEPT ART · AFTER HOURS", "КОНЦЕПТ-АРТ · AFTER HOURS")}</span>` : ""}</div>`;
};
const visual = (n) =>
  `<div class="card-visual" aria-hidden="true">${n % 3 === 0 ? '<div class="diagram-lines"><i></i><i></i><i></i></div>' : n % 3 === 1 ? '<div class="diagram-code">{ context }<br>→ action →</div>' : '<div class="diagram-orbit"></div>'}</div>`;
const stories = () => [
  {
    title: t("The agent era needs a better memory.", "Епосі агентів потрібна краща пам’ять."),
    cat: "agents",
    label: "Agents & MCP",
    summary: t(
      "The next useful question is what an agent remembers, and who gets to decide.",
      "Наступне важливе питання — що агент пам’ятає і хто це вирішує.",
    ),
    time: "09:40",
    route: "article?variant=analysis",
  },
  {
    title: t("Prompt caching, beyond the price tag", "Prompt caching: більше, ніж економія"),
    cat: "cost",
    label: t("Cost & performance", "Вартість і продуктивність"),
    summary: t(
      "A practical lens on stable context, cache boundaries and useful measurements.",
      "Практичний погляд на стабільний контекст, межі кешу та корисні вимірювання.",
    ),
    time: "09:15",
    route: "article?variant=technical",
  },
  {
    title: t(
      "When your coding agent needs a second opinion",
      "Коли агенту для коду потрібна друга думка",
    ),
    cat: "tools",
    label: t("Developer tools", "Інструменти розробника"),
    summary: t(
      "Design the review step before giving a workflow more autonomy.",
      "Спершу спроєктуйте перевірку, а потім додавайте автономність.",
    ),
    time: "08:50",
    route: "article?variant=analysis",
  },
  {
    title: t("A benchmark is a starting point. What comes next?", "Бенчмарк — початок. Що далі?"),
    cat: "models",
    label: t("Models & research", "Моделі й дослідження"),
    summary: t(
      "Read the task, setup and constraints before reading the leaderboard.",
      "Читайте завдання, умови та обмеження до таблиці лідерів.",
    ),
    time: "08:20",
    route: "article?variant=evidence",
  },
  {
    title: t("Make the context window work for you", "Змусьте контекстне вікно працювати на вас"),
    cat: "agents",
    label: "Agents & MCP",
    summary: t(
      "A small map of what belongs in a reusable agent instruction.",
      "Коротка карта того, що варто включати в інструкції агента.",
    ),
    time: "07:45",
    route: "article?variant=technical",
  },
];
const categoryNames = () => [
  t("All stories", "Усі новини"),
  "Agents & MCP",
  t("Developer tools", "Інструменти"),
  t("Models & research", "Моделі"),
  t("Cost & performance", "Оптимізація"),
];
const sectionHead = (title, route, text = t("Explore", "Переглянути")) =>
  `<div class="section-head"><h2>${title}</h2>${route ? link(route, `${text} ${arrow}`) : ""}</div>`;
function header(route) {
  const l = labels();
  const nav = [
    "news",
    "digests",
    "concepts",
    "guides",
    "tools",
    "categories",
    "about",
    "subscribe",
  ];
  return `<div class="preview"><span>${t("DESIGN CONCEPT · AFTER HOURS · Illustrative content", "КОНЦЕПЦІЯ ДИЗАЙНУ · AFTER HOURS · Демонстраційний контент")}</span>${link("system", t("Explore the concept ↗", "Огляд концепції ↗"))}</div><header class="header"><div class="wrap"><div class="header-top">${link("home", `<img src="assets/mark.svg" alt=""><span>AI Today Brief<small>${t("THE INTELLIGENCE EDIT", "РЕДАКЦІЯ AI-НОВИН")}</small></span>`, "wordmark")}<button class="icon-btn" data-search aria-label="${t("Open search", "Відкрити пошук")}">⌕</button><button class="icon-btn" data-lang aria-label="${t("Switch to Ukrainian", "Switch to English")}">${lang === "en" ? "UK" : "EN"}</button><button class="icon-btn" data-theme aria-label="${t("Change reading theme", "Змінити тему читання")}">${theme === "night" ? "☼" : "◐"}</button>${link("subscribe", t("Get the brief ↗", "Отримувати бриф ↗"), "button header-subscribe")}<button class="icon-btn mobile-menu" aria-label="${t("Open menu", "Відкрити меню")}" aria-expanded="false" data-menu>☰</button></div><nav class="nav" aria-label="${t("Main navigation", "Головна навігація")}">${nav.map((r) => link(r, l[r], route === r || { article: "news", daily: "digests", weekly: "digests", concept: "concepts", guide: "guides", tool: "tools", category: "categories" }[route] === r ? "active" : "")).join("")}<span class="nav-note">${t("HUMAN-EDITED. FUTURE-FOCUSED.", "ЛЮДСЬКИЙ ПОГЛЯД НА МАЙБУТНЄ.")}</span></nav></div></header>`;
}
function footer() {
  return `<footer class="footer"><div class="wrap"><div class="footer-grid"><div>${link("home", 'AI Today Brief<span aria-hidden="true">.</span>', "wordmark")}<p>${t("A little perspective. Every day.", "Трохи перспективи. Щодня.")}</p></div><div class="footer-links">${["news", "digests", "concepts", "guides", "tools", "about", "subscribe", "advertise", "policy"].map((r) => link(r, labels()[r])).join("")}</div></div><div class="footer-bottom"><p>© 2026 AI Today Brief · EN / UK</p><div>${link("saved", t("Reading list", "Збережене"))} · ${link("system", t("Design system", "Дизайн-система"))} · ${link("states", t("UI states", "Стани UI"))}</div></div></div></footer>`;
}
function newsletter() {
  return `<section class="newsletter"><div>${eyebrow(t("YOUR DAILY READING RITUAL", "ВАШ ЩОДЕННИЙ РИТУАЛ ЧИТАННЯ"))}<h2 class="mt">${t("Make room for perspective.", "Знайдіть час для перспективи.")}</h2><p>${t("A considered AI briefing, delivered to your inbox.", "Вдумливий AI-бриф у вашій пошті.")}</p></div><div><form class="inline-form" data-subscribe><label class="sr-only" for="email-inline">Email</label><input id="email-inline" type="email" required placeholder="you@example.com" autocomplete="email"><button class="button">${t("Get the brief", "Отримувати бриф")} ↗</button><p class="form-status" aria-live="polite"></p></form><p class="form-note">${t("Free to read. Unsubscribe whenever you like.", "Безкоштовно. Відписатися можна будь-коли.")} ${link("policy", t("Privacy", "Приватність"))}</p></div></section>`;
}
function home() {
  return `<div class="masthead"><h1>${t("Tomorrow, <em>in context.</em>", "Майбутнє. <em>З контекстом.</em>")}</h1><p>${t("AI news for people who build. A considered selection, a clearer point of view.", "AI-новини для тих, хто створює. Уважний відбір. Зрозумілий погляд.")}</p></div><div class="dateline"><span><i class="live-dot"></i>${t("SATURDAY, 05 SEPTEMBER 2026", "СУБОТА, 05 ВЕРЕСНЯ 2026")}</span><span>${t("THE DAILY EDIT / 5 MIN READ", "ЩОДЕННИЙ ВИПУСК / 5 ХВ")}</span></div><div class="lead-grid"><article class="lead"><div class="lead-copy">${eyebrow(t("THE BIG IDEA / AGENTS & MCP", "ГОЛОВНА ТЕМА / AGENTS & MCP"))}<h2>${link("article", stories()[0].title)}</h2><p>${stories()[0].summary}</p>${btn("article", t("Read the story", "Читати матеріал"), true)}<p class="meta mt">${t("EDITORIAL PREVIEW · 4 MIN", "РЕДАКЦІЙНИЙ ПРИКЛАД · 4 ХВ")}</p></div>${art()}</article><aside class="brief-rail">${eyebrow(t("TODAY, DISTILLED", "СЬОГОДНІ. ПО СУТІ."))}<h2>${t("The short version.", "Коротка версія.")}</h2>${stories()
    .slice(1, 4)
    .map(
      (s, i) =>
        `<div class="mini-row"><span>0${i + 1}</span><div><h3>${link("daily", s.title)}</h3><p>${s.label}</p></div></div>`,
    )
    .join(
      "",
    )}${btn("daily", t("Read today’s brief", "Читати бриф дня"))}</aside></div><div class="signal-strip">${eyebrow(t("IN FOCUS", "У ФОКУСІ"))}${["MCP", t("Agent memory", "Пам’ять агентів"), "Prompt caching", t("Coding workflows", "Робота з кодом")].map((s) => link("concept", s + " ↗")).join("")}</div><section class="section">${sectionHead(t("On the radar", "У полі зору"), "news", t("All news", "Усі новини"))}<div class="grid3">${stories()
    .slice(1, 4)
    .map(
      (s, i) =>
        `<article class="card">${visual(i)}${eyebrow(s.label)}<h3>${link("article", s.title)}</h3><p>${s.summary}</p><span class="meta">${t("EDITORIAL PREVIEW", "РЕДАКЦІЙНИЙ ПРИКЛАД")} · ${i + 3} ${t("MIN", "ХВ")}</span></article>`,
    )
    .join(
      "",
    )}</div></section><section class="section">${sectionHead(t("The longer view", "Ширший погляд"), "digests", t("The archive", "Архів"))}${weeklyFeature()}</section><section class="section">${sectionHead(t("From knowing to building.", "Від розуміння до дії."), "concepts")}<div class="grid3">${[
    [
      "concepts",
      t("Understand the ideas", "Зрозуміти ідеї"),
      t(
        "A living reference for the language of AI engineering.",
        "Живий довідник мови AI-інженерії.",
      ),
    ],
    [
      "guides",
      t("Find your next move", "Обрати наступний крок"),
      t(
        "Comparisons and practical frameworks for real decisions.",
        "Порівняння й практичні підходи для реальних рішень.",
      ),
    ],
    [
      "tools",
      t("Work a little smarter", "Працювати розумніше"),
      t(
        "Small, local-first utilities. Built to be useful.",
        "Невеликі локальні утиліти. Створені для користі.",
      ),
    ],
  ]
    .map(
      ([r, h, p], i) =>
        `<div class="card">${eyebrow("0" + (i + 1) + " / " + labels()[r])}<h3>${link(r, h + " ↗")}</h3><p>${p}</p></div>`,
    )
    .join("")}</div></section>${newsletter()}`;
}
function weeklyFeature() {
  return `<div class="week-block"><div class="week-cover">${eyebrow("AI TODAY BRIEF / WEEKLY")}<h3>${t("The shape<br>of what’s next.", "Контури<br>майбутнього.")}</h3><p class="meta spaced" style="color:#d4b483">${t("DESIGN EDITION / 01", "ДИЗАЙН-ВИПУСК / 01")}</p></div><div class="week-copy">${eyebrow(t("THE WEEKLY EDITION", "ТИЖНЕВИЙ ВИПУСК"))}<h2>${t("Less noise.<br>A longer view.", "Менше шуму.<br>Ширший погляд.")}</h2><p>${t("Three shifts, the connections between them, and what to try next week.", "Три зрушення, зв’язки між ними й те, що варто спробувати наступного тижня.")}</p>${btn("weekly", t("Open the edition", "Відкрити випуск"), true)}</div></div>`;
}
const intro = (tag, title, description) =>
  `<div class="page-intro">${eyebrow(tag)}<h1>${title}</h1><p>${description}</p></div>`;
function filterBar(kind = "news") {
  const values =
    kind === "digests"
      ? ["all", "daily", "weekly"]
      : kind === "concepts"
        ? ["all", "concept", "product", "library"]
        : ["all", "agents", "tools", "models", "cost"];
  const names =
    kind === "digests"
      ? [t("All editions", "Усі випуски"), "Daily", "Weekly"]
      : kind === "concepts"
        ? [
            t("All entries", "Усі записи"),
            t("Concepts", "Концепти"),
            t("Products", "Продукти"),
            t("Libraries & APIs", "Бібліотеки й API"),
          ]
        : categoryNames();
  return `<div class="filters" aria-label="${t("Filter content", "Фільтр матеріалів")}">${values.map((v, i) => `<button class="chip" data-filter="${v}" aria-pressed="${activeFilter === v}">${names[i]}</button>`).join("")}</div>`;
}
const feedRows = (items) =>
  items
    .map(
      (s, i) =>
        `<article class="feed-row"><span class="meta">${s.time}<br>${t("05 SEP", "05 ВЕР")}</span><div>${eyebrow(s.label)}<h2 class="mt">${link(s.route, s.title)}</h2><p>${s.summary}</p></div>${visual(i)}</article>`,
    )
    .join("");
const NEWS_CATEGORIES = [
  { id: "tools-and-releases", name: "Tools & releases", ukName: "Інструменти та релізи", color: "#34d399", icon: "🛠️", dotClass: "cat-tools" },
  { id: "tutorials-and-guides", name: "Tutorials & guides", ukName: "Інструкції та гайди", color: "#fbbf24", icon: "📖", dotClass: "cat-tutorials" },
  { id: "token-and-cost-optimization", name: "Token & cost optimization", ukName: "Оптимізація токенів і вартості", color: "#22d3ee", icon: "⚡", dotClass: "cat-token" },
  { id: "agents-and-mcp", name: "Agents & MCP", ukName: "Агенти та MCP", color: "#a78bfa", icon: "🤖", dotClass: "cat-agents" },
  { id: "vibe-coding-workflow", name: "Vibe coding workflow", ukName: "Vibe coding процеси", color: "#f472b6", icon: "✨", dotClass: "cat-vibe" },
  { id: "creative-ai", name: "Creative AI", ukName: "Креативний AI", color: "#fb7185", icon: "🎨", dotClass: "cat-creative" },
  { id: "local-llms", name: "Local LLMs", ukName: "Локальні LLM", color: "#60a5fa", icon: "💻", dotClass: "cat-local" },
  { id: "career-and-monetisation", name: "Career & monetisation", ukName: "Кар'єра та монетизація", color: "#eab308", icon: "💼", dotClass: "cat-career" },
  { id: "models-and-research", name: "Models & research", ukName: "Моделі та дослідження", color: "#c084fc", icon: "🔬", dotClass: "cat-models" },
];

const CATEGORY_META = {
  "tools-and-releases": { count: 33, icon: "🛠️", color: "#34d399", name: "Tools & releases", ukName: "Інструменти та релізи" },
  "tutorials-and-guides": { count: 4, icon: "📖", color: "#fbbf24", name: "Tutorials & guides", ukName: "Інструкції та гайди" },
  "token-and-cost-optimization": { count: 6, icon: "⚡", color: "#22d3ee", name: "Token & cost optimization", ukName: "Оптимізація токенів і вартості" },
  "agents-and-mcp": { count: 33, icon: "🤖", color: "#a78bfa", name: "Agents & MCP", ukName: "Агенти та MCP" },
  "vibe-coding-workflow": { count: 7, icon: "✨", color: "#f472b6", name: "Vibe coding workflow", ukName: "Vibe coding процеси" },
  "creative-ai": { count: 3, icon: "🎨", color: "#fb7185", name: "Creative AI", ukName: "Креативний AI" },
  "local-llms": { count: 5, icon: "💻", color: "#60a5fa", name: "Local LLMs", ukName: "Локальні LLM" },
  "career-and-monetisation": { count: 0, icon: "💼", color: "#eab308", name: "Career & monetisation", ukName: "Кар'єра та монетизація" },
  "models-and-research": { count: 9, icon: "🔬", color: "#c084fc", name: "Models & research", ukName: "Моделі та дослідження" },
};

const HOT_TOPICS = [
  "#MCP",
  "#Cursor",
  "#Claude Code",
  "#RAG",
  "#PromptCaching",
  "#LocalModels",
  "#TokenOptimization",
  "#Benchmarks",
];

const NEWS_STORIES = [
  {
    id: "cursor-harness-tuning",
    cat: "agents-and-mcp",
    date: "Sep 25, 2026",
    readTime: "2 min read",
    title: "Cursor Shares Harness Tuning Prompt to Cut Agent Token Overhead",
    ukTitle: "Cursor ділиться промптом для налаштування харнесу та скорочення оверхеду токенів",
    summary: "Cursor has shared a prompt for improving the token efficiency of AI agent harnesses. One round of prompt trimming, tool offloading, and cache layout changes cut one production team's overall token cost by about 7% with no loss in quality. Offloading non-core tools cut tool-description...",
    ukSummary: "Cursor опублікував промпт для підвищення токен-ефективності харнесів AI-агентів. Один раунд скорочення промптів, розвантаження інструментів і перебудови кешу знизив загальні витрати команди на 7% без втрати якості. Винесення другорядних інструментів зменшило описи функцій...",
    whyItMatters: "Agent harness overhead often consumes up to 40% of context window limits before any user input is processed. Fine-tuning harness prompts and isolating dynamic tools allows agents to preserve prefix caching and slash recursive generation bills.",
    ukWhyItMatters: "Оверхед харнесу агента часто забирає до 40% ліміту контекстного вікна ще до обробки запиту користувача. Точне налаштування промптів і винесення динамічних інструментів зберігає prefix caching і знижує витрати на рекурсивну генерацію.",
    takeaways: [
      "Trimming system prompt boilerplate saved 4,200 tokens per sub-agent invocation",
      "Dynamic tool declarations were moved behind on-demand MCP discovery endpoints",
      "Cache hit rates increased from 38% to 74% across multi-turn reasoning loops"
    ],
    ukTakeaways: [
      "Скорочення шаблонного системного промпту заощадило 4 200 токенів на кожний виклик субагента",
      "Динамічні декларації інструментів перенесено в ендпоінти MCP з викликом за вимогою",
      "Частка попадань у кеш зросла з 38% до 74% у багатоходових циклах міркувань"
    ],
    tags: ["#Cursor", "#MCP", "#PromptCaching", "#TokenOptimization"],
    period: "week",
    commentsCount: 14,
    discussScore: 89,
    timestamp: 1790380800000,
    thumbGradient: "linear-gradient(135deg, #1e1b4b, #4338ca)"
  },
  {
    id: "whiteboard-visual-ide",
    cat: "tools-and-releases",
    date: "Sep 25, 2026",
    readTime: "2 min read",
    title: "Whiteboard Open-Sources Visual Design Integrated Development Environment for Coding Agents",
    ukTitle: "Whiteboard відкриває вихідний код візуального IDE для кодуючих агентів",
    summary: "Whiteboard released an open-source desktop application that bridges visual software architecture and code review for agents like Claude Code and Codex. It includes a Rust AST diff viewer and an agent canvas Software Development Kit.",
    ukSummary: "Whiteboard випустив десктопний додаток із відкритим кодом, що поєднує візуальну архітектуру програмного забезпечення та код-рев'ю для таких агентів, як Claude Code і Codex. До складу входить переглядач Rust AST diff та SDK канвасу агентів.",
    whyItMatters: "Visualizing AST transformations in real time allows engineering leads to spot structural hallucination and incorrect refactoring before code commits reach CI/CD pipelines.",
    ukWhyItMatters: "Візуалізація трансформацій AST у реальному часі дає змогу лідам помічати структурні галюцинації та помилковий рефакторинг до того, як код потрапить у пайплайни CI/CD.",
    takeaways: [
      "Native desktop client written in Tauri and Rust for zero latency diffing",
      "Bidirectional protocol for Claude Code and OpenAI Codex workspace sync",
      "Interactive dependency graph updates live as the agent modifies files"
    ],
    ukTakeaways: [
      "Нативний клієнт на Tauri та Rust для миттєвого порівняння diff",
      "Двосторонній протокол синхронізації робочої області Claude Code та Codex",
      "Інтерактивний граф залежностей оновлюється наживо при зміні файлів агентом"
    ],
    tags: ["#Claude Code", "#LocalModels", "#Cursor"],
    period: "week",
    commentsCount: 22,
    discussScore: 95,
    timestamp: 1790370000000,
    thumbGradient: "linear-gradient(135deg, #064e3b, #059669)"
  },
  {
    id: "prompt-caching-deep-dive",
    cat: "token-and-cost-optimization",
    date: "Sep 26, 2026",
    readTime: "4 min read",
    title: "The 70% Token Cut: How Prompt Caching Rewrites Production Economics",
    ukTitle: "Скорочення токенів на 70%: як Prompt Caching змінює продакшн-економіку",
    summary: "A practical investigation into stable context windows, cache eviction boundaries, and how top engineering teams keep agent latency under 800ms while slashing API bills.",
    ukSummary: "Практичне дослідження стабільних контекстних вікон, меж скидання кешу та способів утримання затримки агентів нижче 800 мс із різким скороченням витрат на API.",
    whyItMatters: "Prompt caching transforms multi-agent workflows from prohibitive cost centers into scalable background processes when instructions and schemas are strictly partitioned.",
    ukWhyItMatters: "Prompt caching перетворює багатагентні процеси з дорогих центрів витрат на масштабовані фонові сервіси за умови чіткого структурування інструкцій і схем.",
    takeaways: [
      "Prefix alignment requires deterministic serializer ordering for tool definitions",
      "Sub-agent harnesses achieve 82% cache reuse across iterative refactoring steps",
      "Production teams report up to 74% monthly cost savings on tier-1 reasoning models"
    ],
    ukTakeaways: [
      "Узгодження префіксів вимагає детермінованого порядку серіалізації описів інструментів",
      "Харнеси субагентів досягають 82% повторного використання кешу в ітеративному кодуванні",
      "Команди повідомляють про зниження щомісячних витрат на 74% на моделях міркувань"
    ],
    tags: ["#PromptCaching", "#TokenOptimization", "#MCP"],
    period: "today",
    commentsCount: 31,
    discussScore: 98,
    timestamp: 1790440000000,
    thumbGradient: "linear-gradient(135deg, #155e75, #0891b2)"
  },
  {
    id: "deepseek-v3-quant-report",
    cat: "local-llms",
    date: "Sep 26, 2026",
    readTime: "3 min read",
    title: "DeepSeek-V3 Quantization Field Report: Running 671B Locally on 4x RTX 4090",
    ukTitle: "Звіт квантування DeepSeek-V3: запуск 671B локально на 4x RTX 4090",
    summary: "Hardware benchmarks for running MoE 671B parameters using custom FP8 and AWQ kernels on consumer GPU clusters with 18 tokens per second inference speeds.",
    ukSummary: "Апаратні бенчмарки запуску MoE 671B за допомогою кастомних ядер FP8 та AWQ на споживчих кластерах GPU зі швидкістю генерації 18 токенів за секунду.",
    whyItMatters: "Data privacy regulations and offline resilience make local high-end reasoning feasible for regulated enterprises without cloud dependency.",
    ukWhyItMatters: "Вимоги до приватності даних та автономність роблять локальні топові моделі доступними для корпоративного сектору без хмарної залежності.",
    takeaways: [
      "Expert offloading via unified PCIe memory achieves 18.4 tokens/sec throughput",
      "AWQ 4-bit preserves 99.1% of MMLU-Pro benchmark scores compared to FP16",
      "Peak VRAM consumption fits within 96GB combined cluster ceiling"
    ],
    ukTakeaways: [
      "Розвантаження експертів через спільну PCIe пам'ять дає швидкість 18.4 ток/сек",
      "AWQ 4-bit зберігає 99.1% балів тесту MMLU-Pro порівняно з FP16",
      "Пікове споживання відеопам'яті не перевищує спільний ліміт 96 ГБ"
    ],
    tags: ["#LocalModels", "#Benchmarks", "#Models"],
    period: "today",
    commentsCount: 19,
    discussScore: 84,
    timestamp: 1790435000000,
    thumbGradient: "linear-gradient(135deg, #1e3a8a, #2563eb)"
  },
  {
    id: "autonomous-code-reviewer-guide",
    cat: "tutorials-and-guides",
    date: "Sep 24, 2026",
    readTime: "5 min read",
    title: "Building an Autonomous Code Reviewer with MCP and GitHub Actions",
    ukTitle: "Створення автономного код-рев'юера з MCP та GitHub Actions",
    summary: "Step-by-step walkthrough of connecting an AST-aware semantic linting agent directly to PR workflows with verified deterministic verdicts and no noisy nitpicks.",
    ukSummary: "Покроковий посібник підключення семантичного лінтера на базі AST до PR-процесів із детермінованими висновками без дріб'язкових зауважень.",
    whyItMatters: "Standard LLM review bots fail on hallocinated style rules. Grounding reviews in MCP-driven repo tools ensures high developer trust.",
    ukWhyItMatters: "Звичайні LLM-боти спамлять вигаданими зауваженнями. Заземлення перевірок через MCP інструменти забезпечує високу довіру інженерів.",
    takeaways: [
      "Custom AST diff filter passes only altered call graphs to the LLM",
      "Verification step rejects any suggestion that breaks existing test suites",
      "Developers accepted 84% of generated patch recommendations"
    ],
    ukTakeaways: [
      "Кастомний фільтр AST передає в LLM лише змінені графи викликів",
      "Крок верифікації відхиляє будь-яку правку, що ламає наявні тести",
      "Розробники прийняли 84% запропонованих автоматичних патчів"
    ],
    tags: ["#MCP", "#Claude Code", "#Cursor"],
    period: "week",
    commentsCount: 27,
    discussScore: 92,
    timestamp: 1790290000000,
    thumbGradient: "linear-gradient(135deg, #78350f, #d97706)"
  },
  {
    id: "vibe-coding-solo-founders",
    cat: "vibe-coding-workflow",
    date: "Sep 23, 2026",
    readTime: "3 min read",
    title: "Vibe Coding at Series A: How Solo Founders Ship Full-Stack SaaS in 14 Days",
    ukTitle: "Vibe Coding на стадії Series A: як соло-фаундери запускають SaaS за 14 днів",
    summary: "An unfiltered analysis of prompt-first software architecture, the risks of technical debt accumulation, and practical safety harnesses for solo builders.",
    ukSummary: "Чесний аналіз prompt-first архітектури ПЗ, ризиків накопичення техборгу та захисних харнесів для соло-розробників.",
    whyItMatters: "Rapid shipping speed creates competitive moats, but without strict schema contracts and automated test gates, vibe-coded codebases become unmaintainable.",
    ukWhyItMatters: "Швидкість запуску дає перевагу, але без суворих схем і тестів код стає непідтримуваним за лічені тижні.",
    takeaways: [
      "Contract-first OpenAPI specs prevent agent drift across full-stack boundaries",
      "Snapshot tests on every generation cycle catch regressions immediately",
      "Zero-dependency utility layers reduce supply-chain vulnerability surfaces"
    ],
    ukTakeaways: [
      "Специфікації OpenAPI за принципом contract-first запобігають розсинхронізації",
      "Снепшот-тести на кожному циклі генерації миттєво ловлять регресії",
      "Мінімалістичні утиліти без сторонніх бібліотек зменшують вразливості"
    ],
    tags: ["#Cursor", "#Claude Code", "#VibeCoding"],
    period: "week",
    commentsCount: 42,
    discussScore: 99,
    timestamp: 1790200000000,
    thumbGradient: "linear-gradient(135deg, #831843, #db2777)"
  },
  {
    id: "svg-generation-benchmarks",
    cat: "creative-ai",
    date: "Sep 18, 2026",
    readTime: "3 min read",
    title: "SVG Generation Benchmarks: Claude 3.7 Sonnet vs GPT-4.5 for UI Prototypes",
    ukTitle: "Бенчмарки генерації SVG: Claude 3.7 Sonnet проти GPT-4.5 для UI-прототипів",
    summary: "Evaluating raw coordinate precision, path minimization, semantic layering, and responsive viewBox scaling across complex vector icon sets.",
    ukSummary: "Оцінка точності координат, оптимізації кривих path, семантичних шарів та адаптивного масштабування viewBox для векторних іконок.",
    whyItMatters: "Generative SVG enables zero-asset dynamic UI rendering directly in modern browser web applications.",
    ukWhyItMatters: "Генеративний SVG дозволяє динамічно рендерити інтерфейсні ілюстрації без завантаження важких растрових файлів.",
    takeaways: [
      "Claude 3.7 produced valid geometric paths without clipping on 96% of prompts",
      "GPT-4.5 excels at intricate organic silhouettes with gradient fills",
      "Generated vectors weigh an average of 4.2KB compared to 120KB WebP images"
    ],
    ukTakeaways: [
      "Claude 3.7 згенерував валідні геометричні контури без обрізання у 96% спроб",
      "GPT-4.5 перевершує у складних силуетах із плавними градієнтними заливками",
      "Згенеровані вектори важать у середньому 4.2 КБ проти 120 КБ для WebP"
    ],
    tags: ["#Benchmarks", "#CreativeAI"],
    period: "month",
    commentsCount: 9,
    discussScore: 71,
    timestamp: 1789780000000,
    thumbGradient: "linear-gradient(135deg, #881337, #e11d48)"
  },
  {
    id: "ai-engineering-salaries-2026",
    cat: "career-and-monetisation",
    date: "Sep 15, 2026",
    readTime: "4 min read",
    title: "State of AI Engineering Salaries: Staff Agent Engineers Command $320k Base",
    ukTitle: "Ринок зарплат AI-інженерів 2026: Staff Agent Engineers отримують від $320k",
    summary: "Industry compensation breakdown across US and EU tech hubs. The shift from generic prompt engineering to deterministic agent evaluation and harness tuning.",
    ukSummary: "Огляд компенсацій у технічних хабах США та ЄС. Перехід від написання промптів до детермінованого оцінювання агентів і тюнінгу харнесів.",
    whyItMatters: "Talent scarcity in production reliability and multi-agent coordination makes senior agent harness architects the highest-paid frontend/backend hybrids.",
    ukWhyItMatters: "Дефіцит інженерів із надійності агентів робить спеціалістів із харнесів найбільш високооплачуваними на ринку.",
    takeaways: [
      "Demand for eval engineers grew 240% year-over-year in Series B+ ventures",
      "MCP protocol experience listed in 41% of tier-1 staff infrastructure roles",
      "European remote salaries narrowed the gap to 82% of US equivalents"
    ],
    ukTakeaways: [
      "Попит на інженерів з оцінювання моделей зріс на 240% за рік",
      "Досвід роботи з протоколом MCP зустрічається у 41% провідних вакансій",
      "Європейські віддалені ставки скоротили розрив до 82% від рівня США"
    ],
    tags: ["#Career", "#MCP", "#Benchmarks"],
    period: "month",
    commentsCount: 38,
    discussScore: 94,
    timestamp: 1789500000000,
    thumbGradient: "linear-gradient(135deg, #713f12, #ca8a04)"
  },
  {
    id: "reasoning-models-inference-compute",
    cat: "models-and-research",
    date: "Sep 26, 2026",
    readTime: "5 min read",
    title: "Reasoning Models in Production: Inference-Time Compute vs Fine-Tuning",
    ukTitle: "Моделі міркувань у продакшні: обчислення під час інференсу проти fine-tuning",
    summary: "Empirical study comparing test-time search budgets against specialized LoRA adapters for coding, logic planning, and tool invocation accuracy.",
    ukSummary: "Емпіричне дослідження порівняння бюджетів пошуку на етапі тестування зі спеціалізованими адаптерами LoRA для кодування та логіки.",
    whyItMatters: "Understanding when to spend compute at inference versus training time defines product cost curves and user perceived response times.",
    ukWhyItMatters: "Розуміння того, коли витрачати ресурси — при генерації чи при навчанні, визначає собівартість продукту та швидкість відповіді.",
    takeaways: [
      "Test-time compute achieves superior generalization on novel edge cases",
      "Specialized LoRA reduces time-to-first-token by 3.5x for known schemas",
      "Hybrid architectures route simple requests to fine-tuned edge models"
    ],
    ukTakeaways: [
      "Обчислення на етапі генерації дають кращі результати на нестандартних задачах",
      "Спеціалізовані LoRA прискорюють видачу першого токена в 3.5 раза для відомих схем",
      "Гібридні системи скеровують прості запити на швидкі локальні моделі"
    ],
    tags: ["#Models", "#Benchmarks", "#TokenOptimization"],
    period: "today",
    commentsCount: 17,
    discussScore: 86,
    timestamp: 1790430000000,
    thumbGradient: "linear-gradient(135deg, #581c87, #9333ea)"
  },
  {
    id: "ollama-distributed-nodes",
    cat: "local-llms",
    date: "Sep 22, 2026",
    readTime: "2 min read",
    title: "Ollama 0.8 Adds Unified Distributed Inference Across LAN Nodes",
    ukTitle: "Ollama 0.8 додає спільний розподілений інференс на вузлах локальної мережі",
    summary: "Pool multiple Mac Studios, Linux workstations, and gaming rigs into a single coherent OpenAI-compatible API endpoint over local Ethernet.",
    ukSummary: "Об'єднуйте Mac Studio, робочі станції Linux та домашні комп'ютери в єдиний API-ендпоінт, сумісний з OpenAI через локальну мережу.",
    whyItMatters: "Local development teams can run massive 120B+ parameter models without buying dedicated enterprise DGX servers.",
    ukWhyItMatters: "Команди розробників можуть запускати великі моделі на 120B+ параметрів без закупівлі серверів корпоративного класу.",
    takeaways: [
      "Automatic layer partitioning based on measured memory bandwidth",
      "Zero configuration discovery via mDNS on local development networks",
      "Full compatibility with existing Cursor and Claude Code configurations"
    ],
    ukTakeaways: [
      "Автоматичний поділ шарів моделі за пропускною здатністю пам'яті",
      "Нульова конфігурація з виявленням пристроїв через mDNS",
      "Повна сумісність із наявними конфігураціями Cursor та Claude Code"
    ],
    tags: ["#LocalModels", "#Cursor", "#Tools"],
    period: "week",
    commentsCount: 29,
    discussScore: 91,
    timestamp: 1790100000000,
    thumbGradient: "linear-gradient(135deg, #1e3a8a, #3b82f6)"
  },
  {
    id: "structured-outputs-scale",
    cat: "tools-and-releases",
    date: "Sep 12, 2026",
    readTime: "3 min read",
    title: "Structured Outputs at Scale: Pydantic v2 vs Native JSON Schemas in Gemini 2.5",
    ukTitle: "Структурований вивід у масштабі: Pydantic v2 проти нативних схем JSON у Gemini 2.5",
    summary: "Comparing strict grammar-constrained decoding latency, schema recursion limits, and error rates when producing complex nested database migrations.",
    ukSummary: "Порівняння затримки декодування з граматичними обмеженнями, лімітів рекурсії схем та помилок при генерації складних міграцій БД.",
    whyItMatters: "Constrained decoding eliminates JSON parse errors entirely, unlocking reliable autonomous pipelines that interface with SQL databases.",
    ukWhyItMatters: "Обмежене декодування повністю виключає помилки парсингу JSON, забезпечуючи надійну взаємодію агентів із базами даних SQL.",
    takeaways: [
      "Grammar masking adds zero observable latency penalty on Gemini 2.5",
      "Pydantic v2 schema generation reduces client serialization overhead by 60%",
      "Zero schema violations observed across 100,000 synthetic test runs"
    ],
    ukTakeaways: [
      "Маскування граматики не додає жодної помітної затримки в Gemini 2.5",
      "Генерація схем Pydantic v2 зменшує клієнтський оверхед на 60%",
      "Зафіксовано нуль помилок валідації схеми на 100 000 синтетичних тестах"
    ],
    tags: ["#Tools", "#Benchmarks", "#TokenOptimization"],
    period: "month",
    commentsCount: 12,
    discussScore: 78,
    timestamp: 1789200000000,
    thumbGradient: "linear-gradient(135deg, #065f46, #10b981)"
  },
  {
    id: "claude-code-subagent-memory",
    cat: "agents-and-mcp",
    date: "Sep 26, 2026",
    readTime: "3 min read",
    title: "Anthropic Upgrades Claude Code with Sub-Agent Delegation and Memory Isolation",
    ukTitle: "Anthropic оновлює Claude Code: делегування субагентам та ізоляція пам'яті",
    summary: "New session boundaries prevent context pollution while allowing task-specific sub-agents to explore dependency trees and run test suites independently.",
    ukSummary: "Нові межі сесій запобігають засміченню контексту, дозволяючи спеціалізованим субагентам автономно досліджувати залежності та запускати тести.",
    whyItMatters: "Long-running tasks fail when context saturates. Sub-agent delegation keeps parent agent instructions crisp and focused on the primary objective.",
    ukWhyItMatters: "Тривалі задачі дають збій при переповненні контексту. Делегування підзадач зберігає інструкції головного агента точними й сфокусованими.",
    takeaways: [
      "Ephemeral scratch workspaces automatically cleaned up on sub-task exit",
      "Structured handoff reports summarize changes without raw terminal dumps",
      "Multi-agent parallel execution cuts total refactoring time in half"
    ],
    ukTakeaways: [
      "Тимчасові робочі простори автоматично видаляються після виконання підзадачі",
      "Структуровані звіти підсумовують зміни без сирих виводів терміналу",
      "Паралельне виконання субагентів скорочує загальний час рефакторингу вдвічі"
    ],
    tags: ["#Claude Code", "#MCP", "#Cursor"],
    period: "today",
    commentsCount: 48,
    discussScore: 100,
    timestamp: 1790445000000,
    thumbGradient: "linear-gradient(135deg, #3730a3, #6366f1)"
  }
];

const newsState = {
  sort: "newest",
  selectedCategories: new Set(),
  period: "all",
  searchQuery: "",
  selectedTopic: "",
  page: 1,
  pageSize: 4,
  expandedIds: new Set(),
  drawerOpen: false,
};

function renderStoryThumb(story, meta) {
  const c = meta.color || "#d4b483";
  switch (story.id) {
    case "claude-code-subagent-memory":
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sub-agent memory delegation architecture">
        <rect width="140" height="100" fill="#0d111c"/>
        <defs>
          <radialGradient id="g-claude" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#6366f1" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#0d111c" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="70" cy="50" r="45" fill="url(#g-claude)"/>
        <rect x="15" y="12" width="110" height="76" rx="6" stroke="#6366f1" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>
        <circle cx="70" cy="30" r="10" fill="#1e1b4b" stroke="#a78bfa" stroke-width="1.5"/>
        <text x="70" y="33" font-family="monospace" font-size="7" fill="#c7d2fe" text-anchor="middle" font-weight="bold">AGENT</text>
        <path d="M70 40 L40 64 M70 40 L70 64 M70 40 L100 64" stroke="#818cf8" stroke-width="1.2" opacity="0.8"/>
        <rect x="26" y="64" width="28" height="18" rx="4" fill="#1e1b4b" stroke="#a78bfa" stroke-width="1"/>
        <text x="40" y="75" font-family="monospace" font-size="6" fill="#a5b4fc" text-anchor="middle">SUB-1</text>
        <rect x="56" y="64" width="28" height="18" rx="4" fill="#1e1b4b" stroke="#a78bfa" stroke-width="1"/>
        <text x="70" y="75" font-family="monospace" font-size="6" fill="#a5b4fc" text-anchor="middle">SUB-2</text>
        <rect x="86" y="64" width="28" height="18" rx="4" fill="#1e1b4b" stroke="#a78bfa" stroke-width="1"/>
        <text x="100" y="75" font-family="monospace" font-size="6" fill="#a5b4fc" text-anchor="middle">SUB-3</text>
      </svg>`;

    case "prompt-caching-deep-dive":
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Prompt caching token reduction">
        <rect width="140" height="100" fill="#042027"/>
        <rect x="20" y="24" width="100" height="14" rx="3" fill="#064e3b" stroke="#22d3ee" stroke-width="1"/>
        <text x="28" y="34" font-family="monospace" font-size="7" fill="#67e8f9">SYSTEM PREFIX [CACHED]</text>
        <rect x="20" y="42" width="65" height="14" rx="3" fill="#064e3b" stroke="#22d3ee" stroke-width="1"/>
        <text x="28" y="52" font-family="monospace" font-size="7" fill="#67e8f9">TOOL DEFS [HIT]</text>
        <rect x="20" y="60" width="40" height="14" rx="3" fill="#134e4a" stroke="#2dd4bf" stroke-width="1"/>
        <text x="28" y="70" font-family="monospace" font-size="7" fill="#a7f3d0">DIFF</text>
        <rect x="82" y="52" width="38" height="24" rx="4" fill="#083344" stroke="#22d3ee" stroke-width="1.5"/>
        <text x="101" y="64" font-family="monospace" font-size="9" fill="#22d3ee" text-anchor="middle" font-weight="bold">-70%</text>
        <text x="101" y="72" font-family="monospace" font-size="6" fill="#67e8f9" text-anchor="middle">COST</text>
      </svg>`;

    case "deepseek-v3-quant-report":
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DeepSeek 4x GPU cluster inference">
        <rect width="140" height="100" fill="#0b1329"/>
        <rect x="18" y="20" width="46" height="26" rx="3" fill="#172554" stroke="#60a5fa" stroke-width="1"/>
        <text x="41" y="34" font-family="monospace" font-size="6.5" fill="#93c5fd" text-anchor="middle">GPU 0 (AWQ)</text>
        <rect x="76" y="20" width="46" height="26" rx="3" fill="#172554" stroke="#60a5fa" stroke-width="1"/>
        <text x="99" y="34" font-family="monospace" font-size="6.5" fill="#93c5fd" text-anchor="middle">GPU 1 (FP8)</text>
        <rect x="18" y="54" width="46" height="26" rx="3" fill="#172554" stroke="#60a5fa" stroke-width="1"/>
        <text x="41" y="68" font-family="monospace" font-size="6.5" fill="#93c5fd" text-anchor="middle">GPU 2 (FP8)</text>
        <rect x="76" y="54" width="46" height="26" rx="3" fill="#172554" stroke="#60a5fa" stroke-width="1"/>
        <text x="99" y="68" font-family="monospace" font-size="6.5" fill="#93c5fd" text-anchor="middle">GPU 3 (AWQ)</text>
        <circle cx="70" cy="50" r="6" fill="#2563eb" stroke="#93c5fd" stroke-width="1"/>
        <text x="70" y="52" font-family="monospace" font-size="5" fill="#ffffff" text-anchor="middle" font-weight="bold">18</text>
      </svg>`;

    case "cursor-harness-tuning":
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cursor harness tuning">
        <rect width="140" height="100" fill="#121024"/>
        <circle cx="70" cy="50" r="40" stroke="#a78bfa" stroke-width="1" stroke-dasharray="2 4" opacity="0.5"/>
        <path d="M30 50 L110 50" stroke="#4338ca" stroke-width="2"/>
        <rect x="36" y="34" width="68" height="32" rx="5" fill="#1e1b4b" stroke="#818cf8" stroke-width="1.5"/>
        <text x="70" y="47" font-family="monospace" font-size="7.5" fill="#c7d2fe" text-anchor="middle" font-weight="bold">HARNESS</text>
        <text x="70" y="58" font-family="monospace" font-size="6.5" fill="#a78bfa" text-anchor="middle">-4.2k TOKENS</text>
      </svg>`;

    case "whiteboard-visual-ide":
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Whiteboard visual agent IDE">
        <rect width="140" height="100" fill="#052019"/>
        <path d="M20 20 H120 M20 40 H120 M20 60 H120 M20 80 H120 M40 15 V85 M70 15 V85 M100 15 V85" stroke="#064e3b" stroke-width="0.75" opacity="0.6"/>
        <rect x="22" y="30" width="38" height="24" rx="4" fill="#064e3b" stroke="#34d399" stroke-width="1.2"/>
        <text x="41" y="44" font-family="monospace" font-size="7" fill="#a7f3d0" text-anchor="middle">AST NODE</text>
        <path d="M60 42 C72 42, 68 62, 80 62" stroke="#34d399" stroke-width="1.5" fill="none"/>
        <rect x="80" y="50" width="40" height="24" rx="4" fill="#064e3b" stroke="#34d399" stroke-width="1.2"/>
        <text x="100" y="64" font-family="monospace" font-size="7" fill="#a7f3d0" text-anchor="middle">DIFF VIEW</text>
      </svg>`;

    case "autonomous-code-reviewer-guide":
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Autonomous code reviewer AST graph">
        <rect width="140" height="100" fill="#241306"/>
        <rect x="18" y="16" width="104" height="68" rx="6" fill="#451a03" stroke="#fbbf24" stroke-width="1"/>
        <line x1="28" y1="30" x2="68" y2="30" stroke="#f87171" stroke-width="2"/>
        <line x1="28" y1="40" x2="88" y2="40" stroke="#34d399" stroke-width="2"/>
        <line x1="28" y1="50" x2="55" y2="50" stroke="#34d399" stroke-width="2"/>
        <circle cx="98" cy="40" r="12" fill="#14532d" stroke="#4ade80" stroke-width="1.5"/>
        <path d="M93 40 L97 44 L104 36" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="70" y="74" font-family="monospace" font-size="6.5" fill="#fde68a" text-anchor="middle">AST REVIEW PASS</text>
      </svg>`;

    case "vibe-coding-solo-founders":
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vibe coding full-stack architecture">
        <rect width="140" height="100" fill="#260b1e"/>
        <rect x="25" y="20" width="90" height="16" rx="3" fill="#4c0519" stroke="#f472b6" stroke-width="1"/>
        <text x="70" y="31" font-family="monospace" font-size="7" fill="#fbcfe8" text-anchor="middle">1. PROMPT / SPEC</text>
        <rect x="25" y="40" width="90" height="16" rx="3" fill="#831843" stroke="#f472b6" stroke-width="1"/>
        <text x="70" y="51" font-family="monospace" font-size="7" fill="#fbcfe8" text-anchor="middle">2. OPENAPI CONTRACT</text>
        <rect x="25" y="60" width="90" height="16" rx="3" fill="#4c0519" stroke="#f472b6" stroke-width="1"/>
        <text x="70" y="71" font-family="monospace" font-size="7" fill="#fbcfe8" text-anchor="middle">3. GENERATED SAAS</text>
      </svg>`;

    case "svg-generation-benchmarks":
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SVG generation bezier vector benchmarks">
        <rect width="140" height="100" fill="#200a12"/>
        <path d="M25 70 C40 20, 80 80, 115 30" stroke="#fb7185" stroke-width="2.5" fill="none"/>
        <circle cx="40" cy="20" r="3" fill="#ffe4e6"/>
        <circle cx="80" cy="80" r="3" fill="#ffe4e6"/>
        <line x1="25" y1="70" x2="40" y2="20" stroke="#fda4af" stroke-width="1" stroke-dasharray="2 2"/>
        <line x1="115" y1="30" x2="80" y2="80" stroke="#fda4af" stroke-width="1" stroke-dasharray="2 2"/>
        <text x="70" y="90" font-family="monospace" font-size="7" fill="#fecdd3" text-anchor="middle">BEZIER PRECISION</text>
      </svg>`;

    case "ai-engineering-salaries-2026":
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AI engineering salary trends">
        <rect width="140" height="100" fill="#221706"/>
        <path d="M20 75 L50 60 L80 48 L115 25" stroke="#eab308" stroke-width="2.5" fill="none"/>
        <circle cx="115" cy="25" r="4" fill="#fef08a"/>
        <text x="115" y="18" font-family="monospace" font-size="7.5" fill="#fef08a" text-anchor="end" font-weight="bold">$320k</text>
        <line x1="20" y1="80" x2="120" y2="80" stroke="#451a03" stroke-width="1"/>
        <text x="70" y="90" font-family="monospace" font-size="6.5" fill="#fde047" text-anchor="middle">STAFF AGENT ARCHITECT</text>
      </svg>`;

    case "reasoning-models-inference-compute":
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Reasoning models inference compute">
        <rect width="140" height="100" fill="#1e0b2b"/>
        <circle cx="70" cy="22" r="7" fill="#581c87" stroke="#c084fc" stroke-width="1.2"/>
        <path d="M70 29 L45 48 M70 29 L95 48" stroke="#a855f7" stroke-width="1.2"/>
        <circle cx="45" cy="48" r="6" fill="#3b0764" stroke="#c084fc" stroke-width="1"/>
        <circle cx="95" cy="48" r="6" fill="#581c87" stroke="#c084fc" stroke-width="1.5"/>
        <path d="M95 54 L80 72 M95 54 L110 72" stroke="#a855f7" stroke-width="1.2"/>
        <circle cx="80" cy="72" r="5" fill="#3b0764" stroke="#c084fc" stroke-width="1"/>
        <circle cx="110" cy="72" r="5" fill="#9333ea" stroke="#e9d5ff" stroke-width="1.5"/>
        <text x="70" y="90" font-family="monospace" font-size="6.5" fill="#e9d5ff" text-anchor="middle">TEST-TIME SEARCH</text>
      </svg>`;

    case "ollama-distributed-nodes":
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ollama distributed LAN nodes">
        <rect width="140" height="100" fill="#081e36"/>
        <circle cx="70" cy="45" r="10" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5"/>
        <text x="70" y="48" font-family="monospace" font-size="6" fill="#bfdbfe" text-anchor="middle">ROUTER</text>
        <circle cx="32" cy="72" r="8" fill="#172554" stroke="#93c5fd" stroke-width="1"/>
        <text x="32" y="74.5" font-family="monospace" font-size="5" fill="#bfdbfe" text-anchor="middle">MAC</text>
        <circle cx="70" cy="80" r="8" fill="#172554" stroke="#93c5fd" stroke-width="1"/>
        <text x="70" y="82.5" font-family="monospace" font-size="5" fill="#bfdbfe" text-anchor="middle">LINUX</text>
        <circle cx="108" cy="72" r="8" fill="#172554" stroke="#93c5fd" stroke-width="1"/>
        <text x="108" y="74.5" font-family="monospace" font-size="5" fill="#bfdbfe" text-anchor="middle">RIG</text>
        <path d="M70 55 L32 64 M70 55 L70 72 M70 55 L108 64" stroke="#60a5fa" stroke-width="1" stroke-dasharray="2 2"/>
        <text x="70" y="20" font-family="monospace" font-size="6.5" fill="#93c5fd" text-anchor="middle">LAN 120B+ CLUSTER</text>
      </svg>`;

    case "structured-outputs-scale":
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Structured JSON grammar validation">
        <rect width="140" height="100" fill="#052219"/>
        <rect x="18" y="16" width="104" height="68" rx="6" fill="#064e3b" stroke="#10b981" stroke-width="1.2"/>
        <text x="26" y="32" font-family="monospace" font-size="6.5" fill="#6ee7b7">{"type": "object",</text>
        <text x="30" y="44" font-family="monospace" font-size="6.5" fill="#6ee7b7"> "strict": true,</text>
        <text x="30" y="56" font-family="monospace" font-size="6.5" fill="#a7f3d0"> "errors": 0}</text>
        <rect x="74" y="60" width="40" height="16" rx="4" fill="#047857" stroke="#34d399" stroke-width="1"/>
        <text x="94" y="71" font-family="monospace" font-size="6.5" fill="#ecfdf5" text-anchor="middle" font-weight="bold">100k PASS</text>
      </svg>`;

    default:
      return `<svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="100" fill="#171918"/>
        <circle cx="70" cy="50" r="28" fill="${c}22" stroke="${c}" stroke-width="1.5"/>
        <text x="70" y="55" font-size="20" text-anchor="middle">${meta.icon || "📄"}</text>
      </svg>`;
  }
}

function news(category = false) {
  if (category && newsState.selectedCategories.size === 0) {
    newsState.selectedCategories.add("agents-and-mcp");
  }

  // Filter
  let filtered = NEWS_STORIES.filter((story) => {
    if (newsState.selectedCategories.size > 0 && !newsState.selectedCategories.has(story.cat)) {
      return false;
    }
    if (newsState.period === "today" && story.period !== "today") return false;
    if (newsState.period === "week" && story.period !== "today" && story.period !== "week") return false;
    if (newsState.period === "month" && story.period === "all") return false;
    if (newsState.selectedTopic && !story.tags.includes(newsState.selectedTopic)) return false;
    if (newsState.searchQuery.trim()) {
      const q = newsState.searchQuery.toLowerCase();
      const match =
        story.title.toLowerCase().includes(q) ||
        story.ukTitle.toLowerCase().includes(q) ||
        story.summary.toLowerCase().includes(q) ||
        story.ukSummary.toLowerCase().includes(q) ||
        story.tags.some((tg) => tg.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    if (newsState.sort === "newest") return b.timestamp - a.timestamp;
    if (newsState.sort === "oldest") return a.timestamp - b.timestamp;
    if (newsState.sort === "discussed") return b.discussScore - a.discussScore;
    if (newsState.sort === "relevance") {
      if (newsState.searchQuery.trim()) {
        const q = newsState.searchQuery.toLowerCase();
        const aTitle = a.title.toLowerCase().includes(q) ? 2 : 0;
        const bTitle = b.title.toLowerCase().includes(q) ? 2 : 0;
        return bTitle - aTitle;
      }
      return b.timestamp - a.timestamp;
    }
    return b.timestamp - a.timestamp;
  });

  const totalFound = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFound / newsState.pageSize));
  if (newsState.page > totalPages) newsState.page = 1;
  const startIndex = (newsState.page - 1) * newsState.pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + newsState.pageSize);

  const hasActiveFilters =
    newsState.selectedCategories.size > 0 ||
    newsState.period !== "all" ||
    newsState.searchQuery.trim() !== "" ||
    newsState.selectedTopic !== "";

  const activeChipsHtml = hasActiveFilters
    ? `<div class="active-filter-chips-bar" aria-label="${t("Active filters", "Активні фільтри")}">
        ${Array.from(newsState.selectedCategories)
          .map((catId) => {
            const cat = CATEGORY_META[catId];
            return `<span class="filter-pill">
              <span class="filter-pill-dot" style="background:${cat.color}"></span>
              ${t(cat.name, cat.ukName)}
              <button class="filter-pill-remove" data-remove-cat="${catId}" aria-label="${t("Remove filter", "Видалити фільтр")}">✕</button>
            </span>`;
          })
          .join("")}
        ${
          newsState.period !== "all"
            ? `<span class="filter-pill">
                ${t("Period: ", "Період: ")}${t(newsState.period.charAt(0).toUpperCase() + newsState.period.slice(1), newsState.period === "today" ? "Сьогодні" : newsState.period === "week" ? "Тиждень" : "Місяць")}
                <button class="filter-pill-remove" data-remove-period aria-label="${t("Remove period filter", "Скинути фільтр періоду")}">✕</button>
              </span>`
            : ""
        }
        ${
          newsState.selectedTopic
            ? `<span class="filter-pill">
                ${newsState.selectedTopic}
                <button class="filter-pill-remove" data-remove-topic aria-label="${t("Remove topic filter", "Скинути фільтр теми")}">✕</button>
              </span>`
            : ""
        }
        ${
          newsState.searchQuery.trim()
            ? `<span class="filter-pill">
                "${esc(newsState.searchQuery)}"
                <button class="filter-pill-remove" data-clear-search aria-label="${t("Clear search", "Очистити пошук")}">✕</button>
              </span>`
            : ""
        }
        <button class="active-filter-reset-link" data-reset-all>${t("Reset all filters", "Скинути всі фільтри")}</button>
      </div>`
    : "";

  const renderSidebarContent = () => `
    <div class="sidebar-section">
      <div class="sidebar-section-title">${t("SORT", "СОРТУВАННЯ")}</div>
      <div class="sort-radio-group" role="radiogroup" aria-label="${t("Sort order", "Сортування")}">
        <label class="sort-radio-item ${newsState.sort === "newest" ? "active" : ""}">
          <input type="radio" class="custom-radio" name="news-sort" value="newest" ${newsState.sort === "newest" ? "checked" : ""}>
          <span>${t("Newest", "Найновіші")}</span>
        </label>
        <label class="sort-radio-item ${newsState.sort === "oldest" ? "active" : ""}">
          <input type="radio" class="custom-radio" name="news-sort" value="oldest" ${newsState.sort === "oldest" ? "checked" : ""}>
          <span>${t("Oldest", "Найдавніші")}</span>
        </label>
        <label class="sort-radio-item ${newsState.sort === "relevance" ? "active" : ""}">
          <input type="radio" class="custom-radio" name="news-sort" value="relevance" ${newsState.sort === "relevance" ? "checked" : ""}>
          <span>${t("Relevance", "Релевантні")}</span>
        </label>
        <label class="sort-radio-item ${newsState.sort === "discussed" ? "active" : ""}">
          <input type="radio" class="custom-radio" name="news-sort" value="discussed" ${newsState.sort === "discussed" ? "checked" : ""}>
          <span>${t("Most discussed", "Найбільш обговорювані")}</span>
        </label>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-title">${t("CATEGORIES", "КАТЕГОРІЇ")}</div>
      <div class="category-checkbox-group" role="group" aria-label="${t("Categories", "Категорії")}">
        ${NEWS_CATEGORIES.map((cat) => {
          const isChecked = newsState.selectedCategories.has(cat.id);
          const meta = CATEGORY_META[cat.id];
          return `<label class="category-checkbox-item ${isChecked ? "checked" : ""}">
            <div class="category-checkbox-left">
              <input type="checkbox" class="custom-checkbox" value="${cat.id}" ${isChecked ? "checked" : ""} data-category-toggle="${cat.id}">
              <span class="category-dot" style="background:${cat.color}"></span>
              <span class="category-icon-symbol">${cat.icon}</span>
              <span class="category-name-text">${t(cat.name, cat.ukName)}</span>
            </div>
            <span class="category-count-badge">${meta.count}</span>
          </label>`;
        }).join("")}
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-title">${t("PERIOD", "ПЕРІОД")}</div>
      <div class="period-btn-grid" role="group" aria-label="${t("Time period", "Часовий період")}">
        <button class="period-btn ${newsState.period === "today" ? "active" : ""}" data-period="today" aria-pressed="${newsState.period === "today"}">${t("Today", "Сьогодні")}</button>
        <button class="period-btn ${newsState.period === "week" ? "active" : ""}" data-period="week" aria-pressed="${newsState.period === "week"}">${t("Week", "Тиждень")}</button>
        <button class="period-btn ${newsState.period === "month" ? "active" : ""}" data-period="month" aria-pressed="${newsState.period === "month"}">${t("Month", "Місяць")}</button>
        <button class="period-btn ${newsState.period === "all" ? "active" : ""}" data-period="all" aria-pressed="${newsState.period === "all"}">${t("All time", "Весь час")}</button>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-title">${t("HOT TOPICS", "ПОПУЛЯРНІ ТЕМИ")}</div>
      <div class="topic-tag-cloud" role="group" aria-label="${t("Hot topics", "Популярні теми")}">
        ${HOT_TOPICS.map((topic) => `
          <button class="topic-tag-chip ${newsState.selectedTopic === topic ? "active" : ""}" data-topic-click="${topic}" aria-pressed="${newsState.selectedTopic === topic}">
            ${topic}
          </button>
        `).join("")}
      </div>
    </div>

    <div class="sidebar-section">
      <button class="sidebar-reset-btn" data-reset-all aria-label="${t("Reset all filters", "Скинути всі фільтри")}">
        ↺ ${t("Reset all filters", "Скинути всі фільтри")}
      </button>
    </div>
  `;

  const storyCardsHtml =
    pageItems.length > 0
      ? pageItems
          .map((story) => {
            const meta = CATEGORY_META[story.cat];
            const isExpanded = newsState.expandedIds.has(story.id);
            const isSaved = savedStories.has(story.id);
            const takeaways = lang === "uk" ? story.ukTakeaways : story.takeaways;
            return `
        <article class="news-story-card" data-story-id="${story.id}">
          <div class="news-card-thumb">
            ${renderStoryThumb(story, meta)}
          </div>
          <div class="news-card-body">
            <div class="news-card-header">
              <div class="news-card-meta">
                <span class="news-category-badge" style="background:${meta.color}18; color:${meta.color}; border:1px solid ${meta.color}44">
                  <span class="category-icon-symbol">${meta.icon}</span> ${t(meta.name, meta.ukName)}
                </span>
                <span>${story.date}</span>
                <span>·</span>
                <span>${story.readTime}</span>
              </div>
            </div>
            <h2 class="news-card-title">
              <a href="#/article?id=${story.id}">${esc(t(story.title, story.ukTitle))}</a>
            </h2>
            <p class="news-card-summary">
              ${esc(t(story.summary, story.ukSummary))}
            </p>
            <div class="news-card-actions">
              <div class="news-card-actions-left">
                <button class="expand-btn" data-toggle-expand="${story.id}" aria-expanded="${isExpanded}">
                  ${isExpanded ? t("Hide analysis ↑", "Сховати аналіз ↑") : t("Expand analysis →", "Розгорнути аналіз →")}
                </button>
                <button class="save-btn ${isSaved ? "saved" : ""}" data-save-story="${story.id}" aria-label="${isSaved ? t("Remove from reading list", "Видалити зі списку") : t("Save story", "Зберегти новину")}">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="${isSaved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  <span>${isSaved ? t("Saved ✓", "Збережено ✓") : t("Save", "Зберегти")}</span>
                </button>
                <button class="share-btn" data-share-story="${story.id}" aria-label="${t("Share story link", "Скопіювати посилання")}">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  <span>${t("Share", "Поділитися")}</span>
                </button>
              </div>
              <span class="news-comments-badge">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                ${story.commentsCount} ${t("Comments (soon)", "Коментарі (скоро)")}
              </span>
            </div>
            ${
              isExpanded
                ? `
              <div class="news-expanded-analysis">
                <div class="why-it-matters-heading">${t("WHY IT MATTERS", "ЧОМУ ЦЕ ВАЖЛИВО")}</div>
                <p class="why-it-matters-text">${esc(t(story.whyItMatters, story.ukWhyItMatters))}</p>
                <div class="takeaways-heading">${t("KEY TAKEAWAYS", "КЛЮЧОВІ ВИСНОВКИ")}</div>
                <ul class="takeaways-list">
                  ${takeaways.map((item) => `<li>${esc(item)}</li>`).join("")}
                </ul>
                <div class="expanded-tags-row">
                  ${story.tags.map((tag) => `<button class="topic-tag-chip" data-topic-click="${tag}">${tag}</button>`).join("")}
                </div>
              </div>
            `
                : ""
            }
          </div>
        </article>
      `;
          })
          .join("")
      : `
      <div class="news-empty-state">
        <div class="news-empty-icon">🧭</div>
        <h3>${t("No stories match your filters", "Жодної новини за обраними фільтрами")}</h3>
        <p>${t("Try loosening your search query, selecting different categories, or resetting the period to 'All time'.", "Спробуйте змінити пошуковий запит, обрати інші категорії або скинути період на 'Весь час'.")}</p>
        <button class="button" data-reset-all>${t("Reset all filters", "Скинути всі фільтри")}</button>
      </div>
    `;

  let paginationHtml = "";
  if (totalPages > 1) {
    let pageButtons = [];
    for (let i = 1; i <= totalPages; i++) {
      pageButtons.push(`
        <button class="page-btn page-number-btn ${i === newsState.page ? "active" : ""}" data-page="${i}" ${i === newsState.page ? 'aria-current="page"' : ""}>
          ${i}
        </button>
      `);
    }
    paginationHtml = `
      <nav class="after-hours-pagination" aria-label="${t("Pagination", "Пагінація")}">
        <button class="page-btn page-nav-btn" data-page="${newsState.page - 1}" ${newsState.page <= 1 ? "disabled" : ""} aria-label="${t("Previous page", "Попередня сторінка")}">
          ← ${t("Previous", "Назад")}
        </button>
        <div class="page-numbers">
          ${pageButtons.join("")}
        </div>
        <button class="page-btn page-nav-btn" data-page="${newsState.page + 1}" ${newsState.page >= totalPages ? "disabled" : ""} aria-label="${t("Next page", "Наступна сторінка")}">
          ${t("Next", "Вперед")} →
        </button>
      </nav>
    `;
  }

  const mobileDrawerHtml = newsState.drawerOpen
    ? `
    <div class="mobile-drawer-backdrop" role="dialog" aria-modal="true" aria-label="${t("Filters drawer", "Панель фільтрів")}">
      <div class="mobile-drawer-panel">
        <div class="mobile-drawer-header">
          <h2>${t("Filters & Sort", "Фільтри та сортування")}</h2>
          <button class="mobile-drawer-close" data-close-drawer aria-label="${t("Close drawer", "Закрити панель")}">✕</button>
        </div>
        <div class="mobile-drawer-content">
          ${renderSidebarContent()}
        </div>
        <div class="mobile-drawer-footer">
          <button class="mobile-drawer-done-btn" data-close-drawer>
            ${t("Show results", "Показати результати")} (${totalFound})
          </button>
        </div>
      </div>
    </div>
  `
    : "";

  return `
    ${intro(
      t("THE NEWSROOM", "СТРІЧКА НОВИН"),
      t("A clearer <em>signal.</em>", "Чіткіший <em>сигнал.</em>"),
      t(
        "What is changing in AI engineering, and why it matters to your work.",
        "Що змінюється в AI-інженерії та чому це важливо для вашої роботи.",
      ),
    )}

    <div class="mobile-filter-toolbar">
      <button class="mobile-filter-trigger" data-open-drawer>
        <span>⚙</span>
        <span>${t("Filters", "Фільтри")}</span>
        ${hasActiveFilters ? `<span class="mobile-filter-badge">${newsState.selectedCategories.size + (newsState.period !== "all" ? 1 : 0) + (newsState.selectedTopic ? 1 : 0)}</span>` : ""}
      </button>
    </div>

    <div class="news-discovery-layout">
      <aside class="news-sidebar">
        ${renderSidebarContent()}
      </aside>

      <section class="news-feed-main">
        <div class="news-toolbar">
          <div class="news-search-box">
            <span class="news-search-icon" aria-hidden="true">⌕</span>
            <input
              id="news-search-input"
              class="news-search-input"
              type="search"
              placeholder="${t("Search stories, concepts, tags...", "Пошук новин, концептів, тегів...")}"
              value="${esc(newsState.searchQuery)}"
              aria-label="${t("Search news stories", "Пошук новин")}"
            >
            ${newsState.searchQuery ? `<button class="news-search-clear" aria-label="${t("Clear search", "Очистити пошук")}">✕</button>` : ""}
          </div>
          <div class="news-toolbar-right">
            <div class="news-stories-count">
              ${t("Stories found: ", "Знайдено новин: ")}<strong>${totalFound}</strong>
            </div>
            <select class="news-sort-select" aria-label="${t("Sort order", "Порядок сортування")}">
              <option value="newest" ${newsState.sort === "newest" ? "selected" : ""}>${t("Newest", "Найновіші")}</option>
              <option value="oldest" ${newsState.sort === "oldest" ? "selected" : ""}>${t("Oldest", "Найдавніші")}</option>
              <option value="relevance" ${newsState.sort === "relevance" ? "selected" : ""}>${t("Relevance", "Релевантні")}</option>
              <option value="discussed" ${newsState.sort === "discussed" ? "selected" : ""}>${t("Most discussed", "Найбільш обговорювані")}</option>
            </select>
          </div>
        </div>

        ${activeChipsHtml}

        <div class="news-cards-list">
          ${storyCardsHtml}
        </div>

        ${paginationHtml}
      </section>
    </div>

    ${mobileDrawerHtml}
    <section class="section">${newsletter()}</section>
  `;
}

function byline(readTime = 4, format = t("DEMONSTRATION LAYOUT", "ДЕМОНСТРАЦІЙНИЙ МАКЕТ")) {
  return `<div class="byline"><span class="avatar">OK</span><div>${t("Oleksandr Kuzmenko", "Олександр Кузьменко")}<br><span class="meta">${t("EDITOR", "РЕДАКТОР")} · ${format}</span></div><span class="meta">05.09.2026 · ${readTime} ${t("MIN READ", "ХВ ЧИТАННЯ")}</span></div>`;
}
function readShell(title, dek, tag, content, toc = ["overview", "context", "next", "sources"]) {
  const tocLabels = {
    overview: t("In brief", "Коротко"),
    context: t("The context", "Контекст"),
    next: t("What to do next", "Що робити далі"),
    sources: t("Sources & notes", "Джерела й примітки"),
  };
  return `<div class="breadcrumb">${link("home", t("Home", "Головна"))} / ${tag}</div><div class="article-top">${eyebrow(tag)}<h1>${title}</h1><p class="dek">${dek}</p>${byline()}</div><div class="article-layout"><nav class="toc" aria-label="${t("On this page", "На цій сторінці")}">${eyebrow(t("IN THIS STORY", "У МАТЕРІАЛІ"))}${toc.map((id) => `<a href="#${id}" data-anchor="${id}">${tocLabels[id]}</a>`).join("")}</nav><article class="reading">${content}</article><aside class="article-tools">${currentRoute() === "article" ? `<button class="button outline" data-save aria-pressed="${saved}">${saved ? t("Saved ✓", "Збережено ✓") : t("Save story +", "Зберегти +")}</button>` : ""}<button class="button outline" data-copy-link>${t("Copy link ↗", "Копіювати ↗")}</button></aside></div>`;
}

const articleVariantIds = ["analysis", "technical", "evidence"];

function currentArticleVariant() {
  const query = location.hash.split("?")[1] || "";
  const value = new URLSearchParams(query).get("variant");
  return articleVariantIds.includes(value) ? value : "analysis";
}

function articleVariantCards() {
  return [
    {
      id: "analysis",
      number: "01",
      format: t("EDITORIAL ANALYSIS", "РЕДАКЦІЙНИЙ РОЗБІР"),
      title: t("The agent era needs a better memory", "Епосі агентів потрібна краща пам’ять"),
      description: t(
        "A narrative news analysis with a thesis, architecture map, implications and uncertainty.",
        "Наративний аналіз новини з тезою, картою архітектури, наслідками й невизначеністю.",
      ),
    },
    {
      id: "technical",
      number: "02",
      format: t("TECHNICAL FIELD GUIDE", "ТЕХНІЧНИЙ РОЗБІР"),
      title: t("Prompt caching, beyond the price tag", "Prompt caching: більше, ніж економія"),
      description: t(
        "A practical developer story with a request anatomy, code, measurements and a rollout checklist.",
        "Практичний матеріал для розробників: анатомія запиту, код, вимірювання й чекліст запуску.",
      ),
    },
    {
      id: "evidence",
      number: "03",
      format: t("EVIDENCE NOTE", "ДОКАЗОВА НОТАТКА"),
      title: t("A benchmark is a starting point", "Бенчмарк — лише початок"),
      description: t(
        "An evidence-led research read with a claim ledger, confidence levels and transfer limits.",
        "Доказовий розбір дослідження: реєстр тверджень, рівні впевненості й межі перенесення.",
      ),
    },
  ];
}

function articleVariantPicker(active) {
  const cards = articleVariantCards();
  return `<section class="article-variant-picker" aria-labelledby="article-variant-title"><div class="article-variant-intro"><div>${eyebrow(t("ARTICLE SYSTEM / THREE FULL EXAMPLES", "СИСТЕМА СТАТЕЙ / ТРИ ПОВНІ ПРИКЛАДИ"))}<h2 id="article-variant-title">${t("One publication. Different reading jobs.", "Одне видання. Різні сценарії читання.")}</h2></div><p>${t("Switch formats to compare hierarchy, density and editorial modules. Each link opens a complete, shareable state.", "Перемикайте формати, щоб порівняти ієрархію, щільність і редакційні модулі. Кожне посилання відкриває повний стан із власною адресою.")}</p></div><div class="article-variant-grid">${cards
    .map(
      (card) =>
        `<a class="article-variant-card${card.id === active ? " active" : ""}" href="#/article?variant=${card.id}"${card.id === active ? ' aria-current="page"' : ""}><span class="article-variant-number">${card.number}</span><span class="meta">${card.format}</span><strong>${card.title}</strong><span>${card.description}</span><i aria-hidden="true">↗</i></a>`,
    )
    .join("")}</div></section>`;
}

function articleTakeaways(items) {
  return `<section class="article-takeaways" aria-labelledby="takeaways-title">${eyebrow(t("IN BRIEF / THREE SIGNALS", "КОРОТКО / ТРИ СИГНАЛИ"))}<h2 id="takeaways-title" class="sr-only">${t("Key takeaways", "Ключові висновки")}</h2><ol>${items
    .map((item, index) => `<li><span>0${index + 1}</span><p>${item}</p></li>`)
    .join("")}</ol></section>`;
}

function articleSourceLedger(items) {
  return `<ol class="source-ledger">${items
    .map(
      ([label, note], index) =>
        `<li><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${label}</strong><p>${note}</p></div></li>`,
    )
    .join("")}</ol>`;
}

function articleShell(data) {
  const related = articleVariantCards().filter((card) => card.id !== data.id);
  return `<div class="breadcrumb">${link("home", t("Home", "Головна"))} / ${link("news", t("News", "Новини"))} / ${data.format}</div>${articleVariantPicker(data.id)}<div class="article-top article-top-rich">${eyebrow(data.tag)}<h1>${data.title}</h1><p class="dek">${data.dek}</p>${byline(data.readTime, data.format)}<div class="article-trust-row"><span>${t("HUMAN-EDITED", "ВІДРЕДАГОВАНО ЛЮДИНОЮ")}</span><span>${t("ILLUSTRATIVE CONCEPT COPY", "ДЕМОНСТРАЦІЙНИЙ ТЕКСТ")}</span><span>${data.sourceCount} ${t("SOURCE SLOTS", "ПОЗИЦІЇ ДЖЕРЕЛ")}</span></div></div><div class="article-layout article-layout-rich"><nav class="toc" aria-label="${t("On this page", "На цій сторінці")}">${eyebrow(t("IN THIS STORY", "У МАТЕРІАЛІ"))}${data.toc.map(([id, label]) => `<a href="#${id}" data-anchor="${id}">${label}</a>`).join("")}</nav><article class="reading reading-rich">${data.content}</article><aside class="article-tools article-tools-rich"><div class="article-format-note">${eyebrow(data.format)}<p>${data.readTime} ${t("min", "хв")} · ${data.sourceCount} ${t("source slots", "позиції джерел")}</p></div><button class="button outline" data-save aria-pressed="${saved}">${saved ? t("Saved ✓", "Збережено ✓") : t("Save story +", "Зберегти +")}</button><button class="button outline" data-copy-link>${t("Copy link ↗", "Копіювати ↗")}</button></aside></div><section class="article-related section" aria-labelledby="article-related-title">${sectionHead(t("Two other ways to tell the story.", "Ще два способи розповісти історію."))}<h2 class="sr-only" id="article-related-title">${t("Other article examples", "Інші приклади статей")}</h2><div class="grid2">${related.map((card) => `<a class="article-related-card" href="#/article?variant=${card.id}"><span class="meta">${card.number} / ${card.format}</span><strong>${card.title}</strong><span>${card.description}</span><i aria-hidden="true">↗</i></a>`).join("")}</div></section>${newsletter()}`;
}

function analysisArticle() {
  const content = `<div class="article-disclosure">${t(
    "This is a complete layout sample, not a published report. Named systems and evidence slots demonstrate the editorial structure without presenting demo claims as news.",
    "Це повний приклад верстки, а не опублікований матеріал. Назви систем і місця для доказів демонструють редакційну структуру, не видаючи демо-твердження за новини.",
  )}</div><div class="callout" id="overview">${eyebrow(t("WHY IT MATTERS", "ЧОМУ ЦЕ ВАЖЛИВО"))}<p>${t(
    "Agent memory is becoming an architecture decision rather than a convenience feature. The useful question is not how much a system can retain, but which decisions should survive, for how long, and under whose authority.",
    "Пам’ять агента стає архітектурним рішенням, а не зручною додатковою функцією. Важливе питання не в тому, скільки система може зберегти, а які рішення мають пережити сесію, як довго і під чиїм контролем.",
  )}</p></div><figure class="article-hero article-hero-editorial">${art(false)}<figcaption>${t(
    "Editorial concept image. In production, the caption identifies the image source, generation disclosure and verification status.",
    "Редакційне концепт-зображення. У production підпис містить джерело, позначку про генерацію та статус перевірки.",
  )}</figcaption></figure>${articleTakeaways([
    t(
      "Separate working context from durable memory. A transcript is not automatically a useful record.",
      "Відокремлюйте робочий контекст від сталої пам’яті. Транскрипт не стає корисним записом автоматично.",
    ),
    t(
      "Store decisions with provenance, scope and an expiry rule so future agents can challenge them.",
      "Зберігайте рішення разом із походженням, межами дії та правилом завершення, щоб майбутній агент міг їх оскаржити.",
    ),
    t(
      "Keep a human review gate wherever remembered context can change permissions, publishing or customer-facing output.",
      "Залишайте людський review-gate там, де пам’ять може змінити дозволи, публікацію або результат для клієнта.",
    ),
  ])}<h2 id="signal">${t("The shift is governed memory, not endless context.", "Зміна — у керованій пам’яті, а не в безмежному контексті.")}</h2><p>${t(
    "Early agent workflows treated every run as a clean room: instructions went in, a result came out, and the next session started again. That made failures visible, but repeated work expensive. The reaction was to retain more—longer transcripts, larger project files, automatically generated summaries and personal preferences.",
    "Перші агентні процеси сприймали кожен запуск як чисту кімнату: інструкції входили, результат виходив, а наступна сесія починалася з нуля. Помилки були видимими, але повторення коштувало дорого. Відповіддю стало збереження більшого: довших транскриптів, більших файлів проєкту, автоматичних підсумків і персональних уподобань.",
  )}</p><p>${t(
    "More retained text solves repetition only until it becomes another source of ambiguity. A stale workaround can look like a current rule. An experiment can quietly become policy. A confident summary can outlive the evidence that produced it. The design problem is therefore editorial as much as technical: memory needs selection, hierarchy and correction.",
    "Більше збереженого тексту вирішує повторення лише доти, доки саме не стає джерелом неоднозначності. Застарілий workaround може виглядати чинним правилом. Експеримент — непомітно перетворитися на політику. Впевнений підсумок — пережити докази, з яких виник. Тому це не лише технічна, а й редакційна задача: пам’яті потрібні відбір, ієрархія та виправлення.",
  )}</p><blockquote>${t(
    "The durable unit should be a decision with context—not a transcript without an editor.",
    "Сталою одиницею має бути рішення з контекстом, а не транскрипт без редактора.",
  )}</blockquote><h2 id="architecture">${t("A three-layer memory model.", "Тришарова модель пам’яті.")}</h2><p>${t(
    "A practical system can divide remembered material by lifespan and authority. The layers below are not a vendor feature list; they are a review model that helps a team decide where information belongs.",
    "Практична система може ділити збережену інформацію за тривалістю й рівнем повноважень. Шари нижче — не список функцій конкретного вендора, а модель перевірки, що допомагає команді визначити місце кожного факту.",
  )}</p><div class="memory-stack"><section><span>01</span><div>${eyebrow(t("WORKING CONTEXT", "РОБОЧИЙ КОНТЕКСТ"))}<h3>${t("Useful for this run.", "Корисне для цього запуску.")}</h3><p>${t("Files, tool output and temporary hypotheses. Cheap to discard; dangerous to canonise automatically.", "Файли, відповіді інструментів і тимчасові гіпотези. Їх легко відкинути й небезпечно автоматично канонізувати.")}</p></div></section><section><span>02</span><div>${eyebrow(t("PROJECT MEMORY", "ПАМ’ЯТЬ ПРОЄКТУ"))}<h3>${t("Useful across a body of work.", "Корисне в межах спільної роботи.")}</h3><p>${t("Confirmed constraints, architecture decisions and named owners. Versioned, reviewable and close to the work they govern.", "Підтверджені обмеження, архітектурні рішення та відповідальні. Версійні, доступні для review і близькі до роботи, якою керують.")}</p></div></section><section><span>03</span><div>${eyebrow(t("ORGANISATIONAL POLICY", "ОРГАНІЗАЦІЙНА ПОЛІТИКА"))}<h3>${t("Useful only with explicit authority.", "Корисне лише з явними повноваженнями.")}</h3><p>${t("Security rules, publication gates and customer commitments. Changes need provenance, approval and an audit trail.", "Правила безпеки, publish-gates і зобов’язання перед клієнтами. Зміни потребують походження, схвалення й audit trail.")}</p></div></section></div><h2 id="decisions">${t("What changes for a product team?", "Що це змінює для продуктової команди?")}</h2><p>${t(
    "Memory design begins before a database choice. Teams need to name the decisions an agent may make, the evidence it may retain and the point at which a person must intervene. Those boundaries should be visible in the product—not buried in a system prompt that only an engineer can inspect.",
    "Проєктування пам’яті починається до вибору бази даних. Команда має назвати рішення, які агент може ухвалювати, докази, які може зберігати, і момент, коли має втрутитися людина. Ці межі мають бути видимими в продукті, а не захованими в system prompt, доступному лише інженеру.",
  )}</p><div class="table-scroll"><table class="decision-table"><thead><tr><th>${t("If the agent remembers…", "Якщо агент пам’ятає…")}</th><th>${t("Require…", "Потрібно…")}</th><th>${t("Watch for…", "Стежте за…")}</th></tr></thead><tbody><tr><td>${t("A user preference", "Уподобання користувача")}</td><td>${t("Visibility and a delete control", "Видимість і можливість видалення")}</td><td>${t("Inference presented as consent", "Припущенням, виданим за згоду")}</td></tr><tr><td>${t("A project constraint", "Обмеження проєкту")}</td><td>${t("Owner, source and review date", "Власник, джерело й дата review")}</td><td>${t("A temporary workaround becoming permanent", "Перетворенням тимчасового workaround на правило")}</td></tr><tr><td>${t("A publishing decision", "Рішення про публікацію")}</td><td>${t("Human approval and an audit event", "Людське схвалення й audit event")}</td><td>${t("A summary replacing primary evidence", "Підміною першоджерела підсумком")}</td></tr></tbody></table></div><div class="editor-note">${eyebrow(t("EDITOR’S TAKE", "ПОГЛЯД РЕДАКТОРА"))}<p>${t(
    "The strongest memory feature may be a clear way to forget. Expiry, supersession and visible correction reduce the authority of stale context without forcing every session to begin from zero.",
    "Найсильнішою функцією пам’яті може бути зрозумілий спосіб забувати. Строк дії, заміна новішим рішенням і видиме виправлення зменшують авторитет застарілого контексту, не змушуючи кожну сесію починати з нуля.",
  )}</p></div><h2 id="uncertainty">${t("What remains uncertain.", "Що лишається невизначеним.")}</h2><div class="uncertainty-grid"><section><strong>${t("Product evidence", "Продуктові докази")}</strong><p>${t("Teams still need longitudinal evidence that remembered context improves completed work rather than only reducing repeated prompts.", "Командам ще потрібні довгострокові докази, що збережений контекст покращує завершену роботу, а не лише скорочує повторні запити.")}</p></section><section><strong>${t("User control", "Контроль користувача")}</strong><p>${t("A technically correct memory can still surprise a person if it appears in the wrong place or cannot be inspected and corrected.", "Навіть технічно коректна пам’ять може здивувати людину, якщо з’являється не там або її неможливо переглянути й виправити.")}</p></section></div><h2 id="sources">${t("Sources & verification notes.", "Джерела й примітки перевірки.")}</h2><p>${t(
    "A production story would link every factual claim to the primary report and mark the editor’s verification date. This concept shows the full source treatment while keeping the copy explicitly illustrative.",
    "Production-матеріал пов’язує кожне фактичне твердження з першоджерелом і позначає дату редакторської перевірки. Концепт показує повне оформлення джерел, лишаючи текст явно демонстраційним.",
  )}</p>${articleSourceLedger([
    [t("Primary announcement / documentation", "Первинний анонс / документація"), t("Canonical source, publication date, version and the exact claim it supports.", "Канонічне джерело, дата публікації, версія й точне твердження, яке воно підтверджує.")],
    [t("Independent technical analysis", "Незалежний технічний аналіз"), t("Used to test the vendor framing and identify limitations or missing context.", "Потрібен, щоб перевірити framing вендора й знайти обмеження або відсутній контекст.")],
    [t("Editor verification log", "Журнал редакторської перевірки"), t("Names the checked facts, unresolved questions, corrections and final review date.", "Називає перевірені факти, відкриті питання, виправлення й дату фінального review.")],
  ])}<div class="article-topic-links">${link("concept", "Model Context Protocol ↗")}${link("guide", t("Choosing an agent workflow ↗", "Вибір агентного процесу ↗"))}${link("policy", t("How we edit ↗", "Як ми редагуємо ↗"))}</div>`;
  return {
    id: "analysis",
    format: t("EDITORIAL ANALYSIS", "РЕДАКЦІЙНИЙ РОЗБІР"),
    tag: t("NEWS ANALYSIS / AGENTS & MCP", "АНАЛІЗ НОВИН / AGENTS & MCP"),
    title: t("The agent era needs a better memory.", "Епосі агентів потрібна краща пам’ять."),
    dek: t(
      "The next useful question is not how much an agent remembers. It is which decisions survive, who can correct them, and when the system should forget.",
      "Наступне важливе питання — не скільки агент пам’ятає. А які рішення зберігаються, хто може їх виправити й коли система має забути.",
    ),
    readTime: 8,
    sourceCount: 3,
    toc: [
      ["overview", t("In brief", "Коротко")],
      ["signal", t("The signal", "Головний сигнал")],
      ["architecture", t("Memory model", "Модель пам’яті")],
      ["decisions", t("Product decisions", "Продуктові рішення")],
      ["uncertainty", t("Uncertainty", "Невизначеність")],
      ["sources", t("Sources & notes", "Джерела й примітки")],
    ],
    content,
  };
}

function technicalArticle() {
  const content = `<div class="article-disclosure">${t(
    "This field guide is production-shaped demonstration copy. The request structure and measurement plan are realistic; example values are labelled and are not benchmark results.",
    "Це демонстраційний технічний матеріал із production-подібною структурою. Будова запиту й план вимірювання реалістичні; прикладні значення позначені й не є результатами бенчмарку.",
  )}</div><div class="callout" id="overview">${eyebrow(t("THE PRACTICAL ANSWER", "ПРАКТИЧНА ВІДПОВІДЬ"))}<p>${t(
    "Prompt caching works best when the request itself has an information architecture: stable instructions first, volatile task data last, and a clear boundary between the two. Cost is one outcome; predictable latency and easier debugging are often the more valuable ones.",
    "Prompt caching найкраще працює, коли сам запит має інформаційну архітектуру: сталі інструкції на початку, змінні дані завдання наприкінці й чітка межа між ними. Економія — лише один наслідок; передбачувана затримка й простіше налагодження часто цінніші.",
  )}</p></div><figure class="article-hero article-hero-system" aria-labelledby="cache-flow-caption"><div class="cache-flow" role="img" aria-label="${t("Stable project context flows into a cache boundary before task-specific input and verification", "Сталий контекст проєкту проходить через межу кешу перед даними конкретного завдання та перевіркою")}"><span><small>01</small>${t("System rules", "Системні правила")}</span><i aria-hidden="true">→</i><span><small>02</small>${t("Stable project context", "Сталий контекст проєкту")}</span><i aria-hidden="true">→</i><span class="cache-boundary"><small>03</small>${t("Cache boundary", "Межа кешу")}</span><i aria-hidden="true">→</i><span><small>04</small>${t("Task + evidence", "Завдання + докази")}</span></div><figcaption id="cache-flow-caption">${t(
    "A cacheable prefix is a content contract, not a pile of text. Put stable material before the boundary and keep per-run evidence after it.",
    "Кешований префікс — це контракт контенту, а не купа тексту. Розміщуйте сталі матеріали до межі, а докази конкретного запуску — після неї.",
  )}</figcaption></figure>${articleTakeaways([
    t("Optimise structure before token count: the same stable prefix should mean the same thing across requests.", "Оптимізуйте структуру до кількості токенів: той самий сталий префікс має означати те саме в різних запитах."),
    t("Track cache hit rate together with first-token latency, output quality and the reason for every miss.", "Відстежуйте cache hit rate разом із first-token latency, якістю результату й причиною кожного промаху."),
    t("Roll out by one repeated workflow. Caching a poorly scoped prompt only makes the wrong contract cheaper.", "Запускайте на одному повторюваному процесі. Кешування погано окресленого промпту лише здешевлює неправильний контракт."),
  ])}<h2 id="anatomy">${t("The anatomy of a cacheable request.", "Анатомія запиту, який варто кешувати.")}</h2><p>${t(
    "Start by reading the request in the order a model receives it. Global safety rules and stable role instructions usually change rarely. Project conventions change more often, but still belong to a versioned layer. The task, selected files, retrieved evidence and user correction are volatile by design.",
    "Почніть із читання запиту в тому порядку, у якому його отримує модель. Глобальні правила безпеки й сталі інструкції ролі зазвичай змінюються рідко. Конвенції проєкту змінюються частіше, але теж належать до версійного шару. Завдання, вибрані файли, знайдені докази й уточнення користувача навмисно змінні.",
  )}</p><p>${t(
    "A good boundary is observable. You can name the version of the stable context, explain which change invalidated it and reproduce the uncached request. If a team cannot do those three things, the cache is hiding coupling rather than removing work.",
    "Хороша межа спостережувана. Ви можете назвати версію сталого контексту, пояснити, яка зміна його інвалідувала, і відтворити запит без кешу. Якщо команда не може зробити ці три речі, кеш приховує зв’язність, а не прибирає роботу.",
  )}</p><div class="request-layers"><section><span class="meta">STABLE / VERSIONED</span><h3>${t("Role and non-negotiables", "Роль і незмінні правила")}</h3><p>${t("Safety limits, output contract, durable project instructions and tool descriptions that truly belong in every run.", "Безпекові межі, контракт результату, сталі інструкції проєкту й описи інструментів, які справді потрібні в кожному запуску.")}</p></section><section><span class="meta">SEMI-STABLE / SELECTIVE</span><h3>${t("Workflow context", "Контекст процесу")}</h3><p>${t("Repository map, active decision records and the smallest reference set needed for this family of tasks.", "Карта репозиторію, активні decision records і найменший набір довідок, потрібний для цього типу завдань.")}</p></section><section><span class="meta">VOLATILE / PER RUN</span><h3>${t("Task and evidence", "Завдання й докази")}</h3><p>${t("User intent, changed files, tool output, current measurements and anything expected to differ on the next call.", "Намір користувача, змінені файли, відповіді інструментів, поточні вимірювання й усе, що має відрізнятися в наступному виклику.")}</p></section></div><h3>${t("A minimal request builder", "Мінімальний конструктор запиту")}</h3><pre class="article-code" aria-label="${t("JavaScript request builder example", "Приклад конструктора запиту JavaScript")}"><code><span class="code-comment">// stable-context@2026-09-05</span>&#10;const stablePrefix = await loadProjectContract();&#10;const taskEvidence = await collectCurrentEvidence(task);&#10;&#10;const request = {&#10;  system: stablePrefix,&#10;  input: { task, evidence: taskEvidence },&#10;  verify: ["goal", "diff", "tests", "uncertainty"],&#10;};&#10;&#10;const result = await runAgent(request);&#10;await reviewBeforePublish(result);</code></pre><p class="article-caption">${t(
    "The example keeps the review step outside the generated result. A cache hit never grants permission to publish or apply a risky change.",
    "Приклад залишає review-крок поза згенерованим результатом. Cache hit ніколи не дає дозволу на публікацію чи ризиковану зміну.",
  )}</p><h2 id="measurement">${t("Measure the workflow, not the invoice alone.", "Вимірюйте процес, а не лише рахунок.")}</h2><p>${t(
    "A lower token bill can coincide with a worse workflow if stale context increases retries or if a larger prefix delays the first useful output. Establish a small baseline before changing the request, then compare the same task family under the same review standard.",
    "Нижчий рахунок за токени може співіснувати з гіршим процесом, якщо застарілий контекст збільшує кількість повторів або великий префікс затримує перший корисний результат. Зафіксуйте малу baseline до зміни запиту, а потім порівнюйте той самий тип завдань за однаковим стандартом review.",
  )}</p><div class="metric-grid"><section><span>${t("HIT RATE", "ЧАСТКА HIT")}</span><strong>72%</strong><p>${t("Illustrative target for a repeated workflow, not a universal threshold.", "Демонстраційна ціль для повторюваного процесу, не універсальний поріг.")}</p></section><section><span>${t("FIRST TOKEN", "ПЕРШИЙ ТОКЕН")}</span><strong>−18%</strong><p>${t("Example comparison after keeping the stable prefix warm.", "Приклад порівняння після прогрівання сталого префікса.")}</p></section><section><span>${t("RETRY RATE", "ЧАСТКА RETRY")}</span><strong>0↔</strong><p>${t("Quality guard: savings do not count if retries increase.", "Quality guard: економія не рахується, якщо retry зростають.")}</p></section><section><span>${t("MISS REASONS", "ПРИЧИНИ MISS")}</span><strong>4</strong><p>${t("Version change, ordering, TTL and provider routing—name each one.", "Зміна версії, порядок, TTL і provider routing — назвіть кожну.")}</p></section></div><div class="table-scroll"><table><thead><tr><th>${t("Measure", "Метрика")}</th><th>${t("Why it matters", "Навіщо")}</th><th>${t("Failure signal", "Сигнал проблеми")}</th></tr></thead><tbody><tr><td>Cache hit rate</td><td>${t("Shows whether the boundary is stable in real traffic", "Показує, чи стабільна межа в реальному трафіку")}</td><td>${t("High variance between equivalent tasks", "Висока різниця між еквівалентними задачами")}</td></tr><tr><td>Time to first token</td><td>${t("Captures perceived responsiveness", "Відображає відчутну швидкість відповіді")}</td><td>${t("A larger prefix erases the benefit", "Більший префікс з’їдає виграш")}</td></tr><tr><td>Accepted-result rate</td><td>${t("Keeps quality attached to cost", "Пов’язує якість із вартістю")}</td><td>${t("More manual repair after a hit", "Більше ручного ремонту після hit")}</td></tr><tr><td>Miss reason</td><td>${t("Turns cache behaviour into a debuggable system", "Робить поведінку кешу придатною для налагодження")}</td><td>${t("Unknown misses become normal", "Невідомі промахи стають нормою")}</td></tr></tbody></table></div><h2 id="rollout">${t("A safe rollout in one afternoon.", "Безпечний запуск за один робочий цикл.")}</h2><div class="use-grid"><section class="use-card positive">${eyebrow(t("USE IT WHEN", "ВИКОРИСТОВУЙТЕ, КОЛИ"))}<ul><li>${t("The same instruction prefix serves a repeated task family.", "Той самий префікс інструкцій обслуговує повторюваний тип завдань.")}</li><li>${t("You can version the stable context independently of task data.", "Сталий контекст можна версіонувати окремо від даних завдання.")}</li><li>${t("Latency, quality and cost can be observed together.", "Затримку, якість і вартість можна спостерігати разом.")}</li></ul></section><section class="use-card caution">${eyebrow(t("WAIT WHEN", "ЗАЧЕКАЙТЕ, КОЛИ"))}<ul><li>${t("Every request assembles a different tool or evidence set.", "Кожен запит збирає інший набір інструментів або доказів.")}</li><li>${t("The prompt contract changes several times a day.", "Контракт промпту змінюється кілька разів на день.")}</li><li>${t("The team cannot explain why a miss occurred.", "Команда не може пояснити причину промаху.")}</li></ul></section></div><ol class="rollout-list"><li><span>01</span><div><strong>${t("Choose one repeated workflow.", "Оберіть один повторюваний процес.")}</strong><p>${t("Use a task with enough volume to observe, but low enough risk to review manually.", "Візьміть завдання з достатнім обсягом для спостереження, але низьким ризиком для ручного review.")}</p></div></li><li><span>02</span><div><strong>${t("Freeze and name the prefix.", "Зафіксуйте й назвіть префікс.")}</strong><p>${t("Record content hash, version, owner and the reason a future change should invalidate it.", "Запишіть content hash, версію, власника й причину, з якої майбутня зміна має його інвалідувати.")}</p></div></li><li><span>03</span><div><strong>${t("Run a paired comparison.", "Проведіть парне порівняння.")}</strong><p>${t("Compare equivalent tasks with the same model, provider route, output contract and reviewer.", "Порівнюйте еквівалентні задачі з тією самою моделлю, provider route, контрактом результату й reviewer.")}</p></div></li><li><span>04</span><div><strong>${t("Add a miss ledger before scaling.", "Додайте реєстр miss до масштабування.")}</strong><p>${t("Every miss needs a reason. Unknown is useful temporarily, not as a permanent category.", "Кожен miss потребує причини. Unknown корисний тимчасово, але не як постійна категорія.")}</p></div></li></ol><div class="editor-note">${eyebrow(t("EDITOR’S TAKE", "ПОГЛЯД РЕДАКТОРА"))}<p>${t(
    "Prompt caching exposes whether a team actually knows what is stable in its own workflow. The cost graph is useful, but the sharper benefit is a better-separated request contract.",
    "Prompt caching показує, чи команда справді розуміє, що є сталим у її процесі. Графік вартості корисний, але сильніший результат — краще розділений контракт запиту.",
  )}</p></div><h2 id="sources">${t("Implementation notes & source slots.", "Примітки реалізації й позиції джерел.")}</h2>${articleSourceLedger([
    [t("Provider caching documentation", "Документація провайдера про кешування"), t("Exact eligibility rules, TTL, billing semantics and invalidation behaviour for the selected route.", "Точні правила придатності, TTL, billing semantics і поведінка інвалідації для обраного маршруту.")],
    [t("Application telemetry", "Телеметрія застосунку"), t("Request version, hit or miss, reason, latency and accepted-result signal—without storing private prompt text.", "Версія запиту, hit або miss, причина, затримка й accepted-result signal — без збереження приватного тексту промпту.")],
    [t("Controlled comparison", "Контрольоване порівняння"), t("Same workflow, model route, reviewer and quality bar before and after the change.", "Той самий процес, маршрут моделі, reviewer і quality bar до та після зміни.")],
    [t("Change log", "Журнал змін"), t("Every prefix version states what changed, who approved it and when results should be rechecked.", "Кожна версія префікса пояснює зміну, того, хто її схвалив, і момент повторної перевірки результатів.")],
  ])}<div class="article-topic-links">${link("concept", t("Prompt caching concept ↗", "Концепт prompt caching ↗"))}${link("tool", t("Structure a prompt ↗", "Структурувати промпт ↗"))}${link("guide", t("Choose a coding workflow ↗", "Обрати процес роботи з кодом ↗"))}</div>`;
  return {
    id: "technical",
    format: t("TECHNICAL FIELD GUIDE", "ТЕХНІЧНИЙ РОЗБІР"),
    tag: t("FIELD GUIDE / COST & PERFORMANCE", "ТЕХНІЧНИЙ ГАЙД / ВАРТІСТЬ І ШВИДКІСТЬ"),
    title: t("Prompt caching, beyond the price tag.", "Prompt caching: більше, ніж економія."),
    dek: t("A cacheable prompt is an information architecture. Here is how to separate the stable prefix, measure the boundary and roll it out without hiding quality regressions.", "Промпт, який варто кешувати, — це інформаційна архітектура. Як відділити сталий префікс, виміряти межу й запустити її без прихованої втрати якості."),
    readTime: 10,
    sourceCount: 4,
    toc: [
      ["overview", t("Practical answer", "Практична відповідь")],
      ["anatomy", t("Request anatomy", "Анатомія запиту")],
      ["measurement", t("What to measure", "Що вимірювати")],
      ["rollout", t("Safe rollout", "Безпечний запуск")],
      ["sources", t("Notes & sources", "Примітки й джерела")],
    ],
    content,
  };
}
function evidenceArticle() {
  const content = `<div class="article-disclosure">${t(
    "This research-note layout uses an illustrative benchmark scenario. The evidence hierarchy is the product: every score, setup and confidence label would link to a reproducible source in a published article.",
    "Цей макет research note використовує демонстраційний сценарій бенчмарку. Ієрархія доказів — частина продукту: кожна оцінка, умова й рівень впевненості в опублікованій статті ведуть до відтворюваного джерела.",
  )}</div><div class="callout" id="overview">${eyebrow(t("THE CLAIM IN ONE SENTENCE", "ТВЕРДЖЕННЯ ОДНИМ РЕЧЕННЯМ"))}<p>${t(
    "A benchmark can show how a system behaved under one defined setup. It cannot, by itself, tell you whether the system fits your repository, review process or tolerance for failure.",
    "Бенчмарк може показати поведінку системи в одних визначених умовах. Сам по собі він не відповідає, чи підходить система вашому репозиторію, процесу review або допустимому рівню помилок.",
  )}</p></div><figure class="article-hero article-hero-evidence" aria-labelledby="evidence-hero-caption"><div class="evidence-frame"><section><span>01 / TASK</span><strong>${t("Repository change", "Зміна в репозиторії")}</strong><small>${t("Defined issue + hidden tests", "Визначена задача + приховані тести")}</small></section><section><span>02 / SETUP</span><strong>${t("Same tools", "Ті самі інструменти")}</strong><small>${t("Pinned model, budget and environment", "Зафіксовані модель, бюджет і середовище")}</small></section><section><span>03 / RESULT</span><strong>${t("Accepted diff", "Прийнятий diff")}</strong><small>${t("Not just a generated answer", "Не лише згенерована відповідь")}</small></section><section><span>04 / TRANSFER</span><strong>${t("Your workflow?", "Ваш процес?")}</strong><small>${t("Still needs a local check", "Ще потребує локальної перевірки")}</small></section></div><figcaption id="evidence-hero-caption">${t(
    "Read a benchmark left to right, then test transferability right to left. The headline score is only one cell in the chain.",
    "Читайте бенчмарк зліва направо, а перенесення перевіряйте справа наліво. Підсумкова оцінка — лише одна клітинка в ланцюгу.",
  )}</figcaption></figure>${articleTakeaways([
    t("Inspect the task definition and pass condition before comparing model names or aggregate scores.", "Перевірте визначення завдання й умову проходження до порівняння назв моделей або загальних балів."),
    t("Treat tool access, retry budget and reviewer intervention as part of the result—not incidental setup details.", "Вважайте доступ до інструментів, бюджет retry і втручання reviewer частиною результату, а не другорядними деталями setup."),
    t("Run a small local transfer test before changing a production workflow. Reproducibility is necessary; relevance is separate.", "Проведіть малий локальний transfer test до зміни production-процесу. Відтворюваність необхідна, але доречність — окреме питання."),
  ])}<h2 id="reading">${t("Read the score backwards.", "Читайте оцінку у зворотному напрямку.")}</h2><p>${t(
    "A leaderboard invites the eye to start with rank. A useful review begins at the other end: what counted as success, who judged it, what the system was allowed to do and which failures disappeared inside an average. Only then does the aggregate score become interpretable.",
    "Таблиця лідерів спонукає починати з місця. Корисний review починається з іншого боку: що вважали успіхом, хто це оцінював, що система мала право робити й які провали зникли всередині середнього. Лише тоді загальний бал можна інтерпретувати.",
  )}</p><p>${t(
    "This is especially important for agent evaluations. A model, harness, tool policy and retry controller act together. Reporting only the model name compresses a system result into a product label. That may be convenient for a headline, but it is weak evidence for an engineering decision.",
    "Це особливо важливо для оцінювання агентів. Модель, harness, tool policy і retry controller працюють разом. Якщо повідомляти лише назву моделі, системний результат стискається до product label. Для заголовка це зручно, але для інженерного рішення — слабкий доказ.",
  )}</p><div class="evidence-ledger"><div class="evidence-ledger-head"><span>${t("CLAIM", "ТВЕРДЖЕННЯ")}</span><span>${t("EVIDENCE NEEDED", "ПОТРІБНИЙ ДОКАЗ")}</span><span>${t("TRANSFER RISK", "РИЗИК ПЕРЕНЕСЕННЯ")}</span></div><div><strong>${t("System A completes more tasks", "Система A завершує більше завдань")}</strong><p>${t("Per-task outcomes, pass condition and excluded runs", "Результати кожного завдання, умова проходження й виключені запуски")}</p><span class="confidence medium">${t("MEDIUM", "СЕРЕДНІЙ")}</span></div><div><strong>${t("The improvement comes from the model", "Покращення дає саме модель")}</strong><p>${t("Ablation across harness, tools, prompt and retry policy", "Ablation для harness, інструментів, промпту й retry policy")}</p><span class="confidence high">${t("HIGH", "ВИСОКИЙ")}</span></div><div><strong>${t("The result will hold in our repository", "Результат повториться в нашому репозиторії")}</strong><p>${t("Local task sample with the same review bar", "Локальна вибірка завдань із тим самим стандартом review")}</p><span class="confidence high">${t("HIGH", "ВИСОКИЙ")}</span></div><div><strong>${t("The workflow is cheaper overall", "Процес загалом дешевший")}</strong><p>${t("Total attempts, reviewer time and provider cost", "Усі спроби, час reviewer і вартість провайдера")}</p><span class="confidence medium">${t("MEDIUM", "СЕРЕДНІЙ")}</span></div></div><h2 id="evidence">${t("An evidence matrix, not a winner card.", "Матриця доказів, а не картка переможця.")}</h2><p>${t(
    "The compact table below shows how a production article can keep numbers attached to their conditions. The values are intentionally illustrative; their job is to demonstrate hierarchy, footnotes and uncertainty without implying a real model comparison.",
    "Компактна таблиця нижче показує, як production-стаття може тримати числа поруч з умовами. Значення навмисно демонстраційні: вони показують ієрархію, примітки й невизначеність, не імітуючи реальне порівняння моделей.",
  )}</p><div class="table-scroll"><table class="benchmark-table"><thead><tr><th>${t("Illustrative system", "Демонстраційна система")}</th><th>${t("Accepted tasks", "Прийняті задачі")}</th><th>${t("Median attempts", "Медіана спроб")}</th><th>${t("Human repair", "Ручний ремонт")}</th><th>${t("Evidence grade", "Рівень доказу")}</th></tr></thead><tbody><tr><td>Baseline / A</td><td>18 / 30</td><td>1.8</td><td>7</td><td><span class="confidence medium">B / ${t("partial", "частково")}</span></td></tr><tr><td>Treatment / B</td><td>21 / 30</td><td>2.4</td><td>9</td><td><span class="confidence medium">B / ${t("partial", "частково")}</span></td></tr><tr><td>${t("Local transfer", "Локальне перенесення")}</td><td>4 / 8</td><td>2.0</td><td>3</td><td><span class="confidence low">C / ${t("small n", "мала n")}</span></td></tr></tbody></table></div><aside class="method-note"><strong>${t("How to read the demo", "Як читати демо")}</strong><p>${t(
    "Treatment B has a higher accepted-task count, but also more attempts and repair. Without task-level data and a larger transfer sample, the strongest defensible conclusion is narrow: the setup deserves another controlled test.",
    "Treatment B має більше прийнятих задач, але також більше спроб і ремонту. Без даних по кожному завданню й більшої transfer-вибірки найсильніший обґрунтований висновок вузький: setup заслуговує ще одного контрольованого тесту.",
  )}</p></aside><h2 id="transfer">${t("Transfer is a second experiment.", "Перенесення — це другий експеримент.")}</h2><p>${t(
    "Reproducibility asks whether another team can obtain the reported result under the documented setup. Transferability asks whether the result survives a change in repository, task mix, tool permissions, latency budget and reviewer expectations. The first protects the claim; the second protects your decision.",
    "Відтворюваність питає, чи інша команда отримає заявлений результат у задокументованому setup. Переносимість — чи переживе результат зміну репозиторію, набору задач, дозволів інструментів, бюджету затримки й очікувань reviewer. Перше захищає твердження, друге — ваше рішення.",
  )}</p><div class="transfer-grid"><section>${eyebrow(t("KEEP CONSTANT", "ЗАЛИШТЕ СТАЛИМ"))}<ul><li>${t("Task acceptance criteria", "Критерії прийняття задачі")}</li><li>${t("Review rubric", "Рубрику review")}</li><li>${t("Maximum attempts", "Максимальну кількість спроб")}</li><li>${t("Cost accounting", "Облік вартості")}</li></ul></section><section>${eyebrow(t("CHANGE DELIBERATELY", "ЗМІНЮЙТЕ НАВМИСНО"))}<ul><li>${t("Repository and codebase shape", "Репозиторій і форму кодової бази")}</li><li>${t("Task distribution", "Розподіл типів задач")}</li><li>${t("Tool and permission policy", "Політику інструментів і дозволів")}</li><li>${t("Reviewer familiarity", "Обізнаність reviewer")}</li></ul></section><section>${eyebrow(t("REPORT SEPARATELY", "ЗВІТУЙТЕ ОКРЕМО"))}<ul><li>${t("Correct first attempts", "Коректні перші спроби")}</li><li>${t("Recovered attempts", "Відновлені спроби")}</li><li>${t("Unsafe or unverifiable output", "Небезпечні або неперевірні результати")}</li><li>${t("Human repair time", "Час ручного ремонту")}</li></ul></section></div><h2 id="decision">${t("A decision framework for the next trial.", "Рамка рішення для наступного тесту.")}</h2><ol class="rollout-list"><li><span>01</span><div><strong>${t("Name the decision.", "Назвіть рішення.")}</strong><p>${t("Are you selecting a model, a complete agent system, a review policy or only a candidate for further testing?", "Ви обираєте модель, повну агентну систему, політику review чи лише кандидата на наступне тестування?")}</p></div></li><li><span>02</span><div><strong>${t("Set the local failure budget.", "Встановіть локальний бюджет помилки.")}</strong><p>${t("Define which failures are recoverable, which require a person and which stop the trial immediately.", "Визначте, які помилки відновлювані, які потребують людини, а які негайно зупиняють тест.")}</p></div></li><li><span>03</span><div><strong>${t("Choose representative tasks.", "Оберіть репрезентативні задачі.")}</strong><p>${t("Include ordinary work, one difficult edge case and one task the system should refuse or escalate.", "Додайте звичайну роботу, один складний edge case і одну задачу, яку система має відхилити або ескалувати.")}</p></div></li><li><span>04</span><div><strong>${t("Keep the evidence package.", "Збережіть пакет доказів.")}</strong><p>${t("Store inputs, environment, versions, outputs, review notes and the reason for every exclusion.", "Збережіть inputs, середовище, версії, outputs, review notes і причину кожного виключення.")}</p></div></li></ol><div class="voice-pair"><blockquote><p>${t("A score is useful when it narrows a decision. It is misleading when it replaces the conditions that produced it.", "Оцінка корисна, коли звужує рішення. Вона вводить в оману, коли замінює умови, що її створили.")}</p><cite>${t("Editorial interpretation", "Редакційна інтерпретація")}</cite></blockquote><blockquote><p>${t("The most honest outcome of a benchmark review can be: promising, not yet transferable.", "Найчеснішим результатом review бенчмарку може бути: перспективно, але ще не переноситься.")}</p><cite>${t("Decision note", "Примітка до рішення")}</cite></blockquote></div><h2 id="sources">${t("Evidence package & source ledger.", "Пакет доказів і реєстр джерел.")}</h2>${articleSourceLedger([
    [t("Benchmark specification", "Специфікація бенчмарку"), t("Task set, exclusions, acceptance rules, evaluator and aggregation method.", "Набір задач, виключення, правила прийняття, evaluator і метод агрегації.")],
    [t("Reproduction bundle", "Пакет відтворення"), t("Environment, versions, prompts, tool policy, seeds and task-level outcomes.", "Середовище, версії, промпти, tool policy, seeds і результати по кожній задачі.")],
    [t("Independent review", "Незалежний review"), t("A second reader checks whether the written claim is narrower than—or equal to—the evidence.", "Другий читач перевіряє, що письмове твердження не ширше за докази.")],
    [t("Local transfer run", "Локальний transfer run"), t("Representative internal tasks, the same quality bar and a separately reported small-sample limitation.", "Репрезентативні внутрішні задачі, той самий quality bar і окремо позначене обмеження малої вибірки.")],
    [t("Correction history", "Історія виправлень"), t("Changes to data, interpretation or confidence remain visible after publication.", "Зміни даних, інтерпретації або рівня впевненості лишаються видимими після публікації.")],
  ])}<div class="article-topic-links">${link("guide", t("Read the evaluation guide ↗", "Читати гайд з оцінювання ↗"))}${link("concept", t("Explore agent systems ↗", "Дослідити агентні системи ↗"))}${link("policy", t("Corrections policy ↗", "Політика виправлень ↗"))}</div>`;
  return {
    id: "evidence",
    format: t("EVIDENCE NOTE", "ДОКАЗОВА НОТАТКА"),
    tag: t("RESEARCH NOTE / MODELS & EVALUATION", "RESEARCH NOTE / МОДЕЛІ Й ОЦІНЮВАННЯ"),
    title: t("A benchmark is a starting point. What comes next?", "Бенчмарк — початок. Що далі?"),
    dek: t("A useful benchmark article keeps the task, setup, result and transfer limit together—then turns the headline score into a bounded engineering decision.", "Корисна стаття про бенчмарк тримає разом завдання, setup, результат і межу перенесення, а підсумкову оцінку перетворює на обмежене інженерне рішення."),
    readTime: 9,
    sourceCount: 5,
    toc: [
      ["overview", t("The claim", "Твердження")],
      ["reading", t("Read the score", "Як читати оцінку")],
      ["evidence", t("Evidence matrix", "Матриця доказів")],
      ["transfer", t("Transfer test", "Transfer test")],
      ["decision", t("Decision framework", "Рамка рішення")],
      ["sources", t("Evidence ledger", "Реєстр доказів")],
    ],
    content,
  };
}

function articleVariant() {
  const variant = currentArticleVariant();
  if (variant === "technical") return technicalArticle();
  if (variant === "evidence") return evidenceArticle();
  return analysisArticle();
}

function article() {
  return articleShell(articleVariant());
}
function digests() {
  return `${intro(t("THE EDITIONS", "ВИПУСКИ"), t("Daily context.<br><em>Weekly perspective.</em>", "Контекст щодня.<br><em>Перспектива щотижня.</em>"), t("Choose a quick catch-up or make time for a deeper read.", "Оберіть короткий огляд або знайдіть час для глибшого читання."))}${filterBar("digests")}<div class="grid2">${activeFilter === "all" || activeFilter === "daily" ? `<article class="tool-card">${eyebrow(t("DAILY / 05 SEP 2026", "DAILY / 05 ВЕР 2026"))}<div class="tool-number">05<span style="font-size:18px"> / 09</span></div><h2>${t("Today, in five minutes.", "Сьогодні, за п’ять хвилин.")}</h2><p>${t("Memory, context and the decisions behind useful agents. A compact, finite read.", "Пам’ять, контекст і рішення за корисними агентами. Короткий завершений огляд.")}</p>${btn("daily", t("Read the daily brief", "Читати бриф дня"))}</article>` : ""}${activeFilter === "all" || activeFilter === "weekly" ? `<article class="week-cover">${eyebrow("WEEKLY / DESIGN EDITION")}<h3>${t("The shape<br>of what’s next.", "Контури<br>майбутнього.")}</h3><div class="spaced" style="position:relative;z-index:2">${btn("weekly", t("Read the weekly edition", "Читати тижневий випуск"))}</div></article>` : ""}</div><section class="section">${sectionHead(t("Previous editions", "Попередні випуски"))}${activeFilter === "weekly" ? `<p class="meta">${t("This preview contains one weekly edition.", "У цьому перегляді один тижневий випуск.")}</p>` : ""}${(activeFilter === "weekly" ? [] : ["04", "03", "02"]).map((d) => `<div class="index-row"><span class="term-letter">${d}</span><h2>${link("daily", t("The daily intelligence edit", "Щоденний редакційний бриф"))}</h2><p>${t("Illustrative archive entry · five-minute format", "Демонстраційний запис архіву · п’ятихвилинний формат")}</p><span class="meta">DAILY / SEP</span></div>`).join("")}</section>${newsletter()}`;
}
function daily() {
  return `${intro("THE DAILY BRIEF / 05.09.2026", t("A little clarity.<br><em>Before you begin.</em>", "Трохи ясності.<br><em>Перед початком дня.</em>"), t("Your five-minute edit: three things to understand, one thing to try.", "Ваш п’ятихвилинний огляд: три речі для розуміння й одна для дії."))}<div class="dateline"><span>${t("DEMONSTRATION EDITION", "ДЕМОНСТРАЦІЙНИЙ ВИПУСК")}</span><span>${link("digests", t("ALL EDITIONS ↗", "УСІ ВИПУСКИ ↗"))}</span></div><div class="feed-layout"><div>${stories()
    .slice(0, 3)
    .map(
      (s, i) =>
        `<article class="index-row" style="grid-template-columns:45px 1fr" id="daily-${i}"><span class="term-letter">0${i + 1}</span><div>${eyebrow(s.label)}<h2 class="mt">${link("article", s.title)}</h2><p class="spaced">${s.summary}</p><div class="status-banner spaced">${t("The takeaway:", "Головне:")} ${t("Connect the change to one concrete decision in your own workflow.", "Пов’яжіть зміну з одним конкретним рішенням у власному процесі.")}</div>${link("article", t("Read the full context ↗", "Читати повний контекст ↗"))}</div></article>`,
    )
    .join(
      "",
    )}<div class="sidebar spaced">${eyebrow(t("ONE THING TO TRY", "ОДНА РІЧ ДЛЯ ПРАКТИКИ"))}<h3>${t("Audit one agent instruction.", "Перевірте одну інструкцію агента.")}</h3><p>${t("Separate the goal, the context and the check. Start with a small example in Toolbox.", "Розділіть мету, контекст і перевірку. Почніть із невеликого прикладу в Toolbox.")}</p>${link("tool", t("Open the workspace ↗", "Відкрити утиліту ↗"))}</div></div><aside class="sidebar">${eyebrow(t("IN THIS EDITION", "У ЦЬОМУ ВИПУСКУ"))}${stories()
    .slice(0, 3)
    .map((s, i) => `<a href="#daily-${i}" data-anchor="daily-${i}">0${i + 1} / ${s.title}</a>`)
    .join(
      "",
    )}<p class="spaced">${t("Prefer the bigger picture?", "Цікавить ширший погляд?")}</p>${link("weekly", t("The weekly edition ↗", "Тижневий випуск ↗"))}</aside></div><section class="section">${newsletter()}</section>`;
}
function weekly() {
  return `${intro("THE WEEKLY EDITION / DESIGN ISSUE 01", t("The shape of<br><em>what’s next.</em>", "Контури<br><em>майбутнього.</em>"), t("Three shifts. One connected view of where AI engineering is heading.", "Три зрушення. Цілісний погляд на напрям розвитку AI-інженерії."))}<img class="brand-art" src="assets/after-hours.png" width="1672" height="941" alt="${t("Brass and glass concept sculpture", "Концептуальна скульптура з латуні й скла")}"><p class="meta mt">${t("CONCEPT ART / SAMPLE EDITION", "КОНЦЕПТ-АРТ / ПРИКЛАД ВИПУСКУ")}</p><div class="article-layout spaced"><nav class="toc" aria-label="${t("Edition contents", "Зміст випуску")}">${eyebrow(t("THE SETLIST", "ЗМІСТ"))}${["Memory", "Context", "Judgment"].map((s, i) => `<a href="#shift-${i}" data-anchor="shift-${i}">0${i + 1} / ${t(s, ["Пам’ять", "Контекст", "Рішення"][i])}</a>`).join("")}<a href="#action-board" data-anchor="action-board">${t("Next week’s moves", "Кроки на наступний тиждень")}</a></nav><article class="reading"><div class="callout">${eyebrow(t("THE THROUGH-LINE", "СПІЛЬНА ДУМКА"))}<p>${t("The interesting shift is from asking what a model can do to designing the conditions in which it does useful work. This is illustrative editorial direction.", "Цікаве зрушення — від питання, що вміє модель, до проєктування умов, у яких вона робить корисну роботу. Це демонстрація редакційного напрямку.")}</p></div>${["Memory", "Context", "Judgment"].map((s, i) => `<section id="shift-${i}">${eyebrow("0" + (i + 1) + " / " + t(s, ["Пам’ять", "Контекст", "Рішення"][i]))}<h2>${stories()[i].title}</h2><p>${stories()[i].summary}</p><p>${t("The weekly format connects individual reports, then separates what changed from what is still uncertain. Each chapter ends with a practical implication and visible source references.", "Тижневий формат пов’язує окремі матеріали, розділяє зміни й невизначеність. Кожен розділ закінчується практичним наслідком і видимими посиланнями на джерела.")}</p>${link("article", t("Follow the original story ↗", "Відкрити окремий матеріал ↗"))}</section>`).join("")}<section id="action-board"><h2>${t("Next week’s moves.", "Кроки на наступний тиждень.")}</h2><div class="table-scroll"><table><thead><tr><th>${t("Try", "Спробуйте")}</th><th>${t("Watch", "Стежте")}</th><th>${t("Keep in mind", "Пам’ятайте")}</th></tr></thead><tbody><tr><td>${t("Audit one instruction", "Перевірити одну інструкцію")}</td><td>${t("Context quality", "Якість контексту")}</td><td>${t("Human review", "Людська перевірка")}</td></tr></tbody></table></div></section><details><summary>${t("Sources, corrections & edition notes", "Джерела, виправлення й примітки випуску")}</summary><p>${t("Illustrative content. Production editions use their own verified source list. Video and PDF controls appear only when a published asset exists.", "Демонстраційний контент. Реальні випуски мають перевірені джерела. Кнопки відео й PDF з’являються лише за наявності опублікованого файлу.")}</p></details>${btn("digests", t("Back to all editions", "До всіх випусків"), true)}</article><aside class="article-tools"><button class="button outline" data-copy-link>${t("Copy edition link", "Копіювати посилання")}</button></aside></div>${newsletter()}`;
}
const terms = () => [
  [
    "AI Agent",
    "concept",
    t(
      "A system that works toward a goal through a sequence of actions.",
      "Система, що працює над метою через послідовність дій.",
    ),
  ],
  [
    "Claude Code",
    "product",
    t(
      "Explore the command-line agent and its workflow vocabulary.",
      "Командний агент і поняття його робочого процесу.",
    ),
  ],
  [
    "Context Engineering",
    "concept",
    t(
      "Choosing the information a model sees at each step.",
      "Вибір інформації, яку модель бачить на кожному кроці.",
    ),
  ],
  [
    "Model Context Protocol",
    "concept",
    t(
      "A shared interface between AI applications and external tools.",
      "Спільний інтерфейс між AI-застосунками й зовнішніми інструментами.",
    ),
  ],
  [
    "OpenAI API",
    "library",
    t(
      "Reference context for applications built around model APIs.",
      "Довідковий контекст для застосунків на основі API моделей.",
    ),
  ],
  [
    "Prompt Caching",
    "concept",
    t(
      "Understand reusable context before optimizing the token bill.",
      "Зрозумійте повторне використання контексту до оптимізації витрат.",
    ),
  ],
  [
    "RAG",
    "concept",
    t(
      "Bring relevant source material into a generation workflow.",
      "Додавайте доречні першоджерела в процес генерації.",
    ),
  ],
];
function concepts() {
  return `${intro(t("THE REFERENCE SHELF", "ПОЛИЦЯ ЗНАНЬ"), t("Know the language.<br><em>See the connections.</em>", "Знати мову.<br><em>Бачити зв’язки.</em>"), t("Concepts, products and protocols, explained in plain language.", "Концепти, продукти й протоколи простою мовою."))}${filterBar("concepts")}<div>${terms()
    .filter((x) => activeFilter === "all" || x[1] === activeFilter)
    .map(
      ([name, type, desc]) =>
        `<div class="index-row"><span class="term-letter">${name[0]}</span><h2>${link("concept", name)}</h2><p>${desc}</p><span class="meta">${type.toUpperCase()} ↗</span></div>`,
    )
    .join(
      "",
    )}</div><section class="section">${sectionHead(t("Start with a question.", "Почніть із питання."))}<div class="grid3">${[t("How do agents use tools?", "Як агенти використовують інструменти?"), t("What belongs in context?", "Що належить до контексту?"), t("How do I compare workflows?", "Як порівнювати робочі процеси?")].map((s, i) => `<div class="card"><h3>${link(i === 2 ? "guide" : "concept", s + " ↗")}</h3></div>`).join("")}</div></section>`;
}
function concept() {
  return readShell(
    "Model Context<br><em>Protocol.</em>",
    t(
      "A common language between AI applications and the tools they use.",
      "Спільна мова між AI-застосунками та їхніми інструментами.",
    ),
    "CONCEPTS / PROTOCOL",
    `<div class="callout" id="overview">${eyebrow(t("THE DEFINITION", "ВИЗНАЧЕННЯ"))}<p>${t("Model Context Protocol (MCP) provides a standard way for AI applications to connect to external data and tools. This definition is used here to demonstrate the reference-page layout.", "Model Context Protocol (MCP) задає стандартний спосіб підключення AI-застосунків до зовнішніх даних та інструментів. Це визначення показує верстку довідкової сторінки.")}</p></div>${visual(1)}<h2 id="context">${t("Where it fits", "Де це використовується")}</h2><p>${t("The concept page leads with a direct answer, then expands into a small mental model, practical context and related terms.", "Сторінка концепту починається з прямої відповіді, далі пояснює модель роботи, практичний контекст і пов’язані терміни.")}</p><div class="table-scroll"><table><thead><tr><th>${t("Part", "Частина")}</th><th>${t("Role", "Роль")}</th></tr></thead><tbody><tr><td>Host</td><td>${t("The application used by the reader", "Застосунок, яким користується читач")}</td></tr><tr><td>Client</td><td>${t("The protocol connection", "Протокольне з’єднання")}</td></tr><tr><td>Server</td><td>${t("The external capabilities", "Зовнішні можливості")}</td></tr></tbody></table></div><h2 id="next">${t("Put it in context", "Додайте контекст")}</h2><p>${link("guide", t("Choose a coding-agent workflow ↗", "Оберіть процес роботи з агентом ↗"))}</p><p>${link("category", t("Read recent Agents & MCP coverage ↗", "Читайте матеріали Agents & MCP ↗"))}</p><details><summary>${t("Is a protocol the same as an agent?", "Чи протокол — це те саме, що агент?")}</summary><p>${t("No. A protocol describes communication; an agent describes a system that acts toward a goal.", "Ні. Протокол описує комунікацію; агент — систему, що діє для досягнення мети.")}</p></details><h2 id="sources">${t("Keep the reference current", "Підтримуйте актуальність")}</h2><p>${t("Production content retains its own verified date, primary documentation and change notes. The layout never presents a design-review date as a factual verification date.", "Реальний матеріал зберігає власну дату перевірки, першоджерела й історію змін. Дата перевірки дизайну не підміняє дату перевірки фактів.")}</p>${link("concepts", t("Back to the reference shelf ↗", "До полиці знань ↗"))}`,
  );
}
function guides() {
  return `${intro(t("THE PRACTICAL LIBRARY", "ПРАКТИЧНА БІБЛІОТЕКА"), t("Less guessing.<br><em>Better decisions.</em>", "Менше здогадок.<br><em>Кращі рішення.</em>"), t("Living guides for the way you actually build with AI.", "Живі гайди для реальної роботи з AI."))}<div class="week-block"><div class="week-cover">${eyebrow(t("START HERE / COMPARISON", "ПОЧНІТЬ ТУТ / ПОРІВНЯННЯ"))}<h3>Claude Code.<br>Cursor.<br>Codex.</h3></div><div class="week-copy">${eyebrow(t("CHOOSE YOUR WORKFLOW", "ОБЕРІТЬ РОБОЧИЙ ПРОЦЕС"))}<h2>${t("Which agent fits<br>the way you work?", "Який агент підходить<br>для вашої роботи?")}</h2><p>${t("A decision framework based on interface, autonomy and review.", "Підхід до вибору за інтерфейсом, автономністю та перевіркою.")}</p>${btn("guide", t("Read the comparison", "Читати порівняння"))}</div></div><section class="section">${sectionHead(t("The working library", "Робоча бібліотека"))}<div class="index-row"><span class="term-letter">02</span><h2>${link("guide", "ATB Orchestration Bench")}</h2><p>${t("How to read a reproducible evaluation and its underlying evidence.", "Як читати відтворюване оцінювання й докази, що стоять за ним.")}</p><span class="meta">REFERENCE ↗</span></div></section>${newsletter()}`;
}
function guide() {
  return readShell(
    t(
      "Choose the agent.<br><em>Keep your judgment.</em>",
      "Оберіть агента.<br><em>Збережіть власне судження.</em>",
    ),
    t(
      "Claude Code, Cursor and Codex: a practical decision framework.",
      "Claude Code, Cursor і Codex: практичний підхід до вибору.",
    ),
    "GUIDES / COMPARISON",
    `<div class="callout" id="overview">${eyebrow(t("START WITH YOUR WORK", "ПОЧНІТЬ ЗІ СВОЄЇ РОБОТИ"))}<p>${t("Choose for the tasks you repeat, the interface you prefer and the level of review you can provide. The table below demonstrates the comparison pattern; it is not a current product ranking.", "Обирайте за повторюваними завданнями, зручним інтерфейсом і доступним рівнем перевірки. Таблиця нижче показує патерн порівняння, а не поточний рейтинг продуктів.")}</p></div><h2 id="context">${t("Compare the right things.", "Порівнюйте потрібне.")}</h2><div class="table-scroll"><table><thead><tr><th>${t("Your question", "Ваше питання")}</th><th>${t("What to inspect", "Що перевірити")}</th><th>${t("Evidence to keep", "Які докази зберегти")}</th></tr></thead><tbody><tr><td>${t("Does it fit my workflow?", "Чи підходить процес?")}</td><td>${t("Editor, terminal, delegated tasks", "Редактор, термінал, делеговані завдання")}</td><td>${t("One completed task", "Одне завершене завдання")}</td></tr><tr><td>${t("Can I review its changes?", "Чи можу я перевірити зміни?")}</td><td>${t("Diff, tests, permissions", "Diff, тести, дозволи")}</td><td>${t("Review notes", "Примітки перевірки")}</td></tr><tr><td>${t("Is the result repeatable?", "Чи результат відтворюється?")}</td><td>${t("Same prompt and context", "Той самий запит і контекст")}</td><td>${t("Run conditions", "Умови запуску")}</td></tr></tbody></table></div><h2 id="next">${t("Try one small task.", "Спробуйте одне мале завдання.")}</h2>${[t("Define the result before starting.", "Визначте результат до початку."), t("Keep the inputs and constraints the same.", "Збережіть однакові вхідні дані й обмеження."), t("Review the actual diff and output.", "Перевірте фактичний diff і результат.")].map((s, i) => `<div class="step"><span class="avatar">${i + 1}</span><p>${s}</p></div>`).join("")}${link("tool", t("Prepare an instruction in Toolbox ↗", "Підготуйте інструкцію в Toolbox ↗"))}<h2 id="sources">${t("Verification & changelog", "Перевірка й історія змін")}</h2><p>${t("The production guide preserves its factual comparisons and verification date. New releases trigger a content review, independently of this redesign.", "Реальний гайд зберігає фактичні порівняння та дату перевірки. Нові релізи потребують перегляду контенту незалежно від редизайну.")}</p><details><summary>${t("How should I read the benchmark?", "Як читати бенчмарк?")}</summary><p>${t("Inspect the task, environment and run evidence before comparing a headline score.", "Перевірте завдання, середовище та докази запуску перед порівнянням підсумкових оцінок.")}</p></details>`,
  );
}
function toolsPage() {
  return `${intro(t("THE WORKBENCH", "МАЙСТЕРНЯ"), t("Small tools.<br><em>Considered craft.</em>", "Малі інструменти.<br><em>Продумана робота.</em>"), t("Free utilities for your AI workflow. Your inputs stay in your browser.", "Безкоштовні утиліти для AI-роботи. Вхідні дані залишаються у вашому браузері."))}<div class="grid3">${[
    [
      t("Prompt Optimizer", "Оптимізатор промптів"),
      t(
        "Give your prompt a clearer goal, context and output format.",
        "Додайте промпту чітку мету, контекст і формат результату.",
      ),
    ],
    [
      "settings.json Builder",
      t(
        "Make permissions and hooks understandable before exporting.",
        "Зрозумілі дозволи й hooks перед експортом.",
      ),
    ],
    [
      "CLAUDE.md / AGENTS.md",
      t(
        "Turn project constraints into explicit, reusable instructions.",
        "Перетворіть обмеження проєкту на чіткі багаторазові інструкції.",
      ),
    ],
  ]
    .map(
      ([title, desc], i) =>
        `<article class="tool-card"><div class="tool-number">0${i + 1}<span style="float:right;font:11px var(--mono)">↗</span></div>${eyebrow(t("LOCAL-FIRST / FREE", "ЛОКАЛЬНО / БЕЗКОШТОВНО"))}<h2>${title}</h2><p>${desc}</p>${link(["tool", "settings", "instructions"][i], t("Open workspace ↗", "Відкрити утиліту ↗"), "button outline")}</article>`,
    )
    .join(
      "",
    )}</div><section class="section"><div class="grid2"><div><h2>${t("Built to do a job.<br>Then get out of your way.", "Зробити справу.<br>І не заважати.")}</h2></div><p>${t("The prototype demonstrates one local interaction. The final workspaces retain the existing tool engines, validation and export formats. Each tool keeps its own verified date and supporting references.", "Прототип показує одну локальну взаємодію. Фінальні утиліти зберігають наявну логіку, валідацію й формати експорту. Кожна має власну дату перевірки та джерела.")}</p></div></section>`;
}
function tool() {
  return `${intro("TOOLBOX / PROMPT OPTIMIZER", t("Give your prompt<br><em>a little structure.</em>", "Додайте промпту<br><em>трохи структури.</em>"), t("A local interaction demo. No model call and no input leaves this page.", "Демонстрація локальної взаємодії. Без виклику моделі чи надсилання введених даних."))}<div class="workbench"><section><form id="tool-form">${eyebrow(t("01 / YOUR DRAFT", "01 / ВАША ЧЕРНЕТКА"))}<label for="prompt-input">${t("What should the agent do?", "Що агент має зробити?")}</label><textarea id="prompt-input" rows="8" required placeholder="${t("Review this pull request for correctness…", "Перевір цей pull request на коректність…")}"></textarea><label for="output-format">${t("Preferred result", "Формат результату")}</label><select id="output-format"><option value="checklist">${t("A concise checklist", "Короткий чекліст")}</option><option value="explanation">${t("An explanation with examples", "Пояснення з прикладами")}</option></select><div class="spaced"><button class="button">${t("Structure the draft", "Структурувати чернетку")} ↗</button></div></form></section><section aria-live="polite">${eyebrow(t("02 / STRUCTURED OUTPUT", "02 / СТРУКТУРОВАНИЙ РЕЗУЛЬТАТ"))}<pre id="tool-output" class="spaced">${t("Your structured draft will appear here.\n\n1. Goal\n2. Context\n3. Output\n4. Verification", "Тут з’явиться структурована чернетка.\n\n1. Мета\n2. Контекст\n3. Результат\n4. Перевірка")}</pre><button class="button outline spaced" id="copy-output" disabled>${t("Copy draft", "Копіювати чернетку")}</button><p class="form-note">${t("This demo adds a template; it does not assess or improve model performance.", "Демо додає шаблон; воно не оцінює й не покращує якість моделі.")}</p></section></div>`;
}
function categories() {
  const cats = [
    [
      "Agents & MCP",
      t("How agents connect, remember and act.", "Як агенти з’єднуються, пам’ятають і діють."),
    ],
    [
      t("Tools & releases", "Інструменти й релізи"),
      t("The tools changing the way you build.", "Інструменти, що змінюють вашу роботу."),
    ],
    [
      t("Models & research", "Моделі й дослідження"),
      t("Read the evidence behind the headline.", "Докази за заголовками."),
    ],
    [
      t("Token & cost optimization", "Оптимізація токенів і вартості"),
      t(
        "More useful work from your context budget.",
        "Більше користі з вашого контекстного бюджету.",
      ),
    ],
    [
      t("Vibe coding workflow", "Vibe coding процеси"),
      t("A closer look at agent-assisted development.", "Уважний погляд на розробку з агентами."),
    ],
    [
      t("Tutorials & guides", "Інструкції й гайди"),
      t(
        "Methods you can take into your own work.",
        "Методи, які можна застосувати у власній роботі.",
      ),
    ],
  ];
  return `${intro(t("EXPLORE BY TOPIC", "ДОСЛІДЖУЙТЕ ЗА ТЕМОЮ"), t("Follow your<br><em>curiosity.</em>", "Рухайтеся за<br><em>цікавістю.</em>"), t("Find the latest reporting, the useful context and your next practical step.", "Знайдіть останні матеріали, корисний контекст і наступний практичний крок."))}<div class="grid2">${cats.map(([h, p], i) => `<article class="card">${eyebrow("0" + (i + 1) + " / TOPIC")}<h2 class="mt">${link("category", h + " ↗")}</h2><p>${p}</p><div class="meta">${t("NEWS · CONCEPTS · GUIDES", "НОВИНИ · КОНЦЕПТИ · ГАЙДИ")}</div></article>`).join("")}</div>${newsletter()}`;
}
function about() {
  return `${intro(t("ABOUT THE PUBLICATION", "ПРО ВИДАННЯ"), t("Intelligence deserves<br><em>a human perspective.</em>", "Інтелект потребує<br><em>людського погляду.</em>"), t("AI Today Brief is a human-edited publication for people who build with AI.", "AI Today Brief — видання з людською редактурою для тих, хто створює з AI."))}<div class="grid2 section"><div>${art(false)}</div><div><h2>${t("A quieter place<br>to understand what’s next.", "Спокійніше місце,<br>щоб зрозуміти майбутнє.")}</h2><p class="spaced">${t("We want each visit to leave you with context you can use: what changed, why it matters and where to go deeper.", "Ми прагнемо, щоб кожен візит давав корисний контекст: що змінилося, чому це важливо й де дізнатися більше.")}</p><p class="spaced">${t("The editorial process uses AI assistance and human judgment. Sources stay visible; responsibility stays with the editor.", "Редакційний процес поєднує AI-допомогу й людське судження. Джерела залишаються видимими, відповідальність — за редактором.")}</p>${link("policy", t("Read the editorial policy ↗", "Прочитати редакційну політику ↗"), "button ghost spaced")}</div></div><section class="section">${sectionHead(t("How a story becomes a brief.", "Як матеріал стає брифом."))}<div class="grid3">${[t("Find the source.", "Знайти джерело."), t("Make sense of it.", "Зрозуміти зміст."), t("Make the editorial call.", "Ухвалити редакційне рішення.")].map((h, i) => `<div class="card">${eyebrow("0" + (i + 1))}<h3>${h}</h3><p>${[t("Start with primary reporting and documentation.", "Почати з першоджерел і документації."), t("Separate the change, the evidence and the uncertainty.", "Розділити зміни, докази й невизначеність."), t("Review the result before publication.", "Перевірити результат до публікації.")][i]}</p></div>`).join("")}</div></section><section class="section"><div class="grid2"><h2>${t("Meet the editor.", "Знайомтеся з редактором.")}</h2><div><div class="byline"><span class="avatar">OK</span><h3>${t("Oleksandr Kuzmenko", "Олександр Кузьменко")}</h3></div><p class="spaced">${t("Focus: AI agents & MCP, developer tools, MLOps and LLM APIs.", "Фокус: AI-агенти й MCP, інструменти розробника, MLOps і LLM API.")}</p><a class="button ghost spaced" href="https://aitodaybrief.com/en/about" target="_blank" rel="noopener">${t("Current editor profile & contacts ↗", "Поточний профіль і контакти редактора ↗")}</a></div></div></section>${newsletter()}`;
}
function subscribe() {
  return `<div class="center-page">${eyebrow(t("THE DAILY READING RITUAL", "ЩОДЕННИЙ РИТУАЛ ЧИТАННЯ"))}<h1>${t("A little perspective.<br><em>In your inbox.</em>", "Трохи перспективи.<br><em>У вашій пошті.</em>")}</h1><p>${t("A focused AI briefing for people who build. Read a sample, then decide if it belongs in your day.", "Сфокусований AI-бриф для тих, хто створює. Прочитайте приклад і вирішіть, чи пасує він до вашого дня.")}</p>${link("daily", t("Read a sample first ↗", "Спершу прочитати приклад ↗"))}<form data-subscribe class="spaced"><label for="subscribe-email" class="form-label">Email</label><input class="wide-input" id="subscribe-email" type="email" autocomplete="email" required placeholder="you@example.com"><label class="form-label" for="edition-language">${t("Edition language", "Мова випуску")}</label><select class="wide-input" id="edition-language"><option>English</option><option>Українська</option></select><label class="form-label"><input type="checkbox" required style="min-height:0"> ${t("I want to receive the brief by email.", "Хочу отримувати бриф на email.")}</label><button class="button spaced">${t("Get the brief", "Отримувати бриф")} ↗</button><p class="form-status" aria-live="polite"></p><p class="form-note">${t("Free. Unsubscribe at any time. Demo: no email is sent.", "Безкоштовно. Відписка будь-коли. Демо: email не надсилається.")} ${link("policy", t("Privacy", "Приватність"))}</p></form></div>`;
}
function searchPage() {
  return `${intro(t("SEARCH THE PUBLICATION", "ПОШУК У ВИДАННІ"), t("Find the <em>thread.</em>", "Знайдіть <em>зв’язок.</em>"), t("Search this prototype’s sample stories and reference entries.", "Пошук демонстраційних матеріалів і довідкових записів прототипу."))}<label class="sr-only" for="page-search">${t("Search", "Пошук")}</label><input class="wide-input" id="page-search" type="search" placeholder="Agents, MCP, caching…"><div id="page-results" class="section" aria-live="polite">${searchResults("")}</div>`;
}
function searchResults(q) {
  const items = [
    ...stories(),
    ...terms().map(([title, cat, summary]) => ({
      title,
      cat,
      summary,
      route: "concept",
      label: t("Reference", "Довідник"),
    })),
  ];
  const matches = items.filter((s) =>
    (s.title + " " + s.summary + " " + s.label).toLowerCase().includes(q.toLowerCase()),
  );
  return matches.length
    ? `<p class="meta">${matches.length} ${t("RESULTS IN DEMO", "РЕЗУЛЬТАТІВ У ДЕМО")}</p>${matches.map((s) => link(s.route, `${eyebrow(s.label)}<h3>${esc(s.title)}</h3>`, "search-result")).join("")}`
    : `<div class="empty"><h2>${t("No thread found.", "Зв’язку не знайдено.")}</h2><p>${t("Try “MCP”, “context” or a shorter phrase.", "Спробуйте «MCP», «контекст» або коротшу фразу.")}</p>${btn("concepts", t("Browse concepts", "Переглянути концепти"), true)}</div>`;
}
function savedPage() {
  return `${intro(t("YOUR READING LIST", "ВАШЕ ЗБЕРЕЖЕНЕ"), t("For a <em>quieter moment.</em>", "Для <em>спокійнішої миті.</em>"), t("Saved stories in this preview session. No account needed.", "Збережені матеріали в цій сесії перегляду. Без облікового запису."))}${saved ? feedRows([stories()[0]]) : `<div class="empty"><h2>${t("Your reading list starts here.", "Ваш список починається тут.")}</h2><p>${t("Open a story and choose Save to keep it in this preview.", "Відкрийте матеріал і натисніть «Зберегти», щоб залишити його в цьому перегляді.")}</p>${btn("news", t("Find a story", "Знайти матеріал"))}</div>`}`;
}
function advertise() {
  return `${intro(t("PARTNER WITH THE PUBLICATION", "СПІВПРАЦЯ З ВИДАННЯМ"), t("Reach people<br><em>who build.</em>", "Будьте поруч із тими,<br><em>хто створює.</em>"), t("Considered sponsorship, with a clear line between editorial and advertising.", "Продумане спонсорство з чітким розмежуванням редакційного й рекламного."))}<div class="grid2 section"><div class="spec-card">${eyebrow(t("SPONSORED / PREVIEW", "СПОНСОРСЬКИЙ БЛОК / ПРИКЛАД"))}<h3>${t("One relevant message.<br>In the right context.", "Одне доречне повідомлення.<br>У потрібному контексті.")}</h3><p>${t("Reserved example of an explicitly labeled placement. No invented audience figures, prices or testimonials.", "Приклад явно позначеного розміщення. Без вигаданих показників аудиторії, цін чи відгуків.")}</p></div><div><h2>${t("Start a conversation.", "Почніть розмову.")}</h2><p class="spaced">${t("The production page can present verified audience data, placement options and the existing inquiry channel.", "Реальна сторінка може показувати перевірені дані аудиторії, варіанти розміщення й наявний канал запитів.")}</p><a class="button outline spaced" href="https://aitodaybrief.com/en/advertise" target="_blank" rel="noopener">${t("Current sponsorship page ↗", "Поточна сторінка співпраці ↗")}</a></div></div>`;
}
function policy() {
  return `${intro(t("TRUST & TRANSPARENCY", "ДОВІРА Й ПРОЗОРІСТЬ"), t("The principles<br><em>behind the brief.</em>", "Принципи,<br><em>що стоять за брифом.</em>"), t("A shared layout for editorial policy, AI disclosure, privacy and terms.", "Спільний шаблон редакційної політики, AI disclosure, приватності й умов."))}<div class="legal-nav">${["editorial-policy", "ai-disclosure", "privacy", "terms"].map((s) => `<a href="https://aitodaybrief.com/${lang}/${s}" target="_blank" rel="noopener">${s} ↗</a>`).join("")}</div><div class="article-layout"><nav class="toc">${eyebrow(t("CONTENTS", "ЗМІСТ"))}<a href="#principles" data-anchor="principles">${t("Editorial principles", "Редакційні принципи")}</a><a href="#corrections" data-anchor="corrections">${t("Corrections", "Виправлення")}</a></nav><article class="reading"><div class="callout">${eyebrow(t("DESIGN NOTE", "ПРИМІТКА МАКЕТА"))}<p>${t("This page demonstrates document layout. Existing legal and policy text must be transferred verbatim during implementation and reviewed separately if changed.", "Ця сторінка демонструє верстку документа. Наявні юридичні тексти й політики переносяться дослівно; зміни проходять окрему перевірку.")}</p></div><h2 id="principles">${t("Visible sources. Clear responsibility.", "Видимі джерела. Чітка відповідальність.")}</h2><p>${t("Give readers a direct route from a claim to its evidence, and from a question to the responsible editor.", "Дайте читачам прямий шлях від твердження до доказу та від питання до відповідального редактора.")}</p><h2 id="corrections">${t("Leave a visible correction trail.", "Зберігайте видиму історію виправлень.")}</h2><p>${t("An updated date and a concise correction note belong next to the content they affect.", "Дата оновлення й коротка примітка про виправлення мають бути поруч із відповідним матеріалом.")}</p></article></div>`;
}
function notFound() {
  return `<div class="center-page">${eyebrow("404 / OFF THE RECORD")}<h1>${t("This track<br><em>is missing.</em>", "Цей трек<br><em>загубився.</em>")}</h1><p>${t("The page may have moved. Let’s get you back to the publication.", "Сторінка могла змінити адресу. Повернімося до видання.")}</p>${btn("home", t("Back to today", "До головної"))} ${btn("search", t("Search", "Пошук"), true)}</div>`;
}
function system() {
  const brandColors = [
    ["Ink", "#171918", "14.6:1 (AAA)"],
    ["Walnut", "#202421", "Surface"],
    ["Parchment", "#f0e9dc", "14.6:1 (AAA)"],
    ["Brass", "#d4b483", "8.9:1 (AAA)"],
    ["Celadon", "#b5d8cc", "12.5:1 (AAA)"],
    ["Muted", "#b9b7ac", "4.8:1 (AA)"],
  ];
  return `${intro("AI TODAY BRIEF / DESIGN DIRECTION 01", "After <em>Hours.</em>", t("The warmth of a jazz club. The precision of tomorrow’s publication.", "Тепло джазового клубу. Точність видання про майбутнє."))}<img class="brand-art" src="assets/after-hours.png" alt="After Hours concept artwork" width="1672" height="941">
  
  <section class="section">
    ${sectionHead(t("The whole publication.", "Усе видання."))}
    <p>${t("26 linked screens. Select a page, switch EN / UK or change the reading theme in the header.", "26 пов’язаних екранів. Оберіть сторінку, перемкніть EN / UK або тему читання в шапці.")}</p>
    <div class="screen-map">${routes.map((r, i) => link(r, `<span><small>${String(i + 1).padStart(2, "0")} / </small>${labels()[r]}</span>↗`)).join("")}</div>
  </section>

  <section class="section">
    ${sectionHead(t("Editorial Palette & WCAG Accessibility", "Редакційна палітра та доступність WCAG"))}
    <div class="brand-grid">
      ${brandColors.map(([name, hex, contrast], i) => `
        <div class="swatch" style="background:${hex};color:${i < 2 ? "#f0e9dc" : "#171918"}">
          <strong>${name}</strong>
          <span>${hex}</span>
          <span class="wcag-badge ${contrast.includes("AA)") && !contrast.includes("AAA") ? "pass-aa" : ""}" style="margin-top:6px">${contrast}</span>
        </div>
      `).join("")}
    </div>
    <p class="spaced">${t("Brass guides primary action. Celadon marks signal focus. All text tokens exceed WCAG 2.2 Level AAA standards (14.6:1 text on dark surface, 8.9:1 brass highlights).", "Латунь спрямовує головні дії. Celadon позначає фокус сигналу. Усі текстові токени перевищують стандарти WCAG 2.2 Level AAA (14.6:1 текст на темній поверхні, 8.9:1 акценти).")}</p>
  </section>

  <section class="section">
    ${sectionHead(t("Category Color Architecture", "Колірна архітектура категорій"))}
    <p>${t("Each topic carries an assigned semantic indicator and token dot, preserving readability across night and day modes.", "Кожна тема має закріплений семантичний індикатор і токен-маркер, що зберігає читабельність у нічному та денному режимах.")}</p>
    <div class="category-swatches-grid">
      ${NEWS_CATEGORIES.map(cat => `
        <div class="cat-swatch-card">
          <span class="cat-swatch-chip" style="background:${cat.color}"></span>
          <div class="cat-swatch-info">
            <span class="cat-swatch-name">${cat.icon} ${t(cat.name, cat.ukName)}</span>
            <span class="cat-swatch-hex">${cat.color} · ${CATEGORY_META[cat.id].count} ${t("stories", "новин")}</span>
          </div>
        </div>
      `).join("")}
    </div>
  </section>

  <section class="section">
    ${sectionHead(t("Form Controls & Component Architecture", "Форми та архітектура компонентів"))}
    <div class="showroom-controls-grid">
      <div class="showroom-control-card">
        <h4>${t("Sort Dropdown / Select", "Випадаючий список сортування")}</h4>
        <p class="meta spaced">${t("Signature After Hours brass arrow with 44px min-height", "Латунна стрілка After Hours з мінімальною висотою 44px")}</p>
        <div class="news-sort-wrapper" style="margin-top:12px">
          <select class="news-sort-select" style="width:100%">
            <option>${t("Newest first", "Спочатку найновіші")}</option>
            <option>${t("Oldest first", "Спочатку найдавніші")}</option>
            <option>${t("Most discussed", "Найбільш обговорювані")}</option>
            <option>${t("Relevance", "За релевантністю")}</option>
          </select>
        </div>
      </div>

      <div class="showroom-control-card">
        <h4>${t("Search Input Box", "Поле вводу пошуку")}</h4>
        <p class="meta spaced">${t("Embedded search glyph and clean reset trigger", "Вбудований гліф пошуку та швидке очищення")}</p>
        <div class="news-search-box" style="margin-top:12px; max-width:100%">
          <span class="news-search-icon">⌕</span>
          <input class="news-search-input" type="text" placeholder="${t("Search queries...", "Пошуковий запит...")}" value="Prompt caching">
          <button class="news-search-clear" aria-label="Clear">✕</button>
        </div>
      </div>

      <div class="showroom-control-card">
        <h4>${t("Checkboxes & Radios", "Чекбокси та радіокнопки")}</h4>
        <div class="category-checkbox-group" style="margin-top:10px">
          <label class="category-checkbox-label">
            <input type="checkbox" checked>
            <span class="category-icon-dot" style="background:var(--cat-agents)"></span>
            <span class="category-name">Agents & MCP</span>
            <span class="category-count">33</span>
          </label>
          <label class="sort-radio-label" style="margin-top:8px">
            <input type="radio" checked name="showroom-radio">
            <span>${t("Newest selection", "Вибір найновіших")}</span>
          </label>
        </div>
      </div>

      <div class="showroom-control-card">
        <h4>${t("Filter Chips & 44px Touch Floor", "Фільтр-чіпи та правило 44px")}</h4>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin: 12px 0">
          <span class="filter-pill">
            <span class="filter-pill-dot" style="background:var(--cat-tools)"></span>
            Tools & releases
            <button class="filter-pill-remove">✕</button>
          </span>
          <span class="filter-pill">
            Period: Week
            <button class="filter-pill-remove">✕</button>
          </span>
        </div>
        <div style="margin-top:14px">
          <div class="touch-target-visualizer">
            <span class="touch-target-label">MIN 44×44 PX TOUCH FLOOR</span>
            <button class="button" style="margin:0">${t("Accessible Button", "Доступна кнопка")}</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="grid2">
      <div>
        ${eyebrow("TYPE / EDITORIAL")}
        <h2 class="manifesto">${t("Tomorrow,<br><em>in context.</em>", "Майбутнє.<br><em>З контекстом.</em>")}</h2>
        <p>Fraunces / 400 · Georgia ${t("for Ukrainian display", "для українських заголовків")}</p>
      </div>
      <div>
        ${eyebrow("TYPE / FUNCTIONAL")}
        <p style="font-size:26px;color:var(--text);margin:22px 0">${t("Clarity is a form of care.", "Ясність — це форма турботи.")}</p>
        <p>Inter / 400, 500, 600 · Latin + Cyrillic</p>
        <p class="meta spaced">CONSOLAS / TIME, SOURCE, EDITION</p>
        <div class="spaced">
          ${btn("news", t("Primary action", "Головна дія"))} 
          ${btn("news", t("Secondary", "Другорядна"), true)}
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    ${sectionHead(t("A mark with rhythm.", "Знак із ритмом."))}
    <div class="grid2">
      <div class="spec-card">
        <img src="assets/mark.svg" width="130" height="130" alt="After Hours ATB monogram">
        <h3 class="spaced">AI Today Brief</h3>
        <p>${t("Nested A strokes evoke a groove; a celadon point places a signal just off the beat. The publication name stays unchanged.", "Вкладені лінії A нагадують доріжку; celadon-крапка зміщує сигнал із такту. Назва видання залишається незмінною.")}</p>
      </div>
      <div class="spec-card">
        <h3>${t("An editorial tempo.", "Редакційний темп.")}</h3>
        <p>${t("140 ms for a response. 240 ms for a transition. 440 ms for a quiet entrance. No looping hero animation, autoplay audio or scroll hijacking.", "140 мс для відгуку. 240 мс для переходу. 440 мс для спокійної появи. Без циклічної анімації hero, автоматичного звуку чи перехоплення скролу.")}</p>
        <p>${t("Hover a button or story artwork. Navigate to watch the page enter. Reduced-motion disables the movement.", "Наведіть на кнопку чи ілюстрацію. Перейдіть між сторінками, щоб побачити появу. Reduced-motion вимикає рух.")}</p>
      </div>
    </div>
  </section>
  ${newsletter()}`;
}

function states() {
  return `
    ${intro("COMPONENT LIBRARY / STATES", t("Care is in<br><em>the details.</em>", "Турбота —<br><em>у деталях.</em>"), t("Explicit loading, empty, error and successful states for robust UX.", "Явні стани завантаження, порожніх даних, помилки й успіху для стабільного UX."))}

    <div class="grid2 section">
      <section class="spec-card" aria-busy="true">
        ${eyebrow(t("LOADING STATE / SHIMMER SKELETON", "СТАН ЗАВАНТАЖЕННЯ / SKELETON"))}
        <h3 class="mt" style="font-size:20px;margin-bottom:14px">${t("Story Card Skeleton", "Скелетон картки новини")}</h3>
        <div class="skeleton-story-card">
          <div class="skeleton-thumb"></div>
          <div>
            <div class="skeleton-line w-40"></div>
            <div class="skeleton-line h-24 w-80"></div>
            <div class="skeleton-line w-60"></div>
            <div class="skeleton-line w-80"></div>
          </div>
        </div>
        <p class="spaced">${t("Reserved dimensions prevent layout shift (CLS: 0.00). Gentle shimmer indicates active background processing.", "Фіксовані габарити унеможливлюють стрибки верстки (CLS: 0.00). Плавний шимер сигналізує про фонове завантаження.")}</p>
      </section>

      <section class="spec-card">
        ${eyebrow(t("EMPTY SEARCH STATE", "СТАН ПОРОЖНЬОГО ПОШУКУ"))}
        <div class="news-empty-state" style="margin:16px 0; padding:24px 16px">
          <div class="news-empty-icon" style="font-size:32px; margin-bottom:8px">🧭</div>
          <h4 style="font-size:18px; margin-bottom:6px">${t("No stories match your filters", "Жодної новини за фільтрами")}</h4>
          <p style="font-size:13px; max-width:320px; margin:0 auto 14px">${t("Try loosening your search query or reset filters.", "Спробуйте змінити пошуковий запит або скинути фільтри.")}</p>
          <button class="button" data-reset-all style="min-height:36px; padding:0 18px">${t("Reset all filters", "Скинути всі фільтри")}</button>
        </div>
        <p>${t("Explains why the view is blank and provides a direct one-click path forward.", "Пояснює причину відсутності контенту та надає зрозумілу дію в один клік.")}</p>
      </section>

      <section class="spec-card">
        ${eyebrow(t("RECOVERABLE ERROR", "ПОМИЛКА З ВІДНОВЛЕННЯМ"))}
        <h3 class="mt">${t("The feed could not be refreshed.", "Не вдалося оновити стрічку.")}</h3>
        <p>${t("Keep the last readable content in memory and offer a non-destructive retry action.", "Збережіть останній прочитаний контент у пам'яті й запропонуйте безпечну спробу повторення.")}</p>
        <button class="button outline" data-retry>${t("Try again", "Спробувати ще")}</button>
        <p data-retry-status role="status" style="margin-top:10px; color:var(--mint); font: 12px var(--mono)"></p>
      </section>

      <section class="spec-card">
        ${eyebrow(t("FORM VALIDATION & FEEDBACK", "ВАЛІДАЦІЯ ТА ВІДГУК ФОРМИ"))}
        <form data-subscribe>
          <label class="form-label" for="state-email">Email</label>
          <input class="wide-input" id="state-email" type="email" required placeholder="you@example.com">
          <button class="button spaced">${t("Preview confirmation", "Переглянути підтвердження")}</button>
          <p class="form-status" aria-live="polite"></p>
        </form>
        <p class="spaced">${t("Real-time HTML5 form validation paired with an aria-live region for accessibility announcement.", "Валідація форми в реальному часі з областю aria-live для зчитувачів екрана.")}</p>
      </section>
    </div>

    <div class="filters">
      <button class="button" disabled>${t("Disabled action", "Недоступна дія")}</button>
      ${btn("404", t("Preview 404", "Переглянути 404"), true)}
      ${btn("news", t("Browse newsroom", "Переглянути стрічку новин"), true)}
    </div>
  `;
}
const renderers = {
  home,
  news: () => news(),
  article,
  digests,
  daily,
  weekly,
  concepts,
  concept,
  guides,
  guide,
  tools: toolsPage,
  tool,
  categories,
  category: () => news(true),
  about,
  subscribe,
  search: searchPage,
  saved: savedPage,
  advertise,
  policy,
  404: notFound,
  system,
  states,
};
function currentRoute() {
  const r = location.hash.replace(/^#\//, "").split("?")[0];
  return routes.includes(r) ? r : r ? "404" : "home";
}
function render(reset = true) {
  const route = currentRoute();
  document.documentElement.lang = lang;
  document.documentElement.dataset.theme = theme;
  const routeTitle =
    route === "article"
      ? articleVariantCards().find((card) => card.id === currentArticleVariant())?.title
      : labels()[route];
  document.title = `${routeTitle || labels()[route]} — AI Today Brief / After Hours`;
  document.getElementById("app").innerHTML =
    `${header(route)}<main id="main" tabindex="-1" class="wrap page">${renderers[route]()}</main>${footer()}<div class="progress" aria-hidden="true"></div>`;
  if (reset) window.scrollTo(0, 0);
  bind();
}
function notify(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => (toast.style.display = "none"), 2600);
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify(t("Copied to clipboard", "Скопійовано"));
  } catch {
    notify(
      t(
        "Clipboard unavailable. Select and copy the visible text.",
        "Буфер недоступний. Виділіть і скопіюйте видимий текст.",
      ),
    );
  }
}
function openSearch() {
  const d = document.getElementById("search-dialog");
  d.querySelector("#search-title").textContent = t("Search the publication", "Пошук у виданні");
  d.querySelector(".close").setAttribute("aria-label", t("Close search", "Закрити пошук"));
  document.getElementById("global-search").value = "";
  document.getElementById("search-results").innerHTML = searchResults("");
  d.showModal();
  document.getElementById("global-search").focus();
}
function bind() {
  document.querySelector("[data-search]").onclick = openSearch;
  document.querySelector("[data-lang]").onclick = () => {
    lang = lang === "en" ? "uk" : "en";
    render(false);
  };
  document.querySelector("button[data-theme]").onclick = () => {
    theme = theme === "night" ? "day" : "night";
    document.documentElement.dataset.theme = theme;
    document.querySelector("button[data-theme]").textContent = theme === "night" ? "☼" : "◐";
  };
  document.querySelector("[data-menu]").onclick = (e) => {
    const nav = document.querySelector(".nav");
    const open = nav.classList.toggle("open");
    e.currentTarget.setAttribute("aria-expanded", String(open));
  };
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        activeFilter = b.dataset.filter;
        render(false);
        document.querySelector(`[data-filter="${activeFilter}"]`).focus();
      }),
  );
  document.querySelectorAll("[data-anchor]").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        document
          .getElementById(a.dataset.anchor)
          ?.scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
          });
      }),
  );
  document.querySelectorAll("[data-save]").forEach(
    (b) =>
      (b.onclick = () => {
        saved = !saved;
        b.textContent = saved ? t("Saved ✓", "Збережено ✓") : t("Save story +", "Зберегти +");
        b.setAttribute("aria-pressed", String(saved));
        notify(
          saved
            ? t("Added to this preview’s reading list", "Додано до збереженого в цьому перегляді")
            : t("Removed from reading list", "Видалено зі збереженого"),
        );
      }),
  );
  document
    .querySelectorAll("[data-copy-link]")
    .forEach((b) => (b.onclick = () => copy(location.href)));
  document.querySelectorAll("[data-subscribe]").forEach(
    (f) =>
      (f.onsubmit = (e) => {
        e.preventDefault();
        const status = f.querySelector(".form-status");
        status.textContent = t(
          "Demo: confirmation state. In production, check your inbox to confirm your subscription. No email has been sent.",
          "Демо: стан підтвердження. У реалізації перевірте пошту й підтвердьте підписку. Лист не надсилався.",
        );
      }),
  );
  const ps = document.getElementById("page-search");
  if (ps)
    ps.oninput = () =>
      (document.getElementById("page-results").innerHTML = searchResults(ps.value));
  const form = document.getElementById("tool-form");
  if (form)
    form.onsubmit = (e) => {
      e.preventDefault();
      const value = document.getElementById("prompt-input").value.trim();
      if (!value) return;
      const format = document.getElementById("output-format").selectedOptions[0].textContent;
      document.getElementById("tool-output").textContent =
        t("GOAL\n", "МЕТА\n") +
        value +
        t(
          "\n\nCONTEXT\n[Add relevant files and constraints]\n\nOUTPUT\n",
          "\n\nКОНТЕКСТ\n[Додайте доречні файли й обмеження]\n\nРЕЗУЛЬТАТ\n",
        ) +
        format +
        t(
          "\n\nVERIFY\nState uncertainties and check the result against the goal.",
          "\n\nПЕРЕВІРКА\nПозначте невизначеність і звірте результат із метою.",
        );
      document.getElementById("copy-output").disabled = false;
    };
  const co = document.getElementById("copy-output");
  if (co) co.onclick = () => copy(document.getElementById("tool-output").textContent);
  const retry = document.querySelector("[data-retry]");
  if (retry)
    retry.onclick = () => {
      document.querySelector("[data-retry-status]").textContent = t(
        "Demo: the feed is available again.",
        "Демо: стрічка знову доступна.",
      );
      retry.disabled = true;
    };

  // News discovery: sort radio change
  document.querySelectorAll('input[name="news-sort"]').forEach((r) => {
    r.onchange = () => {
      newsState.sort = r.value;
      newsState.page = 1;
      render(false);
    };
  });

  // News discovery: sort dropdown change
  document.querySelectorAll(".news-sort-select").forEach((s) => {
    s.onchange = () => {
      newsState.sort = s.value;
      newsState.page = 1;
      render(false);
    };
  });

  // News discovery: category toggle
  document.querySelectorAll("[data-category-toggle]").forEach((cb) => {
    cb.onchange = () => {
      if (cb.checked) {
        newsState.selectedCategories.add(cb.value);
      } else {
        newsState.selectedCategories.delete(cb.value);
      }
      newsState.page = 1;
      render(false);
    };
  });

  // News discovery: period button
  document.querySelectorAll("[data-period]").forEach((btn) => {
    btn.onclick = () => {
      newsState.period = btn.dataset.period;
      newsState.page = 1;
      render(false);
    };
  });

  // News discovery: hot topic tags
  document.querySelectorAll("[data-topic-click]").forEach((btn) => {
    btn.onclick = () => {
      const tag = btn.dataset.topicClick;
      newsState.selectedTopic = newsState.selectedTopic === tag ? "" : tag;
      newsState.page = 1;
      render(false);
    };
  });

  // News discovery: reset all filters
  document.querySelectorAll("[data-reset-all]").forEach((btn) => {
    btn.onclick = () => {
      newsState.selectedCategories.clear();
      newsState.period = "all";
      newsState.sort = "newest";
      newsState.searchQuery = "";
      newsState.selectedTopic = "";
      newsState.page = 1;
      render(false);
    };
  });

  // News discovery: search input
  const nsi = document.getElementById("news-search-input");
  if (nsi) {
    nsi.oninput = () => {
      newsState.searchQuery = nsi.value;
      newsState.page = 1;
      render(false);
      const newNsi = document.getElementById("news-search-input");
      if (newNsi) {
        newNsi.focus();
        newNsi.setSelectionRange(newNsi.value.length, newNsi.value.length);
      }
    };
  }

  // News discovery: search clear button
  const nsc = document.querySelector(".news-search-clear");
  if (nsc) {
    nsc.onclick = () => {
      newsState.searchQuery = "";
      newsState.page = 1;
      render(false);
    };
  }

  // News discovery: active chip removal
  document.querySelectorAll("[data-remove-cat]").forEach((btn) => {
    btn.onclick = () => {
      newsState.selectedCategories.delete(btn.dataset.removeCat);
      newsState.page = 1;
      render(false);
    };
  });
  const rmp = document.querySelector("[data-remove-period]");
  if (rmp) {
    rmp.onclick = () => {
      newsState.period = "all";
      newsState.page = 1;
      render(false);
    };
  }
  const rmt = document.querySelector("[data-remove-topic]");
  if (rmt) {
    rmt.onclick = () => {
      newsState.selectedTopic = "";
      newsState.page = 1;
      render(false);
    };
  }
  const rms = document.querySelector("[data-clear-search]");
  if (rms) {
    rms.onclick = () => {
      newsState.searchQuery = "";
      newsState.page = 1;
      render(false);
    };
  }

  // News discovery: expandable analysis accordion
  document.querySelectorAll("[data-toggle-expand]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.toggleExpand;
      if (newsState.expandedIds.has(id)) {
        newsState.expandedIds.delete(id);
      } else {
        newsState.expandedIds.add(id);
      }
      render(false);
    };
  });

  // News discovery: save story
  document.querySelectorAll("[data-save-story]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.saveStory;
      if (savedStories.has(id)) {
        savedStories.delete(id);
        notify(t("Story removed from reading list", "Новину видалено зі списку"));
      } else {
        savedStories.add(id);
        notify(t("Story saved to reading list", "Новину збережено до списку"));
      }
      render(false);
    };
  });

  // News discovery: share story
  document.querySelectorAll("[data-share-story]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.shareStory;
      copy(window.location.origin + window.location.pathname + "#/article?id=" + id);
    };
  });

  // News discovery: pagination
  document.querySelectorAll(".after-hours-pagination [data-page]").forEach((btn) => {
    btn.onclick = () => {
      const p = parseInt(btn.dataset.page, 10);
      if (!isNaN(p) && p >= 1) {
        newsState.page = p;
        render(false);
        const toolbar = document.querySelector(".news-toolbar");
        if (toolbar) toolbar.scrollIntoView({ behavior: "smooth" });
      }
    };
  });

  // News discovery: mobile filter drawer
  const mTrigger = document.querySelector("[data-open-drawer]");
  if (mTrigger) {
    mTrigger.onclick = () => {
      newsState.drawerOpen = true;
      render(false);
    };
  }
  document.querySelectorAll("[data-close-drawer]").forEach((btn) => {
    btn.onclick = () => {
      newsState.drawerOpen = false;
      render(false);
    };
  });
  const mBackdrop = document.querySelector(".mobile-drawer-backdrop");
  if (mBackdrop) {
    mBackdrop.onclick = (e) => {
      if (e.target === mBackdrop) {
        newsState.drawerOpen = false;
        render(false);
      }
    };
  }
}
document
  .getElementById("global-search")
  .addEventListener(
    "input",
    (e) => (document.getElementById("search-results").innerHTML = searchResults(e.target.value)),
  );
document.getElementById("search-results").addEventListener("click", (e) => {
  if (e.target.closest("a")) document.getElementById("search-dialog").close();
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    openSearch();
  }
});
document.querySelector(".skip").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("main").focus();
  document.getElementById("main").scrollIntoView();
});
window.addEventListener("hashchange", () => {
  activeFilter = "all";
  document.getElementById("search-dialog").close();
  render();
  document.getElementById("main").focus({ preventScroll: true });
});
window.addEventListener(
  "scroll",
  () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const bar = document.querySelector(".progress");
    if (bar) bar.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
  },
  { passive: true },
);
render();
