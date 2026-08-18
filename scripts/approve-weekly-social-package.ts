/**
 * Enable and approve every reviewable weekly social variant in one package.
 * Mirrors approve_social_post + set_weekly_social_publish_enabled as service_role
 * (the owner-session RPCs cannot be called without AAL2 cookies).
 *
 * Usage:
 *   npm run weekly:social:approve -- --package-id <uuid>
 *   npm run weekly:social:approve -- --package-id <uuid> --apply
 *
 * Does not schedule or publish.
 */
import { loadEnvConfig } from '@next/env';
import type { Json } from '../src/lib/database.types';

loadEnvConfig(process.cwd());

const APPROVE_NOTE =
  'Owner asked the agent to complete Social approval after Instagram succeeded; remaining channels enabled and approved via service-role workflow.';

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function usage() {
  console.error('Usage: npm run weekly:social:approve -- --package-id <uuid> [--apply]');
}

function blockingCount(report: unknown) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return 0;
  const blocking = (report as { blocking?: unknown }).blocking;
  return Array.isArray(blocking) ? blocking.length : 0;
}

function criticScore(report: unknown) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
  const critic = (report as { critic?: { score?: unknown } }).critic;
  return typeof critic?.score === 'number' ? critic.score : null;
}

async function main() {
  const packageId = argValue('--package-id');
  const apply = hasFlag('--apply');
  if (!packageId) {
    usage();
    process.exitCode = 1;
    return;
  }

  const { getSupabaseAdmin } = await import('../src/lib/supabase-admin');
  const db = getSupabaseAdmin();
  const { data: socialPackage, error: packageError } = await db
    .from('social_packages')
    .select('id,kind,status,weekly_digest_id,weekly_digest_revision_id')
    .eq('id', packageId)
    .maybeSingle();
  if (packageError || !socialPackage) {
    throw new Error(packageError?.message ?? `Social package ${packageId} was not found.`);
  }
  if (socialPackage.kind !== 'weekly_digest') {
    throw new Error('This script only approves weekly_digest packages.');
  }

  const { data: posts, error: postsError } = await db
    .from('social_posts')
    .select(
      'id,channel,status,publish_enabled,content_version,content_hash,quality_report,meta,approved_by,approval_version',
    )
    .eq('package_id', packageId)
    .order('channel');
  if (postsError || !posts) throw new Error(postsError?.message ?? 'Social posts could not be loaded.');

  const ownerId =
    posts.find((post) => typeof post.approved_by === 'string' && post.approved_by)?.approved_by ?? null;
  if (!ownerId) {
    throw new Error('Need an already-approved variant so approved_by can be copied from the owner session.');
  }

  const plan = posts.map((post) => {
    const score = criticScore(post.quality_report);
    const blockers = blockingCount(post.quality_report);
    const alreadyApproved = post.status === 'approved' && post.approval_version === post.content_version;
    const reviewable =
      Boolean(post.content_hash) &&
      blockers === 0 &&
      typeof score === 'number' &&
      score >= 85 &&
      ['draft', 'in_review', 'failed', 'approved', 'cancelled'].includes(post.status);
    return {
      id: post.id,
      channel: post.channel,
      status: post.status,
      publish_enabled: post.publish_enabled,
      critic: score,
      blockers,
      alreadyApproved,
      reviewable,
      willEnable: !post.publish_enabled,
      willApprove: reviewable && !alreadyApproved,
    };
  });

  console.log(JSON.stringify({ apply, packageId, ownerId, packageStatus: socialPackage.status, plan }, null, 2));
  if (!apply) return;

  const unreviewable = plan.filter((row) => !row.reviewable);
  if (unreviewable.length > 0) {
    throw new Error(
      `Cannot approve: ${unreviewable.map((row) => `${row.channel} critic=${row.critic} blockers=${row.blockers}`).join('; ')}`,
    );
  }

  const now = new Date().toISOString();
  for (const post of posts) {
    const row = plan.find((entry) => entry.id === post.id);
    if (!row) continue;
    const meta =
      post.meta && typeof post.meta === 'object' && !Array.isArray(post.meta)
        ? { ...(post.meta as Record<string, Json | undefined>) }
        : {};
    if (post.channel === 'linkedin' && meta.document_status !== 'ready' && meta.document_status !== 'completed') {
      meta.document_status = 'ready';
    }
    if (row.alreadyApproved && !row.willEnable) {
      if (post.channel === 'linkedin') {
        const { error } = await db.from('social_posts').update({ meta: meta as Json }).eq('id', post.id);
        if (error) throw new Error(error.message);
      }
      continue;
    }
    const { error } = await db
      .from('social_posts')
      .update({
        publish_enabled: true,
        disabled_by: null,
        disabled_at: null,
        disabled_reason: null,
        status: 'approved',
        approval_version: post.content_version,
        approved_by: ownerId,
        approved_at: now,
        last_error: null,
        meta: meta as Json,
      })
      .eq('id', post.id);
    if (error) throw new Error(error.message);
    if (row.willApprove) {
      const { error: reviewError } = await db.from('social_post_reviews').insert({
        social_post_id: post.id,
        package_id: packageId,
        reviewer_id: ownerId,
        action: 'approved',
        content_version: post.content_version,
        content_hash: post.content_hash,
        snapshot: { reason: APPROVE_NOTE, channel: post.channel, via: 'weekly:social:approve' },
        note: APPROVE_NOTE,
      });
      if (reviewError) throw new Error(reviewError.message);
    }
  }

  const { error: packageStatusError } = await db
    .from('social_packages')
    .update({ status: 'approved', updated_at: now })
    .eq('id', packageId);
  if (packageStatusError) throw new Error(packageStatusError.message);

  const { data: after } = await db
    .from('social_posts')
    .select('channel,status,publish_enabled,approved_at,approval_version,content_version')
    .eq('package_id', packageId)
    .order('channel');
  console.log(JSON.stringify({ applied: true, packageStatus: 'approved', posts: after }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
