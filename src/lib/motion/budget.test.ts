import { describe, expect, it } from 'vitest';
import { MotionBudget } from '@/lib/motion/budget';
import { MAX_ACTIVE_UI_ANIMATIONS } from '@/lib/motion/constants';

describe('MotionBudget', () => {
  it('records peak active count', () => {
    const budget = new MotionBudget();
    const animation = { onfinish: null, oncancel: null } as Animation;
    budget.track(animation);
    expect(budget.activeCount).toBe(1);
    expect(budget.peakCount).toBe(1);
  });

  it('blocks new work at the UI cap', () => {
    const budget = new MotionBudget();
    for (let i = 0; i < MAX_ACTIVE_UI_ANIMATIONS; i += 1) {
      budget.track({ onfinish: null, oncancel: null, cancel: () => undefined } as Animation);
    }
    expect(budget.canStart()).toBe(false);
    budget.cancelAll();
    expect(budget.canStart()).toBe(true);
  });
});
