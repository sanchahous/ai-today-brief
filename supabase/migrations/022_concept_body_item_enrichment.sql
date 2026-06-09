-- ============================================================================
-- 022 — Evergreen concept bodies + article enrichment fields
-- ============================================================================

ALTER TABLE public.concepts
  ADD COLUMN IF NOT EXISTS body_en  text,
  ADD COLUMN IF NOT EXISTS body_uk  text,
  ADD COLUMN IF NOT EXISTS faq_en   jsonb,
  ADD COLUMN IF NOT EXISTS faq_uk   jsonb;

ALTER TABLE public.brief_items
  ADD COLUMN IF NOT EXISTS action_items_en jsonb,
  ADD COLUMN IF NOT EXISTS action_items_uk jsonb,
  ADD COLUMN IF NOT EXISTS impact_level    text;

ALTER TABLE public.brief_items
  DROP CONSTRAINT IF EXISTS brief_items_impact_level_check;

ALTER TABLE public.brief_items
  ADD CONSTRAINT brief_items_impact_level_check
  CHECK (impact_level IS NULL OR impact_level IN ('low', 'medium', 'high'));

-- Priority evergreen hubs (EN + UK body + FAQ)
UPDATE public.concepts
SET
  body_en = 'Claude Code is Anthropic''s terminal-native coding agent: it reads your repo, runs shell commands, edits files, and chains tool calls through MCP servers. For daily engineering work it sits between a chat window and a full IDE agent — fast to invoke, scriptable, and designed for longer autonomous sessions with human checkpoints.

Use it when you want repo-wide refactors, test runs, or multi-file fixes without leaving the terminal. Pair it with MCP for databases, browsers, and internal APIs. The main trade-off vs IDE agents: less visual diff review, more discipline around permissions and sandboxing.',
  body_uk = 'Claude Code — термінальний coding-агент від Anthropic: читає репозиторій, виконує shell-команди, редагує файли й ланцюжить tool calls через MCP-сервери. Для щоденної інженерної роботи це щось між чатом і повноцінним IDE-агентом — швидкий запуск, скриптованість і довгі автономні сесії з контрольними точками людини.

Використовуйте для рефакторів на весь репо, прогонів тестів і мультифайлових правок без виходу з терміналу. Поєднуйте з MCP для БД, браузерів і внутрішніх API. Головний компроміс проти IDE-агентів: менше візуального diff-review, більше дисципліни навколо дозволів і sandboxing.',
  faq_en = '[{"q":"When should I pick Claude Code over Cursor?","a":"Choose Claude Code for terminal-first workflows, CI-adjacent automation, and scripted agent runs. Choose Cursor when you want inline IDE edits and visual diff review as the default."},{"q":"Does Claude Code replace code review?","a":"No. Treat agent output as a draft: run tests, read diffs, and keep human review on security-sensitive changes."}]'::jsonb,
  faq_uk = '[{"q":"Коли обрати Claude Code замість Cursor?","a":"Claude Code — для terminal-first workflow, CI-подібної автоматизації та скриптованих запусків агента. Cursor — коли потрібні inline-правки в IDE й візуальний diff за замовчуванням."},{"q":"Чи замінює Claude Code code review?","a":"Ні. Вважайте вивід агента чернеткою: запускайте тести, читайте diff і залишайте людський review для security-чутливих змін."}]'::jsonb
WHERE slug = 'claude-code';

UPDATE public.concepts
SET
  body_en = 'Cursor is an AI-first fork of VS Code built around agentic editing: multi-file changes, codebase-wide search, and model switching (Claude, GPT, Gemini) in one editor. It is the default daily driver for many vibe coders because it keeps the familiar VS Code extension ecosystem while adding agent loops on top.

Use Cursor for feature work inside a GUI, quick inline completions, and visual review of agent diffs. Watch token usage on large repos — context engineering (what you @-mention) matters more than the model choice for most tasks.',
  body_uk = 'Cursor — AI-форк VS Code навколо agentic-редагування: мультифайлові зміни, пошук по кодовій базі й перемикання моделей (Claude, GPT, Gemini) в одному редакторі. Для багатьох vibe-кодерів це щоденний драйвер: знайома екосистема розширень VS Code плюс agent loops зверху.

Cursor — для feature-роботи в GUI, швидких inline-доповнень і візуального review diff від агента. Стежте за токенами на великих репо — context engineering (що ви @-згадуєте) часто важливіший за вибір моделі.',
  faq_en = '[{"q":"Is Cursor just VS Code with a chat panel?","a":"The UI feels familiar, but the product value is agentic multi-file editing, codebase indexing, and model routing — not autocomplete alone."},{"q":"How do I keep costs predictable?","a":"Limit @-context to relevant folders, use smaller models for boilerplate, and enable rules files so the agent does not re-read the whole monorepo each turn."}]'::jsonb,
  faq_uk = '[{"q":"Cursor — це просто VS Code з чатом?","a":"UI знайомий, але цінність — agentic мультифайлове редагування, індексація кодової бази й маршрутизація моделей, а не лише autocomplete."},{"q":"Як тримати витрати під контролем?","a":"Обмежуйте @-контекст релевантними папками, використовуйте менші моделі для шаблонного коду й rules-файли, щоб агент не перечитував увесь монорепо кожен хід."}]'::jsonb
WHERE slug = 'cursor';

UPDATE public.concepts
SET
  body_en = 'Model Context Protocol (MCP) is an open standard for connecting LLM agents to tools and data sources through a client–server contract. Instead of bespoke integrations per product, hosts (Claude Desktop, Claude Code, Cursor, IDEs) discover MCP servers that expose resources, prompts, and callable tools.

For engineers, MCP is the plumbing layer behind “agent can query our DB / Jira / browser”. Security and ops teams care because each server defines its own auth surface — treat MCP like deploying a microservice with credentials.',
  body_uk = 'Model Context Protocol (MCP) — відкритий стандарт підключення LLM-агентів до інструментів і джерел даних через контракт client–server. Замість окремих інтеграцій під кожен продукт, хости (Claude Desktop, Claude Code, Cursor, IDE) знаходять MCP-сервери з resources, prompts і callable tools.

Для інженерів MCP — це «труби», через які агент запитує БД / Jira / браузер. Для security та ops кожен сервер — окрема auth-поверхня; ставтеся до MCP як до мікросервісу з credentials.',
  faq_en = '[{"q":"MCP vs traditional REST plugins?","a":"MCP standardizes discovery, capability listing, and tool schemas so multiple hosts can reuse the same server without one-off glue code."},{"q":"What is the biggest MCP security risk?","a":"Over-privileged servers — an agent inherits whatever the MCP server can access. Scope credentials per environment."}]'::jsonb,
  faq_uk = '[{"q":"MCP проти класичних REST-плагінів?","a":"MCP стандартизує discovery, список можливостей і схеми tools — один сервер можуть використовувати різні хости без glue-коду."},{"q":"Головний security-ризик MCP?","a":"Занадто привілейовані сервери — агент успадковує все, до чого має доступ MCP. Розділяйте credentials по середовищах."}]'::jsonb
WHERE slug = 'mcp';

UPDATE public.concepts
SET
  body_en = 'In AI engineering, an agent is a loop that plans, calls tools, observes results, and continues until a stop condition — not a single prompt/response. Production agents combine an LLM, tool interfaces (often MCP), memory, and guardrails (permissions, human approval, budgets).

The shift for developers: you design workflows and failure modes, not just prompts. Reliability comes from idempotent tools, clear schemas, and explicit escalation when confidence is low.',
  body_uk = 'У AI-інженерії агент — це цикл: планує, викликає tools, спостерігає результат і продовжує до stop condition, а не один prompt/response. Продакшн-агенти поєднують LLM, tool interfaces (часто MCP), пам''ять і guardrails (дозволи, approve людини, бюджети).

Для розробників зміна парадигми: ви проєктуєте workflow і failure modes, а не лише промпти. Надійність — від ідемпотентних tools, чітких схем і явної ескалації при низькій впевненості.',
  faq_en = '[{"q":"Agent vs chatbot?","a":"A chatbot answers once. An agent iterates with tools until the task is done or blocked."},{"q":"When not to build an agent?","a":"When a deterministic script or SQL job suffices — agents add latency, cost, and failure modes."}]'::jsonb,
  faq_uk = '[{"q":"Агент проти чат-бота?","a":"Чат-бот відповідає один раз. Агент ітерує з tools, поки задача не виконана або не заблокована."},{"q":"Коли не будувати агента?","a":"Коли достатньо детермінованого скрипта чи SQL — агенти додають latency, вартість і нові failure modes."}]'::jsonb
WHERE slug = 'agent';

UPDATE public.concepts
SET
  body_en = 'Retrieval-Augmented Generation (RAG) grounds an LLM on your own documents at query time: embed chunks, retrieve the top matches, inject them into the prompt, then generate. It is the default pattern for internal knowledge bases, support bots, and code assistants that must cite sources.

Engineering focus: chunking strategy, embedding model choice, hybrid search (keyword + vector), and evaluation — not just plugging a vector DB into LangChain.',
  body_uk = 'Retrieval-Augmented Generation (RAG) «заземлює» LLM на ваших документах під час запиту: embed чанків, retrieval топ-матчів, ін''єкція в prompt, потім генерація. Це базовий патерн для внутрішніх knowledge base, support-ботів і асистентів, що мають цитувати джерела.

Інженерний фокус: стратегія chunking, модель embedding, hybrid search (keyword + vector) і evaluation — не лише «підключити vector DB до LangChain».',
  faq_en = '[{"q":"RAG vs fine-tuning?","a":"RAG updates facts by changing the index; fine-tuning bakes knowledge into weights. RAG is cheaper to refresh for changing docs."},{"q":"Why do RAG demos fail in prod?","a":"Usually bad chunking, no reranking, or missing eval on real user queries — not the vector DB brand."}]'::jsonb,
  faq_uk = '[{"q":"RAG проти fine-tuning?","a":"RAG оновлює факти через індекс; fine-tuning «запікає» знання у ваги. RAG дешевший для змінюваних документів."},{"q":"Чому RAG падає в проді?","a":"Часто через поганий chunking, відсутній reranking або eval на реальних запитах — не через бренд vector DB."}]'::jsonb
WHERE slug = 'rag';

UPDATE public.concepts
SET
  body_en = 'Prompt caching lets you reuse a long static prefix (system instructions, tool definitions, reference docs) across many API calls at reduced token cost. Anthropic, OpenAI, and Google implement it with different TTL and minimum cache sizes.

It matters for agent loops and batch pipelines where the same context is sent dozens of times per minute — caching can cut billable input tokens dramatically when your prefix is stable.',
  body_uk = 'Prompt caching дозволяє перевикористовувати довгий статичний префікс (system instructions, tool definitions, довідкові доки) у багатьох API-викликах зі зниженою вартістю токенів. Anthropic, OpenAI і Google реалізують це з різним TTL і мінімальним розміром кешу.

Це критично для agent loops і batch-пайплайнів, де той самий контекст відправляється десятки разів на хвилину — кеш може різко зменшити billable input tokens, якщо префікс стабільний.',
  faq_en = '[{"q":"What should go in the cached prefix?","a":"Stable content: system prompt, tool schemas, long reference docs. Keep user-specific or volatile data after the cache breakpoint."},{"q":"Does caching change model behavior?","a":"No — it is a billing/performance optimization on identical prefix tokens, not a different model."}]'::jsonb,
  faq_uk = '[{"q":"Що класти в cached prefix?","a":"Стабільний контент: system prompt, схеми tools, довгі довідники. User-specific або volatile дані — після cache breakpoint."},{"q":"Чи змінює кеш поведінку моделі?","a":"Ні — це оптимізація billing/performance для однакових prefix-токенів, не інша модель."}]'::jsonb
WHERE slug = 'prompt-caching';
