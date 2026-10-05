import { describe, expect, it } from 'vitest';
import {
  SUBSCRIBE_BENEFITS,
  SUBSCRIBE_FAQS,
  AUDIENCE_STATS,
  AD_INVENTORY,
  ADVERTISE_BENEFITS,
} from './marketing-content';

describe('marketing-content', () => {
  it('defines exactly 4 confirmed subscribe benefits with EN and UK translations', () => {
    expect(SUBSCRIBE_BENEFITS).toHaveLength(4);
    for (const b of SUBSCRIBE_BENEFITS) {
      expect(b.icon).toBeDefined();
      expect(b.title.en).toBeTruthy();
      expect(b.title.uk).toBeTruthy();
      expect(b.body.en).toBeTruthy();
      expect(b.body.uk).toBeTruthy();
    }
    // Confirmed benefits cover 5-minute finite read, primary sources, practical step, weekly perspective
    expect(SUBSCRIBE_BENEFITS.map((b) => b.title.en)).toEqual([
      'Five minutes',
      'Sources on every story',
      'One thing to try',
      'Weekly perspective',
    ]);
  });

  it('defines confirmed subscribe FAQs with bilingual schedule answers', () => {
    expect(SUBSCRIBE_FAQS).toHaveLength(3);
    for (const f of SUBSCRIBE_FAQS) {
      expect(f.q.en).toBeTruthy();
      expect(f.q.uk).toBeTruthy();
      expect(f.a.en).toBeTruthy();
      expect(f.a.uk).toBeTruthy();
    }
    // Confirms schedule contains daily email and Monday weekly edition
    expect(SUBSCRIBE_FAQS[0].a.en).toContain('Monday–Saturday');
    expect(SUBSCRIBE_FAQS[0].a.en).toContain('Monday');
    expect(SUBSCRIBE_FAQS[0].a.uk).toContain('понеділка по суботу');
    expect(SUBSCRIBE_FAQS[0].a.uk).toContain('щопонеділка');
  });

  it('defines real sponsor inventory with exactly 3 formats', () => {
    expect(AD_INVENTORY).toHaveLength(3);
    for (const slot of AD_INVENTORY) {
      expect(slot.name.en).toBeTruthy();
      expect(slot.name.uk).toBeTruthy();
      expect(slot.placement.en).toBeTruthy();
      expect(slot.placement.uk).toBeTruthy();
      expect(slot.note.en).toBeTruthy();
      expect(slot.note.uk).toBeTruthy();
      expect(slot.exampleLabel.en).toBeTruthy();
      expect(slot.exampleLabel.uk).toBeTruthy();
    }
    expect(AD_INVENTORY.map((s) => s.name.en)).toEqual([
      'Daily brief slot',
      'Weekly edition partner',
      'Toolbox sponsor',
    ]);
  });

  it('maintains qualitative audience stats and benefits for compatibility', () => {
    expect(AUDIENCE_STATS.length).toBeGreaterThan(0);
    expect(ADVERTISE_BENEFITS.length).toBeGreaterThan(0);
  });
});
