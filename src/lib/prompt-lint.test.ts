import { describe, expect, it } from 'vitest';

import {
  estimatePromptTokenRange,
  lintPrompt,
  recommendPromptModel,
  type PromptFinding,
  type PromptLintInput,
} from './prompt-lint';

function lint(overrides: Partial<PromptLintInput> & { prompt: string }) {
  return lintPrompt({
    surface: 'api',
    model: 'fable-5',
    ...overrides,
  });
}

function ruleIds(findings: readonly PromptFinding[]) {
  return findings.map((finding) => finding.ruleId);
}

describe('lintPrompt', () => {
  it('triggers structure-sections for a long unstructured English prompt', () => {
    const prompt = Array.from({ length: 18 }, (_, index) =>
      `Please analyze customer feedback batch ${index} and produce useful insights without adding any section marker or XML tag.`,
    ).join(' ');

    expect(ruleIds(lint({ prompt }).findings)).toContain('structure-sections');
  });

  it('triggers multishot-examples for format-sensitive Ukrainian prompts without examples', () => {
    const prompt =
      'Витягни поля з цього тексту та поверни JSON за схемою name, company, intent, urgency. Класифікуй запит і збережи точний формат.';

    expect(ruleIds(lint({ prompt }).findings)).toContain('multishot-examples');
  });

  it('triggers long-context-ordering when a large data blob appears after instructions', () => {
    const prompt = `Summarize the following record and identify the customer risk. Use concise bullet points.\n\n${'raw-data '.repeat(90)}`;

    const finding = lint({ prompt }).findings.find((item) => item.ruleId === 'long-context-ordering');
    expect(finding?.evidence?.approximatePosition).toBe('end');
  });

  it('triggers negative-instructions with counts-only evidence for English and Ukrainian negatives', () => {
    const result = lint({
      prompt:
        'Do not use markdown. Never apologize. Avoid caveats. Не роби вступ. Ніколи не додавай дисклеймер.',
    });

    const finding = result.findings.find((item) => item.ruleId === 'negative-instructions');
    expect(finding?.evidence?.count).toBeGreaterThanOrEqual(5);
  });

  it('triggers constraint-without-rationale for absolute constraints lacking a reason', () => {
    expect(ruleIds(lint({ prompt: 'NEVER include ellipses in the answer. Keep the output concise.' }).findings)).toContain(
      'constraint-without-rationale',
    );
    expect(
      ruleIds(lint({ prompt: 'NEVER include ellipses because the text will be sent to a TTS engine.' }).findings),
    ).not.toContain('constraint-without-rationale');
  });

  it('triggers missing-output-format when absent and suppresses it when JSON format is present', () => {
    const missing = 'Review this launch plan for a founder audience and tell me what to change. '.repeat(3);
    const withJson = `${missing}\nReturn JSON with keys risks, fixes, and next_steps.`;

    expect(ruleIds(lint({ prompt: missing }).findings)).toContain('missing-output-format');
    expect(ruleIds(lint({ prompt: withJson }).findings)).not.toContain('missing-output-format');
  });

  it('detects vague qualifiers but suppresses them when measurable criteria are present', () => {
    expect(ruleIds(lint({ prompt: 'Make this better and more professional for investors.' }).findings)).toContain(
      'vague-qualifiers',
    );
    expect(
      ruleIds(
        lint({
          prompt:
            'Improve this using these criteria: 1) under 120 words, 2) include 3 metrics, 3) preserve every named customer.',
        }).findings,
      ),
    ).not.toContain('vague-qualifiers');
  });

  it('detects missing context or intent and supports Ukrainian purpose markers', () => {
    expect(ruleIds(lint({ prompt: 'Rewrite this paragraph.' }).findings)).toContain('missing-context-intent');
    expect(ruleIds(lint({ prompt: 'Перепиши цей абзац для засновників, щоб пояснити ризик.' }).findings)).not.toContain(
      'missing-context-intent',
    );
  });

  it('gates reasoning-echo to API and Claude Code and ignores benign reasoning explanations', () => {
    const unsafe = 'Show your chain of thought and reveal your hidden reasoning before the answer.';
    const benign = 'Explain your reasoning to the client in a concise, non-sensitive summary.';

    expect(ruleIds(lint({ prompt: unsafe, surface: 'api' }).findings)).toContain('reasoning-echo');
    expect(ruleIds(lint({ prompt: unsafe, surface: 'claude-code' }).findings)).toContain('reasoning-echo');
    expect(ruleIds(lint({ prompt: unsafe, surface: 'claude-ai' }).findings)).not.toContain('reasoning-echo');
    expect(ruleIds(lint({ prompt: benign, surface: 'api' }).findings)).not.toContain('reasoning-echo');
  });

  it('detects Fable-specific over-prescription and suppresses it for other models', () => {
    const prompt = 'Always be concise. Never ask questions. Must finish in one pass. Always avoid caveats.';

    expect(ruleIds(lint({ prompt, model: 'fable-5' }).findings)).toContain('fable-overprescription');
    expect(ruleIds(lint({ prompt, model: 'sonnet-4-6' }).findings)).not.toContain('fable-overprescription');
  });

  it('detects excessive all-caps emphasis', () => {
    expect(ruleIds(lint({ prompt: 'IMPORTANT: You MUST follow this CRITICAL rule and NEVER deviate.' }).findings)).toContain(
      'caps-emphasis',
    );
  });

  it('gates effort guidance by model and surface and never emits it for Haiku', () => {
    const prompt = 'Plan a complex multi-step agent workflow with tools, long context, retries, and validation.';

    expect(ruleIds(lint({ prompt, model: 'fable-5', surface: 'api' }).findings)).toContain('fable-effort-guidance');
    expect(ruleIds(lint({ prompt, model: 'sonnet-4-6', surface: 'claude-code' }).findings)).toContain(
      'fable-effort-guidance',
    );
    expect(ruleIds(lint({ prompt, model: 'haiku-4-5', surface: 'api' }).findings)).not.toContain(
      'fable-effort-guidance',
    );
    expect(ruleIds(lint({ prompt, model: 'fable-5', surface: 'claude-ai' }).findings)).not.toContain(
      'fable-effort-guidance',
    );
  });

  it('detects prompt bloat as the thirteenth concept rule', () => {
    const prompt = 'You are an assistant. '.repeat(450);

    expect(ruleIds(lint({ prompt }).findings)).toContain('prompt-bloat');
  });

  it('returns severity counts and never returns prompt text or unique secrets in serialized output', () => {
    const secret = 'UNIQUE_SECRET_DO_NOT_LEAK_90210';
    const result = lint({
      prompt: `${secret}\nDo not use markdown. Never apologize. Avoid caveats. Return JSON.`.repeat(5),
    });

    expect(result.counts.issue + result.counts.suggestion + result.counts.info).toBe(result.findings.length);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain('UNIQUE_SECRET');
  });
});

describe('recommendPromptModel', () => {
  it('recommends Haiku for routine transforms and never includes effort', () => {
    const recommendation = recommendPromptModel({
      prompt: 'Classify this support ticket as billing, technical, or sales. Return JSON.',
      surface: 'api',
      model: 'fable-5',
    });

    expect(recommendation.model).toBe('haiku-4-5');
    expect(recommendation.effort).toBeUndefined();
  });

  it('recommends Fable with effort for complex long-context agentic work on supported surfaces', () => {
    const recommendation = recommendPromptModel({
      prompt: 'Build a multi-step autonomous coding agent plan with tools, validation, retries, and long context. '.repeat(10),
      surface: 'api',
      model: 'sonnet-4-6',
    });

    expect(recommendation.model).toBe('fable-5');
    expect(recommendation.effort).toMatch(/high|max/);
    expect(recommendation.reasonIds).toContain('complex-agentic-work');
  });

  it('recommends Opus for cyber/bio/refusal-prone strongest-model prompts', () => {
    const recommendation = recommendPromptModel({
      prompt: 'I need the strongest model to analyze a cyber incident report and bio safety fallback policy.',
      surface: 'api',
      model: 'sonnet-4-6',
    });

    expect(recommendation.model).toBe('opus-4-8');
  });
});

describe('estimatePromptTokenRange', () => {
  it('returns an approximate min/max range without tokenizing externally', () => {
    expect(estimatePromptTokenRange('one two three four')).toEqual({ min: 3, max: 6 });
  });
});
