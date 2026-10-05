import type { Lang } from './site';

export interface ClaudeMdCitation {
  label: string;
  url: string;
  quote: Record<Lang, string>;
}

export interface ClaudeMdRule {
  id: string;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  rationale: Record<Lang, string>;
  citations: readonly ClaudeMdCitation[];
}

export const CLAUDE_MD_CITATIONS: readonly ClaudeMdCitation[] = [
  {
    label: 'Claude Code memory guide',
    url: 'https://docs.anthropic.com/en/docs/claude-code/memory',
    quote: {
      en: 'CLAUDE.md provides persistent project context; AGENTS.md is the shared multi-agent standard that CLAUDE.md can reference via @AGENTS.md.',
      uk: 'CLAUDE.md надає постійний контекст проєкту; AGENTS.md — спільний мультиагентний стандарт, на який CLAUDE.md посилається через @AGENTS.md.',
    },
  },
  {
    label: 'Claude Code best practices',
    url: 'https://docs.anthropic.com/en/docs/claude-code/best-practices',
    quote: {
      en: 'Keep project instructions concise, specific, and actionable. Avoid overwhelming the context window with encyclopedic rule lists.',
      uk: 'Тримайте інструкції проєкту стислими, конкретними й дієвими. Не перевантажуйте контекстне вікно енциклопедичними списками правил.',
    },
  },
  {
    label: 'Claude Code settings and permissions',
    url: 'https://docs.anthropic.com/en/docs/claude-code/settings',
    quote: {
      en: 'Combine CLAUDE.md project guidelines with settings.json permissions to enforce hard execution guardrails.',
      uk: 'Поєднуйте настанови CLAUDE.md із дозволами settings.json для забезпечення жорстких запобіжників виконання.',
    },
  },
  {
    label: 'Building effective agents',
    url: 'https://www.anthropic.com/research/building-effective-agents',
    quote: {
      en: 'Agent workflows succeed when tasks are scoped, verification is automated, and working agreements are explicitly grounded.',
      uk: 'Агентні робочі процеси успішні тоді, коли задачі обмежені рамками, перевірка автоматизована, а робочі домовленості явно заземлені.',
    },
  },
  {
    label: 'Anthropic prompt engineering overview',
    url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview',
    quote: {
      en: 'Explicit constraints, clear verification criteria, and positive guidance help models navigate complex codebases reliably.',
      uk: 'Явні обмеження, чіткі критерії перевірки та позитивні наміри допомагають моделям надійно орієнтуватися у складних кодових базах.',
    },
  },
] as const;

const [memoryDoc, bestPracticesDoc, settingsDoc, agentPatternsDoc, promptEngDoc] = CLAUDE_MD_CITATIONS;

export const CLAUDE_MD_RULES: readonly ClaudeMdRule[] = [
  {
    id: 'shared-agents-truth',
    title: {
      en: 'AGENTS.md as shared truth',
      uk: 'AGENTS.md як спільне джерело правди',
    },
    description: {
      en: 'Keep multi-agent guidance in AGENTS.md and import it into tool-specific instructions.',
      uk: 'Зберігайте мультиагентні інструкції в AGENTS.md і підключайте їх у специфічні для інструментів файли.',
    },
    rationale: {
      en: 'Prevents rule drift across Codex, Cursor, Copilot, and Claude Code workspaces.',
      uk: 'Запобігає розходженню правил між робочими просторами Codex, Cursor, Copilot та Claude Code.',
    },
    citations: [memoryDoc],
  },
  {
    id: 'claude-import-wiring',
    title: {
      en: 'Explicit @import wiring',
      uk: 'Явне підключення @import',
    },
    description: {
      en: 'Wire AGENTS.md in CLAUDE.md with @AGENTS.md or an explicit symlink.',
      uk: 'Підключайте AGENTS.md у CLAUDE.md через @AGENTS.md або явний symlink.',
    },
    rationale: {
      en: 'Claude Code officially resolves `@file` imports at session start, guaranteeing single-source context.',
      uk: 'Claude Code офіційно підтримує імпорти `@file` на старті сесії, гарантуючи єдине джерело контексту.',
    },
    citations: [memoryDoc],
  },
  {
    id: 'concise-root-instructions',
    title: {
      en: 'Concise root instructions',
      uk: 'Стислі кореневі інструкції',
    },
    description: {
      en: 'Keep CLAUDE.md under 200 lines; move deep reference docs into `.claude/skills/` or docs folders.',
      uk: 'Тримайте CLAUDE.md до 200 рядків; перенесіть детальні довідники у `.claude/skills/` або docs.',
    },
    rationale: {
      en: 'Root context is injected into every agent prompt; unnecessary bulk degrades context-window quality and instruction following.',
      uk: 'Кореневий контекст додається до кожного запиту агента; зайвий обсяг погіршує якість контекстного вікна й виконання інструкцій.',
    },
    citations: [bestPracticesDoc],
  },
  {
    id: 'explicit-verification',
    title: {
      en: 'Explicit verification commands',
      uk: 'Явні команди перевірки',
    },
    description: {
      en: 'Always provide executable test and lint commands so the agent can prove its work.',
      uk: 'Завжди вказуйте виконувані команди тестів і лінтерів, щоб агент міг довести свій результат.',
    },
    rationale: {
      en: 'Agents produce far fewer regressions when given concrete verification steps before handoff.',
      uk: 'Агенти створюють значно менше регресій, коли мають конкретні кроки перевірки перед здачею задачі.',
    },
    citations: [agentPatternsDoc],
  },
  {
    id: 'working-agreements',
    title: {
      en: 'Bounded working agreements',
      uk: 'Окреслені робочі домовленості',
    },
    description: {
      en: 'Read nearby code and established patterns before modifying; avoid refactoring untouched files.',
      uk: 'Читайте сусідній код і усталені патерни перед змінами; уникайте рефакторингу незачеплених файлів.',
    },
    rationale: {
      en: 'Scoped diffs make peer review straightforward and prevent subtle architectural friction.',
      uk: 'Сфокусовані diff полегшують код-рев’ю й запобігають прихованим архітектурним конфліктам.',
    },
    citations: [bestPracticesDoc],
  },
  {
    id: 'secrets-guardrail',
    title: {
      en: 'Secrets and environment guardrails',
      uk: 'Запобіжники секретів і середовища',
    },
    description: {
      en: 'Never commit credentials, API keys, private user data, or unencrypted `.env` files.',
      uk: 'Ніколи не комітьте креденшали, API-ключі, приватні дані користувачів або незашифровані `.env`-файли.',
    },
    rationale: {
      en: 'Hard boundaries in project memory protect credentials even when agents run autonomous loops.',
      uk: 'Жорсткі межі в пам’яті проєкту захищають креденшали навіть під час автономних циклів агентів.',
    },
    citations: [settingsDoc],
  },
  {
    id: 'plan-mode-guardrail',
    title: {
      en: 'Plan mode for cross-cutting changes',
      uk: 'Режим plan для наскрізних змін',
    },
    description: {
      en: 'Require a brief plan before multi-file changes, migrations, or irreversible actions.',
      uk: 'Вимагайте короткий план перед багатофайловими змінами, міграціями або незворотними діями.',
    },
    rationale: {
      en: 'Planning catches invalid assumptions early and allows human alignment before code modifications.',
      uk: 'Планування виявляє хибні припущення на ранньому етапі й дозволяє узгодити напрямок з людиною до правок коду.',
    },
    citations: [agentPatternsDoc],
  },
  {
    id: 'git-hygiene',
    title: {
      en: 'Git hygiene and branch safety',
      uk: 'Гігієна Git і безпека гілок',
    },
    description: {
      en: 'Preserve unrelated local work, write clear descriptive commits, and avoid destructive push operations.',
      uk: 'Зберігайте непов’язані локальні зміни, пишіть описові коміти й уникайте деструктивних операцій push.',
    },
    rationale: {
      en: 'Protects teammates from accidental work loss and maintains an auditable development history.',
      uk: 'Захищає команду від випадкової втрати роботи й підтримує прозору історію розробки.',
    },
    citations: [bestPracticesDoc],
  },
  {
    id: 'dependency-discipline',
    title: {
      en: 'Dependency discipline',
      uk: 'Дисципліна залежностей',
    },
    description: {
      en: 'Prefer existing stack libraries and native utilities over introducing new external packages.',
      uk: 'Віддавайте перевагу наявним бібліотекам стеку й нативним утилітам замість додавання нових пакетів.',
    },
    rationale: {
      en: 'Reduces dependency bloat, security audit overhead, and build complexity.',
      uk: 'Зменшує розростання залежностей, навантаження на безпековий аудит і складність збірки.',
    },
    citations: [bestPracticesDoc],
  },
  {
    id: 'assumptions-boundary',
    title: {
      en: 'Stop points and explicit questions',
      uk: 'Точки зупинки та явні запитання',
    },
    description: {
      en: 'Stop and ask the human owner when product requirements, data formats, or account boundaries are ambiguous.',
      uk: 'Зупиняйтеся й запитуйте власника продукту, якщо вимоги, формати даних або межі акаунтів неоднозначні.',
    },
    rationale: {
      en: 'Hallucinated business rules cause expensive rollbacks; explicit stops keep human oversight active.',
      uk: 'Вигадані бізнес-правила ведуть до дорогих відкатів; явні зупинки зберігають людський контроль.',
    },
    citations: [promptEngDoc],
  },
] as const;

export function getClaudeMdRule(id: string): ClaudeMdRule | undefined {
  return CLAUDE_MD_RULES.find((rule) => rule.id === id);
}
