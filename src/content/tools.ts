import type { Lang } from '@/lib/site';

export interface ToolContent {
  slug: 'prompt-optimizer';
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  lede: Record<Lang, string>;
  lastVerified: string;
  status: 'live' | 'coming-soon';
  href: (lang: Lang) => string;
}

export const TOOLS: readonly ToolContent[] = [
  {
    slug: 'prompt-optimizer',
    title: {
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
    lastVerified: '2026-06-11',
    status: 'live',
    href: (lang) => `/${lang}/tools/prompt-optimizer`,
  },
] as const;

export function getTool(slug: string): ToolContent | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}
