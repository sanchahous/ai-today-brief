import type { SocialChannel, SocialLocale } from '@/lib/social/types';

/**
 * Canonical weekly channel→locale matrix. SQL `weekly_digest_social_matrix`
 * and `weekly_digest_preflight` must match this object (see social-matrix.test.ts).
 */
export const WEEKLY_SOCIAL_MATRIX = {
  telegram: 'uk',
  facebook: 'uk',
  x: 'en',
  threads: 'uk',
  linkedin: 'en',
  instagram: 'en',
} as const satisfies Record<SocialChannel, SocialLocale>;

export type WeeklySocialMatrix = typeof WEEKLY_SOCIAL_MATRIX;

/** Stable tuples for the SQL seed / CI equality check. */
export function weeklySocialMatrixTuples(): Array<[SocialChannel, SocialLocale]> {
  return (Object.keys(WEEKLY_SOCIAL_MATRIX) as SocialChannel[])
    .map((channel) => [channel, WEEKLY_SOCIAL_MATRIX[channel]] as [SocialChannel, SocialLocale])
    .sort((left, right) => left[0].localeCompare(right[0]));
}
