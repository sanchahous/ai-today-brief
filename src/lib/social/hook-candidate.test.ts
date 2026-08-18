import { describe, expect, it } from 'vitest';
import { applyHookCandidate, parseThreadsParts } from './hook-candidate';

const THREADS_SCREENSHOT_HOOK = [
  'Anthropic shipped a concrete evaluation workflow that changes how teams inspect agent behavior before a production rollout, and that is the useful signal this week for anyone shipping agents.',
  '<PART>',
  'The practical consequence is a narrower testable decision: keep the agent in a sandbox until the shipped eval actually passes on your own traces instead of assuming a demo generalizes.',
  '<PART>',
  'What will you inspect first on Monday — the eval gate, the tool-permission boundary, or the human escalation path when the agent is wrong?',
].join('');

describe('Threads hook apply', () => {
  it('applies the screenshot-style <PART> candidate atomically without truncating or keeping the marker', () => {
    expect(THREADS_SCREENSHOT_HOOK.length).toBeGreaterThan(500);
    const parsed = parseThreadsParts(THREADS_SCREENSHOT_HOOK);
    expect(parsed).toHaveLength(3);
    const result = applyHookCandidate({
      channel: 'threads',
      candidate: THREADS_SCREENSHOT_HOOK,
      current: { postText: 'old root that would have been sliced', contentParts: ['old'], firstComment: null },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contentParts).toEqual(parsed);
    expect(result.postText).toBe(parsed![0]);
    expect(result.postText.length).toBeGreaterThan(120);
    expect(result.postText).not.toContain('<PART>');
    expect(result.contentParts.join(' ')).not.toMatch(/<PART>/i);
    expect(result.postText).not.toBe(THREADS_SCREENSHOT_HOOK.slice(0, 500));
  });

  it('refuses an invalid Threads candidate instead of slicing it', () => {
    const result = applyHookCandidate({
      channel: 'threads',
      candidate: 'Only one part with no markers',
      current: { postText: 'keep', contentParts: ['a', 'b', 'c'], firstComment: null },
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
      }),
    );
  });
});

describe('X hook apply', () => {
  it('updates the root and keeps the tracked URL in the self-reply parts', () => {
    const reply = 'Read: https://aitodaybrief.com/r/s/token';
    const result = applyHookCandidate({
      channel: 'x',
      candidate: 'A grounded thesis about the approved eval workflow for production agents.',
      current: { postText: 'old', contentParts: ['old', reply], firstComment: reply },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.postText).toContain('grounded thesis');
    expect(result.firstComment).toBe(reply);
    expect(result.contentParts).toEqual([result.postText, reply]);
  });
});

describe('Instagram hook apply', () => {
  it('is read-only so caption and slides stay aligned', () => {
    const result = applyHookCandidate({
      channel: 'instagram',
      candidate: 'A new angle',
      current: { postText: 'caption', contentParts: [], firstComment: null },
    });
    expect(result.ok).toBe(false);
  });
});
