import type { IconKey } from '@/components/icons';

/** Presentation glyph for concept hubs (not stored in DB). */
const ICON_BY_SLUG: Partial<Record<string, IconKey>> = {
  'claude-code': 'agents',
  cursor: 'tools',
  codex: 'tools',
  gemini: 'models',
  'github-copilot': 'tools',
  mcp: 'agents',
  langchain: 'agents',
  rag: 'tutorials',
  'prompt-caching': 'optimization',
  'vibe-coding': 'vibe',
};

export function conceptIcon(slug: string, type: string): IconKey {
  const bySlug = ICON_BY_SLUG[slug];
  if (bySlug) return bySlug;
  if (type === 'protocol' || type === 'pattern') return 'agents';
  if (type === 'model') return 'models';
  return 'tools';
}
