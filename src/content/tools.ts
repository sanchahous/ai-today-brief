import type { Lang } from '@/lib/site';
import { PROMPT_LINT_CITATIONS, PROMPT_LINT_RULES } from '@/lib/prompt-lint-rules';
import { SETTINGS_BUILDER_CITATIONS, SETTINGS_BUILDER_RULES } from '@/lib/settings-builder-rules';
import { CLAUDE_MD_CITATIONS, CLAUDE_MD_RULES } from '@/lib/claude-md-rules';

export type ToolSlug = 'prompt-optimizer' | 'settings-builder' | 'claude-md-generator';

export interface ToolContent {
  slug: ToolSlug;
  title: Record<Lang, string>;
  shortTitle?: Record<Lang, string>;
  fullTitle?: Record<Lang, string>;
  description: Record<Lang, string>;
  lede: Record<Lang, string>;
  lastVerified: string;
  status: 'live' | 'coming-soon';
  output: Record<Lang, string>;
  rulesCount: number;
  citationsCount: number;
  href: (lang: Lang) => string;
}

export const TOOLS: readonly ToolContent[] = [
  {
    slug: 'prompt-optimizer',
    title: {
      en: 'Free Prompt Optimizer for Claude (Fable 5)',
      uk: 'Безкоштовний оптимізатор промптів для Claude (Fable 5)',
    },
    shortTitle: {
      en: 'Prompt Optimizer',
      uk: 'Оптимізатор промптів',
    },
    fullTitle: {
      en: 'Free Prompt Optimizer for Claude (Fable 5)',
      uk: 'Безкоштовний оптимізатор промптів для Claude (Fable 5)',
    },
    description: {
      en: 'A local, citation-backed prompt linter for Claude Fable 5, Sonnet 4.6, Haiku 4.5, and Opus 4.8.',
      uk: 'Локальний лінтер промптів із цитатами для Claude Fable 5, Sonnet 4.6, Haiku 4.5 та Opus 4.8.',
    },
    lede: {
      en: 'Paste a prompt, choose where you will run it, and get deterministic suggestions grounded in official Claude prompting guidance. Your prompt text never leaves this browser.',
      uk: 'Вставте промпт, виберіть де запускатимете його, і отримайте детерміновані поради з офіційного гайда Claude. Текст промпта не залишає браузер.',
    },
    output: {
      en: 'Findings · model advice',
      uk: 'Знахідки · поради щодо моделі',
    },
    rulesCount: PROMPT_LINT_RULES.length,
    citationsCount: PROMPT_LINT_CITATIONS.length,
    lastVerified: '2026-06-11',
    status: 'live',
    href: (lang) => `/${lang}/tools/prompt-optimizer`,
  },
  {
    slug: 'settings-builder',
    title: {
      en: 'Free Claude Code settings.json Builder — Permissions & Hooks',
      uk: 'Безкоштовний білдер settings.json для Claude Code — permissions і hooks',
    },
    shortTitle: {
      en: 'settings.json Builder',
      uk: 'Білдер settings.json',
    },
    fullTitle: {
      en: 'Free Claude Code settings.json Builder — Permissions & Hooks',
      uk: 'Безкоштовний білдер settings.json для Claude Code — permissions і hooks',
    },
    description: {
      en: 'A local-first builder for Claude Code permissions, hooks, model, and MCP settings, backed by official Claude Code documentation.',
      uk: 'Локальний генератор налаштувань Claude Code для permissions, hooks, model і MCP, підкріплений офіційною документацією Claude Code.',
    },
    lede: {
      en: 'Choose the guardrails your project needs and produce deterministic settings.json scaffolding without sending repository details to a server.',
      uk: 'Оберіть guardrails для проєкту й отримайте детермінований settings.json scaffold без надсилання деталей репозиторію на сервер.',
    },
    output: {
      en: 'settings.json',
      uk: 'settings.json',
    },
    rulesCount: SETTINGS_BUILDER_RULES.length,
    citationsCount: SETTINGS_BUILDER_CITATIONS.length,
    lastVerified: '2026-07-16',
    status: 'live',
    href: (lang) => `/${lang}/tools/settings-builder`,
  },
  {
    slug: 'claude-md-generator',
    title: {
      en: 'CLAUDE.md / AGENTS.md Generator',
      uk: 'Генератор CLAUDE.md / AGENTS.md',
    },
    shortTitle: {
      en: 'CLAUDE.md / AGENTS.md Generator',
      uk: 'Генератор CLAUDE.md / AGENTS.md',
    },
    fullTitle: {
      en: 'CLAUDE.md / AGENTS.md Generator',
      uk: 'Генератор CLAUDE.md / AGENTS.md',
    },
    description: {
      en: 'A citation-backed project-instructions generator that keeps shared AGENTS.md guidance and Claude-specific CLAUDE.md wiring explicit.',
      uk: 'Генератор інструкцій для проєкту з цитатами, який явно розділяє спільні правила AGENTS.md і Claude-specific wiring у CLAUDE.md.',
    },
    lede: {
      en: 'Draft portable agent instructions, choose import or symlink wiring, and lint the result before copying it into your repo.',
      uk: 'Створіть портативні інструкції для агентів, оберіть import або symlink wiring і перевірте результат перед копіюванням у репозиторій.',
    },
    output: {
      en: 'AGENTS.md + CLAUDE.md',
      uk: 'AGENTS.md + CLAUDE.md',
    },
    rulesCount: CLAUDE_MD_RULES.length,
    citationsCount: CLAUDE_MD_CITATIONS.length,
    lastVerified: '2026-07-16',
    status: 'live',
    href: (lang) => `/${lang}/tools/claude-md-generator`,
  },
] as const;

export function getTool(slug: string): ToolContent | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}
