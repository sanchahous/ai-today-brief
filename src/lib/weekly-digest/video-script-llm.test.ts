import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../pipeline/openrouter-models', () => ({
  fetchOpenRouterModels: vi.fn().mockResolvedValue([
    {
      id: 'vendor/writer-model',
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

import { generateWithOpenRouterChain } from '../../../pipeline/openrouter-summarize';
import { generateWeeklyVideoScript } from './video-script-llm';
import type { WeeklyArticleMaster } from './content-studio';

afterEach(() => {
  vi.mocked(generateWithOpenRouterChain).mockReset();
  vi.unstubAllEnvs();
});

const FEATURE_IDS = ['f-1', 'f-2', 'f-3'];

function articleStory(revisionItemId: string, placement: 'feature' | 'radar', index: number) {
  return {
    revisionItemId,
    placement,
    headline: `Headline ${index}`,
    summary: `Summary ${index}`,
    hook: `Hook ${index}`,
    body: `Body ${index}`,
    why: `Why ${index}`,
    practical: `Practical ${index}`,
    limitation: `Limitation ${index}`,
    takeaway: `Takeaway ${index}`,
    editorsView: placement === 'feature' ? `Editorial reasoning ${index}` : '',
    discussionQuestion: placement === 'feature' ? `Discussion question ${index}?` : '',
    claimIds: [`claim-${revisionItemId}`],
  };
}

function article(): WeeklyArticleMaster {
  return {
    locale: 'en',
    title: 'A theme-led weekly title',
    seoTitle: 't',
    metaDescription: 'd',
    ogTitle: 't',
    ogDescription: 'd',
    standfirst: 's',
    theme: 'Operational AI',
    intro: 'i',
    editorNote: 'e',
    keyTakeaways: ['k'],
    topics: ['t'],
    entities: ['e'],
    internalLinks: [],
    conclusion: 'c',
    stories: [
      ...FEATURE_IDS.map((id, index) => articleStory(id, 'feature', index + 1)),
      articleStory('r-1', 'radar', 4),
    ],
  };
}

function words(count: number) {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(' ');
}

function scenePayload(overrides: Record<string, unknown>) {
  return {
    id: 'scene',
    kind: 'broll',
    revisionItemId: null,
    voiceover: words(130),
    onScreenText: '',
    scenePrompt: 'A concrete reportage scene, one subject, no on-screen text.',
    durationSeconds: 50,
    ...overrides,
  };
}

function shortPayload(overrides: Record<string, unknown>) {
  return {
    revisionItemId: FEATURE_IDS[0],
    hook: 'Хук',
    context: 'Контекст',
    insight: 'Інсайт',
    takeaway: 'Дія',
    factIds: [`claim-${FEATURE_IDS[0]}`],
    durationSeconds: 40,
    ...overrides,
  };
}

function validScriptPayload() {
  return {
    title: 'Weekly episode',
    hook: 'The week changed.',
    scenes: [
      scenePayload({ id: 'cold_open', kind: 'cold_open', voiceover: words(65), durationSeconds: 25 }),
      scenePayload({ id: 'anchor_intro', kind: 'anchor', voiceover: words(45), durationSeconds: 17 }),
      scenePayload({
        id: 'broll_1',
        kind: 'broll',
        revisionItemId: FEATURE_IDS[0],
        voiceover: words(260),
        durationSeconds: 100,
      }),
      scenePayload({
        id: 'broll_2',
        kind: 'broll',
        revisionItemId: FEATURE_IDS[1],
        voiceover: words(260),
        durationSeconds: 100,
      }),
      scenePayload({
        id: 'broll_3',
        kind: 'broll',
        revisionItemId: FEATURE_IDS[2],
        voiceover: words(260),
        durationSeconds: 100,
      }),
      scenePayload({ id: 'anchor_radar', kind: 'anchor', voiceover: words(90), durationSeconds: 35 }),
      scenePayload({ id: 'outro', kind: 'outro', voiceover: words(55), durationSeconds: 21 }),
    ],
    shorts: FEATURE_IDS.map((id) =>
      shortPayload({ revisionItemId: id, factIds: [`claim-${id}`] }),
    ),
  };
}

function mockWriterResponse(text: string) {
  return { text, provider: 'openrouter' as const, model: 'vendor/writer-model', usage: null };
}

describe('generateWeeklyVideoScript', () => {
  it('parses a valid script, recomputing narration from the scene voiceovers rather than trusting the model', async () => {
    vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue(
      mockWriterResponse(JSON.stringify(validScriptPayload())),
    );

    const result = await generateWeeklyVideoScript(article());

    expect(result.issues.filter((issue) => issue.blocker)).toEqual([]);
    expect(result.script.scenes).toHaveLength(7);
    expect(result.script.narration).toBe(
      result.script.scenes.map((scene) => scene.voiceover).join('\n\n'),
    );
    expect(result.script.shorts.every((short) => short.locale === 'uk')).toBe(true);
    expect(generateWithOpenRouterChain).toHaveBeenCalledTimes(1);
  });

  it('retries once with the validator issues fed back as guidance, then succeeds', async () => {
    vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
    const tooFewShorts = { ...validScriptPayload(), shorts: validScriptPayload().shorts.slice(0, 2) };
    vi.mocked(generateWithOpenRouterChain)
      .mockResolvedValueOnce(mockWriterResponse(JSON.stringify(tooFewShorts)))
      .mockResolvedValueOnce(mockWriterResponse(JSON.stringify(validScriptPayload())));

    const result = await generateWeeklyVideoScript(article());

    expect(generateWithOpenRouterChain).toHaveBeenCalledTimes(2);
    expect(result.script.shorts).toHaveLength(3);
    const secondPrompt = vi.mocked(generateWithOpenRouterChain).mock.calls[1]![0] as string;
    expect(secondPrompt).toContain('PRIOR VALIDATION FAILURES TO FIX');
    expect(secondPrompt).toContain('shorts_count');
  });

  it('throws with the blocker details after exhausting retries on a script that never validates', async () => {
    vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
    const tooFewShorts = { ...validScriptPayload(), shorts: validScriptPayload().shorts.slice(0, 2) };
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue(
      mockWriterResponse(JSON.stringify(tooFewShorts)),
    );

    await expect(generateWeeklyVideoScript(article())).rejects.toThrow(/shorts_count/);
    expect(generateWithOpenRouterChain).toHaveBeenCalledTimes(2);
  });

  it('rejects a scene whose claimed duration does not match its voiceover length', async () => {
    vi.stubEnv('OPEN_ROUTER_API_KEY', 'test-key');
    const mismatched = validScriptPayload();
    mismatched.scenes[2]!.durationSeconds = 100;
    mismatched.scenes[2]!.voiceover = words(10);
    vi.mocked(generateWithOpenRouterChain).mockResolvedValue(
      mockWriterResponse(JSON.stringify(mismatched)),
    );

    await expect(generateWeeklyVideoScript(article())).rejects.toThrow(/scene_narration_mismatch/);
  });
});
