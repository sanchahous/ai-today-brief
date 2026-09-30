import type { Lang } from '@/lib/site';
import type { IconKey } from '@/components/icons';
import type { CategoryTokenKey } from '@/lib/design-system/tokens';

/**
 * Presentation metadata the `categories` table doesn't carry: the per-category
 * glyph and a one-line marketing tagline. Keyed by `slug` (see
 * supabase/migrations/009_seed_categories.sql). Known colours follow theme tokens.
 * Unknown slugs degrade to a neutral glyph + empty tagline so a future
 * category never renders broken.
 */
export interface CategoryMeta {
  icon: IconKey;
  tokenKey: CategoryTokenKey | null;
  tagline: Record<Lang, string>;
  /** Curated facet chips → pre-filled news search (prototype subtopics). */
  subtopics?: string[];
}

const META: Record<string, CategoryMeta> = {
  'tools-and-releases': {
    icon: 'tools',
    tokenKey: 'tools',
    tagline: { en: 'Fresh features in agentic IDEs', uk: 'Свіжі фічі та оновлення agentic IDE' },
    subtopics: ['Claude Code', 'Cursor', 'Copilot', 'Gemini'],
  },
  'tutorials-and-guides': {
    icon: 'tutorials',
    tokenKey: 'tutorials',
    tagline: {
      en: 'Step-by-step playbooks for AI workflows',
      uk: 'Покрокові плейбуки для AI-воркфлоу',
    },
    subtopics: ['Prompt recipes', 'Cheatsheets', 'RAG', 'Fine-tuning'],
  },
  optimization: {
    icon: 'optimization',
    tokenKey: 'cost',
    tagline: { en: 'A smaller LLM bill, same quality', uk: 'Менший LLM-рахунок без втрати якості' },
    subtopics: ['Prompt caching', 'Context window', 'Batching', 'Token budgets'],
  },
  'agents-and-mcp': {
    icon: 'agents',
    tokenKey: 'agents',
    tagline: { en: 'Orchestrating & connecting agents', uk: 'Оркестрація та підключення агентів' },
    subtopics: ['MCP', 'Agent SDK', 'LangChain', 'Multi-agent'],
  },
  'vibe-coding': {
    icon: 'vibe',
    tokenKey: 'vibe',
    tagline: { en: 'Skills, hooks & slash commands', uk: 'Skills, hooks і slash-команди' },
    subtopics: ['Skills', 'Hooks', 'Sub-agents', 'Slash commands'],
  },
  'creative-ai': {
    icon: 'creative',
    tokenKey: 'creative',
    tagline: { en: 'Image, video & audio generation', uk: 'Генерація зображень, відео та аудіо' },
  },
  'local-llms': {
    icon: 'local',
    tokenKey: 'local',
    tagline: { en: 'Self-hosted, privacy-first inference', uk: 'Self-hosted інференс і privacy-first' },
  },
  'career-and-money': {
    icon: 'career',
    tokenKey: 'career',
    tagline: { en: 'Freelance, indie-SaaS & certs', uk: 'Freelance, indie-SaaS і сертифікати' },
  },
  'models-and-research': {
    icon: 'models',
    tokenKey: 'models',
    tagline: { en: 'Releases, benchmarks & research', uk: 'Релізи, бенчмарки та research' },
    subtopics: ['Benchmarks', 'Open models', 'Gemini', 'Long context'],
  },
};

const FALLBACK: CategoryMeta = { icon: 'tools', tokenKey: null, tagline: { en: '', uk: '' } };

/** The six categories promoted on the home page, in curated display order. */
export const TOP_CATEGORY_SLUGS = [
  'tools-and-releases',
  'agents-and-mcp',
  'tutorials-and-guides',
  'vibe-coding',
  'models-and-research',
  'optimization',
] as const;

export function categoryMeta(slug: string | null | undefined): CategoryMeta {
  if (!slug) return FALLBACK;
  return Object.hasOwn(META, slug) ? META[slug] : FALLBACK;
}

/** DB colours are a compatibility fallback only for categories outside the curated mapping. */
export function categoryColor(slug: string | null | undefined, dbColor?: string | null): string {
  const key = categoryMeta(slug).tokenKey;
  return key ? `var(--cat-${key})` : dbColor || 'var(--muted)';
}

/** Dark banner art keeps its Night palette even when the surrounding page is Day. */
export function categoryArtColor(slug: string | null | undefined, dbColor?: string | null): string {
  const key = categoryMeta(slug).tokenKey;
  return key ? `var(--art-${key})` : dbColor || 'var(--art-neutral)';
}
