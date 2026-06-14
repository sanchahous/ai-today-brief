/** Source endpoints: HN search queries, Reddit subs, and RSS fallback feeds. */

/** HN Algolia queries skew to AI/dev so the candidate pool is on-niche. */
export const HN_QUERIES = [
  'Claude Code',
  'Cursor',
  'Codex',
  'Gemini',
  'AI agent',
  'MCP server',
  'prompt engineering',
  'open source LLM',
  'LLM',
  'OpenAI',
  'Anthropic',
] as const;

export const REDDIT_URLS = [
  'https://www.reddit.com/r/MachineLearning/top.json?t=day&limit=20',
  'https://www.reddit.com/r/LocalLLaMA/top.json?t=day&limit=20',
  'https://www.reddit.com/r/ClaudeAI/top.json?t=day&limit=20',
  'https://www.reddit.com/r/cursor/top.json?t=day&limit=20',
  'https://www.reddit.com/r/ChatGPTCoding/top.json?t=day&limit=20',
  'https://www.reddit.com/r/AI_Agents/top.json?t=day&limit=15',
  'https://www.reddit.com/r/LLMDevs/top.json?t=day&limit=15',
] as const;

// Reddit blocks generic User-Agents — keep a real, identifiable one.
export const REDDIT_USER_AGENT = 'ai-today-brief/1.0 (daily AI/dev brief pipeline)';

/**
 * Bluesky public AppView search — live dev-community discussion (X/Threads
 * conversations increasingly mirror here, and this API is open and free).
 * Only posts that LINK OUT are kept (analog of skipping Reddit self-posts).
 */
export const BLUESKY_QUERIES = [
  'Claude Code',
  'MCP server',
  'Cursor IDE',
  'AI agent',
  'LLM',
] as const;

/**
 * RSS feeds — first-party lab blogs + quality media, fetched as a primary
 * source. Names are the canonical publication labels (see `source-names.ts`)
 * so feed items merge with the same outlet arriving via InBrief.
 */
export const RSS_FEEDS = [
  // Anthropic removed: both /rss.xml and /news/rss.xml now 404 — they no longer
  // publish a public feed. Anthropic news still enters via the HN "Anthropic"
  // query + InBrief. Re-add here if a working feed URL surfaces.
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/' },
  { name: 'DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml' },
  { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'VentureBeat', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed',
  },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
] as const;

/** InBrief.info public Supabase (anon/publishable key — safe to commit). */
export const INBRIEF_SUPABASE_URL = 'https://opukcugqedzruywpqufn.supabase.co';
export const INBRIEF_ANON_KEY = 'sb_publishable_ngFODm_XaHRNodAPXeQg_A_GR_GKwyF';
