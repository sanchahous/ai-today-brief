import type { Json } from '@/lib/database.types';
import type { WeeklyVideoScene, WeeklyVideoScript } from './content-studio';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Scene list for the Video tab JSON field. Generated artifacts store the
 * full plan object; owner Save used to persist the scenes array as
 * `narration_plan`, which the worker then rejected as "not the v3 script".
 */
export function scenesFromVideoScriptContent(content: unknown): Json {
  if (!isPlainObject(content)) return [];
  const plan = content.narration_plan;
  if (Array.isArray(plan)) return plan as Json;
  if (isPlainObject(plan) && Array.isArray(plan.scenes)) return plan.scenes as Json;
  return [];
}

/**
 * Rebuilds the worker's WeeklyVideoScript. `content.script` wins over
 * `narration`. A scenes-only `narration_plan` is valid only when
 * `previousPlan` still has title, hook and shorts.
 */
export function videoScriptFromArtifactContent(
  content: unknown,
  previousPlan?: unknown,
): WeeklyVideoScript | null {
  if (!isPlainObject(content)) return null;
  const plan = content.narration_plan;
  const scriptText = typeof content.script === 'string' ? content.script.trim() : '';
  const base = isPlainObject(plan) ? plan : isPlainObject(previousPlan) ? previousPlan : null;
  if (!base) return null;
  const scenes = Array.isArray(plan) ? plan : Array.isArray(base.scenes) ? base.scenes : null;
  const shorts = Array.isArray(base.shorts) ? base.shorts : null;
  const title = typeof base.title === 'string' ? base.title.trim() : '';
  const hook = typeof base.hook === 'string' ? base.hook.trim() : '';
  const narration =
    scriptText || (typeof base.narration === 'string' ? base.narration.trim() : '');
  if (!title || !hook || !narration || !scenes?.length || !shorts?.length) return null;
  return {
    title,
    hook,
    narration,
    // JSONB scenes/shorts already passed the generator; Save only edits text.
    scenes: scenes as WeeklyVideoScene[],
    shorts: shorts as WeeklyVideoScript['shorts'],
  };
}
