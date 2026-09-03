import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface UntypedRpcClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

export async function syncWeeklySocialUrlsAfterPublish(
  weeklyDigestId: string,
  claimedSlug: string,
  publishedSlug: string,
) {
  const { error } = await (getSupabaseAdmin() as unknown as UntypedRpcClient).rpc(
    'rewrite_weekly_digest_social_urls',
    {
      p_weekly_digest_id: weeklyDigestId,
      p_old_slug: claimedSlug,
      p_new_slug: publishedSlug,
    },
  );
  if (error) throw new Error(`[weekly-release] social urls: ${error.message}`);
}
