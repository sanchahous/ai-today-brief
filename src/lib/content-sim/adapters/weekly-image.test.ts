import { describe, expect, it } from 'vitest';
import { applyRepairToSceneInput } from './weekly-image';

describe('applyRepairToSceneInput', () => {
  it('bumps seed on changeSeed / later attempts', () => {
    const first = applyRepairToSceneInput({ seedBase: 'digest:item' }, 1, { changeSeed: true });
    expect(first.seedBase).toContain('attempt1');
    const second = applyRepairToSceneInput({ seedBase: 'digest:item' }, 2, {});
    expect(second.seedBase).toContain('attempt2');
  });

  it('clears override when metaphor is rejected without replacement', () => {
    const out = applyRepairToSceneInput(
      { seedBase: 'x', sceneOverride: 'old scene' },
      2,
      { rejectMetaphor: true },
    );
    expect(out.sceneOverride).toBeUndefined();
  });

  it('keeps critic-supplied scene_override', () => {
    const out = applyRepairToSceneInput(
      { seedBase: 'x', sceneOverride: 'old' },
      2,
      { rejectMetaphor: true, sceneOverride: 'new concrete metaphor' },
    );
    expect(out.sceneOverride).toBe('new concrete metaphor');
  });

  it('joins prompt patches into a suffix', () => {
    const out = applyRepairToSceneInput({ seedBase: 'x' }, 1, {
      promptPatches: ['no text', 'single subject'],
    });
    expect(out.promptSuffix).toContain('no text');
    expect(out.promptSuffix).toContain('single subject');
  });
});
