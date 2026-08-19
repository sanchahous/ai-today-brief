import { describe, expect, it } from 'vitest';
import type { WeeklyVideoScene } from './content-studio';
import {
  buildVideoShootPack,
  parseWeeklyVideoScenes,
  sceneFileIndex,
} from './video-shoot-pack';

function scene(partial: Partial<WeeklyVideoScene> & Pick<WeeklyVideoScene, 'id' | 'kind'>): WeeklyVideoScene {
  return {
    revisionItemId: null,
    voiceover: 'Spoken line.',
    onScreenText: 'ON SCREEN',
    scenePrompt: 'A specific news event in motion.',
    durationSeconds: 20,
    ...partial,
  };
}

const featureA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const featureB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const featureC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const tvNews: WeeklyVideoScene[] = [
  scene({ id: 'cold_open', kind: 'cold_open', voiceover: 'Hook numbers.' }),
  scene({ id: 'anchor_intro', kind: 'anchor', voiceover: 'Welcome to AI Today Brief.' }),
  scene({
    id: 'broll_a',
    kind: 'broll',
    revisionItemId: featureA,
    scenePrompt: 'Only some GPU racks light up.',
  }),
  scene({
    id: 'broll_b',
    kind: 'broll',
    revisionItemId: featureB,
    scenePrompt: 'A playbook shrinks to retrieved lines.',
  }),
  scene({
    id: 'broll_c',
    kind: 'broll',
    revisionItemId: featureC,
    scenePrompt: 'Model weights download onto a laptop.',
  }),
  scene({ id: 'anchor_radar', kind: 'anchor', voiceover: 'Now, quick hits from the radar.' }),
  scene({ id: 'outro', kind: 'outro', voiceover: 'Drop your take in the comments.' }),
];

const stills = [
  { revisionItemId: featureA, title: 'Qwen3.8', imageUrl: 'https://img.test/a.jpg', imageReady: true },
  { revisionItemId: featureB, title: 'ALTK', imageUrl: 'https://img.test/b.jpg', imageReady: true },
  { revisionItemId: featureC, title: 'Licensing', imageUrl: 'https://img.test/c.jpg', imageReady: false },
];

describe('parseWeeklyVideoScenes', () => {
  it('keeps well-formed scenes and drops junk', () => {
    expect(parseWeeklyVideoScenes([tvNews[0], { kind: 'broll' }, null])).toEqual([tvNews[0]]);
  });
});

describe('buildVideoShootPack', () => {
  it('maps TV-news kinds onto Hailuo and HeyGen jobs with Remotion slot names', () => {
    const pack = buildVideoShootPack({
      digestId: 'digest-1',
      scenes: tvNews,
      stills,
    });
    expect(sceneFileIndex(0)).toBe('01');
    expect(pack.scenes).toHaveLength(7);
    expect(pack.dropBrollDir).toBe('public/broll/digest-1/');
    expect(pack.scenes[0]?.jobs).toHaveLength(1);
    expect(pack.scenes[0]?.jobs[0]?.serviceName).toMatch(/Hailuo/);
    expect(pack.scenes[0]?.jobs[0]?.outputRelPath).toBe('public/broll/digest-1/scene-01.mp4');
    expect(pack.scenes[0]?.jobs[0]?.stillTitle).toBe('Qwen3.8');
    expect(pack.scenes[1]?.jobs.map((job) => job.id)).toEqual(['avatar-02', 'studio-02']);
    expect(pack.scenes[1]?.jobs[0]?.copyText).toBe('Welcome to AI Today Brief.');
    expect(pack.scenes[1]?.jobs[0]?.outputRelPath).toBe('public/avatar/digest-1/scene-02.mp4');
    expect(pack.scenes[5]?.jobs[1]?.action).toMatch(/scene-02/);
    expect(pack.blockers.some((line) => line.includes('scene-05'))).toBe(true);
    expect(pack.assembleNote).toMatch(/ai-today-brief-video/);
  });

  it('asks to generate the script when scenes are missing', () => {
    const pack = buildVideoShootPack({ digestId: 'd', scenes: [], stills: [] });
    expect(pack.scenes).toEqual([]);
    expect(pack.blockers[0]).toMatch(/no scenes/i);
  });

  it('flags empty avatar voiceover', () => {
    const pack = buildVideoShootPack({
      digestId: 'd',
      scenes: [scene({ id: 'anchor_intro', kind: 'anchor', voiceover: '   ' })],
      stills: [],
    });
    expect(pack.blockers.some((line) => line.includes('empty voiceover'))).toBe(true);
  });
});
