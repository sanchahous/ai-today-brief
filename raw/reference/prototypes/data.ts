/**
 * Mock content for the ai-news-scrapper UI/UX prototype.
 *
 * This file is the "Senior content writer" deliverable: every string is
 * publish-ready in both Ukrainian (primary) and English, so the prototype
 * reads like a finished commercial product rather than lorem ipsum.
 *
 * Shapes intentionally mirror the production Supabase types
 * (`src/lib/supabase.ts`) — Category / BriefItem — so wiring the real data
 * layer in later is a 1:1 swap, not a rewrite.
 */

export type Lang = 'uk' | 'en';

export type IconKey =
  | 'tools'
  | 'agents'
  | 'tutorials'
  | 'vibe'
  | 'models'
  | 'optimization'
  | 'creative'
  | 'local'
  | 'career';

export interface ProtoCategory {
  slug: string;
  icon: IconKey;
  color: string;
  name: Record<Lang, string>;
  /** One-line marketing tagline shown under the category title. */
  tagline: Record<Lang, string>;
  /** 2–3 sentence editorial blurb for the category card. */
  blurb: Record<Lang, string>;
  /** Curated topic facets within the category — the "soft subcategory"
   *  layer (maps to concept hubs). Language-neutral product/tech names. */
  subtopics?: string[];
  /** Article count — drives the facet counter in the sidebar. */
  count: number;
}

export interface ProtoPost {
  id: string;
  rank: number;
  categorySlug: string;
  source: string;
  /** ISO date — feeds date grouping, sorting and the "x days ago" label. */
  date: string;
  readMinutes: number;
  /** Provisioned future features — drive the action-bar affordances. */
  hasVideo: boolean;
  comments: number;
  saves: number;
  title: Record<Lang, string>;
  summary: Record<Lang, string>;
  whyMatters: Record<Lang, string>;
  /** Long-form analysis paragraphs — revealed when a card is expanded. */
  deepDive: Record<Lang, string[]>;
  takeaways: Record<Lang, string[]>;
  tools: string[];
}

// ─── Categories ─────────────────────────────────────────────────────────────
// Colours + slugs match supabase/migrations/009_seed_categories.sql exactly.

export const CATEGORIES: ProtoCategory[] = [
  {
    slug: 'tools-and-releases',
    icon: 'tools',
    color: '#47E4D3',
    name: { uk: 'Інструменти й релізи', en: 'Tools & releases' },
    tagline: {
      uk: 'Свіжі фічі та оновлення agentic IDE',
      en: 'Fresh features in agentic IDEs',
    },
    blurb: {
      uk: 'Нові можливості, оновлення версій і приховані фічі Claude Code, Cursor, Codex, Gemini й Copilot. Усе, що змінює ваш робочий процес уже цього тижня.',
      en: 'New capabilities, version bumps and hidden features across Claude Code, Cursor, Codex, Gemini and Copilot. Everything that changes your workflow this week.',
    },
    subtopics: ['Claude Code', 'Cursor', 'Copilot', 'Gemini'],
    count: 248,
  },
  {
    slug: 'agents-and-mcp',
    icon: 'agents',
    color: '#B58CF7',
    name: { uk: 'Агенти й MCP', en: 'Agents & MCP' },
    tagline: {
      uk: 'Оркестрація та підключення агентів',
      en: 'Orchestrating & connecting agents',
    },
    blurb: {
      uk: 'Побудова мульти-агентних систем, MCP-сервери та Claude Agent SDK. Розбираємо архітектури, які працюють у проді, а не лише в демо.',
      en: 'Building multi-agent systems, MCP servers and the Claude Agent SDK. We break down architectures that ship to production, not just demos.',
    },
    subtopics: ['MCP', 'Agent SDK', 'LangChain', 'Multi-agent'],
    count: 176,
  },
  {
    slug: 'tutorials-and-guides',
    icon: 'tutorials',
    color: '#F4C26B',
    name: { uk: 'Гайди й туторіали', en: 'Tutorials & guides' },
    tagline: {
      uk: 'Покрокові плейбуки для AI-воркфлоу',
      en: 'Step-by-step playbooks for AI workflows',
    },
    blurb: {
      uk: 'Hands-on проходження, cheatsheet-и й prompt-рецепти. Бери та застосовуй — кожен гайд перевірений на реальних задачах.',
      en: 'Hands-on walkthroughs, cheatsheets and prompt recipes. Copy, paste, ship — every guide is battle-tested on real tasks.',
    },
    subtopics: ['Prompt recipes', 'Cheatsheets', 'RAG', 'Fine-tuning'],
    count: 203,
  },
  {
    slug: 'vibe-coding',
    icon: 'vibe',
    color: '#5BC9F0',
    name: { uk: 'Vibe coding', en: 'Vibe coding workflow' },
    tagline: {
      uk: 'Skills, hooks і slash-команди',
      en: 'Skills, hooks & slash commands',
    },
    blurb: {
      uk: 'Skills, hooks, sub-агенти та патерни тестування для AI-assisted сесій. Перетворюємо хаотичний vibe coding на повторюваний інженерний процес.',
      en: 'Skills, hooks, sub-agents and testing patterns for AI-assisted sessions. We turn chaotic vibe coding into a repeatable engineering process.',
    },
    subtopics: ['Skills', 'Hooks', 'Sub-agents', 'Slash commands'],
    count: 142,
  },
  {
    slug: 'models-and-research',
    icon: 'models',
    color: '#D49CFF',
    name: { uk: 'Моделі й дослідження', en: 'Models & research' },
    tagline: {
      uk: 'Релізи, бенчмарки та research',
      en: 'Releases, benchmarks & research',
    },
    blurb: {
      uk: 'Релізи моделей, бенчмарки й research-результати — лише з практичними наслідками для щоденної роботи. Без хайпу, з висновками.',
      en: 'Model releases, benchmarks and research findings — only the ones with practical impact on daily building. No hype, just takeaways.',
    },
    subtopics: ['Benchmarks', 'Open models', 'Gemini', 'Long context'],
    count: 189,
  },
  {
    slug: 'optimization',
    icon: 'optimization',
    color: '#9CD66F',
    name: { uk: 'Оптимізація токенів', en: 'Token & cost optimization' },
    tagline: {
      uk: 'Менший LLM-рахунок без втрати якості',
      en: 'A smaller LLM bill, same quality',
    },
    blurb: {
      uk: 'Prompt caching, керування context window, токен-бюджети й batching. Усе, що реально знижує рахунок за API наприкінці місяця.',
      en: 'Prompt caching, context-window engineering, token budgets and batching. Everything that actually drops your API bill at month-end.',
    },
    subtopics: ['Prompt caching', 'Context window', 'Batching', 'Token budgets'],
    count: 97,
  },
  // — remaining taxonomy (kept for the sidebar facet list) —
  {
    slug: 'creative-ai',
    icon: 'creative',
    color: '#FF8FA3',
    name: { uk: 'Креативний AI', en: 'Creative AI' },
    tagline: { uk: 'Генерація зображень, відео та аудіо', en: 'Image, video & audio generation' },
    blurb: {
      uk: 'Інструменти генерації зображень, відео, анімації та аудіо для розробників і indie-творців.',
      en: 'Image, video, animation and audio generation tools for developers and indie creators.',
    },
    count: 84,
  },
  {
    slug: 'local-llms',
    icon: 'local',
    color: '#8A8FFF',
    name: { uk: 'Локальні LLM', en: 'Local LLMs' },
    tagline: {
      uk: 'Self-hosted інференс і privacy-first',
      en: 'Self-hosted, privacy-first inference',
    },
    blurb: {
      uk: 'Self-hosted інференс, GGUF / llama.cpp, Ollama, апаратні збірки та privacy-first AI-стеки.',
      en: 'Self-hosted inference, GGUF / llama.cpp, Ollama, hardware setups and privacy-first AI stacks.',
    },
    count: 61,
  },
  {
    slug: 'career-and-money',
    icon: 'career',
    color: '#FF9B57',
    name: { uk: 'Карʼєра й заробіток', en: 'Career & monetisation' },
    tagline: { uk: 'Freelance, indie-SaaS і сертифікати', en: 'Freelance, indie-SaaS & certs' },
    blurb: {
      uk: 'Freelance-ліди, indie-SaaS, безкоштовні сертифікати та реалістичні шляхи монетизації для AI-native розробників.',
      en: 'Freelance leads, indie-SaaS, free certifications and realistic monetisation paths for AI-native devs.',
    },
    count: 73,
  },
];

/** The six promoted on the home page, in display order. */
export const TOP_CATEGORY_SLUGS = [
  'tools-and-releases',
  'agents-and-mcp',
  'tutorials-and-guides',
  'vibe-coding',
  'models-and-research',
  'optimization',
];

export const categoryBySlug = new Map(CATEGORIES.map((c) => [c.slug, c]));

// ─── Posts ───────────────────────────────────────────────────────────────────

export const POSTS: ProtoPost[] = [
  {
    id: 'p1',
    rank: 1,
    categorySlug: 'tools-and-releases',
    source: 'Anthropic',
    date: '2026-05-28',
    readMinutes: 6,
    hasVideo: true,
    comments: 42,
    saves: 318,
    title: {
      uk: 'Claude Code отримав фонові агенти й нативний перегляд PR прямо в терміналі',
      en: 'Claude Code ships background agents and a native PR review flow in the terminal',
    },
    summary: {
      uk: 'Фонові агенти тепер виконують довгі задачі паралельно, а оновлений перегляд PR показує діфи й коментарі без виходу з CLI. Це закриває розрив між кодуванням і рев’ю.',
      en: 'Background agents now run long tasks in parallel, and the refreshed PR review surfaces diffs and comments without leaving the CLI — closing the gap between coding and review.',
    },
    whyMatters: {
      uk: 'Менше перемикань контексту = більше завершених задач за сесію. Команди можуть тримати рев’ю та автофікси в одному циклі.',
      en: 'Fewer context switches mean more tasks finished per session. Teams can keep review and autofix inside a single loop.',
    },
    deepDive: {
      uk: [
        'Фонові агенти запускаються відокремлено й продовжують працювати між ходами — довгі білди, міграції чи рефактори більше не блокують основну сесію. Ви отримуєте сповіщення, коли задача завершується.',
        'Нативний перегляд PR підтягує діфи, статуси CI та коментарі рев’юерів прямо в термінал. Можна відповідати на коментарі, пушити фікси й перезапускати перевірки, не відкриваючи браузер.',
        'Для команд це означає, що цикл «кодування → рев’ю → фікс» стискається в один інструмент, а метрики (вартість рев’ю, латентність) стають вимірюваними.',
      ],
      en: [
        'Background agents run detached and persist across turns — long builds, migrations or refactors no longer block your main session. You get notified the moment a task finishes.',
        'The native PR review pulls diffs, CI status and reviewer comments straight into the terminal. You can reply to comments, push fixes and re-kick checks without opening a browser.',
        'For teams this collapses the code → review → fix loop into one tool, and makes the metrics (cost per review, latency) measurable.',
      ],
    },
    takeaways: {
      uk: [
        'Запускайте міграції як фонові агенти, щоб не блокувати сесію.',
        'Тримайте рев’ю PR у CLI — менше перемикань на браузер.',
        'Логуйте латентність автофіксів як командну метрику.',
      ],
      en: [
        'Run migrations as background agents so they never block your session.',
        'Keep PR review in the CLI — fewer browser context switches.',
        'Log autofix latency as a team metric.',
      ],
    },
    tools: ['Claude Code', 'GitHub'],
  },
  {
    id: 'p2',
    rank: 2,
    categorySlug: 'agents-and-mcp',
    source: 'Model Context Protocol',
    date: '2026-05-28',
    readMinutes: 8,
    hasVideo: false,
    comments: 27,
    saves: 254,
    title: {
      uk: 'MCP 1.2: стрімінг ресурсів і авторизація на рівні інструментів',
      en: 'MCP 1.2: streaming resources and per-tool authorization',
    },
    summary: {
      uk: 'Нова версія протоколу додає стрімінг великих ресурсів та гранулярні дозволи для кожного інструмента — крок до безпечних агентів у проді.',
      en: 'The new protocol release adds streaming for large resources and granular per-tool permissions — a step toward production-safe agents.',
    },
    whyMatters: {
      uk: 'Гранулярна авторизація знімає головний блокер для впровадження MCP у корпоративних середовищах.',
      en: 'Granular authorization removes the main blocker for adopting MCP in enterprise environments.',
    },
    deepDive: {
      uk: [
        'Стрімінг ресурсів дозволяє агентам читати великі файли й набори даних порціями, не вичерпуючи context window одним запитом.',
        'Авторизація на рівні інструмента означає, що сервер може дозволити читання, але заборонити запис — без переписування логіки клієнта.',
      ],
      en: [
        'Resource streaming lets agents read large files and datasets in chunks without blowing the context window on a single call.',
        'Per-tool authorization means a server can allow reads but deny writes — without rewriting client logic.',
      ],
    },
    takeaways: {
      uk: [
        'Оновіть MCP-сервери до 1.2 для стрімінгу.',
        'Розділіть read/write дозволи на кожен інструмент.',
      ],
      en: ['Upgrade MCP servers to 1.2 for streaming.', 'Split read/write permissions per tool.'],
    },
    tools: ['MCP', 'Claude Agent SDK'],
  },
  {
    id: 'p3',
    rank: 3,
    categorySlug: 'models-and-research',
    source: 'arXiv',
    date: '2026-05-27',
    readMinutes: 10,
    hasVideo: true,
    comments: 61,
    saves: 401,
    title: {
      uk: 'Дослідження: довгий контекст програє структурованому пошуку на реальних задачах',
      en: 'Study: long context loses to structured retrieval on real-world tasks',
    },
    summary: {
      uk: 'Бенчмарк на 12 доменах показав, що цільовий RAG стабільно випереджає «закидання всього в контекст» — і коштує в рази дешевше.',
      en: 'A 12-domain benchmark shows targeted RAG consistently beats “stuff everything in context” — and costs a fraction as much.',
    },
    whyMatters: {
      uk: 'Це прямий аргумент проти дорогих величезних промптів і на користь продуманої архітектури пошуку.',
      en: 'A direct argument against expensive mega-prompts and in favour of thoughtful retrieval architecture.',
    },
    deepDive: {
      uk: [
        'Автори порівняли три підходи: повний контекст, наївний RAG і структурований пошук з ре-ранкінгом. Останній виграв у 10 з 12 доменів.',
        'Цікаво, що перевага зростає з розміром корпусу — саме там, де «довгий контекст» мав би перемагати.',
      ],
      en: [
        'The authors compared three approaches: full context, naive RAG, and structured retrieval with re-ranking. The last won in 10 of 12 domains.',
        'Notably, the advantage grows with corpus size — exactly where “long context” was supposed to win.',
      ],
    },
    takeaways: {
      uk: [
        'Інвестуйте в ре-ранкінг, а не в довжину контексту.',
        'Вимірюйте якість на власному домені, не на загальних бенчах.',
      ],
      en: [
        'Invest in re-ranking, not context length.',
        'Measure quality on your own domain, not generic benchmarks.',
      ],
    },
    tools: ['RAG', 'OpenRouter'],
  },
  {
    id: 'p4',
    rank: 4,
    categorySlug: 'optimization',
    source: 'Latent Space',
    date: '2026-05-27',
    readMinutes: 5,
    hasVideo: false,
    comments: 18,
    saves: 176,
    title: {
      uk: 'Як prompt caching зрізав наш рахунок за API на 71%',
      en: 'How prompt caching cut our API bill by 71%',
    },
    summary: {
      uk: 'Розбір реального кейсу: винесення системного промпту й документів у кеш дало економію без жодної втрати якості відповідей.',
      en: 'A real case study: moving the system prompt and documents into the cache delivered savings with zero quality loss.',
    },
    whyMatters: {
      uk: 'Кешування — найдешевша оптимізація, яку більшість команд досі не вмикають.',
      en: 'Caching is the cheapest optimization most teams still leave switched off.',
    },
    deepDive: {
      uk: [
        'Ключ — стабільний префікс: системний промпт і незмінні документи йдуть першими, динамічна частина — в кінці.',
        'Cache hit rate виріс до 89% після того, як автори перестали міняти порядок повідомлень між запитами.',
      ],
      en: [
        'The key is a stable prefix: the system prompt and unchanging documents go first, the dynamic part goes last.',
        'Cache hit rate climbed to 89% once the authors stopped reordering messages between requests.',
      ],
    },
    takeaways: {
      uk: ['Тримайте стабільний префікс промпту.', 'Логуйте cache hit rate як ключову метрику.'],
      en: ['Keep a stable prompt prefix.', 'Log cache hit rate as a key metric.'],
    },
    tools: ['Prompt caching', 'Anthropic API'],
  },
  {
    id: 'p5',
    rank: 5,
    categorySlug: 'vibe-coding',
    source: 'Claude Docs',
    date: '2026-05-26',
    readMinutes: 7,
    hasVideo: false,
    comments: 33,
    saves: 289,
    title: {
      uk: 'Skills проти MCP: коли який інструмент розширення обирати',
      en: 'Skills vs MCP: which extension mechanism to reach for',
    },
    summary: {
      uk: 'Практичний розбір: Skills — для повторюваних воркфлоу й знань, MCP — для доступу до зовнішніх систем. Межа часто розмита.',
      en: 'A practical breakdown: Skills for repeatable workflows and knowledge, MCP for access to external systems. The line is often blurry.',
    },
    whyMatters: {
      uk: 'Правильний вибір механізму економить тижні підтримки й робить агента передбачуваним.',
      en: 'The right mechanism saves weeks of maintenance and keeps your agent predictable.',
    },
    deepDive: {
      uk: [
        'Skills інкапсулюють «як ми це робимо» — процедури, чеклісти, edge-cases. Вони версіонуються разом з репозиторієм.',
        'MCP відповідає на «де взяти дані / виконати дію» — це міст до бази, API чи файлової системи.',
      ],
      en: [
        'Skills encapsulate “how we do this” — procedures, checklists, edge-cases. They version alongside your repo.',
        'MCP answers “where do I get data / perform an action” — a bridge to a DB, API or filesystem.',
      ],
    },
    takeaways: {
      uk: ['Воркфлоу → Skill. Доступ до системи → MCP.', 'Версіонуйте Skills разом з кодом.'],
      en: ['Workflow → Skill. System access → MCP.', 'Version Skills alongside your code.'],
    },
    tools: ['Skills', 'MCP'],
  },
  {
    id: 'p6',
    rank: 6,
    categorySlug: 'tutorials-and-guides',
    source: 'freeCodeCamp',
    date: '2026-05-26',
    readMinutes: 12,
    hasVideo: true,
    comments: 54,
    saves: 512,
    title: {
      uk: 'Повний гайд: власний агент для рев’ю коду з нуля за вечір',
      en: 'Full guide: build your own code-review agent from scratch in an evening',
    },
    summary: {
      uk: 'Від вебхука до коментаря в PR — покроковий туторіал з готовим кодом, тестами та оцінкою вартості однієї перевірки.',
      en: 'From webhook to PR comment — a step-by-step tutorial with ready code, tests and a cost estimate per review.',
    },
    whyMatters: {
      uk: 'Найкращий спосіб зрозуміти агентів — зібрати власного. Цей гайд прибирає бар’єр входу.',
      en: 'The best way to understand agents is to build one. This guide removes the barrier to entry.',
    },
    deepDive: {
      uk: [
        'Туторіал починається з мінімального вебхук-сервера, додає виклик моделі з структурованим виводом і завершується постингом коментарів через GitHub API.',
        'Окрема секція присвячена тестуванню: як замокати модель і зафіксувати поведінку регресійними тестами.',
      ],
      en: [
        'The tutorial starts with a minimal webhook server, adds a model call with structured output, and finishes by posting comments via the GitHub API.',
        'A dedicated section covers testing: how to mock the model and lock behaviour with regression tests.',
      ],
    },
    takeaways: {
      uk: ['Починайте з мінімального вебхука.', 'Фіксуйте поведінку агента регресійними тестами.'],
      en: ['Start with a minimal webhook.', 'Lock agent behaviour with regression tests.'],
    },
    tools: ['GitHub', 'Claude Agent SDK'],
  },
  {
    id: 'p7',
    rank: 7,
    categorySlug: 'tools-and-releases',
    source: 'Cursor',
    date: '2026-05-25',
    readMinutes: 4,
    hasVideo: false,
    comments: 21,
    saves: 198,
    title: {
      uk: 'Cursor додав мульти-файлові правки з попереднім переглядом діфу',
      en: 'Cursor adds multi-file edits with a diff preview step',
    },
    summary: {
      uk: 'Тепер можна переглянути всі зміни через файли одним діфом перед застосуванням — менше сюрпризів від агента.',
      en: 'You can now review every change across files as one diff before applying — fewer surprises from the agent.',
    },
    whyMatters: {
      uk: 'Перегляд перед застосуванням — це довіра. Без нього автоматичні правки лякають.',
      en: 'Review-before-apply is about trust. Without it, automated edits are scary.',
    },
    deepDive: {
      uk: ['Діф групується за файлами й підсвічує ризиковані зміни (видалення, зміни сигнатур).'],
      en: ['The diff groups by file and highlights risky changes (deletions, signature changes).'],
    },
    takeaways: {
      uk: ['Завжди переглядайте мульти-файловий діф перед apply.'],
      en: ['Always review the multi-file diff before applying.'],
    },
    tools: ['Cursor'],
  },
  {
    id: 'p8',
    rank: 8,
    categorySlug: 'local-llms',
    source: 'Ollama',
    date: '2026-05-25',
    readMinutes: 6,
    hasVideo: false,
    comments: 15,
    saves: 143,
    title: {
      uk: 'Ollama тепер тримає кілька моделей у пам’яті одночасно',
      en: 'Ollama now keeps multiple models warm in memory',
    },
    summary: {
      uk: 'Гаряче перемикання між моделями без перезавантаження — суттєвий приріст для локальних мульти-агентних сетапів.',
      en: 'Hot-swapping between models without a reload — a big win for local multi-agent setups.',
    },
    whyMatters: {
      uk: 'Локальні агенти стають практичними, коли перемикання моделі коштує мілісекунди, а не секунди.',
      en: 'Local agents become practical when switching models costs milliseconds, not seconds.',
    },
    deepDive: {
      uk: ['Менеджер пам’яті вивантажує найрідше використовувані моделі за LRU-політикою.'],
      en: ['The memory manager evicts least-recently-used models with an LRU policy.'],
    },
    takeaways: {
      uk: ['Тримайте маленьку модель-маршрутизатор гарячою поруч з основною.'],
      en: ['Keep a small router model warm alongside your main one.'],
    },
    tools: ['Ollama', 'llama.cpp'],
  },
  {
    id: 'p9',
    rank: 9,
    categorySlug: 'career-and-money',
    source: 'Indie Hackers',
    date: '2026-05-24',
    readMinutes: 9,
    hasVideo: false,
    comments: 47,
    saves: 367,
    title: {
      uk: 'Від side-project до $4k MRR: розбір AI-мікросервісу для нішевого ринку',
      en: 'From side-project to $4k MRR: anatomy of a niche AI micro-SaaS',
    },
    summary: {
      uk: 'Засновник розповідає, як вузька ніша й один чіткий use-case дали стабільний дохід без венчурних грошей.',
      en: 'The founder explains how a narrow niche and one crisp use-case produced steady revenue with no VC money.',
    },
    whyMatters: {
      uk: 'Реалістичний орієнтир для розробників, які хочуть монетизувати AI-навички без хайпу.',
      en: 'A realistic benchmark for devs who want to monetise AI skills without the hype.',
    },
    deepDive: {
      uk: ['Ключ — дистрибуція в нішевих спільнотах, а не загальний маркетинг.'],
      en: ['The key was distribution inside niche communities, not broad marketing.'],
    },
    takeaways: {
      uk: ['Обирайте нішу, де вже платять за рішення вручну.'],
      en: ['Pick a niche where people already pay to solve it manually.'],
    },
    tools: ['Stripe', 'Supabase'],
  },
  {
    id: 'p10',
    rank: 10,
    categorySlug: 'creative-ai',
    source: 'The Verge',
    date: '2026-05-24',
    readMinutes: 5,
    hasVideo: true,
    comments: 38,
    saves: 221,
    title: {
      uk: 'Нова модель відео-генерації тримає консистентність персонажа між сценами',
      en: 'New video model keeps character consistency across scenes',
    },
    summary: {
      uk: 'Головний біль відео-генерації — «плаваючі» обличчя — вирішено через окремий шар ідентичності.',
      en: 'Video generation’s biggest pain — drifting faces — is addressed with a dedicated identity layer.',
    },
    whyMatters: {
      uk: 'Консистентність персонажа відкриває реальні продакшн-кейси для коротких відео.',
      en: 'Character consistency unlocks real production use-cases for short-form video.',
    },
    deepDive: {
      uk: ['Шар ідентичності фіксує ембединг персонажа й застосовує його до кожного кадру.'],
      en: ['The identity layer pins a character embedding and applies it to every frame.'],
    },
    takeaways: {
      uk: ['Тестуйте консистентність на 30-секундних роликах, а не на кадрах.'],
      en: ['Test consistency on 30-second clips, not single frames.'],
    },
    tools: ['Runway'],
  },
  {
    id: 'p11',
    rank: 11,
    categorySlug: 'agents-and-mcp',
    source: 'LangChain',
    date: '2026-05-23',
    readMinutes: 7,
    hasVideo: false,
    comments: 29,
    saves: 184,
    title: {
      uk: 'Патерн «супервайзер-воркери» нарешті отримав нормальний дебагінг',
      en: 'The supervisor-workers pattern finally gets proper debugging',
    },
    summary: {
      uk: 'Нові трейс-інструменти показують повний граф викликів між агентами — кінець «чорній скриньці» мульти-агентів.',
      en: 'New trace tooling shows the full call graph between agents — the end of multi-agent black boxes.',
    },
    whyMatters: {
      uk: 'Без трейсингу мульти-агентні баги невідтворювані. Це робить їх debuggable.',
      en: 'Without tracing, multi-agent bugs are unreproducible. This makes them debuggable.',
    },
    deepDive: {
      uk: ['Кожен крок логується з вхід/вихід, що дозволяє реплеїти конкретний прогін.'],
      en: ['Each step logs input/output, enabling replay of a specific run.'],
    },
    takeaways: {
      uk: ['Вмикайте трейсинг з першого дня мульти-агентного проєкту.'],
      en: ['Turn on tracing from day one of a multi-agent project.'],
    },
    tools: ['LangChain', 'LangSmith'],
  },
  {
    id: 'p12',
    rank: 12,
    categorySlug: 'tutorials-and-guides',
    source: 'Hugging Face',
    date: '2026-05-23',
    readMinutes: 11,
    hasVideo: false,
    comments: 22,
    saves: 256,
    title: {
      uk: 'Файнтюн маленької моделі під ваш домен: коли це справді виправдано',
      en: 'Fine-tuning a small model for your domain: when it actually pays off',
    },
    summary: {
      uk: 'Чесний розбір: де файнтюн б’є промпт-інжиніринг, а де — лише марна трата GPU-годин.',
      en: 'An honest breakdown of where fine-tuning beats prompt engineering — and where it just wastes GPU hours.',
    },
    whyMatters: {
      uk: 'Файнтюн модний, але часто непотрібний. Цей гайд економить бюджет.',
      en: 'Fine-tuning is trendy but often unnecessary. This guide saves budget.',
    },
    deepDive: {
      uk: [
        'Емпіричне правило: спочатку вичерпайте few-shot і RAG, лише потім думайте про файнтюн.',
      ],
      en: ['Rule of thumb: exhaust few-shot and RAG first, only then consider fine-tuning.'],
    },
    takeaways: {
      uk: ['Файнтюньте під стиль/формат, а не під знання.'],
      en: ['Fine-tune for style/format, not for knowledge.'],
    },
    tools: ['Hugging Face', 'LoRA'],
  },
  {
    id: 'p13',
    rank: 13,
    categorySlug: 'vibe-coding',
    source: 'Claude Cookbook',
    date: '2026-05-22',
    readMinutes: 6,
    hasVideo: false,
    comments: 31,
    saves: 207,
    title: {
      uk: 'Sub-агенти на практиці: як розбити велику задачу й не загубити контекст',
      en: 'Sub-agents in practice: splitting a big task without losing context',
    },
    summary: {
      uk: 'Патерн «оркестратор + вузькі sub-агенти» дає чистіший контекст і передбачуваніший результат, ніж один агент на все.',
      en: 'The “orchestrator + narrow sub-agents” pattern yields cleaner context and a more predictable result than one do-it-all agent.',
    },
    whyMatters: {
      uk: 'Правильне розбиття задачі — головний важіль якості в agentic-воркфлоу.',
      en: 'Task decomposition is the biggest quality lever in agentic workflows.',
    },
    deepDive: {
      uk: [
        'Кожен sub-агент отримує лише потрібний зріз контексту, а оркестратор збирає результати.',
      ],
      en: [
        'Each sub-agent gets only the slice of context it needs; the orchestrator merges results.',
      ],
    },
    takeaways: {
      uk: ['Виносьте пошук і рев’ю в окремих sub-агентів.'],
      en: ['Move search and review into separate sub-agents.'],
    },
    tools: ['Claude Code', 'Skills'],
  },
  {
    id: 'p14',
    rank: 14,
    categorySlug: 'models-and-research',
    source: 'DeepMind',
    date: '2026-05-22',
    readMinutes: 9,
    hasVideo: true,
    comments: 44,
    saves: 298,
    title: {
      uk: 'Нова відкрита модель тримає рівень фронтиру на коді при вчетверо меншій ціні',
      en: 'New open model matches frontier coding quality at a quarter of the cost',
    },
    summary: {
      uk: 'Бенчмарки на реальних репозиторіях показують паритет із закритими моделями — при суттєво нижчій ціні за токен.',
      en: 'Benchmarks on real repositories show parity with closed models — at a markedly lower price per token.',
    },
    whyMatters: {
      uk: 'Дешевий фронтир на коді змінює економіку agentic-інструментів для всіх.',
      en: 'A cheap coding frontier changes the economics of agentic tools for everyone.',
    },
    deepDive: {
      uk: ['Ключ — кращі дані для пост-тренування, а не просто більший масштаб.'],
      en: ['The key is better post-training data, not just bigger scale.'],
    },
    takeaways: {
      uk: ['Перетестуйте свій агент на новій моделі перед продовженням контрактів.'],
      en: ['Re-test your agent on the new model before renewing contracts.'],
    },
    tools: ['Gemini', 'OpenRouter'],
  },
  {
    id: 'p15',
    rank: 15,
    categorySlug: 'optimization',
    source: 'Anthropic Engineering',
    date: '2026-05-21',
    readMinutes: 7,
    hasVideo: false,
    comments: 26,
    saves: 231,
    title: {
      uk: 'Context engineering: як упорядкувати промпт, щоб платити менше за токени',
      en: 'Context engineering: structuring a prompt so you pay less per token',
    },
    summary: {
      uk: 'Порядок, дедуплікація та винесення статики в кеш зменшують вартість запиту без втрати якості.',
      en: 'Ordering, de-duplication and pushing static content into the cache cut request cost without losing quality.',
    },
    whyMatters: {
      uk: 'Структура промпту впливає на рахунок не менше, ніж вибір моделі.',
      en: 'Prompt structure affects the bill as much as model choice does.',
    },
    deepDive: {
      uk: ['Статичний контекст — на початок і в кеш; динамічний — у кінець запиту.'],
      en: ['Static context goes first and into the cache; dynamic content goes last.'],
    },
    takeaways: {
      uk: ['Виміряйте токени до й після реструктуризації промпту.'],
      en: ['Measure tokens before and after restructuring the prompt.'],
    },
    tools: ['Prompt caching', 'Anthropic API'],
  },
];

/** Featured + secondary picks for the home "Top of the week" block. */
export const WEEK_FEATURED_ID = 'p1';
export const WEEK_SECONDARY_IDS = ['p3', 'p6', 'p2', 'p4'];

export const postById = new Map(POSTS.map((p) => [p.id, p]));

/** Latest N posts in a category, newest first — powers the category-card preview. */
export function latestByCategory(slug: string, n = 2): ProtoPost[] {
  return POSTS.filter((p) => p.categorySlug === slug)
    .sort((a, b) => b.date.localeCompare(a.date) || a.rank - b.rank)
    .slice(0, n);
}

/** Free-text match across title, summary, source, tools and category name. */
export function matchesQuery(p: ProtoPost, q: string, lang: Lang): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const cat = categoryBySlug.get(p.categorySlug);
  const hay = [p.title[lang], p.summary[lang], p.source, ...p.tools, cat ? cat.name[lang] : '']
    .join(' ')
    .toLowerCase();
  return hay.includes(s);
}

/** Search the archive — newest first. `limit` caps the result count. */
export function searchPosts(q: string, lang: Lang, limit?: number): ProtoPost[] {
  const rows = POSTS.filter((p) => matchesQuery(p, q, lang)).sort(
    (a, b) => b.date.localeCompare(a.date) || a.rank - b.rank,
  );
  return typeof limit === 'number' ? rows.slice(0, limit) : rows;
}

// ─── FEATURE F4 — Trending topics (concept hubs) ──────────────────────────────
// Each topic maps to a /:lang/concepts/:slug hub that already exists in
// production. Surfacing them as a weighted tag cloud builds the hub-and-spoke
// internal-linking structure SEO rewards, and gives readers a discovery path.

export type Momentum = 'up' | 'flat' | 'new';

export interface TrendingTopic {
  slug: string;
  label: string;
  /** Glyph shown on the chip — replaces the generic "#". */
  icon: IconKey;
  /** Mentions across the archive — drives the tag weight/size. */
  mentions: number;
  momentum: Momentum;
}

export const TRENDING_TOPICS: TrendingTopic[] = [
  { slug: 'claude-code', label: 'Claude Code', icon: 'tools', mentions: 64, momentum: 'up' },
  { slug: 'mcp', label: 'MCP', icon: 'agents', mentions: 51, momentum: 'up' },
  { slug: 'cursor', label: 'Cursor', icon: 'tools', mentions: 47, momentum: 'flat' },
  { slug: 'rag', label: 'RAG', icon: 'models', mentions: 38, momentum: 'flat' },
  {
    slug: 'prompt-caching',
    label: 'Prompt caching',
    icon: 'optimization',
    mentions: 29,
    momentum: 'up',
  },
  { slug: 'agent-sdk', label: 'Agent SDK', icon: 'agents', mentions: 26, momentum: 'new' },
  { slug: 'ollama', label: 'Ollama', icon: 'local', mentions: 22, momentum: 'flat' },
  { slug: 'langchain', label: 'LangChain', icon: 'agents', mentions: 19, momentum: 'flat' },
  { slug: 'fine-tuning', label: 'Fine-tuning', icon: 'models', mentions: 17, momentum: 'up' },
  { slug: 'gemini', label: 'Gemini', icon: 'models', mentions: 15, momentum: 'new' },
];

// ─── FEATURE F2 — Native sponsor slot ─────────────────────────────────────────
// Sponsorship is the primary revenue model for AI newsletters (The Rundown
// reported $10M+ in 2025; deep-dive placements sell at 3–6× the primary rate).
// This is a clearly-labelled native unit — a demo placeholder, not a real ad.

export interface Sponsor {
  brand: string;
  color: string;
  tagline: Record<Lang, string>;
  body: Record<Lang, string>;
  cta: Record<Lang, string>;
  url: string;
}

export const SPONSOR: Sponsor = {
  brand: 'Vector DB',
  color: '#5BC9F0',
  tagline: { uk: 'Postgres, готовий до AI', en: 'Postgres, built for AI' },
  body: {
    uk: 'Векторний пошук, гнучке масштабування й безкоштовний tier для пет-проєктів. Розгорніть базу для свого RAG за 60 секунд.',
    en: 'Vector search, elastic scaling and a free tier for side-projects. Spin up a database for your RAG in 60 seconds.',
  },
  cta: { uk: 'Спробувати безкоштовно', en: 'Try it free' },
  url: 'https://example.com',
};

// ─── FEATURE F3 — SEO FAQ (FAQPage schema) ────────────────────────────────────
// Answer-led content that targets long-tail/conversational queries and feeds
// FAQPage JSON-LD for AI/answer engines (AEO/GEO).

export interface Faq {
  q: Record<Lang, string>;
  a: Record<Lang, string>;
}

export const FAQS: Faq[] = [
  {
    q: { uk: 'Що таке AI Brief?', en: 'What is AI Brief?' },
    a: {
      uk: 'AI Brief — щоденний дайджест найважливіших новин зі світу штучного інтелекту для розробників. Ми читаємо сотні джерел, відкидаємо хайп і подаємо кожну новину з аналізом «чому це важливо» та ключовими висновками.',
      en: 'AI Brief is a daily digest of the most important AI news for developers. We read hundreds of sources, drop the hype, and present each story with a “why it matters” analysis and key takeaways.',
    },
  },
  {
    q: { uk: 'Як часто оновлюється контент?', en: 'How often is it updated?' },
    a: {
      uk: 'Новий бриф виходить щодня. Стрічка «Усі новини» та топ категорій оновлюються автоматично, щойно завершується щоденний пайплайн добору й аналізу.',
      en: 'A new brief ships every day. The “All news” feed and top categories update automatically as soon as the daily curation-and-analysis pipeline finishes.',
    },
  },
  {
    q: { uk: 'Це безкоштовно?', en: 'Is it free?' },
    a: {
      uk: 'Так, читання брифу та архіву безкоштовне. Email-дайджест теж безкоштовний — підпишіться, щоб отримувати головне на пошту щоранку.',
      en: 'Yes — reading the brief and the archive is free. The email digest is free too; subscribe to get the highlights in your inbox each morning.',
    },
  },
  {
    q: { uk: 'Звідки ви берете новини?', en: 'Where do you source the news?' },
    a: {
      uk: 'З офіційних блогів лабораторій і вендорів, релізів на GitHub, arXiv, технічних медіа та профільних спільнот. Кожна новина має посилання на першоджерело.',
      en: 'From official lab and vendor blogs, GitHub releases, arXiv, tech media and developer communities. Every story links back to its primary source.',
    },
  },
  {
    q: { uk: 'Чи доступно українською?', en: 'Is it available in Ukrainian?' },
    a: {
      uk: 'Так. Кожна новина й аналіз доступні українською та англійською — перемкнути мову можна у шапці сайту в один клік.',
      en: 'Yes. Every story and analysis is available in Ukrainian and English — switch languages from the header in one click.',
    },
  },
];

// ─── Slugs + permalinks ───────────────────────────────────────────────────────
// Posts get a readable slug from their English title so each story has a stable
// /:lang/news/:slug permalink. Lookups accept either the slug or the raw id.

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function postSlug(p: ProtoPost): string {
  return slugify(p.title.en);
}

export const postBySlug = new Map(POSTS.map((p) => [postSlug(p), p]));

/** Resolve a post by slug or by raw id (toolbar/back-compat). */
export function findPost(key: string): ProtoPost | undefined {
  return postById.get(key) ?? postBySlug.get(key);
}

// ─── Daily briefs ─────────────────────────────────────────────────────────────
// The canonical daily product: a dated, ordered selection of items. Grouped
// from the mock posts by publish date.

export interface ProtoBrief {
  slug: string;
  date: string;
  title: Record<Lang, string>;
  intro: Record<Lang, string>;
  itemIds: string[];
}

export const BRIEFS: ProtoBrief[] = [
  {
    slug: 'daily-2026-05-28',
    date: '2026-05-28',
    title: { uk: 'AI Brief · 28 травня 2026', en: 'AI Brief · May 28, 2026' },
    intro: {
      uk: 'День агентного тулінгу: Claude Code з фоновими агентами й нативним рев’ю PR, а MCP 1.2 додає стрімінг ресурсів і гранулярну авторизацію.',
      en: 'A day of agent tooling: Claude Code ships background agents and native PR review, while MCP 1.2 adds resource streaming and granular authorization.',
    },
    itemIds: ['p1', 'p2'],
  },
  {
    slug: 'daily-2026-05-27',
    date: '2026-05-27',
    title: { uk: 'AI Brief · 27 травня 2026', en: 'AI Brief · May 27, 2026' },
    intro: {
      uk: 'Дослідження проти інтуїції: структурований пошук б’є «довгий контекст», а prompt caching зрізає рахунок за API на 71%.',
      en: 'Research beats intuition: structured retrieval outperforms “long context”, and prompt caching cuts the API bill by 71%.',
    },
    itemIds: ['p3', 'p4'],
  },
  {
    slug: 'daily-2026-05-26',
    date: '2026-05-26',
    title: { uk: 'AI Brief · 26 травня 2026', en: 'AI Brief · May 26, 2026' },
    intro: {
      uk: 'Практика vibe-coding: коли обирати Skills, а коли MCP, і повний гайд зі збору власного агента для рев’ю коду за вечір.',
      en: 'Vibe-coding in practice: when to reach for Skills vs MCP, and a full guide to building your own code-review agent in an evening.',
    },
    itemIds: ['p5', 'p6'],
  },
];

export const briefBySlug = new Map(BRIEFS.map((b) => [b.slug, b]));

/** Resolve a brief by slug; `latest` returns the most recent. */
export function findBrief(slug: string): ProtoBrief | undefined {
  if (slug === 'latest') return BRIEFS[0];
  return briefBySlug.get(slug);
}

// ─── Concept hubs (hub-and-spoke for SEO + discovery) ─────────────────────────
// Each concept gathers every story that mentions it — the internal-linking
// structure that builds topical authority.

export interface ProtoConcept {
  slug: string;
  icon: IconKey;
  name: Record<Lang, string>;
  description: Record<Lang, string>;
}

export const CONCEPTS: ProtoConcept[] = [
  {
    slug: 'claude-code',
    icon: 'tools',
    name: { uk: 'Claude Code', en: 'Claude Code' },
    description: {
      uk: 'Agentic CLI від Anthropic: фонові агенти, рев’ю PR у терміналі, Skills, hooks і MCP. Усі матеріали про Claude Code в одному місці.',
      en: 'Anthropic’s agentic CLI: background agents, in-terminal PR review, Skills, hooks and MCP. Every Claude Code story in one place.',
    },
  },
  {
    slug: 'mcp',
    icon: 'agents',
    name: { uk: 'MCP', en: 'MCP' },
    description: {
      uk: 'Model Context Protocol — стандарт під’єднання агентів до інструментів і даних. Релізи, патерни авторизації та продакшн-кейси.',
      en: 'The Model Context Protocol — the standard for wiring agents to tools and data. Releases, authorization patterns and production cases.',
    },
  },
  {
    slug: 'rag',
    icon: 'models',
    name: { uk: 'RAG', en: 'RAG' },
    description: {
      uk: 'Retrieval-Augmented Generation: структурований пошук, ре-ранкінг і дедуплікація замість «закидання всього в контекст».',
      en: 'Retrieval-Augmented Generation: structured retrieval, re-ranking and de-duplication instead of stuffing everything into context.',
    },
  },
  {
    slug: 'prompt-caching',
    icon: 'optimization',
    name: { uk: 'Prompt caching', en: 'Prompt caching' },
    description: {
      uk: 'Кешування стабільного префікса промпту — найдешевша оптимізація вартості LLM. Реальні кейси економії 70%+.',
      en: 'Caching a stable prompt prefix — the cheapest LLM cost optimization. Real-world cases of 70%+ savings.',
    },
  },
];

export const conceptBySlug = new Map(CONCEPTS.map((c) => [c.slug, c]));

/** Posts that mention a concept — matched by its label across the archive. */
export function postsForConcept(slug: string, lang: Lang): ProtoPost[] {
  const c = conceptBySlug.get(slug);
  if (!c) return [];
  return POSTS.filter(
    (p) => p.tools.some((tool) => slugify(tool) === slug) || matchesQuery(p, c.name.en, lang),
  ).sort((a, b) => b.date.localeCompare(a.date) || a.rank - b.rank);
}
