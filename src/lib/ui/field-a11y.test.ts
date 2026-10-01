import { describe, expect, it } from 'vitest';
import { describedBy, searchFieldCopy } from './field-a11y';

describe('field descriptions', () => {
  it('drops empty ids and keeps hint and error together', () => {
    expect(describedBy([false, null, undefined, ''])).toBeUndefined();
    expect(describedBy(['email-hint', false, 'email-error'])).toBe('email-hint email-error');
  });

  it('localises the search placeholder and the clear control', () => {
    expect(searchFieldCopy('en')).toEqual({ placeholder: 'Search...', clearLabel: 'Clear input' });
    expect(searchFieldCopy('uk')).toEqual({ placeholder: 'Пошук…', clearLabel: 'Очистити поле' });
  });
});
