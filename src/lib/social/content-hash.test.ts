import { describe, expect, it } from 'vitest';
import { socialContentHash } from './content-hash';

const content = {
  channel: 'x' as const,
  locale: 'en' as const,
  format: 'link_free_hook',
  text: 'An approved AI update for builders.',
  firstComment: 'Read: https://aitodaybrief.com/en/weekly/example?s=token',
  assets: [],
  scheduledFor: '2027-01-01T10:00:00.000Z',
  contentVersion: 1,
};

describe('social content hash', () => {
  it('is stable for exact content', () => {
    expect(socialContentHash(content)).toBe(socialContentHash({ ...content }));
  });

  it('changes for copy, schedule, version, or artifact identity — not a re-signed URL', () => {
    const original = socialContentHash(content);
    expect(socialContentHash({ ...content, text: `${content.text} Updated.` })).not.toBe(original);
    expect(socialContentHash({ ...content, scheduledFor: '2027-01-01T11:00:00.000Z' })).not.toBe(
      original,
    );
    expect(socialContentHash({ ...content, contentVersion: 2 })).not.toBe(original);
    expect(
      socialContentHash({ ...content, contentParts: [content.text, content.firstComment] }),
    ).not.toBe(original);

    const withArtifact = {
      ...content,
      assets: [
        {
          artifactId: 'landscape-1',
          url: 'https://example.supabase.co/storage/v1/object/sign/weekly/a.jpg?token=old',
          width: 1200,
          height: 630,
          mimeType: 'image/jpeg' as const,
          bytes: 80_000,
        },
      ],
    };
    const resigned = {
      ...withArtifact,
      assets: [
        {
          ...withArtifact.assets[0],
          url: 'https://example.supabase.co/storage/v1/object/sign/weekly/a.jpg?token=new',
        },
      ],
    };
    expect(socialContentHash(withArtifact)).toBe(socialContentHash(resigned));
    expect(
      socialContentHash({
        ...withArtifact,
        assets: [{ ...withArtifact.assets[0], artifactId: 'landscape-2' }],
      }),
    ).not.toBe(socialContentHash(withArtifact));
  });
});
