import 'server-only';

import { parseCritic } from '@/lib/social/critic';
import { generateSocialJson } from '@/lib/social/llm-router';
import { runQualityGate } from '@/lib/social/quality';
import type {
  QualityReport,
  SocialAsset,
  SocialChannel,
  SocialDraft,
  SocialLocale,
} from '@/lib/social/types';
import type { WeeklyMasterBundle } from './content-studio';

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
  const value = JSON.parse(match) as { text?: unknown; firstComment?: unknown };
  if (typeof value.text !== 'string' || !value.text.trim()) {
    throw new SyntaxError('Writer text is missing.');
  }
  return {
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

function scoreCandidate(channel: SocialChannel, candidate: string) {
  let score = 100;
  if (/…/.test(candidate)) score -= 40;
  if (/^(?:\s*\d+[.)].*\n){3,}/m.test(candidate)) score -= 30;
  if (/this week in ai|цього тижня в (?:ai|ші)/i.test(candidate)) score -= 8;
  if (!/[.!?]/.test(candidate.slice(0, 140))) score -= 8;
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

function promptFor(input: {
  channel: SocialChannel;
  locale: SocialLocale;
  bundle: WeeklyMasterBundle;
  hookAngle: string;
  trackedUrl: string;
}) {
  const article = input.locale === 'uk' ? input.bundle.uk : input.bundle.en;
  return `You are a senior social editor for AI Today Brief. Adapt the approved master into native ${input.channel} copy for builders, founders and AI decision-makers. Voice: trusted editor-practitioner, direct, vivid and useful without clickbait. Do not list all headlines. Do not truncate or use ellipses. Use only claim IDs and facts already present in the master.

CHANNEL CONTRACT: ${CHANNEL_CONTRACT[input.channel]}
HOOK ANGLE: ${input.hookAngle}
TRACKED URL: ${input.trackedUrl}

Create THREE meaningfully different hook candidates. Put all candidates inside the JSON "text" string and separate them with <CANDIDATE>. For Threads use <PART> inside each candidate. For Instagram use <SLIDE> and <CAPTION>. For X return the tracked URL in "firstComment"; for other channels put it only where the contract permits. Return strict JSON only: {"text":"candidate 1<CANDIDATE>candidate 2<CANDIDATE>candidate 3","firstComment":""}.

APPROVED ARTICLE
${JSON.stringify(article)}

APPROVED SOCIAL ANGLES
${JSON.stringify(input.bundle.socialAngles)}`;
}

export async function adaptWeeklySocialChannel(input: {
  channel: SocialChannel;
  locale: SocialLocale;
  bundle: WeeklyMasterBundle;
  hookAngle: string;
  trackedUrl: string;
  scheduledFor: string;
  sourceFacts: string[];
  assets?: SocialAsset[];
  altText?: string | null;
}): Promise<WeeklySocialAdaptation> {
  const writer = await generateSocialJson('writer', promptFor(input), parseWriter);
  const hookCandidates = candidatesFromText(writer.value.text);
  const ranked = hookCandidates
    .map((candidate) => ({ candidate, score: scoreCandidate(input.channel, candidate) }))
    .sort((left, right) => right.score - left.score);
  const selected = ranked[0]!;
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
  const criticPrompt = `Audit this social adaptation independently. First, compare it against ONLY the approved facts and flag unsupported numbers, names, quotes, causal implications or misleading compression. Second, audit it against the exact ${input.channel} contract: ${CHANNEL_CONTRACT[input.channel]}. Score factual grounding and platform-native fit separately from 0–100. Return JSON only: {"score":0,"flags":[],"platformFitScore":0,"platformFlags":[]}.

APPROVED FACTS
${input.sourceFacts.map((fact) => `- ${fact}`).join('\n')}

COPY
${[draft.text, ...unpacked.contentParts, draft.firstComment ?? ''].join('\n---\n')}`;
  const critic = await generateSocialJson('critic', criticPrompt, parseCritic, {
    excludeProviders: [writer.provider],
  });
  const platformFitScore = Math.min(
    selected.score,
    critic.value.platformFitScore ?? selected.score,
  );
  const auditedCopy = [draft.text, ...unpacked.contentParts, draft.firstComment ?? ''].join('\n');
  const qualityReport: QualityReport = {
    ...base,
    platformFitScore,
    hookAngle: input.hookAngle,
    hookCandidates,
    writer: {
      provider: writer.provider,
      model: writer.model,
      fallbackUsed: writer.fallbackUsed,
      usage: writer.usage,
    },
    critic: {
      ...critic.value,
      provider: critic.provider,
      model: critic.model,
      fallbackUsed: critic.fallbackUsed,
      attempts: critic.attempts,
      auditedAt: new Date().toISOString(),
      usage: critic.usage,
    },
    blocking: [
      ...base.blocking,
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
        suggestedFix: 'Remove or rewrite this claim using only an approved claim ID.',
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
    ],
  };
  return {
    ...draft,
    hookAngle: input.hookAngle,
    hookCandidates,
    writer: {
      provider: writer.provider,
      model: writer.model,
      fallbackUsed: writer.fallbackUsed,
      usage: writer.usage,
    },
    qualityReport,
  };
}
