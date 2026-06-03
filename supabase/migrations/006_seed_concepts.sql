-- Initial seed of ~30 concepts covering the tools and patterns that come
-- up most often in the reader's daily work. Idempotent — uses ON CONFLICT
-- so re-running is safe and so future migrations can add new concepts
-- without touching the existing rows.

INSERT INTO public.concepts (slug, name_en, name_uk, description_en, description_uk, type, category, official_url, aliases) VALUES

-- ── Agentic IDEs and CLIs ────────────────────────────────────────────────
('claude-code',
  'Claude Code', 'Claude Code',
  'Anthropic''s command-line coding agent. Runs in your terminal, uses Claude as the model, supports skills, hooks, slash commands, and MCP servers. Designed for vibe coding longer sessions with file context and tool use.',
  'CLI-агент від Anthropic для кодування. Працює в терміналі, використовує Claude як модель, підтримує skills, hooks, slash-команди та MCP-сервери. Розрахований на тривалі vibe-coding-сесії з файловим контекстом і tool use.',
  'product', 'ide', 'https://claude.com/claude-code',
  ARRAY['claude-code', 'claude code', 'claudecode']),

('cursor',
  'Cursor', 'Cursor',
  'AI-first IDE forked from VS Code. Integrates Claude, GPT, and Gemini for inline edits, multi-file refactors, and agentic workflows. Core daily driver for vibe coders.',
  'AI-перший IDE на базі VS Code. Інтегрує Claude, GPT і Gemini для inline-редагувань, мультифайлових рефакторів і agentic-воркфлоу. Базовий інструмент для vibe-кодерів.',
  'product', 'ide', 'https://cursor.com',
  ARRAY['cursor', 'cursor ide', 'cursor ai']),

('codex',
  'Codex', 'Codex',
  'OpenAI''s coding-focused agent / CLI. Newer iteration of the Codex brand built for autonomous coding tasks with GPT-class models.',
  'Кодинг-агент і CLI від OpenAI. Нова ітерація бренду Codex для автономних задач кодування на моделях класу GPT.',
  'product', 'ide', 'https://openai.com/codex',
  ARRAY['codex', 'openai codex', 'codex cli']),

('gemini',
  'Gemini', 'Gemini',
  'Google''s flagship model family and matching CLI. Strong at long-context analysis and structured output; Gemini Flash is the cheap workhorse for high-volume pipelines.',
  'Флагманське сімейство моделей Google і його CLI. Сильний у роботі з довгим контекстом і structured output; Gemini Flash — дешева робоча конячка для high-volume пайплайнів.',
  'product', 'model', 'https://ai.google.dev',
  ARRAY['gemini', 'gemini cli', 'gemini code', 'gemini pro', 'gemini flash']),

('github-copilot',
  'GitHub Copilot', 'GitHub Copilot',
  'GitHub''s in-editor AI assistant. Inline autocompletion and chat, now with agent mode and MCP support. Bundled with most paid GitHub plans.',
  'AI-асистент GitHub прямо в редакторі. Inline-автодоповнення і чат, тепер з agent mode і підтримкою MCP. Входить у платні тарифи GitHub.',
  'product', 'ide', 'https://github.com/features/copilot',
  ARRAY['github copilot', 'copilot']),

('windsurf',
  'Windsurf', 'Windsurf',
  'AI-native IDE from Codeium with Cascade agent for cross-file edits. A direct alternative to Cursor with a different agent loop.',
  'AI-нативний IDE від Codeium з Cascade-агентом для крос-файлових редагувань. Пряма альтернатива Cursor із іншим agent-циклом.',
  'product', 'ide', 'https://windsurf.com',
  ARRAY['windsurf', 'windsurf editor']),

('cline',
  'Cline', 'Cline',
  'Open-source autonomous coding agent for VS Code. Multi-step task execution with human-in-the-loop confirmation.',
  'Відкритий автономний кодинг-агент для VS Code. Багатокрокове виконання задач із human-in-the-loop підтвердженням.',
  'product', 'ide', 'https://cline.bot',
  ARRAY['cline']),

('aider',
  'Aider', 'Aider',
  'Terminal-based pair programmer. Uses git to track AI-generated edits; works with Claude, GPT-4, and local models.',
  'Pair-programmer у терміналі. Використовує git для трекінгу AI-згенерованих змін; працює з Claude, GPT-4 і локальними моделями.',
  'product', 'ide', 'https://aider.chat',
  ARRAY['aider']),

('continue-dev',
  'Continue', 'Continue',
  'Open-source autopilot for VS Code and JetBrains. Brings agent workflows, custom commands, and context providers into the editor.',
  'Відкритий autopilot для VS Code і JetBrains. Дає agent-воркфлоу, кастомні команди і провайдери контексту прямо в редакторі.',
  'product', 'ide', 'https://continue.dev',
  ARRAY['continue.dev', 'continue']),

-- ── Concepts / patterns ──────────────────────────────────────────────────
('mcp',
  'Model Context Protocol', 'Model Context Protocol',
  'Open protocol from Anthropic for connecting LLM clients to data sources and tools via standardised servers. Cursor, Claude Code, and Copilot all support MCP servers.',
  'Відкритий протокол від Anthropic для підключення LLM-клієнтів до даних і інструментів через стандартизовані сервери. Cursor, Claude Code і Copilot підтримують MCP-сервери.',
  'concept', 'protocol', 'https://modelcontextprotocol.io',
  ARRAY['mcp', 'model context protocol', 'mcp server', 'mcp servers']),

('rag',
  'Retrieval-Augmented Generation', 'Retrieval-Augmented Generation',
  'Pattern where an LLM is given relevant documents at inference time (retrieved from a vector store or other index) rather than relying on training data alone. Standard recipe for grounding answers in your own data.',
  'Патерн, коли LLM під час інференсу отримує релевантні документи (з векторної БД або іншого індексу), а не покладається лише на тренувальні дані. Стандартний рецепт grounding-у відповідей на власних даних.',
  'concept', 'pattern', 'https://www.anthropic.com/news/contextual-retrieval',
  ARRAY['rag', 'retrieval-augmented generation', 'retrieval augmented generation']),

('prompt-caching',
  'Prompt Caching', 'Prompt Caching',
  'API feature that lets you reuse a long static prompt prefix across many requests for a fraction of the token cost. Anthropic, OpenAI, and Google all offer it with slightly different rules.',
  'API-фіча, яка дозволяє перевикористовувати довгий статичний префікс промпта в багатьох запитах за частку токен-вартості. Anthropic, OpenAI і Google пропонують її з трохи різними правилами.',
  'concept', 'optimization', 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching',
  ARRAY['prompt caching', 'prompt cache', 'cached prompt']),

('token-optimization',
  'Token Optimization', 'Оптимізація токенів',
  'Practice of reducing the number of tokens sent to and received from an LLM without losing task quality. Includes prompt caching, message pruning, context window management, and structured output.',
  'Практика зменшення кількості токенів до й від LLM без втрати якості. Включає prompt caching, обрізання повідомлень, керування context window і structured output.',
  'concept', 'optimization', null,
  ARRAY['token optimization', 'token cost', 'token savings', 'token budget']),

('context-engineering',
  'Context Engineering', 'Context Engineering',
  'Discipline of curating exactly the right files, instructions, and history that go into an LLM''s context window. Distinct from prompt engineering — the focus is on what the model sees, not how you ask.',
  'Дисципліна підбору саме тих файлів, інструкцій і історії, що потрапляють у context window LLM. Відмінне від prompt engineering — фокус на тому, що модель бачить, а не як її питають.',
  'concept', 'pattern', null,
  ARRAY['context engineering', 'context window']),

('agent',
  'AI Agent', 'AI-агент',
  'LLM-driven program that decides which tools to call in a loop to accomplish a goal, rather than answering a single prompt. Modern coding IDEs all build on agent loops.',
  'LLM-керована програма, яка в циклі сама вирішує, які інструменти викликати для досягнення мети, замість відповіді на один промпт. Сучасні coding IDE будуються на agent-циклах.',
  'concept', 'pattern', null,
  ARRAY['agent', 'ai agent', 'agentic', 'agentic workflow', 'agentic coding']),

('skill',
  'Skill', 'Skill',
  'Claude Code abstraction: a reusable bundle of instructions, scripts, and context that the agent can load on demand. Like a slash command with structured behaviour.',
  'Абстракція Claude Code: переvикористовуваний пакет інструкцій, скриптів і контексту, який агент завантажує на вимогу. Як slash-команда зі структурованою поведінкою.',
  'concept', 'pattern', 'https://docs.claude.com/en/docs/claude-code/skills',
  ARRAY['skill', 'skills', 'claude skill']),

('hook',
  'Hook', 'Hook',
  'Claude Code lifecycle interception. Hooks run before or after tool calls, prompts, or session events — useful for guardrails, logging, and policy.',
  'Перехоплення життєвого циклу Claude Code. Hooks виконуються до або після викликів інструментів, промптів чи подій сесії — корисні для guardrails, логування і політик.',
  'concept', 'pattern', 'https://docs.claude.com/en/docs/claude-code/hooks',
  ARRAY['hook', 'hooks', 'claude hook']),

('slash-command',
  'Slash Command', 'Slash-команда',
  'Custom user-defined command in Claude Code (and similar tools) invoked with /name. Used to encapsulate reusable workflows like /review or /cache.',
  'Користувацька команда в Claude Code (та подібних інструментах), яка викликається через /name. Інкапсулює перевикористовувані воркфлоу типу /review чи /cache.',
  'concept', 'pattern', null,
  ARRAY['slash command', 'slash commands', 'slash-command']),

('subagent',
  'Subagent', 'Sub-агент',
  'Spawned child agent with its own context and tool set, called from a parent agent. Used to parallelise work and isolate context.',
  'Породжений дочірній агент із власним контекстом і набором інструментів, який запускається з батьківського агента. Використовується для розпаралелення і ізоляції контексту.',
  'concept', 'pattern', null,
  ARRAY['subagent', 'sub-agent', 'sub agent']),

('vibe-coding',
  'Vibe Coding', 'Vibe Coding',
  'Working style where you steer an AI agent through a coding task in natural language without writing the code yourself line by line. Popularised by Andrej Karpathy in early 2025.',
  'Стиль роботи, коли ти керуєш AI-агентом через задачу природною мовою, не пишучи код самостійно рядок за рядком. Популяризований Андрієм Карпатим на початку 2025.',
  'concept', 'pattern', null,
  ARRAY['vibe coding', 'vibe-coding', 'vibecoding']),

-- ── Services ─────────────────────────────────────────────────────────────
('anthropic-api',
  'Anthropic API', 'Anthropic API',
  'Direct REST API for Claude models. Supports prompt caching, batch mode, structured outputs, and tool use.',
  'Прямий REST API для моделей Claude. Підтримує prompt caching, batch mode, structured outputs і tool use.',
  'service', 'service', 'https://docs.anthropic.com',
  ARRAY['anthropic api', 'claude api']),

('openai-api',
  'OpenAI API', 'OpenAI API',
  'OpenAI''s REST API for GPT, embeddings, image, and audio models. The widest tool-use ecosystem and the most third-party integrations.',
  'REST API OpenAI для GPT, embeddings, image- і audio-моделей. Найширша екосистема tool use і найбільше сторонніх інтеграцій.',
  'service', 'service', 'https://platform.openai.com',
  ARRAY['openai api']),

('openrouter',
  'OpenRouter', 'OpenRouter',
  'Unified API for switching between LLMs from Anthropic, OpenAI, Google, Mistral, and dozens more. Useful for avoiding lock-in and price arbitrage.',
  'Єдиний API для перемикання між LLM від Anthropic, OpenAI, Google, Mistral і десятків інших. Уникнення lock-in і прайс-арбітраж.',
  'service', 'service', 'https://openrouter.ai',
  ARRAY['openrouter']),

-- ── SDKs / libraries ─────────────────────────────────────────────────────
('claude-agent-sdk',
  'Claude Agent SDK', 'Claude Agent SDK',
  'Anthropic''s Python and TypeScript SDK for building agentic apps on top of Claude. Wraps tool use, sessions, and the agent loop.',
  'Python і TypeScript SDK від Anthropic для побудови agentic-додатків на Claude. Обгортає tool use, сесії й agent-цикл.',
  'library', 'sdk', 'https://docs.claude.com/en/api/agent-sdk',
  ARRAY['claude agent sdk', 'agent sdk']),

('langchain',
  'LangChain', 'LangChain',
  'Popular framework for chaining LLM calls, retrieval, and tools. Big surface area, occasionally controversial design, but the de-facto starter for many teams.',
  'Популярний фреймворк для ланцюжків LLM-викликів, retrieval і tools. Велика поверхня, інколи спірний дизайн, але de-facto старт для багатьох команд.',
  'library', 'sdk', 'https://www.langchain.com',
  ARRAY['langchain']),

('llamaindex',
  'LlamaIndex', 'LlamaIndex',
  'Framework specialised for retrieval and indexing — better defaults than LangChain when your app is mostly RAG.',
  'Фреймворк, спеціалізований на retrieval і індексації — кращі дефолти за LangChain, коли додаток переважно RAG.',
  'library', 'sdk', 'https://www.llamaindex.ai',
  ARRAY['llamaindex', 'llama index'])

ON CONFLICT (slug) DO NOTHING;
