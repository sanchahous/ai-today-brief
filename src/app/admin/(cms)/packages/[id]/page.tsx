import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Json } from '@/lib/database.types';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { SITE_URL } from '@/lib/site';
import { ActionSubmitButton } from '@/components/admin/action-submit-button';
import { StatusPill } from '@/components/admin/status-pill';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  approvePackageAction,
  approvePostAction,
  cancelPackageAction,
  regenerateVariantAction,
  updateVariantAction,
} from '../../../actions';

export const dynamic = 'force-dynamic';

interface Issue {
  code?: string;
  message?: string;
}

function quality(value: Json): {
  blocking: Issue[];
  warnings: Issue[];
  critic?: {
    score?: number;
    flags?: string[];
    provider?: string;
    model?: string;
    fallbackUsed?: boolean;
    auditedAt?: string;
  };
} {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { blocking: [], warnings: [] };
  const report = value as { blocking?: unknown; warnings?: unknown; critic?: unknown };
  return {
    blocking: Array.isArray(report.blocking) ? (report.blocking as Issue[]) : [],
    warnings: Array.isArray(report.warnings) ? (report.warnings as Issue[]) : [],
    critic:
      report.critic && typeof report.critic === 'object' && !Array.isArray(report.critic)
        ? (report.critic as {
            score?: number;
            flags?: string[];
            provider?: string;
            model?: string;
            fallbackUsed?: boolean;
            auditedAt?: string;
          })
        : undefined,
  };
}

function assets(value: Json) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const url = (entry as Record<string, Json | undefined>).url;
    return typeof url === 'string' ? [url] : [];
  });
}

function kyivInput(iso: string | null) {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export default async function PackageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSocialAdmin();
  const supabase = getSupabaseAdmin();
  const [{ data: socialPackage }, { data: posts }, { data: reviews }] = await Promise.all([
    supabase.from('social_packages').select('*').eq('id', id).maybeSingle(),
    supabase.from('social_posts').select('*').eq('package_id', id).order('scheduled_for'),
    supabase
      .from('social_post_reviews')
      .select('id,action,created_at,content_version,note,social_post_id')
      .eq('package_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (!socialPackage) notFound();
  const allApprovable =
    (posts ?? []).length > 0 &&
    (posts ?? []).every(
      (post) =>
        ['draft', 'in_review', 'approved', 'failed'].includes(post.status) &&
        quality(post.quality_report).blocking.length === 0 &&
        Boolean(quality(post.quality_report).critic?.auditedAt),
    );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusPill value={socialPackage.risk_level} />
            <StatusPill value={socialPackage.status} />
          </div>
          <h1 className="mt-3 max-w-3xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {socialPackage.title}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {socialPackage.kind.replaceAll('_', ' ')} · generation{' '}
            {socialPackage.generation_version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={approvePackageAction}>
            <input type="hidden" name="id" value={id} />
            <ActionSubmitButton
              idleLabel="Approve package"
              pendingLabel="Approving package…"
              disabled={!allApprovable}
              className="min-h-11 rounded-xl bg-[#47e4d3] px-4 text-sm font-bold text-[#0a2321] disabled:cursor-not-allowed disabled:opacity-40"
            />
          </form>
          <form action={cancelPackageAction}>
            <input type="hidden" name="id" value={id} />
            <ActionSubmitButton
              idleLabel="Cancel future posts"
              pendingLabel="Cancelling posts…"
              className="min-h-11 rounded-xl border border-red-400/30 px-4 text-sm font-bold text-red-200"
            />
          </form>
        </div>
      </div>

      <div className="mt-8 grid gap-6">
        {(posts ?? []).map((post) => {
          const report = quality(post.quality_report);
          const media = assets(post.asset_urls);
          const locked = ['publishing', 'posted', 'cancelled'].includes(post.status);
          const hasCurrentAudit = Boolean(report.critic?.auditedAt);
          return (
            <article
              key={post.id}
              className="overflow-hidden rounded-3xl border border-white/10 bg-[#151b20]"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-4 sm:px-6">
                <h2 className="text-lg font-bold text-white capitalize">{post.channel}</h2>
                <StatusPill value={post.status} />
                <span className="ml-auto text-xs text-slate-500">v{post.content_version}</span>
              </div>
              <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.72fr)]">
                <form action={updateVariantAction} className="grid content-start gap-4">
                  <input type="hidden" name="id" value={post.id} />
                  <label className="grid gap-2 text-sm font-semibold text-slate-300">
                    Post copy
                    <textarea
                      name="post_text"
                      required
                      rows={Math.min(
                        18,
                        Math.max(7, Math.ceil((post.post_text?.length ?? 0) / 70)),
                      )}
                      defaultValue={post.post_text ?? ''}
                      disabled={locked}
                      className="rounded-2xl border border-white/15 bg-[#0c1014] p-4 text-base leading-6 text-white outline-none focus:border-[#47e4d3] disabled:opacity-60"
                    />
                  </label>
                  <div className="rounded-xl border border-white/10 bg-white/[.02] p-3 text-xs text-slate-400">
                    <strong className="block text-slate-300">Tracked link</strong>
                    <code className="mt-1 block break-all text-[#8af4e9]">
                      {new URL(`/r/s/${post.tracking_token}`, SITE_URL).toString()}
                    </code>
                    {post.channel === 'instagram' ? (
                      <span className="mt-1 block">
                        Use this as the temporary link-in-bio destination for post-level
                        attribution.
                      </span>
                    ) : null}
                  </div>
                  {post.channel === 'x' ? (
                    <label className="grid gap-2 text-sm font-semibold text-slate-300">
                      Self-reply
                      <textarea
                        name="first_comment"
                        rows={3}
                        defaultValue={post.first_comment ?? ''}
                        disabled={locked}
                        className="rounded-xl border border-white/15 bg-[#0c1014] p-3 text-white outline-none focus:border-[#47e4d3]"
                      />
                    </label>
                  ) : (
                    <input type="hidden" name="first_comment" value={post.first_comment ?? ''} />
                  )}
                  <label className="grid gap-2 text-sm font-semibold text-slate-300">
                    Alt text
                    <input
                      name="alt_text"
                      defaultValue={post.alt_text ?? ''}
                      disabled={locked}
                      className="min-h-11 rounded-xl border border-white/15 bg-[#0c1014] px-3 text-white outline-none focus:border-[#47e4d3]"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-300">
                    Schedule · Europe/Kyiv
                    <input
                      type="datetime-local"
                      name="scheduled_for"
                      required
                      defaultValue={kyivInput(post.scheduled_for)}
                      disabled={locked}
                      className="min-h-11 rounded-xl border border-white/15 bg-[#0c1014] px-3 text-white outline-none focus:border-[#47e4d3]"
                    />
                  </label>
                  {!locked ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ActionSubmitButton
                        idleLabel="Save · revoke approval"
                        pendingLabel="Saving and auditing…"
                        className="min-h-11 rounded-xl border border-[#47e4d3]/40 px-4 text-sm font-bold text-[#8af4e9]"
                      />
                      <ActionSubmitButton
                        idleLabel="Regenerate selected"
                        pendingLabel="Regenerating and auditing…"
                        formAction={regenerateVariantAction}
                        className="min-h-11 rounded-xl border border-violet-400/30 px-4 text-sm font-bold text-violet-200"
                      />
                    </div>
                  ) : null}
                </form>

                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-[.15em] text-slate-500 uppercase">
                    Platform preview
                  </p>
                  <div className="mt-3 rounded-2xl border border-white/10 bg-[#0b0f13] p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-full bg-[#47e4d3] font-black text-[#0a2321]">
                        AT
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">AI Today Brief</p>
                        <p className="text-xs text-slate-500 capitalize">{post.channel}</p>
                      </div>
                    </div>
                    <p className="text-sm leading-6 break-words whitespace-pre-wrap text-slate-200">
                      {post.post_text}
                    </p>
                    {media.length > 0 ? (
                      <div className={`mt-4 grid gap-2 ${media.length > 1 ? 'grid-cols-2' : ''}`}>
                        {media.map((url, index) => (
                          <Image
                            key={url}
                            src={url}
                            alt={post.alt_text ?? `Social asset ${index + 1}`}
                            width={post.channel === 'instagram' ? 540 : 600}
                            height={post.channel === 'instagram' ? 675 : 315}
                            className="h-auto w-full rounded-xl object-cover"
                            sizes="(max-width: 1024px) 90vw, 36vw"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-2">
                    {!hasCurrentAudit ? (
                      <p className="rounded-xl border border-red-400/25 bg-red-400/8 p-3 text-sm text-red-200">
                        Blocker: run the current-generation critic audit by saving or regenerating
                        this variant.
                      </p>
                    ) : null}
                    {report.blocking.map((item, index) => (
                      <p
                        key={`${item.code}-${index}`}
                        className="rounded-xl border border-red-400/25 bg-red-400/8 p-3 text-sm text-red-200"
                      >
                        Blocker: {item.message ?? item.code}
                      </p>
                    ))}
                    {report.warnings.map((item, index) => (
                      <p
                        key={`${item.code}-${index}`}
                        className="rounded-xl border border-amber-400/20 bg-amber-400/8 p-3 text-sm text-amber-100"
                      >
                        Review: {item.message ?? item.code}
                      </p>
                    ))}
                    {report.critic ? (
                      <div className="rounded-xl border border-white/10 p-3 text-sm text-slate-300">
                        Critic score:{' '}
                        <strong className="text-white">{report.critic.score ?? '—'}/100</strong>
                        {report.critic.provider || report.critic.model ? (
                          <span className="mt-1 block text-xs text-slate-500">
                            {[report.critic.provider, report.critic.model]
                              .filter(Boolean)
                              .join(' · ')}
                            {report.critic.fallbackUsed ? ' · fallback used' : ''}
                          </span>
                        ) : null}
                        {report.critic.flags?.map((flag) => (
                          <p key={flag} className="mt-1 text-amber-100">
                            • {flag}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {!locked && post.status !== 'approved' ? (
                    <form action={approvePostAction} className="mt-4">
                      <input type="hidden" name="id" value={post.id} />
                      <ActionSubmitButton
                        idleLabel="Approve this variant"
                        pendingLabel="Approving variant…"
                        disabled={report.blocking.length > 0 || !hasCurrentAudit}
                        className="min-h-11 w-full rounded-xl bg-white px-4 text-sm font-bold text-[#101418] disabled:opacity-40"
                      />
                    </form>
                  ) : null}
                  {post.channel === 'linkedin' && post.status !== 'posted' ? (
                    <a
                      href="https://www.linkedin.com/company/aitodaybrief/admin/page-posts/published/"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 block rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-bold text-slate-200"
                    >
                      Open LinkedIn native scheduler
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.02] p-4">
        <h2 className="font-bold text-white">Audit trail</h2>
        <ol className="mt-3 grid gap-2 text-sm text-slate-400">
          {(reviews ?? []).map((review) => (
            <li
              key={review.id}
              className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-2 last:border-0"
            >
              <span className="capitalize">
                {review.action.replaceAll('_', ' ')} · v{review.content_version}
              </span>
              <time>
                {new Date(review.created_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
