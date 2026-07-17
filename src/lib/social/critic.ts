import 'server-only';

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { QualityReport, SocialDraft } from './types';

interface CriticResult {
  score: number;
  flags: string[];
}

function parseCritic(raw: string): CriticResult {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return { score: 0, flags: ['Critic returned an unreadable response.'] };
  try {
    const value = JSON.parse(json) as { score?: unknown; flags?: unknown };
    return {
      score: Math.max(0, Math.min(100, Number(value.score) || 0)),
      flags: Array.isArray(value.flags)
        ? value.flags.filter((flag): flag is string => typeof flag === 'string').slice(0, 8)
        : [],
    };
  } catch {
    return { score: 0, flags: ['Critic returned invalid JSON.'] };
  }
}

/** Advisory only: this result can flag a post, but can never approve it. */
export async function attachCriticReport(
  draft: SocialDraft,
  report: QualityReport,
): Promise<QualityReport> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.SOCIAL_CRITIC_MODEL?.trim() || 'gemini-2.5-flash';
  if (!apiKey) {
    return {
      ...report,
      warnings: [
        ...report.warnings,
        {
          code: 'critic_unconfigured',
          message: 'LLM critic is not configured; owner review is still required.',
        },
      ],
    };
  }

  const prompt = `You are an independent factual critic. Compare the proposed social copy ONLY with the approved facts below. Do not use outside knowledge. Flag every number, name, causal claim, quote, or implication not supported by those facts. Also flag misleading compression. Return strict JSON only: {"score":0-100,"flags":["..."]}. A high score means faithful copy.

CHANNEL: ${draft.channel}
LOCALE: ${draft.locale}
APPROVED FACTS:
${draft.sourceFacts.map((fact) => `- ${fact}`).join('\n')}

PROPOSED COPY:
${draft.text}

FIRST COMMENT:
${draft.firstComment ?? ''}`;

  try {
    const result = await new GoogleGenerativeAI(apiKey)
      .getGenerativeModel({ model, generationConfig: { responseMimeType: 'application/json' } })
      .generateContent(prompt);
    const critic = parseCritic(result.response.text());
    return {
      ...report,
      critic: { ...critic, model },
      warnings:
        critic.flags.length > 0
          ? [
              ...report.warnings,
              {
                code: 'critic_flags',
                message: `${critic.flags.length} critic flag(s) require owner review.`,
              },
            ]
          : report.warnings,
    };
  } catch (error) {
    return {
      ...report,
      warnings: [
        ...report.warnings,
        {
          code: 'critic_failed',
          message: `LLM critic failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        },
      ],
    };
  }
}
