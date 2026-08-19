import type { WeeklyVideoScene } from './content-studio';

export const VIDEO_I2V_SERVICE = {
  name: 'Hailuo',
  alt: 'Krea Video',
  url: 'https://hailuoai.video',
  rule:
    'Image-to-video, 5–8s, loop-friendly, no on-screen text, no watermark. Do not crop watermarks.',
} as const;

export const VIDEO_AVATAR_SERVICE = {
  name: 'HeyGen',
  url: 'https://www.heygen.com',
  rule:
    'Talking-head clip. Paste the voiceover verbatim. When this file is in the video repo, Remotion mutes Edge TTS for that scene.',
} as const;

const SCENE_KINDS = ['cold_open', 'anchor', 'broll', 'outro'] as const;

export type StoryStillRef = {
  revisionItemId: string;
  title: string;
  imageUrl: string | null;
  imageReady: boolean;
};

export type VideoShootJob = {
  id: string;
  serviceName: string;
  serviceUrl: string;
  serviceRule: string;
  action: string;
  copyLabel: string;
  copyText: string;
  outputRelPath: string;
  stillTitle: string | null;
  stillUrl: string | null;
  stillReady: boolean;
};

export type VideoShootScene = {
  index: number;
  fileIndex: string;
  sceneId: string;
  kind: WeeklyVideoScene['kind'];
  durationSeconds: number;
  onScreenText: string;
  jobs: VideoShootJob[];
};

export type VideoShootPack = {
  digestId: string;
  dropBrollDir: string;
  dropAvatarDir: string;
  assembleNote: string;
  scenes: VideoShootScene[];
  blockers: string[];
};

function isWeeklyVideoKind(value: unknown): value is WeeklyVideoScene['kind'] {
  return typeof value === 'string' && (SCENE_KINDS as readonly string[]).includes(value);
}

export function isWeeklyVideoScene(value: unknown): value is WeeklyVideoScene {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || !row.id) return false;
  if (!isWeeklyVideoKind(row.kind)) return false;
  if (row.revisionItemId !== null && typeof row.revisionItemId !== 'string') return false;
  if (typeof row.voiceover !== 'string') return false;
  if (typeof row.onScreenText !== 'string') return false;
  if (typeof row.scenePrompt !== 'string') return false;
  if (typeof row.durationSeconds !== 'number' || !Number.isFinite(row.durationSeconds)) return false;
  return true;
}

export function parseWeeklyVideoScenes(raw: unknown): WeeklyVideoScene[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isWeeklyVideoScene);
}

export function sceneFileIndex(zeroBased: number): string {
  return String(zeroBased + 1).padStart(2, '0');
}

function wrapI2vPrompt(scenePrompt: string): string {
  const visual = scenePrompt.trim() || 'subtle newsroom motion of this story';
  return `${visual}. subtle cinematic camera push-in, volumetric light, no text, loop-friendly motion, 5s`;
}

function stillFor(
  revisionItemId: string | null,
  stills: StoryStillRef[],
  fallbackId: string | null,
): StoryStillRef | null {
  const id = revisionItemId ?? fallbackId;
  if (!id) return null;
  return stills.find((still) => still.revisionItemId === id) ?? null;
}

function firstBrollItemId(scenes: WeeklyVideoScene[]): string | null {
  const broll = scenes.find((scene) => scene.kind === 'broll' && scene.revisionItemId);
  return broll?.revisionItemId ?? null;
}

function firstStudioZeroIndex(scenes: WeeklyVideoScene[]): number {
  return scenes.findIndex((scene) => scene.kind === 'anchor' || scene.kind === 'outro');
}

function i2vNewsJob(input: {
  digestId: string;
  fileIndex: string;
  scene: WeeklyVideoScene;
  still: StoryStillRef | null;
}): VideoShootJob {
  const stillHint = input.still
    ? `Start frame: Visuals → “${input.still.title}”.`
    : 'Start frame: download the matching approved story JPEG from Visuals.';
  return {
    id: `i2v-${input.fileIndex}`,
    serviceName: `${VIDEO_I2V_SERVICE.name} (or ${VIDEO_I2V_SERVICE.alt})`,
    serviceUrl: VIDEO_I2V_SERVICE.url,
    serviceRule: VIDEO_I2V_SERVICE.rule,
    action: `Generate a 5s living news clip. ${stillHint} The motion must show this story’s event, not a still Ken Burns.`,
    copyLabel: 'Copy i2v prompt',
    copyText: wrapI2vPrompt(input.scene.scenePrompt),
    outputRelPath: `public/broll/${input.digestId}/scene-${input.fileIndex}.mp4`,
    stillTitle: input.still?.title ?? null,
    stillUrl: input.still?.imageUrl ?? null,
    stillReady: Boolean(input.still?.imageReady),
  };
}

function studioJob(input: {
  digestId: string;
  fileIndex: string;
  scene: WeeklyVideoScene;
  reuseFrom: string | null;
}): VideoShootJob {
  const reuse =
    input.reuseFrom && input.reuseFrom !== input.fileIndex
      ? `Reuse the studio loop from scene-${input.reuseFrom}.mp4 (copy the file).`
      : 'Generate a quiet newsroom loop (empty desk / blurred monitors).';
  return {
    id: `studio-${input.fileIndex}`,
    serviceName: `${VIDEO_I2V_SERVICE.name} (or ${VIDEO_I2V_SERVICE.alt})`,
    serviceUrl: VIDEO_I2V_SERVICE.url,
    serviceRule: VIDEO_I2V_SERVICE.rule,
    action: `${reuse} This is the background under the presenter PiP.`,
    copyLabel: 'Copy studio i2v prompt',
    copyText: wrapI2vPrompt(input.scene.scenePrompt),
    outputRelPath: `public/broll/${input.digestId}/scene-${input.fileIndex}.mp4`,
    stillTitle: null,
    stillUrl: null,
    stillReady: true,
  };
}

function avatarJob(input: {
  digestId: string;
  fileIndex: string;
  scene: WeeklyVideoScene;
}): VideoShootJob {
  return {
    id: `avatar-${input.fileIndex}`,
    serviceName: VIDEO_AVATAR_SERVICE.name,
    serviceUrl: VIDEO_AVATAR_SERVICE.url,
    serviceRule: VIDEO_AVATAR_SERVICE.rule,
    action:
      'Record the presenter saying this text exactly. Save as the slot filename. PiP is ~20–25% of the frame in Remotion.',
    copyLabel: 'Copy avatar script',
    copyText: input.scene.voiceover.trim(),
    outputRelPath: `public/avatar/${input.digestId}/scene-${input.fileIndex}.mp4`,
    stillTitle: null,
    stillUrl: null,
    stillReady: true,
  };
}

function jobsForScene(input: {
  digestId: string;
  index: number;
  scene: WeeklyVideoScene;
  stills: StoryStillRef[];
  fallbackStillId: string | null;
  firstStudioFile: string | null;
}): VideoShootJob[] {
  const fileIndex = sceneFileIndex(input.index);
  switch (input.scene.kind) {
    case 'cold_open':
      return [
        i2vNewsJob({
          digestId: input.digestId,
          fileIndex,
          scene: input.scene,
          still: stillFor(input.scene.revisionItemId, input.stills, input.fallbackStillId),
        }),
      ];
    case 'broll':
      return [
        i2vNewsJob({
          digestId: input.digestId,
          fileIndex,
          scene: input.scene,
          still: stillFor(input.scene.revisionItemId, input.stills, null),
        }),
      ];
    case 'anchor':
    case 'outro':
      return [
        avatarJob({ digestId: input.digestId, fileIndex, scene: input.scene }),
        studioJob({
          digestId: input.digestId,
          fileIndex,
          scene: input.scene,
          reuseFrom: input.firstStudioFile,
        }),
      ];
    default: {
      const unexpected: never = input.scene.kind;
      return unexpected;
    }
  }
}

function collectBlockers(scenes: WeeklyVideoScene[], shootScenes: VideoShootScene[]): string[] {
  const blockers: string[] = [];
  if (scenes.length === 0) {
    blockers.push('Generate the TV-news script before shooting. There are no scenes yet.');
    return blockers;
  }
  for (const scene of shootScenes) {
    for (const job of scene.jobs) {
      if (job.id.startsWith('i2v-') && !job.stillReady) {
        blockers.push(
          `scene-${scene.fileIndex} (${scene.sceneId}): approve the matching story image on Visuals before Hailuo.`,
        );
      }
      if (job.id.startsWith('avatar-') && !job.copyText) {
        blockers.push(`scene-${scene.fileIndex} (${scene.sceneId}): avatar scene has empty voiceover.`);
      }
    }
  }
  return blockers;
}

export function buildVideoShootPack(input: {
  digestId: string;
  scenes: unknown;
  stills: StoryStillRef[];
}): VideoShootPack {
  const scenes = parseWeeklyVideoScenes(input.scenes);
  const fallbackStillId = firstBrollItemId(scenes);
  const studioZero = firstStudioZeroIndex(scenes);
  const firstStudioFile = studioZero >= 0 ? sceneFileIndex(studioZero) : null;
  const shootScenes = scenes.map((scene, index) => ({
    index: index + 1,
    fileIndex: sceneFileIndex(index),
    sceneId: scene.id,
    kind: scene.kind,
    durationSeconds: scene.durationSeconds,
    onScreenText: scene.onScreenText,
    jobs: jobsForScene({
      digestId: input.digestId,
      index,
      scene,
      stills: input.stills,
      fallbackStillId,
      firstStudioFile,
    }),
  }));
  return {
    digestId: input.digestId,
    dropBrollDir: `public/broll/${input.digestId}/`,
    dropAvatarDir: `public/avatar/${input.digestId}/`,
    assembleNote:
      'After the clips are on disk, assemble only in the ai-today-brief-video repo (`npm run media:refresh`, then Remotion). This admin does not render MP4.',
    scenes: shootScenes,
    blockers: collectBlockers(scenes, shootScenes),
  };
}
