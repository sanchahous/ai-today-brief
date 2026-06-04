/**
 * Beehiiv env — supports canonical name and Beehiiv-dashboard aliases (API v1/v2 IDs).
 * v2 subscriptions endpoint expects the `pub_…` publication id when available.
 */
export function getBeehiivCredentials(): { apiKey: string; publicationId: string } | null {
  const apiKey = process.env.BEEHIIV_API_KEY?.trim() ?? '';
  const publicationId = (
    process.env.BEEHIIV_PUBLICATION_ID?.trim() ||
    process.env.BEEHIIV_PUBLICATION_ID_API_V2?.trim() ||
    process.env.BEEHIIV_PUBLICATION_ID_API_V1?.trim() ||
    ''
  );
  if (!apiKey || !publicationId) return null;
  return { apiKey, publicationId };
}
