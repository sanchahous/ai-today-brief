/**
 * Same-event identity for weekly research corroboration.
 *
 * Daily rank still clusters only within one fetch run and only by title, so
 * a NVIDIA blog and the Hugging Face model card for the same release never
 * share `cluster_id`. Research packs used to look only at the daily item's
 * citation list — typically the primary URL — and then flagged
 * `no_independent_corroboration`. This module finds other pages already in
 * `articles` that are independently published and look like the same event.
 *
 * Matching is conservative: a shared distinctive identifier (model card,
 * GitHub repo, CVE, digit-bearing slug) or a stored cluster id. Generic
 * tokens such as "qwen3" or "summer-2026" alone are not enough.
 */

import { canonicalPageUrl, pageIdentityKey } from './page-url';
import { hostOf, isDiscussionHost, publisherAuthority } from './source-authority';

/** Minimum length of a digit-bearing slug/title key before it may match. */
export const MIN_STORY_IDENTITY_KEY_LENGTH = 12;

export interface CorpusArticle {
  url: string;
  title: string;
  clusterId: string | null;
}

const SKIP_HF_ROOTS = new Set(['blog', 'papers', 'datasets', 'spaces', 'docs']);
const MAX_CORROBORATION_CANDIDATES = 4;

function normalizeIdentityText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[._]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function pathSegments(url: string): string[] {
  try {
    return new URL(url).pathname.split('/').filter(Boolean);
  } catch {
    return [];
  }
}

function addLongKey(keys: Set<string>, value: string) {
  if (value.length >= MIN_STORY_IDENTITY_KEY_LENGTH) keys.add(value);
}

function addHostedArtifactKeys(keys: Set<string>, url: string) {
  const host = hostOf(url);
  const segments = pathSegments(url);
  if (!host || segments.length < 2) return;
  if (host === 'github.com') {
    keys.add(`gh:${segments[0]!.toLowerCase()}/${segments[1]!.toLowerCase()}`);
    return;
  }
  let org: string | undefined;
  let model: string | undefined;
  if (host === 'huggingface.co' || host.endsWith('.huggingface.co')) {
    org = segments[0];
    model = segments[1];
    if (org && SKIP_HF_ROOTS.has(org)) return;
  } else if (host === 'modelscope.cn' && segments[0] === 'models') {
    org = segments[1];
    model = segments[2];
  }
  if (!org || !model) return;
  const orgKey = normalizeIdentityText(org);
  const modelKey = normalizeIdentityText(model);
  if (orgKey && modelKey) keys.add(`model:${orgKey}/${modelKey}`);
  addLongKey(keys, modelKey);
}

function addCompoundKeys(keys: Set<string>, blob: string) {
  const normalized = normalizeIdentityText(blob);
  if (!normalized) return;
  addLongKey(keys, normalized);
  const matches = normalized.match(/[a-z]{2,}\d[a-z0-9-]{8,}/g);
  if (!matches) return;
  for (const match of matches) addLongKey(keys, match);
}

export function storyIdentityKeys(title: string, url: string): string[] {
  const keys = new Set<string>();
  addHostedArtifactKeys(keys, url);
  const haystack = `${title} ${url}`;
  const cves = haystack.match(/CVE-\d{4}-\d{4,}/gi);
  if (cves) {
    for (const id of cves) keys.add(id.toUpperCase());
  }
  addCompoundKeys(keys, title);
  for (const segment of pathSegments(url)) addCompoundKeys(keys, segment);
  return [...keys];
}

export function identitiesOverlap(left: readonly string[], right: readonly string[]): boolean {
  for (const a of left) {
    for (const b of right) {
      if (a === b) return true;
      if (a.length < MIN_STORY_IDENTITY_KEY_LENGTH || b.length < MIN_STORY_IDENTITY_KEY_LENGTH) {
        continue;
      }
      if (a.includes(b) || b.includes(a)) return true;
    }
  }
  return false;
}

export function isIndependentPublisherUrl(primaryUrl: string, candidateUrl: string): boolean {
  const primaryHost = hostOf(primaryUrl);
  const candidateHost = hostOf(candidateUrl);
  if (!primaryHost || !candidateHost) return false;
  if (isDiscussionHost(candidateHost)) return false;
  if (candidateHost === primaryHost) return false;
  if (candidateHost.endsWith(`.${primaryHost}`)) return false;
  if (primaryHost.endsWith(`.${candidateHost}`)) return false;
  return true;
}

function sameEvent(
  primary: { url: string; title: string; clusterId: string | null },
  candidate: CorpusArticle,
): boolean {
  if (primary.clusterId && candidate.clusterId && primary.clusterId === candidate.clusterId) {
    return true;
  }
  return identitiesOverlap(
    storyIdentityKeys(primary.title, primary.url),
    storyIdentityKeys(candidate.title, candidate.url),
  );
}

function uniqueHttps(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const canonical = canonicalPageUrl(raw);
    if (!canonical?.startsWith('https://')) continue;
    const identity = pageIdentityKey(canonical);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    out.push(canonical);
  }
  return out;
}

/**
 * Independent pages the research pack may fetch, in fetch order: editor-listed
 * citations first, then corpus matches ranked by publisher host trust.
 * Discussion threads and same-host pages never qualify.
 */
export function researchCorroborationCandidates(input: {
  primaryUrl: string;
  primaryTitle: string;
  primaryClusterId?: string | null;
  listedUrls: readonly string[];
  corpus: readonly CorpusArticle[];
}): string[] {
  const primaryCanonical = canonicalPageUrl(input.primaryUrl);
  if (!primaryCanonical) return [];
  const primaryIdentity = pageIdentityKey(primaryCanonical);
  const listed = uniqueHttps(input.listedUrls).filter(
    (url) =>
      pageIdentityKey(url) !== primaryIdentity &&
      isIndependentPublisherUrl(primaryCanonical, url),
  );
  const taken = new Set(listed.flatMap((url) => {
    const identity = pageIdentityKey(url);
    return identity ? [identity] : [];
  }));
  if (primaryIdentity) taken.add(primaryIdentity);

  const primary = {
    url: primaryCanonical,
    title: input.primaryTitle,
    clusterId: input.primaryClusterId ?? null,
  };
  const corpusHits: CorpusArticle[] = [];
  for (const article of input.corpus) {
    const identity = pageIdentityKey(article.url);
    if (!identity || taken.has(identity)) continue;
    if (!isIndependentPublisherUrl(primaryCanonical, article.url)) continue;
    if (!sameEvent(primary, article)) continue;
    corpusHits.push(article);
  }
  corpusHits.sort(
    (left, right) => publisherAuthority('', right.url) - publisherAuthority('', left.url),
  );

  const corpusUrls: string[] = [];
  for (const url of uniqueHttps(corpusHits.map((article) => article.url))) {
    const identity = pageIdentityKey(url);
    if (!identity || taken.has(identity)) continue;
    taken.add(identity);
    corpusUrls.push(url);
  }
  return [...listed, ...corpusUrls].slice(0, MAX_CORROBORATION_CANDIDATES);
}

/** Inclusive start, exclusive end, padded ± a few days around the digest week. */
export function corroborationWindow(
  weekStart: string,
  weekEnd: string,
): { from: string; toExclusive: string } {
  const from = new Date(`${weekStart}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 3);
  const to = new Date(`${weekEnd}T00:00:00.000Z`);
  to.setUTCDate(to.getUTCDate() + 4);
  return { from: from.toISOString(), toExclusive: to.toISOString() };
}
