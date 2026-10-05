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
    subtopics: ['SVG', 'Image models', 'Video', 'Audio'],
  },
  'local-llms': {
    icon: 'local',
    tokenKey: 'local',
    tagline: { en: 'Self-hosted, privacy-first inference', uk: 'Self-hosted інференс і privacy-first' },
    subtopics: ['Ollama', 'Quantization', 'GGUF', 'Llama.cpp'],
  },
  'career-and-money': {
    icon: 'career',
    tokenKey: 'career',
    tagline: { en: 'Freelance, indie-SaaS & certs', uk: 'Freelance, indie-SaaS і сертифікати' },
    subtopics: ['Freelance', 'Indie SaaS', 'Certifications', 'Hiring'],
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

/** Map category slugs to a related in-depth guide slug, if one exists. */
export const CATEGORY_RELATED_GUIDE: Record<string, string> = {
  'tools-and-releases': 'claude-code-vs-cursor-vs-codex',
  'agents-and-mcp': 'claude-code-vs-cursor-vs-codex',
  'vibe-coding': 'claude-code-vs-cursor-vs-codex',
  'models-and-research': 'atb-orchestration-bench',
};

export function getRelatedGuideSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return CATEGORY_RELATED_GUIDE[slug] ?? null;
}

/**
 * Filter concepts matching category subtopics (prototype categoryPrimer logic).
 * Falls back to the first up to 3 concepts if no direct match is found.
 */
export function findPrimerConcepts<T extends { slug: string; name: string }>(
  subtopics: readonly string[],
  allConcepts: readonly T[],
  limit = 4,
): T[] {
  if (!allConcepts.length) return [];
  const normalized = subtopics.map((s) => s.toLowerCase().trim()).filter(Boolean);
  const picks = allConcepts.filter((c) => {
    const cName = c.name.toLowerCase();
    const cSlug = c.slug.toLowerCase();
    return normalized.some((s) => {
      const stem = s.endsWith('s') && s.length > 3 ? s.slice(0, -1) : s;
      return (
        cName.includes(s) ||
        s.includes(cName) ||
        cSlug.includes(s) ||
        cName.includes(stem) ||
        cSlug.includes(stem)
      );
    });
  });
  if (picks.length > 0) return picks.slice(0, limit);
  return allConcepts.slice(0, Math.min(3, limit));
}

/**
 * Evaluates whether this category has real, verifiable daily update activity.
 * Per invariant I-6, never claim "updated daily" unless items appear on the
 * latest published brief date and span at least 4 distinct publishing days in
 * the recent 7-day window.
 */
export function isCategoryUpdatedDaily(
  items: readonly { date: string }[],
  latestBriefDate?: string | null,
): boolean {
  if (!items.length || !latestBriefDate) return false;
  if (items[0].date !== latestBriefDate) return false;
  const recentDates = new Set(
    items
      .map((it) => it.date)
      .filter((d) => {
        const diffMs = new Date(latestBriefDate).getTime() - new Date(d).getTime();
        return diffMs >= 0 && diffMs <= 7 * 86400 * 1000;
      }),
  );
  return recentDates.size >= 4;
}
