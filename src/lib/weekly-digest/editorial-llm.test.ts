import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../pipeline/openrouter-models', () => ({
  fetchOpenRouterModels: vi.fn().mockResolvedValue([
    {
      id: 'vendor/critic-model',
      context_length: 128_000,
      architecture: { modality: 'text' },
      pricing: { prompt: '0.000001', completion: '0.000006' },
      benchmarks: { artificial_analysis: { intelligence_index: 60 } },
    },
    {
      // A distinct vendor so the independent critic's OpenRouter fallback
      // (which excludes the writer's vendor) still has a model to pick.
      id: 'other-vendor/writer-model',
      context_length: 128_000,
      architecture: { modality: 'text' },
      pricing: { prompt: '0.000001', completion: '0.000006' },
      benchmarks: { artificial_analysis: { intelligence_index: 60 } },
    },
  ]),
}));

vi.mock('../../../pipeline/openrouter-summarize', () => ({
  generateWithOpenRouterChain: vi.fn(),
}));

vi.mock('../../../pipeline/claude-cli', () => ({
  generateWithClaudeCli: vi.fn(),
}));

vi.mock('../../../pipeline/providers/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../pipeline/providers/registry')>();
  return { ...actual, loadProviderRegistry: vi.fn() };
});

import {
  extractJsonObject,
  masterRetryGuidancePrompt,
  approvedStoryPromptMaterial,
  criticApprovedEvidence,
  criticPrompt,
  openRouterModelVendor,
  parseRepairedValue,
  parseStorySegment,
  premiumGeminiEditorialModels,
  premiumOpenRouterModels,
  repairFieldPrompt,
  splitMasterRetryGuidance,
  storySegmentPrompt,
  type WeeklyMasterInputStory,
  type WeeklyMasterRetryGuidance,
} from './editorial-llm';
import type { WeeklyMasterBundle } from './content-studio';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('premiumOpenRouterModels', () => {
  it('keeps one in-request model attempt within the function budget', () => {
    vi.stubEnv('WEEKLY_MASTER_OPENROUTER_MODELS', 'provider/new,provider/older');
    expect(
      premiumOpenRouterModels([
        {
          id: 'provider/new',
          created: 2,
          context_length: 128_000,
          architecture: { modality: 'text' },
          pricing: { prompt: '0.000001', completion: '0.000006' },
          benchmarks: { artificial_analysis: { intelligence_index: 55 } },
        },
        {
          id: 'provider/older',
          created: 1,
          context_length: 128_000,
          architecture: { modality: 'text' },
          pricing: { prompt: '0.000002', completion: '0.00001' },
          benchmarks: { artificial_analysis: { intelligence_index: 55 } },
        },
      ]),
    ).toEqual(['provider/new']);
  });

  it('selects an independent premium vendor for the critic', () => {
    expect(
      premiumOpenRouterModels(
        [
          {
            id: 'anthropic/claude-opus-current',
            created: 3,
            context_length: 128_000,
            architecture: { modality: 'text' },
            pricing: { prompt: '0.000001', completion: '0.000006' },
            benchmarks: { artificial_analysis: { intelligence_index: 80 } },
          },
          {
            id: 'openai/gpt-current',
            created: 2,
            context_length: 128_000,
            architecture: { modality: 'text' },
            pricing: { prompt: '0.000002', completion: '0.00001' },
            benchmarks: { artificial_analysis: { intelligence_index: 55 } },
          },
        ],
        { configuredModels: [], excludeVendors: ['anthropic'] },
      ),
    ).toEqual(['openai/gpt-current']);
    expect(openRouterModelVendor('openai/gpt-current')).toBe('openai');
  });

  it('prefers the cheaper of two models that both clear the quality floor', () => {
    expect(
      premiumOpenRouterModels([
        {
          id: 'vendor/cheap-adequate',
          context_length: 128_000,
          architecture: { modality: 'text' },
          pricing: { prompt: '0.000001', completion: '0.000006' },
          benchmarks: { artificial_analysis: { intelligence_index: 55 } },
        },
        {
          id: 'vendor/expensive-flagship',
          context_length: 128_000,
          architecture: { modality: 'text' },
          pricing: { prompt: '0.000015', completion: '0.000075' },
          benchmarks: { artificial_analysis: { intelligence_index: 85 } },
        },
      ]),
    ).toEqual(['vendor/cheap-adequate']);
  });

  it('excludes models below the quality floor even when cheapest', () => {
    expect(
      premiumOpenRouterModels([
        {
          id: 'vendor/too-weak',
          context_length: 128_000,
          architecture: { modality: 'text' },
          pricing: { prompt: '0.0000001', completion: '0.0000006' },
          benchmarks: { artificial_analysis: { intelligence_index: 10 } },
        },
        {
          id: 'vendor/adequate',
          context_length: 128_000,
          architecture: { modality: 'text' },
          pricing: { prompt: '0.000001', completion: '0.000006' },
          benchmarks: { artificial_analysis: { intelligence_index: 55 } },
        },
      ]),
    ).toEqual(['vendor/adequate']);
  });
});

describe('masterRetryGuidancePrompt', () => {
  it('labels prior critic feedback as constraints rather than factual evidence', () => {
    const prompt = masterRetryGuidancePrompt([
      {
        code: 'STRENGTHENED-CLAIM',
        message: 'The earlier draft implied unsupported causality.',
        suggestedFix: 'State only that the reversal occurred.',
        locale: 'en',
      },
    ]);
    expect(prompt).toContain('not approved factual claims');
    expect(prompt).toContain('State only that the reversal occurred.');
  });
});

describe('splitMasterRetryGuidance', () => {
  it('routes plain locale:uk guidance (e.g. article naturalness) to Ukrainian', () => {
    const guidance: WeeklyMasterRetryGuidance[] = [
      { code: 'STYLE_CALQUE', message: 'calqued phrasing', locale: 'uk', field: 'stories.body' },
    ];
    const { english, ukrainian } = splitMasterRetryGuidance(guidance);
    expect(english).toHaveLength(0);
    expect(ukrainian).toHaveLength(1);
  });

  it('leaves untagged guidance (structural/English issues) in English', () => {
    const guidance: WeeklyMasterRetryGuidance[] = [
      { code: 'top3_radar_structure', message: 'must contain exactly three features' },
    ];
    const { english, ukrainian } = splitMasterRetryGuidance(guidance);
    expect(english).toHaveLength(1);
    expect(ukrainian).toHaveLength(0);
  });
});

function storyWithPrimaryExcerpt(): WeeklyMasterInputStory {
  return {
    revisionItemId: 'item-w2',
    rank: 2,
    placement: 'feature',
    titleEn: 'CryptanalysisBench',
    titleUk: 'CryptanalysisBench',
    summaryEn: 'Anthropic released CryptanalysisBench.',
    summaryUk: 'Anthropic випустив CryptanalysisBench.',
    whyEn: null,
    whyUk: null,
    sources: [{ name: 'Anthropic', url: 'https://www.anthropic.com/research/example' }],
    claims: [
      {
        id: 'W2-C5',
        text: 'Benchmark Name: CryptanalysisBench',
        evidenceUrls: ['https://www.anthropic.com/research/example'],
      },
    ],
    research: {
      schemaVersion: 'weekly-research-v3',
      digestId: 'digest',
      revisionId: 'revision',
      revisionItemId: 'item-w2',
      placement: 'feature',
      primarySource: {
        url: 'https://www.anthropic.com/research/example',
        sourceName: 'Anthropic',
        domain: 'anthropic.com',
        primary: true,
        extractedText:
          'For this experiment, we used a Claude Code-like harness that supports multiple worker agents with access to computational tools like Python and Sage.',
        ogImage: null,
      },
      corroboratingSources: [],
      claims: [
        {
          id: 'W2-C5',
          text: 'Benchmark Name: CryptanalysisBench',
          kind: 'fact',
          evidenceUrls: ['https://www.anthropic.com/research/example'],
        },
      ],
      context: [],
      contradictions: [],
      limitations: [],
      risks: [],
      researchedAt: '2026-08-04T00:00:00.000Z',
    },
  };
}

describe('approvedStoryPromptMaterial', () => {
  it('surfaces primary source excerpts beside structured claims for the writer', () => {
    const [material] = approvedStoryPromptMaterial([storyWithPrimaryExcerpt()]);
    expect(material.claims.map((claim) => claim.id)).toEqual(['W2-C5']);
    expect(material.primarySourceExcerpt?.excerpt).toContain('Python and Sage');
    expect(material).not.toHaveProperty('research');
  });

  it('passes through the owner-set editorial angle when present (PR4)', () => {
    const withAngle = { ...storyWithPrimaryExcerpt(), angle: 'Frame this as a cautionary tale.' };
    const [material] = approvedStoryPromptMaterial([withAngle]);
    expect(material.angle).toBe('Frame this as a cautionary tale.');
  });

  it('omits angle entirely when the story has none, rather than sending an empty string', () => {
    const [material] = approvedStoryPromptMaterial([storyWithPrimaryExcerpt()]);
    expect(material).not.toHaveProperty('angle');
  });
});

describe('criticApprovedEvidence', () => {
  it('gives the critic claims plus primary excerpts so excerpt-only details stay grounded', () => {
    const [evidence] = criticApprovedEvidence([storyWithPrimaryExcerpt()]);
    expect(evidence.claims).toHaveLength(1);
    expect(evidence.primarySourceExcerpt?.excerpt).toContain('Python and Sage');
  });
});

describe('criticPrompt', () => {
  it('instructs the critic to accept excerpt-supported details missing from numbered claims', () => {
    const bundle = {
      en: { locale: 'en', stories: [] },
      uk: { locale: 'uk', stories: [] },
    } as unknown as WeeklyMasterBundle;
    const prompt = criticPrompt(bundle, [storyWithPrimaryExcerpt()]);
    expect(prompt).toContain('claims AND the attached primary/corroborating source excerpts');
    expect(prompt).toContain('do NOT flag it as UNSUPPORTED_');
    expect(prompt).toContain('Python and Sage');
    expect(prompt).toContain('APPROVED EVIDENCE');
  });
});

describe('premiumGeminiEditorialModels', () => {
  it('finds Pro after faster models in the live-ranked queue', () => {
    expect(
      premiumGeminiEditorialModels(['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-pro']),
    ).toEqual(['gemini-3.5-pro']);
  });

  it('rejects non-premium model families', () => {
    expect(
      premiumGeminiEditorialModels(['gemini-3.6-flash', 'gemini-3-mini', 'gemini-3-nano']),
    ).toEqual([]);
  });
});

const story = (revisionItemId: string, placement: 'feature' | 'radar') => ({
  revisionItemId,
  rank: placement === 'feature' ? 1 : 4,
  placement,
  titleEn: 'Title',
  titleUk: 'Заголовок',
  summaryEn: 'Summary',
  summaryUk: 'Підсумок',
  whyEn: null,
  whyUk: null,
  sources: [{ name: 'Example', url: 'https://example.com' }],
  claims: [{ id: 'claim-1', text: 'A supported claim.', evidenceUrls: ['https://example.com'] }],
});

describe('storySegmentPrompt', () => {
  const material = approvedStoryPromptMaterial([story('item-1', 'feature')])[0]!;

  it('scopes the call to one story and gives it its own word budget', () => {
    const prompt = storySegmentPrompt({
      material,
      placement: 'feature',
      rank: 1,
      alreadyWritten: [],
      guidance: [],
    });
    expect(prompt).toContain('Write ONE story (rank 1, feature)');
    expect(prompt).toContain('400-520 words');
    expect(prompt).toContain('only this one');
  });

  it('gives radar stories the shorter body budget and drops the feature-only fields', () => {
    const prompt = storySegmentPrompt({
      material,
      placement: 'radar',
      rank: 5,
      alreadyWritten: [],
      guidance: [],
    });
    expect(prompt).toContain('80-120 words');
    expect(prompt).toContain('must both be empty strings');
  });

  // One call per story cannot see the rest of the edition, so the writer is
  // handed what has already been said to keep three stories from opening the
  // same way.
  it('passes already-written headlines so framings are not repeated', () => {
    const prompt = storySegmentPrompt({
      material,
      placement: 'feature',
      rank: 3,
      alreadyWritten: [{ rank: 1, headline: 'First story', hook: 'First hook' }],
      guidance: [],
    });
    expect(prompt).toContain('ALREADY WRITTEN IN THIS EDITION');
    expect(prompt).toContain('First story');
  });

  it('keeps the evidence and invented-scene rules from the whole-edition prompt', () => {
    const prompt = storySegmentPrompt({
      material,
      placement: 'feature',
      rank: 1,
      alreadyWritten: [],
      guidance: [],
    });
    expect(prompt).toContain('Never invent a person staring at a screen');
    expect(prompt).toContain('never open a sentence with the name of another field');
  });
});

describe('parseStorySegment', () => {
  const response = JSON.stringify({
    story: {
      headline: 'H',
      summary: 'S',
      hook: 'K',
      body: 'B',
      why: 'W',
      practical: 'P',
      limitation: 'L',
      takeaway: 'T',
      editorsView: 'E',
      discussionQuestion: 'Q',
      claimIds: ['claim-1', 'invented-claim', 'claim-from-another-story'],
    },
  });

  // An invented or borrowed claim id used to survive into the bundle and
  // become an `unsupported_claim_id` blocker that cost a full regenerate.
  it('drops claim ids outside this story’s approved set', () => {
    expect(parseStorySegment(response, ['claim-1']).claimIds).toEqual(['claim-1']);
  });

  it('accepts a bare story object as well as a wrapped one', () => {
    const bare = JSON.stringify(JSON.parse(response).story);
    expect(parseStorySegment(bare, ['claim-1']).headline).toBe('H');
  });

  it('treats a missing editorsView as an empty radar field rather than a parse failure', () => {
    const radar = JSON.parse(response);
    delete radar.story.editorsView;
    expect(parseStorySegment(JSON.stringify(radar), ['claim-1']).editorsView).toBe('');
  });

  it('rejects a response missing a required prose field', () => {
    const broken = JSON.parse(response);
    delete broken.story.body;
    expect(() => parseStorySegment(JSON.stringify(broken), ['claim-1'])).toThrow(/body/);
  });
});

describe('repairFieldPrompt / parseRepairedValue', () => {
  it('sends one field with its contract, problems and grounding — not the article', () => {
    const prompt = repairFieldPrompt({
      target: { locale: 'en', revisionItemId: 'item-1', field: 'practical' },
      currentValue: 'Teams can use this in their workflow.',
      issues: [
        {
          code: 'usefulness_generic',
          message: 'Generic template.',
          suggestedFix: 'Name a concrete actor.',
        },
      ],
      grounding: { claims: [{ id: 'claim-1', text: 'A supported claim.' }] },
    });
    expect(prompt).toContain('FIELD: practical');
    expect(prompt).toContain('concrete actor, workflow, action, constraint and observable result');
    expect(prompt).toContain('APPROVED EVIDENCE FOR THIS STORY');
    expect(prompt).toContain('{"value": ""}');
    // The whole point: a fraction of the ~53,000-character writer prompt.
    expect(prompt.length).toBeLessThan(12_000);
  });

  it('asks a Ukrainian repair to hold parity with the English counterpart', () => {
    const prompt = repairFieldPrompt({
      target: { locale: 'uk', revisionItemId: 'item-1', field: 'body' },
      currentValue: 'Український текст.',
      issues: [{ code: 'language_mechanics', message: 'Помилка узгодження.', span: 'узгодження' }],
      englishCounterpart: 'The English body.',
    });
    expect(prompt).toContain('ENGLISH COUNTERPART');
    expect(prompt).toContain('The English body.');
  });

  it('asks for a list shape when the field is a list', () => {
    const prompt = repairFieldPrompt({
      target: { locale: 'en', revisionItemId: 'item-1', field: 'claimIds' },
      currentValue: ['claim-1'],
      issues: [{ code: 'ungrounded_story', message: 'No approved claim cited.' }],
    });
    expect(prompt).toContain('{"value": ["", ""]}');
  });

  it('parses both response shapes and rejects an empty one', () => {
    expect(parseRepairedValue('{"value":"Fixed."}', false)).toBe('Fixed.');
    expect(parseRepairedValue('{"value":["claim-1"]}', true)).toEqual(['claim-1']);
    expect(() => parseRepairedValue('{"value":""}', false)).toThrow();
  });

  it('recovers a repair value from a conversational preamble', () => {
    expect(parseRepairedValue('Here is the fix:\n\n{"value":"Fixed."}', false)).toBe('Fixed.');
  });
});

describe('extractJsonObject', () => {
  // The exact shape that killed a live job (2026-08-09, run 31324873875)
  // after 22 minutes and a successful EN, UK and critic pass: the revise
  // step answered as an assistant instead of as an API.
  it('digs the object out of a conversational preamble', () => {
    const raw = '**Applying the requested fixes**\n\n{"locale":"en","title":"Fixed"}';
    expect(JSON.parse(extractJsonObject(raw)!)).toEqual({ locale: 'en', title: 'Fixed' });
  });

  it('is not fooled by braces or escaped quotes inside strings', () => {
    const raw = 'here you go: {"body":"a \\"quoted\\" { brace }","n":1} -- hope that helps';
    expect(JSON.parse(extractJsonObject(raw)!)).toEqual({
      body: 'a "quoted" { brace }',
      n: 1,
    });
  });

  it('stops at the first complete object rather than swallowing trailing prose', () => {
    expect(extractJsonObject('{"a":{"b":2}} and then some chatter {')).toBe('{"a":{"b":2}}');
  });

  it('returns null when there is no object at all', () => {
    expect(extractJsonObject('I cannot help with that.')).toBeNull();
  });
});
