import { describe, expect, it } from 'vitest';
import { formatEditionDate } from './date-format';

describe('formatEditionDate', () => {
  it('returns null for missing or invalid dates', () => {
    expect(formatEditionDate(null, 'en')).toBeNull();
    expect(formatEditionDate(undefined, 'uk')).toBeNull();
    expect(formatEditionDate('invalid-date', 'en')).toBeNull();
  });

  it('formats dates in English (en-GB)', () => {
    expect(formatEditionDate('2026-10-14', 'en')).toBe('Wednesday 14 October');
  });

  it('formats dates in Ukrainian (uk-UA)', () => {
    expect(formatEditionDate('2026-10-14', 'uk')).toBe('середа, 14 жовтня');
  });

  it('handles ISO timestamps', () => {
    // If it's a full timestamp, it parses it directly
    const date = new Date('2026-10-14T12:00:00Z');
    // The exact string depends on the test environment's timezone, but it shouldn't be null
    expect(formatEditionDate(date.toISOString(), 'en')).not.toBeNull();
  });
});
