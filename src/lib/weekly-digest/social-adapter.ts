import 'server-only';

import type { PipelineDb } from '../../../pipeline/db';
import { parseCritic } from '@/lib/social/critic';
import { generateSocialJson } from '@/lib/social/llm-router';
import { findBlindCrossPosts, runQualityGate } from '@/lib/social/quality';
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
    'Ukrainian, 900–1600 characters. Strong lead, Top 3 with a short consequence, radar in one block, one CTA and exactly one URL.',
  facebook:
    'Ukrainian, 700–1400 characters. One human narrative line, 2–3 conclusions, one meaningful question and exactly one URL.',
  threads:
    'Ukrainian sequence of 3–5 messages, each at most 500 characters. Thesis → evidence → consequence → genuine question. Separate messages with <PART>. Put the URL only in the final part.',
  x: 'English root post, 180–260 characters, one thesis and one strong fact, no URL. The tracked URL goes only in firstComment.',
  linkedin:
    'English, 700–1200 characters. A self-contained insight for builders/leaders: tension, evidence, judgment, next decision. At most 3 hashtags and one URL.',
  instagram:
    'English carousel of 7–9 slides. Separate slide text with <SLIDE>, then write <CAPTION> and a caption that adds context instead of repeating slide headlines. No URL and at most 5 hashtags.',
};

function parseWriter(raw: string) {
  const match = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!match) throw new SyntaxError('Writer returned no JSON object.');
  const value = JSON.parse(match) as { angle?: unknown; text?: unknown; firstComment?: unknown };
  if (typeof value.angle !== 'string' || !value.angle.trim()) {
    throw new SyntaxError('Writer angle is missing.');
  }
  if (typeof value.text !== 'string' || !value.text.trim()) {
    throw new SyntaxError('Writer text is missing.');
  }
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
  throw new SyntaxError('Writer must return 2–3 hook candidates separated by <CANDIDATE>.');
}

function unpackCandidate(channel: SocialChannel, candidate: string, firstComment: string | null) {
  if (channel === 'threads') {
    const parts = candidate
      .split(/\s*<PART>\s*/i)
      .map((part) => part.trim())
      .filter(Boolean);
    return { text: parts[0] ?? '', contentParts: parts, firstComment: null };
  }
  if (channel === 'instagram') {
    const [slidesText = '', caption = ''] = candidate.split(/\s*<CAPTION>\s*/i, 2);
    const parts = slidesText
      .split(/\s*<SLIDE>\s*/i)
      .map((part) => part.trim())
      .filter(Boolean);
    return { text: caption.trim(), contentParts: parts, firstComment: null };
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
  const characterRange: Partial<Record<SocialChannel, [number, number]>> = {
    telegram: [900, 1_600],
    facebook: [700, 1_400],
    x: [180, 260],
    linkedin: [700, 1_200],
  };
  const range = characterRange[channel];
  if (range && (candidate.length < range[0] || candidate.length > range[1])) score -= 40;
  if (channel === 'threads') {
    const parts = candidate.split(/\s*<PART>\s*/i).filter((part) => part.trim());
    if (parts.length < 3 || parts.length > 5) score -= 40;
    if (parts.some((part) => part.length > 500)) score -= 40;
    if (!candidate.includes('?')) score -= 12;
  }
  if (channel === 'instagram') {
    const slides = candidate
      .split(/\s*<CAPTION>\s*/i)[0]!
      .split(/\s*<SLIDE>\s*/i)
      .filter((part) => part.trim());
    if (slides.length < 7 || slides.length > 9) score -= 40;
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
    instagram: 'weekly_carousel_7_9',
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
  if (draft.channel === 'instagram') {
    return [
      ...(draft.contentParts ?? []).map((part) => `<SLIDE>${part}`),
      `<CAPTION>${draft.text}`,
    ].join('\n');
  }
  if (draft.channel === 'threads') {
    return (draft.contentParts ?? []).map((part) => `<PART>${part}`).join('\n');
  }
  if (draft.channel === 'x') {
    return `ROOT POST\n${draft.text}\nFIRST COMMENT\n${draft.firstComment ?? ''}`;
  }
  return draft.text;
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
  ) {
    super(
      `${channel} social copy did not pass its approval boundary after bounded repair: ${[
        ...new Set(blockerCodes),
      ].join(', ')}`,
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

First, read the approved article below and decide your own angle for this channel's audience -- the single most compelling entry point, not a recap of every headline. Write it as a short (3-8 word) label in "angle". Then create THREE hook candidates built on that angle that are genuinely different from each other in opening, tone or emphasis -- not the same sentence reworded. Never open with a generic AI-tell phrase ("in today's fast-moving AI landscape", "it's worth noting", "game-changer") or a leader-briefing frame ("for product and security leaders") -- open on the concrete fact or scene. Put all candidates inside the JSON "text" string and separate them with <CANDIDATE>. For Threads use <PART> inside each candidate. For Instagram use <SLIDE> and <CAPTION>. For X return the tracked URL in "firstComment"; for other channels put it only where the contract permits. Return strict JSON only: {"angle":"","text":"candidate 1<CANDIDATE>candidate 2<CANDIDATE>candidate 3","firstComment":""}.

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
    const writer = await generateSocialJson('writer', promptFor(input, repair), parseWriter, {
      db: input.db,
    });
    writerUsage = usageTotal(writerUsage, writer.usage);
    const hookCandidates = candidatesFromText(writer.value.text);
    const ranked = hookCandidates
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(input.channel, input.locale, candidate),
      }))
      .sort((left, right) => right.score - left.score);
    const failedThisRound: WeeklySocialAdaptation[] = [];

    for (const selected of ranked) {
      const firstComment = input.channel === 'x' ? input.trackedUrl : writer.value.firstComment;
      const unpacked = unpackCandidate(input.channel, selected.candidate, firstComment);
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
      const duplicateIssues =
        findBlindCrossPosts([...(input.avoidCopies ?? []), draft]).get(input.channel) ?? [];
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
          ...(typeof critic.value.originalityScore === 'number' &&
          critic.value.originalityScore >= 70
            ? originalityFlags
            : []),
        ],
        blocking: [
          ...base.blocking,
          ...duplicateIssues,
          ...(platformFitScore < 85
            ? [
                {
                  code: 'platform_fit',
                  message: `Platform-native fit ${platformFitScore}/100 is below 85/100.`,
                },
              ]
            : []),
          ...critic.value.flags.map((flag) => ({
            code: 'critic_flag',
            message: flag,
            span: criticSpan(flag, auditedCopy),
            suggestedFix: 'Remove or rewrite this claim using only an approved fact.',
          })),
          ...(critic.value.platformFlags ?? []).map((flag) => ({
            code: 'platform_flag',
            message: flag,
            suggestedFix: `Rewrite the copy against the ${input.channel} channel contract.`,
          })),
          ...(critic.value.score < 85
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
  );
}
