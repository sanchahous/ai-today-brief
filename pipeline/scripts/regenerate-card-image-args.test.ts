import { describe, expect, it } from 'vitest';
import { parseSlugs } from './regenerate-card-image-args';

describe('regenerate-card-image parseSlugs', () => {
  it('accepts --slug, --slugs csv and de-duplicates', () => {
    expect(parseSlugs(['node', 'x', '--slug', 'a', '--slugs', 'a,b, c'])).toEqual(['a', 'b', 'c']);
  });

  it('reads a slugs file, ignoring comments and "|status" annotations', () => {
    const file = '# header\nfoo|approved\n\nbar\r\n';
    expect(parseSlugs(['node', 'x', '--slugs-file', 'f.txt'], () => file)).toEqual(['foo', 'bar']);
  });

  it('throws when nothing is given', () => {
    expect(() => parseSlugs(['node', 'x'])).toThrow(/--slug/);
  });
});
