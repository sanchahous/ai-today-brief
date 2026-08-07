import 'server-only';

import {
  type WeeklyArticleMaster,
  type WeeklyQualityIssue,
  type WeeklyVideoScript,
  validateVideoScript,
} from './content-studio';
import { voicePromptBlock } from './editorial-voice';
import {
  generateFirstAvailable,
  type EditorialGenerationMetadata,
  type ProviderResult,
} from './editorial-llm';

export interface WeeklyVideoScriptGenerationResult {
  script: WeeklyVideoScript;
  generation: EditorialGenerationMetadata;
  issues: WeeklyQualityIssue[];
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const normalized = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const value = JSON.parse(normalized) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SyntaxError('Video script model must return one JSON object.');
  }
  return value as Record<string, unknown>;
}

function requiredString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim()) throw new SyntaxError(`${key} is required.`);
  return value.trim();
}

function optionalString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === 'string' ? value.trim() : '';
}

function requiredNumber(row: Record<string, unknown>, key: string) {
  const value = Number(row[key]);
  if (!Number.isFinite(value)) throw new SyntaxError(`${key} must be a finite number.`);
  return value;
}

function stringArray(value: unknown, key: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new SyntaxError(`${key} must be a string array.`);
  }
  return value.map((entry) => (entry as string).trim()).filter(Boolean);
}

function recordArray(value: unknown, key: string) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))
  ) {
    throw new SyntaxError(`${key} must be an object array.`);
  }
  return value as Array<Record<string, unknown>>;
}

const SCENE_KINDS = new Set(['cold_open', 'anchor', 'broll', 'outro']);

function parseVideoScript(raw: string): WeeklyVideoScript {
  const row = parseJsonObject(raw);
  const scenes = recordArray(row.scenes, 'scenes').map((scene) => {
    const kind = requiredString(scene, 'kind');
    if (!SCENE_KINDS.has(kind)) throw new SyntaxError(`Unknown scene kind "${kind}".`);
    return {
      id: requiredString(scene, 'id'),
      kind: kind as WeeklyVideoScript['scenes'][number]['kind'],
      revisionItemId: optionalString(scene, 'revisionItemId') || null,
      voiceover: requiredString(scene, 'voiceover'),
      onScreenText: optionalString(scene, 'onScreenText'),
      scenePrompt: requiredString(scene, 'scenePrompt'),
      durationSeconds: requiredNumber(scene, 'durationSeconds'),
    };
  });
  const shorts = recordArray(row.shorts, 'shorts').map((short) => ({
    revisionItemId: requiredString(short, 'revisionItemId'),
    locale: 'uk' as const,
    hook: requiredString(short, 'hook'),
    context: requiredString(short, 'context'),
    insight: requiredString(short, 'insight'),
    takeaway: requiredString(short, 'takeaway'),
    factIds: stringArray(short.factIds, 'short.factIds'),
    durationSeconds: requiredNumber(short, 'durationSeconds'),
  }));
  return {
    title: requiredString(row, 'title'),
    hook: requiredString(row, 'hook'),
    // Computed from the actual scenes rather than trusted from the model --
    // a full-episode narration string the model writes independently of the
    // per-scene voiceover is exactly the kind of field that can silently
    // drift out of sync with what will actually be spoken.
    narration: scenes.map((scene) => scene.voiceover).join('\n\n'),
    scenes,
    shorts,
  };
}

/**
 * TV-news dramaturgy: cold open -> anchor bridge -> one dramatized b-roll
 * segment per Top 3 story -> quick-hits wrap -> discussion outro. Each
 * broll scene carries the feature story's own `revisionItemId` so the video
 * renderer can map it to that story's approved illustration instead of the
 * old `index % assets.length` guess (see wiki/pipeline/video-boundary.md).
 */
function videoScriptPrompt(
  articleEn: WeeklyArticleMaster,
  guidance: WeeklyQualityIssue[] = [],
): string {
  const features = articleEn.stories.filter((story) => story.placement === 'feature');
  const radar = articleEn.stories.filter((story) => story.placement === 'radar');
  const material = {
    edition: { title: articleEn.title, theme: articleEn.theme },
    features: features.map((story) => ({
      revisionItemId: story.revisionItemId,
      headline: story.headline,
      body: story.body,
      why: story.why,
      practical: story.practical,
      editorsView: story.editorsView,
      discussionQuestion: story.discussionQuestion,
      claimIds: story.claimIds,
    })),
    radar: radar.map((story) => ({
      revisionItemId: story.revisionItemId,
      headline: story.headline,
      summary: story.summary,
    })),
  };
  const guidanceBlock = guidance.length
    ? `\n\nPRIOR VALIDATION FAILURES TO FIX\nThe previous draft failed these checks -- resolve every one in the new draft:\n${JSON.stringify(guidance.map((issue) => ({ code: issue.code, message: issue.message })))}`
    : '';
  return `You are the head writer for the AI Today Brief weekly video edition -- a news-format YouTube episode, not a corporate webinar. Dramatize this week's already-approved, already-fact-checked article into a real news broadcast: a cold open, an anchor bridge, one dramatized field segment per Top 3 story, a quick-hits wrap of the rest, and a discussion outro. Never invent facts beyond what the supplied story material states.

${voicePromptBlock('en')}

SCENE STRUCTURE (return exactly these, in this order)
1. ONE "cold_open" scene (id "cold_open", revisionItemId null, 15-25s): open mid-moment on the single most striking fact across the three features -- not a "welcome to this week's AI news" preamble.
2. ONE "anchor" scene (id "anchor_intro", revisionItemId null, 10-20s): a studio anchor bridges from the cold open into "here's what we're covering" -- this is a HeyGen avatar slot, so onScreenText should carry the episode title.
3. EXACTLY ONE "broll" scene per feature story (id "broll_<revisionItemId>", revisionItemId set to that story's exact revisionItemId, 60-100s each): a dramatized field segment. voiceover explains what happened and why it matters, grounded ONLY in that story's own body/why/practical/editorsView -- do not cite facts from other stories. scenePrompt describes ONE reportage-style visual frame for this segment: picture a photojournalist on location for this exact event -- name a specific concrete actor (person, machine, screen, object) performing the specific action, never a symbolic metaphor (no glowing brains, cracked padlocks, robotic handshakes). No text, logos or readable screens in the frame. 18-32 words, concrete nouns, one focal subject.
4. ONE "anchor" quick-hits scene (id "anchor_radar", revisionItemId null, 30-50s): rapid-fire wrap of the radar stories, one clause each.
5. ONE "outro" scene (id "outro", revisionItemId null, 20-35s): close on one of the feature discussionQuestions, inviting the viewer to weigh in -- do not just say "thanks for watching."

DURATION -- THE SINGLE MOST IMPORTANT RULE
Write each scene's voiceover FIRST, then set durationSeconds = (word count of that voiceover) / 2.6, rounded to the nearest second. Never pick a duration first and pad or shorten the voiceover to fit it -- a validator checks every scene's duration against its own voiceover word count within +-20% and rejects the whole draft on any mismatch. All scene durations must sum to 360-480 seconds total, which naturally requires roughly 950-1250 words of combined voiceover across all scenes -- write narration that long, do not invent silence.

SHORTS -- exactly three Ukrainian-language YouTube Shorts, one per feature story (revisionItemId = that story's revisionItemId), 35-50s each (duration follows the same words/2.6 logic as scenes, computed on the combined hook+context+insight+takeaway text). Write hook/context/insight/takeaway directly in Ukrainian, in-voice:

${voicePromptBlock('uk')}

factIds for each short must be a non-empty subset of that story's own claimIds (supplied below) -- never invent an ID.

JSON SHAPE
{"title":"","hook":"","scenes":[{"id":"","kind":"cold_open|anchor|broll|outro","revisionItemId":null,"voiceover":"","onScreenText":"","scenePrompt":"","durationSeconds":0}],"shorts":[{"revisionItemId":"","hook":"","context":"","insight":"","takeaway":"","factIds":[""],"durationSeconds":0}]}
Return one JSON object only.

STORY MATERIAL
${JSON.stringify(material)}${guidanceBlock}`;
}

const MAX_ATTEMPTS = 2;

/**
 * Generates and deterministically validates the weekly video script,
 * retrying once (full regenerate, with the failed validator issues fed back
 * as guidance) before surfacing the failure to the caller. Runs after the
 * master article is approved -- see generation-worker.ts's video_script job.
 */
export async function generateWeeklyVideoScript(
  articleEn: WeeklyArticleMaster,
): Promise<WeeklyVideoScriptGenerationResult> {
  const expectedStories = articleEn.stories.map((story) => ({
    revisionItemId: story.revisionItemId,
    placement: story.placement,
    claimIds: story.claimIds,
  }));
  let guidance: WeeklyQualityIssue[] = [];
  for (let attempt = 1; ; attempt += 1) {
    const result: ProviderResult<WeeklyVideoScript> = await generateFirstAvailable(
      videoScriptPrompt(articleEn, guidance),
      parseVideoScript,
    );
    const issues = validateVideoScript(result.value, expectedStories);
    const blockers = issues.filter((issue) => issue.blocker);
    if (blockers.length === 0) {
      return { script: result.value, generation: result.metadata, issues };
    }
    if (attempt >= MAX_ATTEMPTS) {
      throw new Error(
        `Video script failed validation after ${attempt} attempt(s): ${blockers.map((issue) => `${issue.code}: ${issue.message}`).join('; ')}`,
      );
    }
    guidance = blockers;
  }
}
