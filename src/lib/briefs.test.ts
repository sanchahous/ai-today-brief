import { describe, expect, it } from 'vitest';
import { formatPackUpdateLabel } from '@/lib/briefs';

describe('formatPackUpdateLabel', () => {
  it('returns the base label without a publish time', () => {
    expect(formatPackUpdateLabel('en', null)).toBe('Update');
    expect(formatPackUpdateLabel('uk', null)).toBe('Оновлення');
  });

  it('appends a Kyiv-local time when published_at is set', () => {
    const label = formatPackUpdateLabel('en', '2026-06-09T15:30:00.000Z');
    expect(label.startsWith('Update · ')).toBe(true);
    expect(label.length).toBeGreaterThan('Update · '.length);
  });
});
