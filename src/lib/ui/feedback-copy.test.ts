import { describe, expect, it } from 'vitest';
import { shownVolumeLabel, updatedAgoLabel } from './feedback-copy';

describe('updatedAgoLabel', () => {
  it('says less than an hour when the age is zero', () => {
    expect(updatedAgoLabel(0, 'en')).toBe('Updated less than an hour ago. New stories may be missing.');
    expect(updatedAgoLabel(0, 'uk')).toBe('Оновлено менш ніж годину тому. Нових матеріалів може бракувати.');
  });

  it('uses a relative hour phrase for a positive age', () => {
    expect(updatedAgoLabel(3, 'en')).toBe('Updated 3 hours ago. New stories may be missing.');
    expect(updatedAgoLabel(1, 'en')).toBe('Updated 1 hour ago. New stories may be missing.');
    expect(updatedAgoLabel(3, 'uk')).toContain('Оновлено');
    expect(updatedAgoLabel(3, 'uk')).toContain('3');
    expect(updatedAgoLabel(3, 'uk')).toContain('Нових матеріалів може бракувати.');
  });

  it('rejects a negative or fractional age', () => {
    expect(() => updatedAgoLabel(-1, 'en')).toThrow(/hoursAgo/);
    expect(() => updatedAgoLabel(1.5, 'uk')).toThrow(/hoursAgo/);
  });
});

describe('shownVolumeLabel', () => {
  it('pluralises English and Ukrainian counts', () => {
    expect(shownVolumeLabel(1, 'en')).toBe('Showing the latest 1 story. Older coverage: use search.');
    expect(shownVolumeLabel(100, 'en')).toBe('Showing the latest 100 stories. Older coverage: use search.');
    expect(shownVolumeLabel(1, 'uk')).toBe('Показано останній 1 матеріал. Давніші — через пошук.');
    expect(shownVolumeLabel(2, 'uk')).toBe('Показано останні 2 матеріали. Давніші — через пошук.');
    expect(shownVolumeLabel(5, 'uk')).toBe('Показано останні 5 матеріалів. Давніші — через пошук.');
    expect(shownVolumeLabel(21, 'uk')).toBe('Показано останній 21 матеріал. Давніші — через пошук.');
    expect(shownVolumeLabel(0, 'en')).toBe('Showing the latest 0 stories. Older coverage: use search.');
    expect(shownVolumeLabel(0, 'uk')).toBe('Показано останні 0 матеріалів. Давніші — через пошук.');
  });

  it('rejects a negative or fractional count', () => {
    expect(() => shownVolumeLabel(-1, 'en')).toThrow(/shown/);
    expect(() => shownVolumeLabel(2.2, 'uk')).toThrow(/shown/);
  });
});
