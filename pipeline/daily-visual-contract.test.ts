import { describe, expect, it } from 'vitest';
import {
  DAILY_VISUAL_AUTOMATED_DAY_MAX_COST_MICRO_USD,
  DAILY_VISUAL_AUTOMATED_MONTH_MAX_COST_MICRO_USD,
  DAILY_VISUAL_DIRECTION_RETRY_ATTEMPT,
  DAILY_VISUAL_DIRECTION_RETRY_MAX_COST_MICRO_USD,
  DAILY_VISUAL_DIRECTION_RETRY_STEPS,
  DAILY_VISUAL_MAX_CALENDAR_DAYS_PER_MONTH,
  DAILY_VISUAL_MONTHLY_CAP_MICRO_USD,
  buildDailyVisualDirectionInstruction,
  buildDailyVisualImagePrompt,
  buildDailyVisualRepairPrompt,
  dailyVisualBudgetStepMaxCost,
  dailyVisualAltText,
  fallbackDailyVisualDirection,
  hashDailyVisualSnapshot,
  parseDailyVisualDirection,
  parseDailyVisualSnapshot,
  type DailyVisualSnapshot,
} from './daily-visual-contract';

const SNAPSHOT: DailyVisualSnapshot = {
  editorialDate: '2026-08-24',
  leadBriefId: 'brief-1',
  canonicalSlug: 'ai-daily-2026-08-24',
  titleEn: 'A day of AI engineering shifts',
  titleUk: 'День змін в AI-інженерії',
  introEn: 'Teams are trading brute force for selective, controllable systems.',
  introUk: 'Команди переходять від грубої сили до вибіркових керованих систем.',
  stories: [
    {
      id: 'item-1',
      rank: 1,
      titleEn: 'Qwen opens sparse model weights',
      titleUk: 'Qwen відкриває ваги розрідженої моделі',
      summaryEn: 'Only a small expert subset activates per token.',
      summaryUk: 'На токен активується лише мала частина експертів.',
      whyEn: 'Large models become cheaper to run.',
      whyUk: 'Великі моделі дешевше запускати.',
    },
  ],
};

const DIRECTOR = {
  displayTitleEn: 'Efficiency becomes the AI moat',
  displayTitleUk: 'Ефективність стає перевагою в AI',
  visualThesisEn: 'Selective systems make advanced AI practical without relying on raw scale.',
  visualThesisUk: 'Вибіркові системи роблять складний AI практичним без ставки лише на масштаб.',
  overlayStatEn: '95B active',
  overlayStatUk: '95 млрд активних',
  subject: 'a modular compute engine with one bright routing gate',
  action: 'the gate directs one token into a small active expert cluster',
  setting: 'a precise engineering workshop with a dark blue material palette',
  mechanism:
    'only the selected expert modules receive the active signal while the rest remain dormant',
  consequence: 'a finished output reaches a compact deployable device with visibly lower burden',
  scene:
    'A modular compute engine sits in a precise engineering workshop. One bright routing gate sends a token into a small active expert cluster while the larger lattice remains dormant, and a finished output reaches a compact deployable device; calm premium editorial lighting, no writing or interface panels.',
};

describe('daily visual direction contract', () => {
  it('keeps the full automatic path below the owner-approved $5 cap in a 31-day month', () => {
    expect(DAILY_VISUAL_AUTOMATED_DAY_MAX_COST_MICRO_USD).toBe(158_000);
    expect(DAILY_VISUAL_AUTOMATED_MONTH_MAX_COST_MICRO_USD).toBe(
      DAILY_VISUAL_AUTOMATED_DAY_MAX_COST_MICRO_USD * DAILY_VISUAL_MAX_CALENDAR_DAYS_PER_MONTH,
    );
    expect(DAILY_VISUAL_AUTOMATED_MONTH_MAX_COST_MICRO_USD).toBeLessThanOrEqual(
      DAILY_VISUAL_MONTHLY_CAP_MICRO_USD,
    );
    expect(dailyVisualBudgetStepMaxCost('qa_story_semantic')).toBe(12_000);
  });

  it('leaves exactly one bounded recovery shape beside an unreleased first direction', () => {
    expect(DAILY_VISUAL_DIRECTION_RETRY_ATTEMPT).toBe(1);
    expect(DAILY_VISUAL_DIRECTION_RETRY_MAX_COST_MICRO_USD).toBe(84_000);
    expect(DAILY_VISUAL_DIRECTION_RETRY_STEPS).toEqual([
      'direction',
      'ai_primary',
      'qa_image_only',
      'qa_story_semantic',
    ]);
    // The first direction's full $0.010 reservation may still be held when a
    // provider outcome is ambiguous; even then recovery stays under $0.158.
    expect(10_000 + DAILY_VISUAL_DIRECTION_RETRY_MAX_COST_MICRO_USD).toBeLessThanOrEqual(
      DAILY_VISUAL_AUTOMATED_DAY_MAX_COST_MICRO_USD,
    );
    expect(DAILY_VISUAL_DIRECTION_RETRY_STEPS).not.toContain('ai_repair');
  });

  it('asks for one shared thesis and localized editorial titles instead of a news collage', () => {
    const instruction = buildDailyVisualDirectionInstruction(SNAPSHOT);
    expect(instruction).toContain('ONE main causal thesis');
    expect(instruction).toContain('Do not make a collage');
    expect(instruction).toContain('displayTitleUk');
    expect(instruction).toContain('Qwen opens sparse model weights');
  });

  it('bounds the metered director context even when a frozen source field is abnormally long', () => {
    const oversized = 'x'.repeat(100_000);
    const instruction = buildDailyVisualDirectionInstruction({
      ...SNAPSHOT,
      titleEn: oversized,
      titleUk: oversized,
      introEn: oversized,
      introUk: oversized,
      stories: Array.from({ length: 3 }, (_, index) => ({
        ...SNAPSHOT.stories[0]!,
        id: `item-${index}`,
        titleEn: oversized,
        summaryEn: oversized,
        whyEn: oversized,
      })),
    });
    expect(instruction.length).toBeLessThan(20_000);
    expect(instruction).toContain('…');
  });

  it('accepts a complete localized direction and rejects incomplete semantic data', () => {
    expect(parseDailyVisualDirection(JSON.stringify(DIRECTOR))?.displayTitleUk).toBe(
      DIRECTOR.displayTitleUk,
    );
    expect(parseDailyVisualDirection(JSON.stringify({ ...DIRECTOR, mechanism: '' }))).toBeNull();
    expect(parseDailyVisualDirection('not json')).toBeNull();
  });

  it('builds one safe causal render prompt and one bounded repair prompt', () => {
    const direction = parseDailyVisualDirection(JSON.stringify(DIRECTOR))!;
    const prompt = buildDailyVisualImagePrompt(direction);
    const repair = buildDailyVisualRepairPrompt(direction, [
      'Make the dormant modules visibly inactive.',
    ]);
    expect(prompt).toContain('central 78% width and 68% height');
    expect(prompt).toContain('Do not generate text');
    expect(prompt).toContain('not a collage');
    expect(repair).toContain('Make the dormant modules visibly inactive.');
  });

  it('hashes the same source independent of story input order', () => {
    expect(hashDailyVisualSnapshot(SNAPSHOT)).toBe(
      hashDailyVisualSnapshot({ ...SNAPSHOT, stories: [...SNAPSHOT.stories].reverse() }),
    );
  });

  it('rehydrates only a complete frozen source snapshot for a later editor choice', () => {
    expect(parseDailyVisualSnapshot(SNAPSHOT)).toEqual(SNAPSHOT);
    expect(
      parseDailyVisualSnapshot({
        ...SNAPSHOT,
        stories: [{ ...SNAPSHOT.stories[0], whyUk: '' }],
      }),
    ).toBeNull();
  });

  it('keeps a transparent fallback only as a reviewable alternative', () => {
    const fallback = fallbackDailyVisualDirection(SNAPSHOT);
    expect(fallback.displayTitleEn).toContain('Qwen');
    expect(dailyVisualAltText(fallback, 'uk')).toContain(fallback.displayTitleUk);
  });
});
