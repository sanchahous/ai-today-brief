import type { Lang } from '@/lib/site';

/**
 * Living reference pages ("guides") — the GEO/SEO magnets from the portal
 * plan: long-form comparisons and explainers the editor re-verifies on a
 * schedule. Content lives in the repo (version-controlled, reviewed in PRs)
 * and is written in the same constrained markdown the article body renderer
 * supports (src/lib/markdown.ts).
 *
 * Editorial rule for this file: structural, slowly-changing claims only —
 * no prices or version numbers unless freshly verified. Bump `lastVerified`
 * on every review, even when nothing changed; the date is the trust signal.
 */
export interface Guide {
  slug: string;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  /** ISO date of the editor's last fact pass — shown on the page + schema. */
  lastVerified: string;
  body: Record<Lang, string>;
}

const CLAUDE_CODE_VS_CURSOR_VS_CODEX: Guide = {
  slug: 'claude-code-vs-cursor-vs-codex',
  title: {
    en: 'Claude Code vs Cursor vs Codex: which AI coding agent fits your workflow',
    uk: 'Claude Code vs Cursor vs Codex: який AI-агент для коду під ваш workflow',
  },
  description: {
    en: 'A structural comparison of the three agentic coding tools — interface model, autonomy, extensibility, team fit — and an honest "choose this if" checklist.',
    uk: 'Структурне порівняння трьох агентних інструментів для коду — модель інтерфейсу, автономність, розширюваність, командний фіт — і чесний чекліст «обирай це, якщо».',
  },
  lastVerified: '2026-06-11',
  body: {
    en: `All three tools put a frontier model inside your development loop, but they make different structural bets. This page compares the bets, not the week's benchmarks — those change faster than any comparison can.

### The core difference: where the agent lives

**Claude Code** is a terminal-first agent. It works in any repo, any stack, any editor, because it operates on files and shell commands rather than on an IDE's internals. That makes it the most composable of the three: it scripts, it pipes, it runs in CI.

**Cursor** is an IDE-first agent — a VS Code fork where the model is woven into editing itself: inline edits, tab completion, codebase-aware chat. The bet is that most coding time is spent *editing*, so the agent should live where editing happens.

**Codex** is a cloud-first agent: you hand it a task and it works in an isolated environment, returning a pull request. The bet is delegation — the agent as a junior teammate rather than a pair programmer.

### Autonomy and supervision

- Claude Code runs long multi-step tasks in your terminal with permission gates you configure per command class. You watch it work and can interrupt.
- Cursor keeps you closest to every change: agent mode exists, but the workflow gravitates toward reviewing diffs as they appear in the editor.
- Codex maximizes autonomy: tasks run remotely and in parallel; you review finished PRs instead of keystrokes.

### Extensibility

Claude Code leans on open extension surfaces — **Model Context Protocol** (MCP) servers for tools and data, hooks for lifecycle automation, skills and slash commands for reusable workflows. Cursor supports MCP too, plus its own rules files; the deepest customization still assumes you live in its IDE. Codex extensibility is mostly about environment configuration for its cloud sandbox.

### When to choose which

- **Choose Claude Code if** you want one agent across every repo and editor, automate beyond the IDE (scripts, CI, servers), or build custom tooling on MCP.
- **Choose Cursor if** your day is hands-on editing, you want the lowest-friction inline assistance, and a VS Code-compatible IDE is acceptable as your daily driver.
- **Choose Codex if** you delegate well-scoped tasks (bug fixes, mechanical refactors, test coverage) and want them to run in parallel without occupying your machine.

### When NOT to switch

- Don't adopt any of them to fix an unclear codebase — agents amplify the structure you already have, good or bad.
- Don't pick by leaderboard deltas: model quality converges and all three swap models underneath you.
- A terminal-averse team will not enjoy Claude Code; an IDE-locked team loses Cursor's main advantage the moment they leave it.

### The boring truth

Many teams run two of the three: an IDE-native assistant for the inner loop and a terminal/cloud agent for batch work. Start from your workflow's bottleneck — editing speed, delegation, or automation — and pick the tool whose structural bet matches it.`,
    uk: `Усі три інструменти ставлять frontier-модель у ваш цикл розробки, але роблять різні структурні ставки. Ця сторінка порівнює саме ставки, а не бенчмарки тижня — ті змінюються швидше, ніж будь-яке порівняння.

### Ключова різниця: де живе агент

**Claude Code** — termin-first агент. Працює в будь-якому репозиторії, стеку й редакторі, бо оперує файлами та shell-командами, а не нутрощами IDE. Це робить його найбільш композованим із трьох: він скриптується, пайпиться, запускається в CI.

**Cursor** — IDE-first агент: форк VS Code, де модель вплетена в саме редагування — inline-правки, tab-доповнення, чат із контекстом кодової бази. Ставка: більшість часу кодинга — це *редагування*, тож агент має жити там, де воно відбувається.

**Codex** — cloud-first агент: ви віддаєте йому задачу, він працює в ізольованому середовищі й повертає pull request. Ставка на делегування — агент як джуніор-колега, а не пара-програміст.

### Автономність і нагляд

- Claude Code виконує довгі багатокрокові задачі у вашому терміналі з permission-гейтами, які ви налаштовуєте за класами команд. Ви бачите роботу й можете перервати.
- Cursor тримає вас найближче до кожної зміни: agent-режим є, але workflow тяжіє до перегляду дифів просто в редакторі.
- Codex максимізує автономність: задачі виконуються віддалено й паралельно; ви рев'юїте готові PR, а не кожне натискання.

### Розширюваність

Claude Code спирається на відкриті поверхні розширення — сервери **Model Context Protocol** (MCP) для інструментів і даних, hooks для автоматизації життєвого циклу, skills і slash-команди для повторюваних workflow. Cursor теж підтримує MCP, плюс власні rules-файли; але найглибша кастомізація передбачає життя в його IDE. Розширюваність Codex — переважно конфігурація середовища його cloud-пісочниці.

### Коли що обирати

- **Обирайте Claude Code, якщо** хочете одного агента в усіх репозиторіях і редакторах, автоматизуєте поза IDE (скрипти, CI, сервери) або будуєте власний тулінг на MCP.
- **Обирайте Cursor, якщо** ваш день — це hands-on редагування, потрібна асистенція з мінімальним тертям, а VS Code-сумісна IDE прийнятна як основна.
- **Обирайте Codex, якщо** делегуєте добре окреслені задачі (багфікси, механічні рефактори, тестове покриття) і хочете, щоб вони йшли паралельно, не займаючи вашу машину.

### Коли НЕ переходити

- Не беріть жоден із них, щоб «полагодити» незрозумілу кодову базу — агенти підсилюють структуру, яка вже є, хорошу чи погану.
- Не обирайте за дельтами лідербордів: якість моделей сходиться, і всі три міняють моделі під капотом.
- Команді, що уникає термінала, не зайде Claude Code; команда, прикута до своєї IDE, втрачає головну перевагу Cursor, щойно виходить з неї.

### Нудна правда

Багато команд тримають два з трьох: IDE-нативного асистента для внутрішнього циклу і термінального/хмарного агента для батч-роботи. Відштовхуйтесь від вузького місця вашого workflow — швидкість редагування, делегування чи автоматизація — і беріть інструмент, чия структурна ставка йому відповідає.`,
  },
};

const AOB_BENCHMARK: Guide = {
  slug: 'atb-orchestration-bench',
  title: {
    en: 'ATB Orchestration Bench: our reproducible agent-delivery benchmark',
    uk: 'ATB Orchestration Bench: наш відтворюваний бенчмарк агентної розробки',
  },
  description: {
    en: 'Every notable coding-agent release gets the same end-to-end delivery epic — planning, memory, token economy, code, self-review, tests, design, tech-debt honesty. Scores and run logs live on this page.',
    uk: 'Кожен помітний реліз кодинг-агента проходить той самий епік розробки під ключ — планування, память, токен-економіка, код, само-ревью, тести, дизайн, чесний техборг. Оцінки й логи прогонів — на цій сторінці.',
  },
  lastVerified: '2026-06-11',
  body: {
    en: `Leaderboards measure models on isolated problems. Real agentic work is different: it is **orchestrated delivery** — decomposing an epic, surviving a session restart, staying inside a token budget, reviewing your own code, shipping tests, and being honest about the debt you left behind. That is what this benchmark scores.

### The fixed epic

Every tool gets the same one-page spec: **"Standup Tracker"** — a complete product slice (team CRUD, daily entries, an analytics dashboard, responsive UI per a fixed design spec) built from scratch in a fixed reference repo. Web track on Next.js/TypeScript; a mobile track on Expo exists for tools that claim it.

### What makes it hard — and fair

- **A mid-run session restart is mandatory.** Long-term memory is scored by how much context survives without re-explaining. Configuring the tool's own memory, rules and skills is allowed — that *is* orchestration — but every configuration is published in the run log.
- **A hard token budget** is set before the run. Closing the epic on half the budget scores 5; running out ends the run.
- **Every human intervention is logged and costs points.** The goal is "під ключ", not pair programming.
- Same repo commit, same spec, same budget for every tool; exact model ids and versions recorded; full run logs published.

### The 10 dimensions (0–5 each, max 50)

1. Planning & decomposition
2. Long-term memory (the restart test)
3. Token economy
4. Code quality (typecheck/lint/idiom)
5. Self-review & critique
6. Tests (unit + Playwright e2e, all green)
7. Design fidelity
8. Tech-debt honesty
9. Autonomy (interventions counted)
10. Time to done

We publish the **profile**, not just the total: a tool that scores 46 but fails memory is a different animal from a 46 that fails design.

### Results

No scored runs yet — the protocol is frozen as v1 and the first runs are scheduled. Each future run adds a row here: tool, version, date, total, dimension profile, cost, and a link to the full run log.

### Why trust this

The protocol, the epic spec and every run log are public and versioned. When we change anything, the protocol version bumps and old scores stop being comparable — no silent re-grading.`,
    uk: `Лідерборди міряють моделі на ізольованих задачках. Реальна агентна робота інша: це **оркестрована розробка** — декомпозиція епіку, виживання після рестарту сесії, життя в межах токен-бюджету, ревью власного коду, тести і чесність щодо залишеного техборгу. Саме це оцінює наш бенчмарк.

### Фіксований епік

Кожен інструмент отримує ту саму односторінкову специфікацію: **«Standup Tracker»** — повний продуктовий зріз (CRUD команд, щоденні записи, дашборд з аналітикою, responsive UI за фіксованим дизайн-специфікаціями), збудований з нуля у фіксованому референс-репозиторії. Web-трек на Next.js/TypeScript; mobile-трек на Expo — для інструментів, що заявляють таку компетенцію.

### Що робить його складним — і чесним

- **Обовʼязковий рестарт сесії посеред прогону.** Довгострокова память оцінюється за тим, скільки контексту виживає без повторних пояснень. Налаштування власної памяті, правил і скілів інструмента дозволене — це і *є* оркестрація — але кожна конфігурація публікується в лозі прогону.
- **Жорсткий токен-бюджет** фіксується до старту. Закрити епік за половину бюджету — 5 балів; вичерпати — кінець прогону.
- **Кожне людське втручання логується і коштує балів.** Мета — «під ключ», а не парне програмування.
- Той самий коміт репозиторію, та сама специфікація, той самий бюджет для всіх; точні id моделей і версії фіксуються; повні логи прогонів публікуються.

### 10 вимірів (0–5 кожен, максимум 50)

1. Планування й декомпозиція
2. Довгострокова память (тест рестартом)
3. Токен-економіка
4. Якість коду (typecheck/lint/ідіоматичність)
5. Само-ревью і критика
6. Тести (unit + Playwright e2e, всі зелені)
7. Відповідність дизайну
8. Чесність техборгу
9. Автономність (втручання рахуються)
10. Час до готовності

Ми публікуємо **профіль**, а не лише суму: інструмент із 46 балами, що провалив память, — зовсім інший звір, ніж 46 із провалом дизайну.

### Результати

Оцінених прогонів ще немає — протокол заморожено як v1, перші прогони заплановані. Кожен майбутній прогін додає сюди рядок: інструмент, версія, дата, сума, профіль вимірів, вартість і посилання на повний лог.

### Чому цьому можна довіряти

Протокол, специфікація епіку і кожен лог прогону — публічні й версіоновані. Коли ми щось змінюємо, версія протоколу підвищується, і старі оцінки перестають бути порівнюваними — жодного тихого перегрейдингу.`,
  },
};

export const GUIDES: readonly Guide[] = [CLAUDE_CODE_VS_CURSOR_VS_CODEX, AOB_BENCHMARK];

export function getGuide(slug: string): Guide | null {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}
