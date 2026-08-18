import { describe, expect, it } from 'vitest';
import { socialFormFields, socialFormHas } from './channel-form';

describe('channel-aware social form', () => {
  it('shows only the fields that belong to each channel', () => {
    expect(socialFormFields('telegram')).toEqual([
      'post_copy',
      'destination',
      'alt',
      'schedule',
      'media_summary',
    ]);
    expect(socialFormFields('facebook')).toEqual(socialFormFields('telegram'));
    expect(socialFormHas('linkedin', 'linkedin_document')).toBe(true);
    expect(socialFormHas('linkedin', 'first_comment')).toBe(false);
    expect(socialFormHas('x', 'first_comment')).toBe(true);
    expect(socialFormHas('x', 'thread_parts')).toBe(false);
    expect(socialFormHas('threads', 'thread_parts')).toBe(true);
    expect(socialFormHas('threads', 'post_copy')).toBe(false);
    expect(socialFormHas('instagram', 'caption')).toBe(true);
    expect(socialFormHas('instagram', 'carousel_preview')).toBe(true);
    expect(socialFormHas('instagram', 'destination')).toBe(false);
    expect(socialFormHas('telegram', 'linkedin_document')).toBe(false);
  });
});
