/**
 * Source trust — the feed we found a story in vs. the publisher that wrote it.
 *
 * `articles.source_name` is the FEED name. For aggregator feeds (Hacker News,
 * Lobsters, Mastodon, X) that name says nothing about the linked page: a
 * personal bearblog write-up and an openai.com release note both arrive tagged
 * "Hacker News", so both inherited trust 0.9. Anything that scores "authority"
 * from the feed name alone is therefore scoring the aggregator, not the source.
 *
 * `sourceTrust` (feed-level, unchanged) stays the input of the daily composite
 * in `rank.ts`. `publisherAuthority` is the publisher-level read: it falls back
 * to the destination host whenever the feed is an aggregator. Weekly selection
 * uses it; re-scoring the daily pipeline is a separate decision and is NOT part
 * of this module's job.
 */

// ─── Feed-level trust (input of the daily composite) ─────────────────────────

const SOURCE_TRUST: Array<[RegExp, number]> = [
  [/\b(anthropic|openai|google (research|ai)|deepmind|hugging ?face|meta ai|nvidia)\b/i, 1],
  [/\b(hacker news|simon willison|github|arxiv)\b/i, 0.9],
  // Lobsters: curated, invite-only dev community — HN-cousin signal density.
  [/\blobsters\b/i, 0.85],
  [/\b(ars ?technica|mit tech(nology)?|techcrunch)\b/i, 0.75],
  // AINews (Smol AI): machine-aggregated dev-subreddit/Discord/X recap — a
  // curated lead source, above the neutral default but below first-party media.
  [/\b(reddit|ainews)\b/i, 0.7],
  // The Verge demoted: 33 fetched / 0 published in the first month — reader
  // profile mismatch (consumer angle), not a quality judgement. Mastodon sits in
  // the social tier alongside Bluesky (engagement is a hint, not authority).
  [/\b(venturebeat|marktechpost|youtube|x\.com|twitter|threads|the verge|bluesky|mastodon)\b/i, 0.55],
];

export function sourceTrust(sourceName: string): number {
  for (const [re, w] of SOURCE_TRUST) if (re.test(sourceName)) return w;
  return 0.6;
}

// ─── Aggregators ─────────────────────────────────────────────────────────────

/**
 * Feeds that surface other people's pages. Their own trust reflects how well
 * they filter, which is a discovery signal — it must never transfer to whatever
 * they happened to link to.
 */
const AGGREGATOR_FEED =
  /\b(hacker news|lobsters|reddit|mastodon|bluesky|threads|twitter|x \(twitter\)|youtube|ainews|inbrief|google news)\b/i;

export function isAggregatorFeed(sourceName: string): boolean {
  return AGGREGATOR_FEED.test(sourceName);
}

/**
 * Hosts that carry discussion, not publication. A link back to the HN thread a
 * story was found in is not a second source, so these never count as
 * corroboration and never earn publisher trust.
 */
const DISCUSSION_HOST =
  /^(news\.ycombinator\.com|lobste\.rs|reddit\.com|(x|twitter)\.com|threads\.net|bsky\.app|t\.me|linkedin\.com|youtube\.com|youtu\.be|mastodon\.[a-z.]+|[a-z0-9-]+\.social)$/i;

export function isDiscussionHost(host: string): boolean {
  return DISCUSSION_HOST.test(host);
}

/** Lowercased hostname without `www.`, or `null` when the URL is unusable. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

// ─── Publisher-level trust (destination host) ────────────────────────────────

const HOST_TRUST: Array<[RegExp, number]> = [
  // 1.00 — first-party labs and vendors: the page IS the primary announcement.
  [
    /(^|\.)(openai|anthropic|claude|deepmind|mistral|cohere|nvidia|ibm|microsoft|apple|databricks|scale)\.com$/,
    1,
  ],
  [/(^|\.)(huggingface\.co|blog\.google|ai\.google|research\.google|googleblog\.com)$/, 1],
  [/(^|\.)(deepmind\.google|ai\.meta\.com|stability\.ai|mistral\.ai|qwen\.ai|alibabacloud\.com)$/, 1],
  // 0.90 — peer review, preprints, standards bodies.
  [/(^|\.)(arxiv\.org|openreview\.net|acm\.org|ieee\.org|nature\.com|nist\.gov)$/, 0.9],
  [/\.(edu|ac\.uk)$/, 0.9],
  // 0.85 — code and package hosting: the repo is the primary artifact of a
  // tool release, even though anyone may publish there.
  [/(^|\.)(github\.com|gitlab\.com|codeberg\.org|pypi\.org|npmjs\.com|crates\.io)$/, 0.85],
  // 0.80 — engineering authors and publications with a track record.
  [
    /(^|\.)(simonwillison\.net|danluu\.com|lwn\.net|arstechnica\.com|thepragmaticengineer\.com|martinfowler\.com)$/,
    0.8,
  ],
  // 0.70 — trade press: real reporting, but second-hand by construction.
  [/(^|\.)(techcrunch\.com|technologyreview\.com|wired\.com|zdnet\.com|infoworld\.com)$/, 0.7],
  // 0.55 — consumer tech press, mirroring the feed-level demotions above.
  [/(^|\.)(theverge\.com|venturebeat\.com|marktechpost\.com|businessinsider\.com)$/, 0.55],
  // 0.45 — hosted blog platforms: one person's write-up with no editing layer.
  // The story may still be excellent; it is simply not an institution speaking.
  [
    /(^|\.)(bearblog\.dev|substack\.com|medium\.com|wordpress\.com|blogspot\.com|github\.io|gitlab\.io|hashnode\.dev|dev\.to|notion\.site|gitbook\.io|vercel\.app|netlify\.app|pages\.dev)$/,
    0.45,
  ],
];

/** Trust of a company/product domain we hold no specific opinion about. */
const NEUTRAL_HOST_TRUST = 0.6;
/** A social post or discussion thread is a claim, not a publication. */
const DISCUSSION_HOST_TRUST = 0.35;

/** Publisher trust of a host, or `null` when the host is not in any tier. */
export function hostTrust(host: string): number | null {
  if (isDiscussionHost(host)) return DISCUSSION_HOST_TRUST;
  for (const [re, weight] of HOST_TRUST) if (re.test(host)) return weight;
  return null;
}

/**
 * Trust of whoever actually published the page, in [0, 1].
 *
 * Aggregator feed → the destination host decides, and an unrecognised host gets
 * the neutral tier rather than the aggregator's own (high) trust. Publisher feed
 * → the feed name is authoritative, and a recognised host may only lift it.
 */
export function publisherAuthority(sourceName: string, url: string): number {
  const host = hostOf(url);
  const fromHost = host ? hostTrust(host) : null;
  if (isAggregatorFeed(sourceName)) return fromHost ?? NEUTRAL_HOST_TRUST;
  return Math.max(sourceTrust(sourceName), fromHost ?? 0);
}
