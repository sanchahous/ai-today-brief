import { describe, expect, it } from 'vitest';
import { parseCritic } from './critic';

describe('parseCritic', () => {
  it('parses and clamps a valid critic response', () => {
    expect(parseCritic('{"score":105,"flags":[" unsupported claim "]}')).toEqual({
      score: 100,
      flags: ['unsupported claim'],
    });
  });

  it('rejects invalid output so the router can try a fallback', () => {
    expect(() => parseCritic('not json')).toThrow(SyntaxError);
    expect(() => parseCritic('{"score":"high","flags":[]}')).toThrow(SyntaxError);
  });
});
