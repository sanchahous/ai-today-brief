/**
 * Canonical "Topics" for the news discovery facet (AH-4.1, ADR D8).
 *
 * The source is `brief_items.tools_mentioned` — free text written by the
 * pipeline, so the same tool arrives as "Claude Code", "claude-code" or
 * "ClaudeCode". A topic is identified by its `slug`: the lowercase letters and
 * digits of the name with everything else dropped ("claudecode"). Spelling,
 * case, spaces and punctuation therefore never split one tool into two chips,
 * and the slug survives a URL round trip unchanged.
 *
 * Genuinely different names for one thing ("Model Context Protocol" / "MCP")
 * cannot be caught by spelling alone — those live in `ALIAS_GROUPS`. Add a
 * group only when the equivalence is certain: merging two different tools is
 * worse than showing one tool twice.
 */

export interface Topic {
  /** Stable identity used in URLs and matching, e.g. `claudecode`. */
  slug: string;
  /** Display name, e.g. `Claude Code`. */
  name: string;
}

/** Longest slug we accept — anything longer is a sentence, not a tool name. */
export const MAX_TOPIC_SLUG_LENGTH = 64;
/** Upper bound on `topics=` values read from a URL. */
export const MAX_TOPIC_FILTERS = 10;

/** `name` is the canonical display name; `aliases` are other spellings that map to it. */
const ALIAS_GROUPS: readonly { name: string; aliases: readonly string[] }[] = [
  { name: 'MCP', aliases: ['Model Context Protocol'] },
  { name: 'Codex', aliases: ['OpenAI Codex'] },
  { name: 'Claude Opus 4.8', aliases: ['Opus 4.8'] },
  { name: 'Antigravity', aliases: ['Google Antigravity'] },
  { name: 'PostgreSQL', aliases: ['Postgres'] },
  { name: 'VS Code', aliases: ['Visual Studio Code'] },
  { name: 'AWS', aliases: ['Amazon Web Services'] },
];

/**
 * Letters and digits only, lowercased. `+` and `#` are spelled out first so
 * "C++" and "C#" do not both collapse to "c".
 */
export function topicKey(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

const CANONICAL_BY_KEY: ReadonlyMap<string, Topic> = new Map(
  ALIAS_GROUPS.flatMap((group) => {
    const topic: Topic = { slug: topicKey(group.name), name: group.name };
    return [group.name, ...group.aliases].map((spelling) => [topicKey(spelling), topic] as const);
  }),
);

/** `null` for anything that has no usable key (empty, punctuation only, absurdly long). */
export function normalizeTopic(raw: unknown): Topic | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  const slug = topicKey(name);
  if (!slug || slug.length > MAX_TOPIC_SLUG_LENGTH) return null;
  return CANONICAL_BY_KEY.get(slug) ?? { slug, name };
}

/** Distinct topics of one item, in the order the pipeline listed them. */
export function topicsFromTools(tools: readonly string[]): Topic[] {
  const seen = new Set<string>();
  const topics: Topic[] = [];
  for (const tool of tools) {
    const topic = normalizeTopic(tool);
    if (!topic || seen.has(topic.slug)) continue;
    seen.add(topic.slug);
    topics.push(topic);
  }
  return topics;
}

export function topicSlugs(tools: readonly string[]): string[] {
  return topicsFromTools(tools).map((topic) => topic.slug);
}

/**
 * `topics=` values from a URL (comma-separated and/or repeated) → canonical,
 * de-duplicated slugs. Values that do not normalize are dropped.
 */
export function parseTopicParam(values: readonly string[]): string[] {
  const slugs: string[] = [];
  for (const value of values) {
    for (const piece of value.split(',')) {
      const topic = normalizeTopic(piece);
      if (topic && !slugs.includes(topic.slug)) slugs.push(topic.slug);
      if (slugs.length >= MAX_TOPIC_FILTERS) return slugs;
    }
  }
  return slugs;
}

/**
 * Display name per slug across a set of items. Aliased tools have one
 * canonical name; for the rest the most frequent spelling wins, first seen on
 * a tie, so "vLLM" beats a one-off "VLLM".
 */
export function resolveTopicNames(toolLists: Iterable<readonly string[]>): Map<string, string> {
  const spellings = new Map<string, Map<string, number>>();
  for (const tools of toolLists) {
    for (const topic of topicsFromTools(tools)) {
      const bySpelling = spellings.get(topic.slug) ?? new Map<string, number>();
      bySpelling.set(topic.name, (bySpelling.get(topic.name) ?? 0) + 1);
      spellings.set(topic.slug, bySpelling);
    }
  }

  const names = new Map<string, string>();
  for (const [slug, bySpelling] of spellings) {
    let best = '';
    let bestCount = 0;
    for (const [name, count] of bySpelling) {
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    }
    names.set(slug, best);
  }
  return names;
}
