import { describe, expect, it } from 'vitest';
import { dailyVisualPublicationFromRow, formatPackUpdateLabel } from '@/lib/briefs';

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

const publication = {
  daily_visual_set_id: 'set-1',
  candidate_id: 'candidate-1',
  public_url: 'https://example.supabase.co/storage/v1/object/public/social-assets/daily/test.webp',
  width: 1600,
  height: 900,
  alt_en: 'A visual summary of the daily AI shift.',
  alt_uk: 'Візуальний підсумок головної AI-зміни дня.',
  display_title_en: 'Efficiency moves to the foreground',
  display_title_uk: 'Ефективність виходить на перший план',
};

describe('dailyVisualPublicationFromRow', () => {
  it('uses the reader-safe projection and localizes only its public fields', () => {
    expect(dailyVisualPublicationFromRow('uk', publication)).toEqual({
      visualSetId: publication.daily_visual_set_id,
      candidateId: publication.candidate_id,
      publicUrl: publication.public_url,
      width: 1600,
      height: 900,
      alt: publication.alt_uk,
      displayTitle: publication.display_title_uk,
    });
  });

  it('fails closed for a non-public image URL or invalid dimensions', () => {
    expect(
      dailyVisualPublicationFromRow('en', { ...publication, public_url: 'javascript:alert(1)' }),
    ).toBeNull();
    expect(dailyVisualPublicationFromRow('en', { ...publication, height: 0 })).toBeNull();
  });
});
