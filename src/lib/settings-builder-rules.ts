import type { Lang } from './site';

export type RuleEffect = 'allow' | 'deny' | 'ask';
export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'plan'
  | 'auto'
  | 'dontAsk'
  | 'bypassPermissions';
export type SettingsScope = 'managed' | 'user' | 'project' | 'local';
export type RuleTool = 'Bash' | 'Read' | 'Edit' | 'Write' | 'WebFetch' | 'Agent' | 'MCP';
export type HookEvent =
  | 'SessionStart'
  | 'SessionEnd'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'PermissionRequest'
  | 'Stop'
  | 'StopFailure'
  | 'FileChanged'
  | 'ConfigChange'
  | 'PreCompact'
  | 'Notification'
  | 'SubagentStop'
  | 'CwdChanged';
export type HookType = 'command' | 'http' | 'mcp_tool' | 'prompt' | 'agent';
export type RecipeTag =
  | 'format'
  | 'lint'
  | 'safety'
  | 'secret-scan'
  | 'notify'
  | 'context'
  | 'audit'
  | 'env'
  | 'quality';
export type Severity = 'critical' | 'warning' | 'info';

export interface Citation {
  label: string;
  url: string;
  quote: Partial<Record<Lang, string>>;
}

export interface PermissionTemplate {
  id: string;
  effect: RuleEffect;
  tool: RuleTool;
  rule: string;
  title: Record<Lang, string>;
  rationale: Record<Lang, string>;
  severity: Severity;
  citations: readonly Citation[];
}

export interface HookRecipe {
  id: string;
  event: HookEvent;
  matcher: string;
  hookType: HookType;
  command?: string;
  prompt?: string;
  model?: string;
  tags: readonly RecipeTag[];
  title: Record<Lang, string>;
  useCase: Record<Lang, string>;
  caveat: Record<Lang, string>;
  severity: Severity;
  experimental?: boolean;
  citations: readonly Citation[];
}

export interface GrammarRow {
  pattern: string;
  meaning: Record<Lang, string>;
  citations: readonly Citation[];
}

export interface ScopeRow {
  scope: SettingsScope | 'cli';
  path: string;
  precedence: number;
  note: Record<Lang, string>;
  citations: readonly Citation[];
}

export const PERMISSION_MODES: readonly PermissionMode[] = [
  'default',
  'acceptEdits',
  'plan',
  'auto',
  'dontAsk',
  'bypassPermissions',
] as const;

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

const settingsCitation: Citation = {
  label: 'Claude Code settings',
  url: 'https://docs.anthropic.com/en/docs/claude-code/settings',
  quote: {
    en: 'settings.json is the official mechanism for configuring Claude Code through hierarchical settings; effortLevel accepts low, medium, high, or xhigh.',
    uk: 'settings.json — офіційний механізм налаштування Claude Code через ієрархічні settings; effortLevel приймає low, medium, high або xhigh.',
  },
};

const permissionsCitation: Citation = {
  label: 'Claude Code permissions',
  url: 'https://code.claude.com/docs/en/permissions',
  quote: {
    en: 'Set the defaultMode in your settings files; deny rules are evaluated before ask and allow rules.',
    uk: 'defaultMode задається у settings files; deny-правила оцінюються перед ask та allow.',
  },
};

const permissionModesCitation: Citation = {
  label: 'Claude Code permission modes',
  url: 'https://code.claude.com/docs/en/permission-modes',
  quote: {
    en: 'To make plan mode the default for a project, set defaultMode in .claude/settings.json under permissions.',
    uk: 'Щоб зробити plan режимом за замовчуванням для проєкту, задайте defaultMode у .claude/settings.json всередині permissions.',
  },
};

const hooksCitation: Citation = {
  label: 'Claude Code hooks reference',
  url: 'https://docs.anthropic.com/en/docs/claude-code/hooks',
  quote: {
    en: 'Hooks are defined in JSON settings files and include events such as PreToolUse, PostToolUse, Stop, Notification, and SubagentStop.',
    uk: 'Hooks визначаються у JSON settings files і включають події PreToolUse, PostToolUse, Stop, Notification та SubagentStop.',
  },
};

const cliCitation: Citation = {
  label: 'Claude Code CLI reference',
  url: 'https://docs.anthropic.com/en/docs/claude-code/cli-reference',
  quote: {
    en: 'To persist additional working directories across sessions, set permissions.additionalDirectories in settings.',
    uk: 'Щоб зберегти додаткові робочі директорії між сесіями, задайте permissions.additionalDirectories у settings.',
  },
};

export const PERMISSION_TEMPLATES: readonly PermissionTemplate[] = [
  {
    id: 'deny-rm-rf',
    effect: 'deny',
    tool: 'Bash',
    rule: 'Bash(rm -rf *)',
    title: { en: 'Block recursive forced deletes', uk: 'Блокувати рекурсивне force-delete' },
    rationale: {
      en: 'Adds an explicit guardrail for destructive shell commands while keeping safer Bash commands configurable separately.',
      uk: 'Додає явний guardrail для руйнівних shell-команд, залишаючи безпечніші Bash-команди окремо налаштовуваними.',
    },
    severity: 'critical',
    citations: [permissionsCitation],
  },
  {
    id: 'protect-env-read',
    effect: 'deny',
    tool: 'Read',
    rule: 'Read(./.env*)',
    title: { en: 'Block local env reads', uk: 'Блокувати читання локальних .env' },
    rationale: {
      en: 'Prevents accidental exposure of secrets stored in common environment files.',
      uk: 'Запобігає випадковому розкриттю секретів у типових environment-файлах.',
    },
    severity: 'critical',
    citations: [settingsCitation, permissionsCitation],
  },
  {
    id: 'protect-env-edit',
    effect: 'ask',
    tool: 'Edit',
    rule: 'Edit(./.env*)',
    title: { en: 'Ask before env edits', uk: 'Питати перед редагуванням .env' },
    rationale: {
      en: 'Forces a human confirmation before changes to sensitive local configuration.',
      uk: 'Вимагає людського підтвердження перед змінами чутливої локальної конфігурації.',
    },
    severity: 'warning',
    citations: [permissionsCitation],
  },
  {
    id: 'allow-package-tests',
    effect: 'allow',
    tool: 'Bash',
    rule: 'Bash(npm run test *)',
    title: { en: 'Allow package tests', uk: 'Дозволити package-тести' },
    rationale: {
      en: 'Pre-approves repeatable test commands without broadly allowing every shell command.',
      uk: 'Попередньо дозволяє повторювані test-команди без широкого дозволу всіх shell-команд.',
    },
    severity: 'info',
    citations: [permissionsCitation],
  },
  {
    id: 'ask-github-webfetch',
    effect: 'ask',
    tool: 'WebFetch',
    rule: 'WebFetch(domain:github.com)',
    title: { en: 'Ask before GitHub fetches', uk: 'Питати перед GitHub-запитами' },
    rationale: {
      en: 'Shows domain-scoped WebFetch grammar and keeps outbound network access visible.',
      uk: 'Показує domain-scoped grammar для WebFetch і робить outbound network доступ видимим.',
    },
    severity: 'info',
    citations: [permissionsCitation],
  },
] as const;

export const HOOK_RECIPES: readonly HookRecipe[] = [
  {
    id: 'format-on-write-prettier',
    event: 'PostToolUse',
    matcher: 'Edit|Write',
    hookType: 'command',
    command: 'npx prettier --write "$CLAUDE_FILE_PATH"',
    tags: ['format', 'quality'],
    title: { en: 'Format edited files with Prettier', uk: 'Форматувати змінені файли Prettier-ом' },
    useCase: {
      en: 'Run project formatting after file write/edit tools complete.',
      uk: 'Запускати форматування проєкту після завершення write/edit tools.',
    },
    caveat: {
      en: 'Keep command hooks deterministic and repository-local; review before enabling on large files.',
      uk: 'Тримайте command hooks детермінованими й локальними до репозиторію; перевірте перед увімкненням на великих файлах.',
    },
    severity: 'info',
    citations: [hooksCitation],
  },
  {
    id: 'lint-after-write',
    event: 'PostToolUse',
    matcher: 'Edit|Write',
    hookType: 'command',
    command: 'npm run lint -- --fix=false',
    tags: ['lint', 'quality'],
    title: { en: 'Lint after edits', uk: 'Лінт після редагувань' },
    useCase: {
      en: 'Surface lint failures quickly after code changes.',
      uk: 'Швидко показувати lint-помилки після змін коду.',
    },
    caveat: {
      en: 'Prefer fast linters here; long suites should run manually or in CI.',
      uk: 'Краще використовувати швидкі лінтери; довгі suite-и запускайте вручну або в CI.',
    },
    severity: 'warning',
    citations: [hooksCitation],
  },
  {
    id: 'secret-scan-before-bash',
    event: 'PreToolUse',
    matcher: 'Bash',
    hookType: 'command',
    command: 'node scripts/check-command-for-secrets.mjs',
    tags: ['secret-scan', 'safety'],
    title: { en: 'Screen Bash commands for secret patterns', uk: 'Перевіряти Bash-команди на secret patterns' },
    useCase: {
      en: 'Add a local safety check before shell commands execute.',
      uk: 'Додати локальну safety-перевірку перед виконанням shell-команд.',
    },
    caveat: {
      en: 'Example command is a placeholder; wire it to a reviewed local script before use.',
      uk: 'Команда-приклад є placeholder; підключіть її до перевіреного локального скрипта перед використанням.',
    },
    severity: 'critical',
    citations: [hooksCitation, permissionsCitation],
  },
  {
    id: 'notify-on-stop',
    event: 'Stop',
    matcher: '',
    hookType: 'command',
    command: 'printf "Claude Code session stopped\\n"',
    tags: ['notify'],
    title: { en: 'Notify when a session stops', uk: 'Сповіщати про завершення сесії' },
    useCase: {
      en: 'Emit a lightweight notification for long-running sessions.',
      uk: 'Виводити легке сповіщення для довгих сесій.',
    },
    caveat: {
      en: 'Replace printf with your OS notifier or chat webhook only after reviewing privacy impact.',
      uk: 'Замініть printf на OS notifier або chat webhook лише після privacy review.',
    },
    severity: 'info',
    citations: [hooksCitation],
  },
  {
    id: 'capture-user-prompt-audit',
    event: 'UserPromptSubmit',
    matcher: '',
    hookType: 'command',
    command: 'node scripts/audit-prompt-metadata.mjs',
    tags: ['audit', 'context'],
    title: { en: 'Audit prompt metadata', uk: 'Аудит metadata промпта' },
    useCase: {
      en: 'Record prompt metadata for internal process audits without storing prompt text.',
      uk: 'Записувати metadata промптів для внутрішнього аудиту без збереження тексту промпта.',
    },
    caveat: {
      en: 'Do not log raw prompts or secrets; keep audit payloads to counts and enums.',
      uk: 'Не логуйте сирі промпти чи секрети; обмежте audit payloads лічильниками та enum-ами.',
    },
    severity: 'warning',
    citations: [hooksCitation],
  },
  {
    id: 'env-check-session-start',
    event: 'SessionStart',
    matcher: '',
    hookType: 'command',
    command: 'node scripts/check-claude-env.mjs',
    tags: ['env', 'quality'],
    title: { en: 'Check environment on session start', uk: 'Перевіряти environment на старті сесії' },
    useCase: {
      en: 'Warn early when project prerequisites are missing.',
      uk: 'Попереджати на старті, коли бракує prerequisites проєкту.',
    },
    caveat: {
      en: 'Keep startup hooks fast so opening Claude Code stays responsive.',
      uk: 'Тримайте startup hooks швидкими, щоб Claude Code відкривався без затримок.',
    },
    severity: 'info',
    citations: [hooksCitation, settingsCitation],
  },
] as const;

export const GRAMMAR_REFERENCE: readonly GrammarRow[] = [
  {
    pattern: 'Bash(npm run test *)',
    meaning: {
      en: 'Allow, deny, or ask for matching shell commands with Bash wildcards.',
      uk: 'Allow, deny або ask для shell-команд, що матчаться Bash wildcards.',
    },
    citations: [permissionsCitation],
  },
  {
    pattern: 'Bash',
    meaning: {
      en: 'Bare tool rules affect the whole tool; scoped rules affect only matching calls.',
      uk: 'Bare tool rules впливають на весь tool; scoped rules — лише на відповідні виклики.',
    },
    citations: [permissionsCitation],
  },
  {
    pattern: 'Read(./src/**)',
    meaning: {
      en: 'Project-relative file anchor for repository paths.',
      uk: 'Project-relative file anchor для шляхів у репозиторії.',
    },
    citations: [permissionsCitation],
  },
  {
    pattern: 'Read(~/notes/**)',
    meaning: {
      en: 'Home-relative file anchor for user-local paths.',
      uk: 'Home-relative file anchor для користувацьких локальних шляхів.',
    },
    citations: [permissionsCitation],
  },
  {
    pattern: 'Read(/var/log/**)',
    meaning: {
      en: 'Absolute path anchor for machine paths.',
      uk: 'Absolute path anchor для шляхів машини.',
    },
    citations: [permissionsCitation],
  },
  {
    pattern: 'Read(//server/share/**)',
    meaning: {
      en: 'Double-slash anchor for network-style roots where supported by the host.',
      uk: 'Double-slash anchor для network-style roots, якщо це підтримує host.',
    },
    citations: [permissionsCitation],
  },
  {
    pattern: 'WebFetch(domain:github.com)',
    meaning: {
      en: 'Domain-scoped network access rule for WebFetch.',
      uk: 'Domain-scoped правило мережевого доступу для WebFetch.',
    },
    citations: [permissionsCitation],
  },
  {
    pattern: 'mcp__github__create_issue',
    meaning: {
      en: 'MCP tool permission pattern for server and tool names.',
      uk: 'MCP tool permission pattern для назв server і tool.',
    },
    citations: [permissionsCitation],
  },
  {
    pattern: 'Agent(Review)',
    meaning: {
      en: 'Agent-scoped pattern for named subagents.',
      uk: 'Agent-scoped pattern для named subagents.',
    },
    citations: [permissionsCitation],
  },
] as const;

export const SCOPE_HIERARCHY: readonly ScopeRow[] = [
  {
    scope: 'managed',
    path: 'managed-settings.json',
    precedence: 1,
    note: {
      en: 'Organization policy; cannot be overridden by lower levels.',
      uk: 'Політика організації; нижчі рівні її не перевизначають.',
    },
    citations: [settingsCitation, permissionsCitation],
  },
  {
    scope: 'cli',
    path: '--settings / --permission-mode / --add-dir',
    precedence: 2,
    note: {
      en: 'Temporary command-line overrides for one session.',
      uk: 'Тимчасові CLI overrides для однієї сесії.',
    },
    citations: [settingsCitation, cliCitation],
  },
  {
    scope: 'local',
    path: '.claude/settings.local.json',
    precedence: 3,
    note: {
      en: 'Personal project-local overrides; normally gitignored.',
      uk: 'Персональні project-local overrides; зазвичай gitignored.',
    },
    citations: [settingsCitation],
  },
  {
    scope: 'project',
    path: '.claude/settings.json',
    precedence: 4,
    note: {
      en: 'Shared project settings that can be committed for a team.',
      uk: 'Спільні project settings, які можна закомітити для команди.',
    },
    citations: [settingsCitation, permissionModesCitation],
  },
  {
    scope: 'user',
    path: '~/.claude/settings.json',
    precedence: 5,
    note: {
      en: 'User-wide defaults; lowest precedence among persisted settings files.',
      uk: 'User-wide defaults; найнижчий precedence серед persisted settings files.',
    },
    citations: [settingsCitation],
  },
] as const;

export function getRecipe(id: string): HookRecipe | undefined {
  return HOOK_RECIPES.find((recipe) => recipe.id === id);
}

export function getTemplate(id: string): PermissionTemplate | undefined {
  return PERMISSION_TEMPLATES.find((template) => template.id === id);
}
