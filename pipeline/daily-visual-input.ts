import type { DailyVisualSocialInput } from '@/lib/social/daily-visual-composer';
import {
  parseDailyVisualDirection,
  parseDailyVisualSnapshot,
  type DailyVisualDirection,
  type DailyVisualSnapshot,
} from './daily-visual-contract';

/**
 * Keep finalization and a later editor selection on the exact same frozen
 * causal story. The social composer validates the result again at its own
 * boundary; this helper makes malformed historical JSON a visible admin
 * failure instead of silently re-querying a changed daily brief.
 */
export function dailyVisualSocialInput(
  snapshot: DailyVisualSnapshot,
  direction: DailyVisualDirection,
  visualSetId: string,
  publicUrl: string,
): DailyVisualSocialInput {
  return {
    sourceDate: snapshot.editorialDate,
    visualSetId,
    selectedPublicMasterUrl: publicUrl,
    displayTitle: { en: direction.displayTitleEn, uk: direction.displayTitleUk },
    visualThesis: { en: direction.visualThesisEn, uk: direction.visualThesisUk },
    stories: snapshot.stories.slice(0, 3).map((story) => ({
      id: story.id,
      approved: true,
      title: { en: story.titleEn, uk: story.titleUk },
      whatChanged: { en: story.summaryEn, uk: story.summaryUk },
      whyItMatters: { en: story.whyEn, uk: story.whyUk },
    })),
    lead: {
      briefId: snapshot.leadBriefId,
      slug: snapshot.canonicalSlug,
      briefItemId: snapshot.stories[0]?.id,
    },
  };
}

export function dailyVisualSocialInputFromStored(input: {
  sourceSnapshot: unknown;
  direction: unknown;
  visualSetId: string;
  publicUrl: string;
}): DailyVisualSocialInput {
  const snapshot = parseDailyVisualSnapshot(input.sourceSnapshot);
  // The stored direction was accepted by the same strict parser at generation
  // time. Stringifying it is intentionally a narrow re-entry through that
  // parser, rather than trusting arbitrary JSONB from a server action.
  const serializedDirection = JSON.stringify(input.direction);
  const direction = serializedDirection ? parseDailyVisualDirection(serializedDirection) : null;
  if (!snapshot || !direction) {
    throw new Error('This visual set has an incomplete frozen direction or source snapshot.');
  }
  return dailyVisualSocialInput(snapshot, direction, input.visualSetId, input.publicUrl);
}
