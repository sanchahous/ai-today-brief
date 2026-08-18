import { describe, expect, it } from 'vitest';
import {
  scenesFromVideoScriptContent,
  videoScriptFromArtifactContent,
} from './video-script-content';

const scene = {
  id: 'cold_open',
  kind: 'cold_open',
  revisionItemId: null,
  voiceover: 'Hook line.',
  onScreenText: 'HOOK',
  scenePrompt: 'A concrete scene.',
  durationSeconds: 20,
};

const shorts = [
  {
    revisionItemId: '11111111-1111-4111-8111-111111111111',
    locale: 'uk' as const,
    hook: 'Хук',
    context: 'Контекст',
    insight: 'Інсайт',
    takeaway: 'Дія',
    factIds: ['claim-1'],
    durationSeconds: 40,
  },
];

const fullPlan = {
  title: 'Weekly episode',
  hook: 'The week changed.',
  narration: 'Original narration.',
  scenes: [scene],
  shorts,
};

describe('scenesFromVideoScriptContent', () => {
  it('reads scenes from the generated plan object', () => {
    expect(scenesFromVideoScriptContent({ narration_plan: fullPlan })).toEqual([scene]);
  });

  it('reads a scenes-only narration_plan from a broken Save', () => {
    expect(scenesFromVideoScriptContent({ narration_plan: [scene] })).toEqual([scene]);
  });
});

describe('videoScriptFromArtifactContent', () => {
  it('returns the generated object and overlays content.script', () => {
    const parsed = videoScriptFromArtifactContent({
      script: 'Edited narration.',
      narration_plan: fullPlan,
    });
    expect(parsed?.title).toBe('Weekly episode');
    expect(parsed?.narration).toBe('Edited narration.');
    expect(parsed?.shorts).toHaveLength(1);
  });

  it('merges a scenes array onto the previous full plan', () => {
    const parsed = videoScriptFromArtifactContent(
      { script: 'Phrase fix.', narration_plan: [scene] },
      fullPlan,
    );
    expect(parsed?.hook).toBe('The week changed.');
    expect(parsed?.narration).toBe('Phrase fix.');
    expect(parsed?.scenes).toEqual([scene]);
    expect(parsed?.shorts).toEqual(shorts);
  });

  it('returns null when scenes-only JSON has no previous plan', () => {
    expect(
      videoScriptFromArtifactContent({ script: 'Phrase fix.', narration_plan: [scene] }),
    ).toBeNull();
  });
});
