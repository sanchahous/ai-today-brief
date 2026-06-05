/**
 * Two deterministic classifiers for a headline:
 *
 *   detectTopic     → a fine-grained product/tech tag (claude, cursor, mcp, …).
 *                     Used only as a diversity guard so one pool isn't five
 *                     Claude stories (select.ts caps items per topic).
 *   categoryForTitle → one of the nine product categories (the `categories`
 *                      taxonomy / `brief_items.category_slug` FK). The LLM
 *                      editor may override this; it's the deterministic default.
 *
 * Order matters in both: the first matching pattern wins, so specific products
 * sit ahead of the generic buckets.
 */

export const GENERAL_TOPIC = 'general';

const TOPIC_PATTERNS: Array<[RegExp, string]> = [
  [/\b(claude code|claude-code|claude|anthropic)\b/i, 'claude'],
  [/\b(cursor)\b/i, 'cursor'],
  [/\b(codex)\b/i, 'codex'],
  [/\b(copilot)\b/i, 'copilot'],
  [/\b(windsurf|cline|aider|continue\.dev|zed)\b/i, 'ai-ide'],
  [/\b(gemini|google deepmind|deepmind)\b/i, 'gemini'],
  [/\b(chatgpt|gpt-?[0-9]|openai|sora|o[0-9]\b)\b/i, 'openai'],
  [/\b(llama|meta ai)\b/i, 'llama'],
  [/\b(deepseek)\b/i, 'deepseek'],
  [/\b(mistral|mixtral)\b/i, 'mistral'],
  [/\b(grok|xai|x\.ai)\b/i, 'grok'],
  [/\b(qwen|kimi|glm|yi-)\b/i, 'cn-models'],
  [/\b(mcp|model context protocol)\b/i, 'mcp'],
  [/\b(agent|agentic|multi-agent)\b/i, 'agents'],
  [/\b(ollama|llama\.cpp|gguf|local(ly)? (run|host)|self-host)\b/i, 'local-llm'],
  [/\b(midjourney|stable diffusion|flux|runway|veo|image gen|video gen)\b/i, 'media-gen'],
  [/\b(token|prompt cach|context window|inference cost)\b/i, 'optimization'],
];

export function detectTopic(title: string): string {
  for (const [re, tag] of TOPIC_PATTERNS) {
    if (re.test(title)) return tag;
  }
  return GENERAL_TOPIC;
}

// ─── Product categories (the `categories` taxonomy) ──────────────────────────

export const CATEGORY_SLUGS = [
  'tools-and-releases',
  'tutorials-and-guides',
  'optimization',
  'agents-and-mcp',
  'vibe-coding',
  'creative-ai',
  'local-llms',
  'career-and-money',
  'models-and-research',
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const DEFAULT_CATEGORY: CategorySlug = 'tools-and-releases';

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORY_SLUGS);

/** Narrow an arbitrary string (e.g. an LLM-chosen slug) to a known category. */
export function isCategorySlug(value: unknown): value is CategorySlug {
  return typeof value === 'string' && CATEGORY_SET.has(value);
}

const CATEGORY_PATTERNS: Array<[RegExp, CategorySlug]> = [
  [/\bvibe[- ]?cod/i, 'vibe-coding'],
  // Money/career intent outranks a generic "how to" so "how to monetize …" is
  // career-and-money, not a tutorial.
  [
    /\b(monetiz|\bearn\b|income|side[- ]?hustle|freelance|micro[- ]?saas|\bsaas\b|salary|hir(e|ing)|career|\bjobs?\b|grant|certif|free (tier|credit|course))\b/i,
    'career-and-money',
  ],
  [
    /\b(tutorial|guide|how[- ]?to|walkthrough|playbook|step[- ]by[- ]step|getting started|cheat[- ]?sheet|build (a|an|your))\b/i,
    'tutorials-and-guides',
  ],
  [/\b(mcp|model context protocol|agent|agentic|multi-agent|tool[- ]use|orchestrat)\b/i, 'agents-and-mcp'],
  [
    /\b(token(s)?|prompt cach|context window|inference cost|latency|throughput|quantiz|cost (cut|reduc|optim|saving)|speed[- ]?up)\b/i,
    'optimization',
  ],
  [/\b(ollama|llama\.cpp|gguf|local(ly)? (run|host|llm)|self[- ]host|on[- ]device|on[- ]prem)\b/i, 'local-llms'],
  [
    /\b(midjourney|stable diffusion|flux|runway|veo|sora|image gen|video gen|text[- ]to[- ](image|video|speech)|tts|voice clon|music gen)\b/i,
    'creative-ai',
  ],
  [
    /\b(benchmark|arxiv|\bpaper\b|research|model card|fine[- ]?tun|training run|dataset|sota|state[- ]of[- ]the[- ]art|eval(uation)?s?)\b/i,
    'models-and-research',
  ],
];

export function categoryForTitle(title: string): CategorySlug {
  for (const [re, slug] of CATEGORY_PATTERNS) {
    if (re.test(title)) return slug;
  }
  return DEFAULT_CATEGORY;
}
