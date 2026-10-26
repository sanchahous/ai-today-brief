import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Approves every variant of the given packages that passed all quality gates
 * on an enabled channel, when the owner switched auto-publish on (migration
 * 20261026150000_auto_approve_clean_social_posts). Variants with blocking
 * issues, or for channels that are not connected, stay in review. Returns the
 * number of variants approved.
 */
export async function autoApproveCleanPosts(packageIds: string[]) {
  let approved = 0;
  for (const packageId of packageIds) {
    const { data, error } = await getSupabaseAdmin().rpc('auto_approve_clean_social_posts', {
      p_package_id: packageId,
    });
    if (error) throw new Error(`[social-auto-approve] ${error.message}`);
    approved += data ?? 0;
  }
  return approved;
}
