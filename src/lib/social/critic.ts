import 'server-only';

import { generateSocialJson } from './llm-router';
import type { QualityReport, SocialDraft } from './types';

interface CriticResult {
  score: number;
  flags: string[];
  platformFitScore?: number;
  platformFlags?: string[];
  /** How original/non-formulaic the copy reads, 0-100 -- weekly-only (PR7); daily prompts never request it. */
  originalityScore?: number;
  originalityFlags?: string[];
}

export function parseCritic(raw: string): CriticResult {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new SyntaxError('Critic returned no JSON object.');
  try {
    const value = JSON.parse(json) as {
      score?: unknown;
      flags?: unknown;
      platformFitScore?: unknown;
      platformFlags?: unknown;
      originalityScore?: unknown;
      originalityFlags?: unknown;
    };
    if (typeof value.score !== 'number' || !Number.isFinite(value.score)) {
      throw new SyntaxError('Critic score is missing.');
    }
    if (!Array.isArray(value.flags) || value.flags.some((flag) => typeof flag !== 'string')) {
      throw new SyntaxError('Critic flags are invalid.');
    }
    if (
      value.platformFitScore !== undefined &&
      (typeof value.platformFitScore !== 'number' || !Number.isFinite(value.platformFitScore))
    ) {
      throw new SyntaxError('Critic platform fit score is invalid.');
    }
    if (
      value.platformFlags !== undefined &&
      (!Array.isArray(value.platformFlags) ||
        value.platformFlags.some((flag) => typeof flag !== 'string'))
    ) {
      throw new SyntaxError('Critic platform flags are invalid.');
    }
    if (
      value.originalityScore !== undefined &&
      (typeof value.originalityScore !== 'number' || !Number.isFinite(value.originalityScore))
    ) {
      throw new SyntaxError('Critic originality score is invalid.');
    }
    if (
      value.originalityFlags !== undefined &&
      (!Array.isArray(value.originalityFlags) ||
        value.originalityFlags.some((flag) => typeof flag !== 'string'))
    ) {
      throw new SyntaxError('Critic originality flags are invalid.');
    }
    return {
      score: Math.max(0, Math.min(100, value.score)),
      flags: value.flags
        .map((flag) => flag.trim())
        .filter(Boolean)
        .slice(0, 8),
      ...(typeof value.platformFitScore === 'number'
        ? { platformFitScore: Math.max(0, Math.min(100, value.platformFitScore)) }
        : {}),
      ...(Array.isArray(value.platformFlags)
        ? {
            platformFlags: value.platformFlags
              .map((flag) => flag.trim())
              .filter(Boolean)
              .slice(0, 8),
          }
        : {}),
      ...(typeof value.originalityScore === 'number'
        ? { originalityScore: Math.max(0, Math.min(100, value.originalityScore)) }
        : {}),
      ...(Array.isArray(value.originalityFlags)
        ? {
            originalityFlags: value.originalityFlags
              .map((flag) => flag.trim())
              .filter(Boolean)
              .slice(0, 8),
          }
        : {}),
    };
  } catch (error) {
    throw error instanceof SyntaxError ? error : new SyntaxError('Critic returned invalid JSON.');
  }
}

function envEnabled(value: string | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
}

/** Advisory only: this result can flag a post, but can never approve it. */
export async function attachCriticReport(
  draft: SocialDraft,
  report: QualityReport,
): Promise<QualityReport> {
  const prompt = `You are an independent factual critic. Compare the proposed social copy ONLY with the approved facts below. Do not use outside knowledge. Flag every number, name, causal claim, quote, or implication not supported by those facts. Also flag misleading compression.

Audit rules:
- The tracked source URL is approved distribution metadata. Never flag the URL itself.
- Neutral calls to action such as "Read more", "Details", "Деталі" or "Читати" are not factual claims.
- Score 100 when every factual claim is supported. Deduct only for a specific unsupported or misleading claim.
- Every flag must name the exact questionable claim in concise, actionable language.
- Return strict JSON only: {"score":0-100,"flags":["..."]}.

CHANNEL: ${draft.channel}
LOCALE: ${draft.locale}
APPROVED FACTS:
${draft.sourceFacts.map((fact) => `- ${fact}`).join('\n')}

TRACKED SOURCE URL (approved metadata):
${draft.sourceUrl}

PROPOSED COPY:
${draft.text}

FIRST COMMENT:
${draft.firstComment ?? ''}`;

  try {
    const result = await generateSocialJson('critic', prompt, parseCritic);
    const critic = result.value;
    const minimumScore = Number.parseInt(process.env.SOCIAL_CRITIC_MIN_SCORE ?? '85', 10);
    const needsReview = critic.flags.length > 0 || critic.score < minimumScore;
    return {
      ...report,
      critic: {
        ...critic,
        provider: result.provider,
        model: result.model,
        fallbackUsed: result.fallbackUsed,
        attempts: result.attempts,
        usage: result.usage,
        auditedAt: new Date().toISOString(),
      },
      warnings: needsReview
        ? [
            ...report.warnings,
            {
              code: 'critic_flags',
              message:
                critic.flags.length > 0
                  ? `${critic.flags.length} critic flag(s) require owner review.`
                  : `Critic score ${critic.score}/100 is below the ${minimumScore}/100 review target.`,
            },
          ]
        : report.warnings,
    };
  } catch {
    const required = envEnabled(process.env.SOCIAL_CRITIC_REQUIRED);
    const auditIssue = {
      code: 'critic_unavailable',
      message: required
        ? 'Independent LLM audit is unavailable after all configured fallbacks; publishing is blocked until the audit succeeds.'
        : 'Independent LLM audit is unavailable after all configured fallbacks; owner review is still required.',
    };
    return {
      ...report,
      blocking: required ? [...report.blocking, auditIssue] : report.blocking,
      warnings: required ? report.warnings : [...report.warnings, auditIssue],
    };
  }
}
