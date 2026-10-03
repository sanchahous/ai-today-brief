import { describe, expect, it } from 'vitest';
import { hashSeed } from './hash-seed';

describe('hashSeed', () => {
  it('returns deterministic seed for same string or number', () => {
    expect(hashSeed('alpha')).toBe(hashSeed('alpha'));
    expect(hashSeed(12345)).toBe(hashSeed(12345));
    expect(hashSeed('12345')).toBe(hashSeed(12345));
  });

  it('handles null, undefined and empty string gracefully', () => {
    expect(typeof hashSeed(null)).toBe('number');
    expect(typeof hashSeed(undefined)).toBe('number');
    expect(typeof hashSeed('')).toBe('number');
  });

  it('produces different seeds for different inputs', () => {
    expect(hashSeed('first-story')).not.toBe(hashSeed('second-story'));
  });
});
