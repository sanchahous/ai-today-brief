import 'server-only';

import type { PipelineDb } from '../../../pipeline/db';
import { channelNativeCopy } from '@/lib/social/channel-copy';
import { parseCritic } from '@/lib/social/critic';
import {
  assembleInstagramCarouselSpec,
  parseInstagramWriterCandidate,
  readableInstagramParts,
} from '@/lib/social/instagram-carousel';
import { generateSocialJson } from '@/lib/social/llm-router';
import { findBlindCrossPosts, runQualityGate } from '@/lib/social/quality';
import { containsTelegramBold, containsTelegramInlineCode } from '@/lib/social/telegram-format';
import type {
  QualityReport,
  SocialAsset,
  SocialChannel,
  SocialDraft,
  SocialLocale,
} from '@/lib/social/types';
import type { WeeklyMasterBundle } from './content-studio';
import { bannedPhrasesFor, VOICE_EN, VOICE_UK } from './editorial-voice';

export interface WeeklySocialAdaptation extends SocialDraft {
  hookAngle: string;
  hookCandidates: string[];
  writer: {
    provider: 'gemini' | 'openrouter' | 'ollama';
    model: string;
    fallbackUsed: boolean;
    usage: {
      promptTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
    };
  };
}

const CHANNEL_CONTRACT: Record<SocialChannel, string> = {
  telegram:
    'Ukrainian, 900–1600 characters. Separate every block with a blank line; never run blocks together on consecutive lines. Never write <PART>, <SLIDE> or <CAPTION> here — those markers belong to Threads and Instagram; Telegram uses a blank line only. Telegram is the only channel that renders rich text: use **bold** for the one number that matters and `backticks` for tool, flag or command names. Never use these markers on any other channel. Four labeled blocks, each its own blank-line-delimited paragraph, never merged: (1) a strong lead, (2) a block whose first line is Топ 3 / Top 3 with a short consequence for each of the three stories — never dump those three into Радар, (3) a separate block whose first line is Радар / Radar for the remaining signals, (4) a short standalone CTA line with exactly one URL and nothing else — never fold the URL into the closing analysis. At least one block must name a model, tool, endpoint or setting the reader can try this week, the concrete step to try it, and its cost, limit or caveat. One small icon or emoji may head the practical block and the radar block for scannability (stay inside the channel emoji budget); never one per line.',
  facebook:
    'Ukrainian, 700–1400 characters. Blank line between paragraphs. One human narrative line, 2–3 conclusions, one meaningful question and exactly one URL. Name at least one tool, model or setting the reader can act on, with the trade-off that comes with it. One small icon or emoji may head the practical block for scannability; never one per line.',
  threads:
    'Ukrainian sequence of 3–5 messages, each at most 500 characters. Thesis → evidence → what to try → genuine question. Separate messages with <PART>. Put the URL only in the final part. One part must be a concrete thing to try, naming the tool or setting and the step, not a restatement of the news.',
  x: 'English root post, 180–260 characters, one thesis and one strong fact, no URL. The tracked URL goes only in firstComment, and firstComment must carry a second fact or the practical step alongside the link — never a bare URL.',
  linkedin:
    'English, 700–1200 characters. Break lines aggressively: one sentence or short block per line, blank line between blocks, never a single dense paragraph. A self-contained insight for builders/leaders: tension, evidence, judgment, what to do about it, next decision. One block must be a concrete action naming the tool, serving path, flag or setting, plus its cost or limit. At most 3 hashtags. The post body must contain no URL at all; the tracked URL goes in firstComment, which should read as a real first comment rather than a bare link. One small icon or emoji may head the practical-action block for scannability; never one per line.',
  instagram:
    'English hybrid carousel of exactly 7 slides. Inside each candidate write <COVER>headline, three <STORY>headline||body, then <COMPARISON>headline||body, <CAVEAT>headline||body, <TAKEAWAY>headline||body, then <CAPTION>caption. Cover headline ≤72 characters; other headlines ≤54; bodies ≤120. Caption 180–800 characters, no URL, at most 5 hashtags. The takeaway slide must state a concrete action with a named tool, serving path or setting — not a summary of the week.',
};

/**
 * Contract character ranges, shared between candidate ranking and the
 * deterministic blocking check below. Narrower than `CHANNEL_RULES` in
 * `@/lib/social/quality`, which enforces each platform's hard technical limit
 * (e.g. Telegram's 4096-char message cap) — this is the editorial range this
 * writer/critic loop is actually contracted to hit.
 */
const CONTRACT_CHAR_RANGE: Partial<Record<SocialChannel, [number, number]>> = {
  telegram: [900, 1_600],
  facebook: [700, 1_400],
  x: [180, 260],
  linkedin: [700, 1_200],
};

/** Channels whose CHANNEL_CONTRACT explicitly requires a blank line between blocks. */
const REQUIRES_PARAGRAPH_BREAKS: ReadonlySet<SocialChannel> = new Set([
  'telegram',
  'facebook',
  'linkedin',
]);

/** True once the text has at least one real blank-line break, not just a single `\n`. */
function hasParagraphBreaks(text: string) {
  return /\n[ \t]*\n/.test(text.trim());
}

function paragraphBlocks(text: string) {
  return text
    .split(/\n[ \t]*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

/** Length of the longest blank-line-delimited block, for the LinkedIn dense-paragraph check. */
function longestParagraphBlock(text: string) {
  return paragraphBlocks(text).reduce((max, block) => Math.max(max, block.length), 0);
}

/** LinkedIn contract: "never a single dense paragraph." A block over this reads as one. */
const LINKEDIN_MAX_BLOCK_CHARS = 400;

/**
 * Telegram contract names four distinct blocks (lead, Top 3, radar, CTA).
 * A count below this means at least two were merged into one paragraph.
 * Count alone is not enough: a production retry had 4+ paragraphs and still
 * dumped the three lead stories into «📡 Радар» with the URL folded into
 * the closing analysis. Label and CTA checks below catch that shape.
 */
const TELEGRAM_MIN_BLOCKS = 4;

/** A standalone Telegram CTA is one short last line, not a paragraph + URL. */
const TELEGRAM_MAX_CTA_BLOCK_CHARS = 180;

/** Strip a leading emoji/bullet so "📡 Радар" and "• Топ 3" still match. */
function telegramBlockFirstLine(block: string) {
  const firstLine = block.split('\n')[0]?.trim() ?? '';
  return firstLine.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

function isTelegramTop3Block(block: string) {
  // First line may be "Топ 3:", "📡 Top 3", "Головне · Топ 3" — the label
  // does not have to be the very first token after the emoji strip.
  return /(?:топ[\s-]*3|top[\s-]*3)\b/iu.test(telegramBlockFirstLine(block));
}

function isTelegramRadarBlock(block: string) {
  // Ukrainian locative "На радарі" must match; anchoring at ^ missed the
  // live retry that labeled the section that way and still failed the gate.
  return /(?:радар|radar)\b/iu.test(telegramBlockFirstLine(block));
}

function blockHasRadarLabel(block: string) {
  return /(?:^|\s)(?:радар|radar)\b/iu.test(block);
}

function telegramUrlBlockIndex(blocks: string[]) {
  return blocks.findIndex((block) => /https?:\/\//i.test(block));
}

function telegramStructureIssues(candidate: string) {
  const issues: { code: string; message: string; suggestedFix: string }[] = [];
  const blocks = paragraphBlocks(candidate);
  if (blocks.length < TELEGRAM_MIN_BLOCKS) {
    issues.push({
      code: 'telegram_block_structure',
      message: `Only ${blocks.length} blank-line-delimited block(s) found; the contract requires four separate blocks -- lead, Top 3, radar, CTA -- and at least two of them are merged together.`,
      suggestedFix:
        'Split the copy into four separate blank-line-delimited blocks: lead, Top 3, radar, and a standalone CTA with the URL. Never combine two of these into one paragraph.',
    });
  }

  const top3Index = blocks.findIndex(isTelegramTop3Block);
  const radarIndex = blocks.findIndex(isTelegramRadarBlock);
  if (top3Index < 0) {
    issues.push({
      code: 'telegram_top3_block_required',
      message:
        'No blank-line-delimited block starts with Топ 3 / Top 3; the three lead stories were likely folded into another section (often Радар).',
      suggestedFix:
        'Give the three lead stories their own block whose first line is Топ 3, separate from Радар, with a short consequence for each.',
    });
  }

  const top3Block = top3Index >= 0 ? blocks[top3Index] : undefined;
  const mergedOnSameHeading = top3Index >= 0 && radarIndex >= 0 && top3Index === radarIndex;
  const radarLabelInsideTop3 = top3Index >= 0 && radarIndex < 0 && Boolean(top3Block && blockHasRadarLabel(top3Block));
  if (mergedOnSameHeading || radarLabelInsideTop3) {
    issues.push({
      code: 'telegram_top3_radar_merged',
      message:
        'Топ 3 and Радар share one block; the contract requires them as two blank-line-delimited sections.',
      suggestedFix: 'Split Топ 3 and Радар into two blocks separated by a blank line. Do not put the three lead stories under Радар.',
    });
  }

  const urlIndex = telegramUrlBlockIndex(blocks);
  if (urlIndex >= 0) {
    const cta = blocks[urlIndex] ?? '';
    const notLast = urlIndex !== blocks.length - 1;
    const tooLong = cta.length > TELEGRAM_MAX_CTA_BLOCK_CHARS;
    if (notLast || tooLong) {
      issues.push({
        code: 'telegram_cta_merged',
        message: notLast
          ? 'The URL is not in the final block; the CTA must be a short last block of its own.'
          : `The last block is ${cta.length} characters and contains the URL; the CTA is folded into analysis instead of standing alone.`,
        suggestedFix: 'Move the URL into a short last block (one CTA line, no analysis).',
      });
    }
  }
  return issues;
}

/**
 * Mechanically checkable slice of CHANNEL_CONTRACT. A prior incident shipped
 * Telegram copy that was 1700+ characters with no bold span and no backticked
 * tool name; an earlier one shipped Telegram and LinkedIn copy with single
 * `\n` line breaks instead of the required blank line, so blocks visually ran
 * together ("1495 chars, 9 line breaks, 0 blank lines"). In both cases the
 * critic LLM was only asked to *notice* the defect, and noticing is not
 * guaranteed every round, so violations survived all three bounded repair
 * rounds. Checking them in code guarantees every round's repair prompt names
 * the exact defect, instead of depending on the critic catching it by luck.
 */
function channelContractIssues(channel: SocialChannel, candidate: string) {
  const issues: { code: string; message: string; suggestedFix: string }[] = [];
  const range = CONTRACT_CHAR_RANGE[channel];
  if (range && (candidate.length < range[0] || candidate.length > range[1])) {
    issues.push({
      code: 'channel_length',
      message: `${channel} copy must be ${range[0]}–${range[1]} characters counting the tracked URL; found ${candidate.length}.`,
      suggestedFix: `Rewrite so the final text, including the URL, lands inside ${range[0]}–${range[1]} characters.`,
    });
  }
  if (REQUIRES_PARAGRAPH_BREAKS.has(channel) && !hasParagraphBreaks(candidate)) {
    issues.push({
      code: 'paragraph_breaks_required',
      message:
        'No blank line found between blocks; the contract requires a blank line, not a single line break, between every block.',
      suggestedFix: 'Insert a blank line (an empty line) between every block instead of a single line break.',
    });
  }
  if (channel === 'linkedin') {
    const longest = longestParagraphBlock(candidate);
    if (longest > LINKEDIN_MAX_BLOCK_CHARS) {
      issues.push({
        code: 'linkedin_dense_paragraph',
        message: `One block is ${longest} characters with no line break inside it; the contract requires one sentence or short block per line, never a single dense paragraph.`,
        suggestedFix: 'Break that block into shorter one-sentence lines separated by blank lines.',
      });
    }
  }
  if (channel === 'telegram') {
    if (!containsTelegramBold(candidate)) {
      issues.push({
        code: 'telegram_bold_required',
        message: 'No **bold** span found; the contract requires bolding the one number that matters.',
        suggestedFix: 'Wrap the single most important number in **bold**.',
      });
    }
    if (!containsTelegramInlineCode(candidate)) {
      issues.push({
        code: 'telegram_backticks_required',
        message:
          'No `backticked` span found; the contract requires wrapping every tool, flag or command name in backticks.',
        suggestedFix: 'Wrap every tool, flag, endpoint or command name mentioned in the copy in `backticks`.',
      });
    }
    issues.push(...telegramStructureIssues(candidate));
  }
  return issues;
}

export function parseWeeklySocialWriter(raw: string) {
  const match = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!match) throw new SyntaxError('Writer returned no JSON object.');
  const value = JSON.parse(match) as { angle?: unknown; text?: unknown; firstComment?: unknown };
  if (typeof value.angle !== 'string' || !value.angle.trim()) {
    throw new SyntaxError('Writer angle is missing.');
  }
  if (typeof value.text !== 'string' || !value.text.trim()) {
    throw new SyntaxError('Writer text is missing.');
  }
  // Reject empty/unparseable text so the OpenRouter model queue can continue.
  // A single complete `text` body is valid: live writers often omit <CANDIDATE>
  // and returning that as malformed burned the queue, after which later models
  // pasted Threads <PART> markers onto Telegram.
  candidatesFromText(value.text);
  return {
    angle: value.angle.trim(),
    text: value.text.trim(),
    firstComment: typeof value.firstComment === 'string' ? value.firstComment.trim() : null,
  };
}

function candidatesFromText(text: string) {
  const marked = text
    .split(/\n?\s*<CANDIDATE>\s*\n?|\n?\s*CANDIDATE\s+[123]\s*:\s*/i)
    .map((candidate) => candidate.trim())
    .filter(Boolean);
  if (marked.length >= 2) return marked.slice(0, 3);
  const blocks = text
    .split(/\n\s*---\s*\n/)
    .map((candidate) => candidate.trim())
    .filter(Boolean);
  if (blocks.length >= 2) return blocks.slice(0, 3);
  if (marked.length === 1) return marked;
  throw new SyntaxError('Writer text is empty after candidate split.');
}

function unpackCandidate(
  channel: SocialChannel,
  candidate: string,
  firstComment: string | null,
  instagram?: {
    angle: string;
    hookCandidates: [string, string, string];
    storyRevisionItemIds: [string, string, string];
  },
) {
  if (channel === 'threads') {
    const parts = candidate
      .split(/\s*<PART>\s*/i)
      .map((part) => part.trim())
      .filter(Boolean);
    return { text: parts[0] ?? '', contentParts: parts, firstComment: null };
  }
  if (channel === 'instagram') {
    if (!instagram) {
      return { text: '', contentParts: [], firstComment: null };
    }
    const parsed = parseInstagramWriterCandidate(candidate);
    if (!parsed) {
      return { text: '', contentParts: [], firstComment: null };
    }
    const spec = assembleInstagramCarouselSpec({
      angle: instagram.angle,
      hookCandidates: instagram.hookCandidates,
      parsed,
      storyRevisionItemIds: instagram.storyRevisionItemIds,
    });
    return {
      text: spec.caption,
      contentParts: readableInstagramParts(spec),
      firstComment: null,
      instagramCarousel: spec,
    };
  }
  if (channel === 'x') {
    return {
      text: candidate,
      contentParts: [candidate, firstComment ?? ''].filter(Boolean),
      firstComment,
    };
  }
  return { text: candidate, contentParts: [], firstComment };
}

function scoreCandidate(channel: SocialChannel, locale: SocialLocale, candidate: string) {
  let score = 100;
  if (/…/.test(candidate)) score -= 40;
  if (/^(?:\s*\d+[.)].*\n){3,}/m.test(candidate)) score -= 30;
  if (/this week in ai|цього тижня в (?:ai|ші)/i.test(candidate)) score -= 8;
  if (!/[.!?]/.test(candidate.slice(0, 140))) score -= 8;
  // Same deterministic AI-tell/template-leak detectors PR1 built for article
  // prose -- generic hedge phrasing and label-openers read just as badly in
  // a social hook as in a 600-word story.
  for (const rule of bannedPhrasesFor(locale)) {
    if (rule.pattern.test(candidate)) score -= 15;
  }
  const range = CONTRACT_CHAR_RANGE[channel];
  if (range && (candidate.length < range[0] || candidate.length > range[1])) score -= 40;
  if (REQUIRES_PARAGRAPH_BREAKS.has(channel) && !hasParagraphBreaks(candidate)) score -= 30;
  if (channel === 'linkedin' && longestParagraphBlock(candidate) > LINKEDIN_MAX_BLOCK_CHARS) {
    score -= 20;
  }
  if (channel === 'telegram') {
    if (!containsTelegramBold(candidate)) score -= 20;
    if (!containsTelegramInlineCode(candidate)) score -= 20;
    if (telegramStructureIssues(candidate).length > 0) score -= 25;
  }
  if (channel === 'threads') {
    const parts = candidate.split(/\s*<PART>\s*/i).filter((part) => part.trim());
    if (parts.length < 3 || parts.length > 5) score -= 40;
    if (parts.some((part) => part.length > 500)) score -= 40;
    if (!candidate.includes('?')) score -= 12;
  }
  if (channel === 'instagram') {
    if (!parseInstagramWriterCandidate(candidate)) score -= 40;
  }
  return Math.max(0, score);
}

function formatFor(channel: SocialChannel) {
  return {
    telegram: 'weekly_top3_radar',
    facebook: 'weekly_human_narrative',
    threads: 'weekly_thread_3_5',
    x: 'weekly_thesis_self_reply',
    linkedin: 'weekly_editor_verdict',
    instagram: 'weekly_carousel_7',
  }[channel];
}

function criticSpan(flag: string, copy: string) {
  const quoted = flag.match(/[“"]([^”"]{3,})[”"]/u)?.[1]?.trim();
  return quoted && copy.includes(quoted) ? quoted : undefined;
}

export function parseWeeklySocialCritic(raw: string) {
  const critic = parseCritic(raw);
  const noDiagnostic =
    critic.score === 0 &&
    critic.flags.length === 0 &&
    critic.platformFitScore === 0 &&
    (critic.platformFlags?.length ?? 0) === 0 &&
    critic.originalityScore === 0 &&
    (critic.originalityFlags?.length ?? 0) === 0;
  if (noDiagnostic) {
    throw new SyntaxError('Critic echoed an empty zero-score template instead of an audit.');
  }
  if (critic.score < 85 && critic.flags.length === 0) {
    throw new SyntaxError('Critic deducted factual points without an actionable factual flag.');
  }
  if (
    typeof critic.platformFitScore === 'number' &&
    critic.platformFitScore < 85 &&
    (critic.platformFlags?.length ?? 0) === 0
  ) {
    throw new SyntaxError(
      'Critic deducted platform-fit points without an actionable platform flag.',
    );
  }
  if (
    typeof critic.originalityScore === 'number' &&
    critic.originalityScore < 70 &&
    (critic.originalityFlags?.length ?? 0) === 0
  ) {
    throw new SyntaxError(
      'Critic deducted originality points without an actionable originality flag.',
    );
  }
  return critic;
}

function copyForAudit(draft: SocialDraft) {
  return channelNativeCopy(draft);
}

function usageTotal(
  left: { promptTokens: number; outputTokens: number; estimatedCostUsd: number },
  right: { promptTokens: number; outputTokens: number; estimatedCostUsd: number },
) {
  return {
    promptTokens: left.promptTokens + right.promptTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    estimatedCostUsd: left.estimatedCostUsd + right.estimatedCostUsd,
  };
}

export class SocialCopyQualityError extends Error {
  constructor(
    readonly channel: SocialChannel,
    readonly blockerCodes: string[],
    readonly blockerMessages: string[] = [],
  ) {
    super(
      `${channel} social copy did not pass its approval boundary after bounded repair: ${[
        ...new Set(blockerCodes),
      ].join(', ')}${blockerMessages.length > 0 ? `. Details: ${blockerMessages.join(' | ')}` : ''}`,
    );
    this.name = 'SocialCopyQualityError';
  }
}

function promptFor(
  input: {
    channel: SocialChannel;
    locale: SocialLocale;
    bundle: WeeklyMasterBundle;
    trackedUrl: string;
    sourceFacts: string[];
    avoidCopies?: SocialDraft[];
  },
  repair?: { copy: string; blockers: string[] },
) {
  const article = input.locale === 'uk' ? input.bundle.uk : input.bundle.en;
  const voice = input.locale === 'uk' ? VOICE_UK : VOICE_EN;
  return `You are a senior social editor for AI Today Brief. Adapt the approved master into native ${input.channel} copy for builders, founders and AI decision-makers. Do not list all headlines. Do not truncate or use ellipses. Use only claim IDs and facts already present in the master.

VOICE
${voice}

CHANNEL CONTRACT: ${CHANNEL_CONTRACT[input.channel]}
TRACKED URL: ${input.trackedUrl}

WHAT THIS COPY MUST GIVE THE READER
Reporting the news accurately is the floor, not the goal. Every adaptation must leave the reader holding something they can act on this week: a named model, tool, endpoint, flag, threshold or licence term, the concrete step to use it, and the cost, limit or failure mode attached to it. When the fact snapshot carries a practical example for a story -- who would run this, on what stack, at what price -- build the copy on that example instead of restating the headline. Prefer facts that describe what a team can now do over facts that only describe what happened. A post that a reader finishes without knowing what to try, change or check fails this contract even when every number in it is correct.

APPROVED FACT SNAPSHOT
${input.sourceFacts.map((fact) => `- ${fact}`).join('\n')}

${
  input.avoidCopies?.length
    ? `COPY ALREADY USED ON OTHER ${input.locale.toUpperCase()} CHANNELS — choose a materially different hook and structure:\n${input.avoidCopies.map(copyForAudit).join('\n---\n')}`
    : ''
}

${
  repair
    ? `REPAIR REQUIRED\nThe prior candidate below failed automated approval. Rewrite the substance called out by every check; do not merely paraphrase it.\nChecks:\n${repair.blockers.map((blocker) => `- ${blocker}`).join('\n')}\nRejected copy:\n${repair.copy}`
    : ''
}

First, read the approved article below and decide your own angle for this channel's audience -- the single most compelling entry point, not a recap of every headline. Write it as a short (3-8 word) label in "angle". Then create THREE hook candidates built on that angle that are genuinely different from each other in opening, tone or emphasis -- not the same sentence reworded. Never open with a generic AI-tell phrase ("in today's fast-moving AI landscape", "it's worth noting", "game-changer") or a leader-briefing frame ("for product and security leaders") -- open on the concrete fact or scene. Put all candidates inside the JSON "text" string and separate them with <CANDIDATE>. For Threads use <PART> inside each candidate. For Instagram use the tagged 7-slide contract inside each candidate. For X and LinkedIn return the tracked URL in "firstComment"; for other channels put it only where the contract permits. Return strict JSON only: {"angle":"","text":"candidate 1<CANDIDATE>candidate 2<CANDIDATE>candidate 3","firstComment":""}.

APPROVED ARTICLE
${JSON.stringify(article)}`;
}

export async function adaptWeeklySocialChannel(input: {
  channel: SocialChannel;
  locale: SocialLocale;
  bundle: WeeklyMasterBundle;
  trackedUrl: string;
  scheduledFor: string;
  sourceFacts: string[];
  assets?: SocialAsset[];
  altText?: string | null;
  instagramStoryIds?: [string, string, string];
  currentRevisionItemIds?: string[];
  /** Same-locale adaptations already accepted for this package. */
  avoidCopies?: SocialDraft[];
  /** Enables DB-driven role-chain overrides (owner-added HTTP providers via /admin/providers) for social.writer/social.critic. */
  db?: PipelineDb;
}): Promise<WeeklySocialAdaptation> {
  const emptyUsage = { promptTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
  let writerUsage = emptyUsage;
  let criticUsage = emptyUsage;
  let auditedCandidates = 0;
  let repair: { copy: string; blockers: string[] } | undefined;
  let lastFailed: WeeklySocialAdaptation | null = null;

  for (let round = 0; round < 3; round += 1) {
    const writer = await generateSocialJson(
      'writer',
      promptFor(input, repair),
      parseWeeklySocialWriter,
      {
        db: input.db,
      },
    );
    writerUsage = usageTotal(writerUsage, writer.usage);
    const hookCandidates = candidatesFromText(writer.value.text);
    const ranked = hookCandidates
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(input.channel, input.locale, candidate),
      }))
      .sort((left, right) => right.score - left.score);
    const failedThisRound: WeeklySocialAdaptation[] = [];

    // Audit the strongest deterministic candidate once per round. Auditing all
    // three before asking the writer to repair multiplied slow reasoning-model
    // latency by nine in the worst case without improving the repair signal.
    for (const selected of ranked.slice(0, 1)) {
      const firstComment = input.channel === 'x' ? input.trackedUrl : writer.value.firstComment;
      const hookCandidatesTriple = [
        hookCandidates[0] ?? selected.candidate,
        hookCandidates[1] ?? selected.candidate,
        hookCandidates[2] ?? selected.candidate,
      ] as [string, string, string];
      const unpacked = unpackCandidate(input.channel, selected.candidate, firstComment, {
        angle: writer.value.angle,
        hookCandidates: hookCandidatesTriple,
        storyRevisionItemIds: input.instagramStoryIds ?? ['', '', ''],
      });
      const draft: SocialDraft = {
        channel: input.channel,
        locale: input.locale,
        format: formatFor(input.channel),
        text: unpacked.text,
        contentParts: unpacked.contentParts,
        firstComment: unpacked.firstComment,
        assets: input.assets ?? [],
        altText: input.altText ?? null,
        scheduledFor: input.scheduledFor,
        sourceApproved: true,
        sourceFacts: input.sourceFacts,
        sourceUrl: input.trackedUrl,
        instagramCarousel: unpacked.instagramCarousel,
        currentRevisionItemIds: input.currentRevisionItemIds,
      };
      const base = runQualityGate(draft);
      const criticPrompt = `Audit this social adaptation independently. First, compare it against ONLY the approved facts and flag unsupported numbers, names, quotes, causal implications or misleading compression. Second, audit the native serialization below against the exact ${input.channel} contract: ${CHANNEL_CONTRACT[input.channel]}. Third, score how ORIGINAL and non-formulaic the copy reads. Score factual grounding, platform-native fit and originality separately from 0–100.

Consistency rules:
- Empty factual flags mean factual score 100; every deduction needs a precise flag.
- Empty platform flags mean platform fit 100; every deduction needs a precise flag.
- Empty originality flags mean originality 100; every deduction needs a precise flag.
- Never echo an example or return unexplained zero scores.
- Return strict JSON with these keys: score, flags, platformFitScore, platformFlags, originalityScore, originalityFlags.

APPROVED FACTS
${input.sourceFacts.map((fact) => `- ${fact}`).join('\n')}

NATIVE ${input.channel.toUpperCase()} COPY
${copyForAudit(draft)}`;
      const critic = await generateSocialJson('critic', criticPrompt, parseWeeklySocialCritic, {
        excludeProviders: [writer.provider],
        db: input.db,
      });
      auditedCandidates += 1;
      criticUsage = usageTotal(criticUsage, critic.usage);
      const platformFitScore = Math.min(
        selected.score,
        critic.value.platformFitScore ?? selected.score,
      );
      const auditedCopy = copyForAudit(draft);
      const originalityFlags = (critic.value.originalityFlags ?? []).map((flag) => ({
        code: 'originality_flag',
        message: flag,
        span: criticSpan(flag, auditedCopy),
        suggestedFix: "Rewrite the flagged phrase in this channel's own voice.",
      }));
      const factualFlags = critic.value.flags.map((flag) => ({
        code: 'critic_flag',
        message: flag,
        span: criticSpan(flag, auditedCopy),
        suggestedFix: 'Remove or rewrite this claim using only an approved fact.',
      }));
      const platformFlags = (critic.value.platformFlags ?? []).map((flag) => ({
        code: 'platform_flag',
        message: flag,
        suggestedFix: `Rewrite the copy against the ${input.channel} channel contract.`,
      }));
      const factualPassed = critic.value.score >= 85;
      const platformPassed = platformFitScore >= 85;
      const duplicateIssues =
        findBlindCrossPosts([...(input.avoidCopies ?? []), draft]).get(input.channel) ?? [];
      const contractIssues = channelContractIssues(input.channel, draft.text).map(
        (contractIssue) => ({ ...contractIssue, field: 'post_text' as const }),
      );
      const qualityReport: QualityReport = {
        ...base,
        platformFitScore,
        hookAngle: writer.value.angle,
        hookCandidates,
        repairRounds: round,
        auditedCandidates,
        writer: {
          provider: writer.provider,
          model: writer.model,
          fallbackUsed: writer.fallbackUsed,
          usage: writerUsage,
        },
        critic: {
          ...critic.value,
          provider: critic.provider,
          model: critic.model,
          fallbackUsed: critic.fallbackUsed,
          attempts: critic.attempts,
          auditedAt: new Date().toISOString(),
          usage: criticUsage,
        },
        warnings: [
          ...base.warnings,
          ...(factualPassed ? factualFlags : []),
          ...(platformPassed ? platformFlags : []),
          ...(typeof critic.value.originalityScore === 'number' &&
          critic.value.originalityScore >= 70
            ? originalityFlags
            : []),
        ],
        blocking: [
          ...base.blocking,
          ...duplicateIssues,
          ...contractIssues,
          ...(!platformPassed
            ? [
                {
                  code: 'platform_fit',
                  message: `Platform-native fit ${platformFitScore}/100 is below 85/100.`,
                },
              ]
            : []),
          ...(!factualPassed ? factualFlags : []),
          ...(!platformPassed ? platformFlags : []),
          ...(!factualPassed
            ? [
                {
                  code: 'critic_score',
                  message: `Independent factual critic scored this variant ${critic.value.score}/100; 85 is required.`,
                  suggestedFix: 'Rewrite the flagged compression and rerun the independent critic.',
                },
              ]
            : []),
          ...(typeof critic.value.originalityScore === 'number' &&
          critic.value.originalityScore < 70
            ? [
                {
                  code: 'originality_score',
                  message: `Independent critic scored this variant ${critic.value.originalityScore}/100 for originality; 70 is required.`,
                  suggestedFix: 'Rewrite with a more specific, non-generic angle.',
                },
                ...originalityFlags,
              ]
            : []),
        ],
      };
      const adaptation: WeeklySocialAdaptation = {
        ...draft,
        hookAngle: writer.value.angle,
        hookCandidates,
        writer: {
          provider: writer.provider,
          model: writer.model,
          fallbackUsed: writer.fallbackUsed,
          usage: writerUsage,
        },
        qualityReport,
      };
      if (qualityReport.blocking.length === 0) return adaptation;
      failedThisRound.push(adaptation);
    }

    lastFailed =
      failedThisRound.sort((left, right) => {
        const blockerDelta =
          left.qualityReport!.blocking.length - right.qualityReport!.blocking.length;
        if (blockerDelta) return blockerDelta;
        const leftScore = left.qualityReport!.critic?.score ?? 0;
        const rightScore = right.qualityReport!.critic?.score ?? 0;
        return rightScore - leftScore;
      })[0] ?? null;
    if (lastFailed) {
      repair = {
        copy: copyForAudit(lastFailed),
        blockers: lastFailed.qualityReport!.blocking.map((issue) => issue.message),
      };
    }
  }

  throw new SocialCopyQualityError(
    input.channel,
    lastFailed?.qualityReport?.blocking.map((issue) => issue.code) ?? ['unknown_quality_failure'],
    lastFailed?.qualityReport?.blocking.map((issue) => issue.message) ?? [],
  );
}
