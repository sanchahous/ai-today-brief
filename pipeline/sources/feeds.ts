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

/**
 * "Show HN" launch lane — the highest-actionability HN slice ("someone shipped a
 * thing you can try today"), which the `tags=story` query alone misses. Queried
 * narrowly so the pool stays on-niche; a points floor in the fetcher drops the
 * 1-point unranked launches.
 */
export const HN_SHOW_HN_QUERIES = ['AI', 'LLM', 'agent', 'MCP'] as const;

// Dev/AI subreddits read top-of-day (50 posts each) as a read-only discovery
// signal. ~15 reads × 3 runs ≈ 48/day — a tiny fraction of the free OAuth limit
// (~100 req/MINUTE), so the list can grow freely. Add a subreddit = add a name.
export const REDDIT_SUBREDDITS = [
  'MachineLearning',
  'LocalLLaMA',
  'ClaudeAI',
  'cursor',
  'ChatGPTCoding',
  'AI_Agents',
  'LLMDevs',
  'OpenAI',
  'StableDiffusion',
  'comfyui',
  'PromptEngineering',
  'artificial',
  'singularity',
  'Ollama',
  'aivideo',
] as const;

export const REDDIT_URLS = REDDIT_SUBREDDITS.map(
  (sub) => `https://www.reddit.com/r/${sub}/top.json?t=day&limit=50`,
);

// Reddit requires an accurate, descriptive User-Agent with a Reddit username as
// contact. `fetchReddit` stays disabled if the username or approval gate is absent.
const REDDIT_OWNER = process.env.REDDIT_USERNAME?.trim().replace(/^\/?u\//i, '');
export const REDDIT_USER_AGENT = `web:ai-today-brief:1.1 (by /u/${REDDIT_OWNER || 'unset'})`;

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
  // Smol AI "AINews": a weekday recap machine-aggregated from 12 dev subreddits
  // (r/LocalLLaMA, r/ClaudeAI, r/StableDiffusion…), AI Discords and 500+ X
  // accounts — the closest open re-aggregation of the lost Reddit signal. Open,
  // CI-safe RSS; the parser keeps only {title, link, pubDate} so the ~2MB digest
  // body is never stored. One digest item/day — a discovery/lead pointer.
  { name: 'AINews', url: 'https://news.smol.ai/rss.xml' },
] as const;

// Polite identifier for open community APIs (Lobsters, Mastodon) that have no
// formal API key but ask automated clients to identify themselves.
export const BUILDER_USER_AGENT = 'ai-today-brief/1.0 (+https://aitodaybrief.com)';

/**
 * Lobsters — open, BSD-licensed HN-cousin where engineers submit, upvote and
 * discuss tools and releases. The per-tag JSON exposes score + comment_count (a
 * Reddit-shaped engagement signal) and serves cleanly to datacenter IPs, unlike
 * Reddit's *.json. "vibecoding" maps to the Claude-Code/Cursor reader; the two
 * tags don't overlap, so we pull both. Discovery/ranking signal only — we link
 * out to the original article, never republish (robots.txt sets ai-input=no).
 */
export const LOBSTERS_TAGS = ['ai', 'vibecoding'] as const;
export const lobstersTagUrl = (tag: string): string => `https://lobste.rs/t/${tag}.json`;

/**
 * Mastodon (fediverse) — open public hashtag timelines, no auth (300 req/5min
 * per IP), CI-safe. Instance choice IS the curation: AI/dev-heavy instances
 * crossed with practical tags. Each status carries a card{url,title} outbound
 * link + favourites/reblogs counts → the same engagement lane Bluesky uses.
 * Instances that disable unauthenticated API access just 401 and are skipped.
 */
export const MASTODON_INSTANCES = [
  'mastodon.social',
  'fosstodon.org',
  'sigmoid.social',
  'hachyderm.io',
] as const;
export const MASTODON_TAGS = ['LLM', 'MCP', 'AIagents', 'LocalLLM', 'Claude', 'Cursor'] as const;
export const mastodonTagUrl = (instance: string, tag: string): string =>
  `https://${instance}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=40`;

/** InBrief.info public Supabase (anon/publishable key — safe to commit). */
export const INBRIEF_SUPABASE_URL = 'https://opukcugqedzruywpqufn.supabase.co';
export const INBRIEF_ANON_KEY = 'sb_publishable_ngFODm_XaHRNodAPXeQg_A_GR_GKwyF';
