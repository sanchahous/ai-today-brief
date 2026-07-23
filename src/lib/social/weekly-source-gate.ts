export interface WeeklySocialSourcePackage {
  kind: string | null;
  weekly_digest_id: string | null;
  weekly_digest_revision_id: string | null;
}

export interface WeeklySocialSourceDigest {
  status: string;
  published_revision_id: string | null;
}

export type WeeklySocialSourceGate =
  | { ready: true }
  | { ready: false; code: 'weekly_digest_source_missing' | 'weekly_digest_not_published' };

export function assessWeeklySocialSource(
  socialPackage: WeeklySocialSourcePackage | null,
  digest: WeeklySocialSourceDigest | null,
): WeeklySocialSourceGate {
  if (socialPackage?.kind !== 'weekly_digest') return { ready: true };
  if (!socialPackage.weekly_digest_id || !socialPackage.weekly_digest_revision_id) {
    return { ready: false, code: 'weekly_digest_source_missing' };
  }
  if (
    digest?.status !== 'published' ||
    digest.published_revision_id !== socialPackage.weekly_digest_revision_id
  ) {
    return { ready: false, code: 'weekly_digest_not_published' };
  }
  return { ready: true };
}
