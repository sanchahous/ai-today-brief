import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { completeEngagementAction, createEngagementTaskAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EngagementPage() {
  await requireSocialAdmin();
  const { data: tasks } = await getSupabaseAdmin()
    .from('engagement_tasks')
    .select('*')
    .eq('status', 'open')
    .order('due_at', { ascending: true })
    .limit(40);
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-bold tracking-[.16em] text-[#47e4d3] uppercase">Engagement</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Curated manual queue</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        Every follow, comment, reshare, and invite opens the native network. No auto-follow,
        auto-DM, auto-comment, or automatic reply is implemented.
      </p>
      <details className="mt-6 rounded-2xl border border-white/10 bg-[#151b20] p-5">
        <summary className="cursor-pointer font-bold text-white">Add a curated task</summary>
        <form action={createEngagementTaskAction} className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
            Channel
            <select
              name="channel"
              className="min-h-11 rounded-xl border border-white/15 bg-[#0c1014] px-3 text-sm text-white capitalize"
            >
              {['telegram', 'x', 'threads', 'linkedin', 'instagram', 'facebook'].map((channel) => (
                <option key={channel}>{channel}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
            Action
            <select
              name="engagement_action"
              className="min-h-11 rounded-xl border border-white/15 bg-[#0c1014] px-3 text-sm text-white"
            >
              <option value="review_profile">Review profile</option>
              <option value="follow">Follow manually</option>
              <option value="comment">Comment manually</option>
              <option value="reshare">Reshare manually</option>
              <option value="invite_connection">LinkedIn invite</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase sm:col-span-2">
            Native HTTPS URL
            <input
              type="url"
              name="native_url"
              required
              className="min-h-11 rounded-xl border border-white/15 bg-[#0c1014] px-3 text-sm text-white"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase sm:col-span-2">
            Why this is relevant
            <textarea
              name="rationale"
              rows={2}
              className="rounded-xl border border-white/15 bg-[#0c1014] p-3 text-sm tracking-normal text-white normal-case"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase sm:col-span-2">
            Suggested text · owner still posts manually
            <textarea
              name="suggested_text"
              rows={3}
              className="rounded-xl border border-white/15 bg-[#0c1014] p-3 text-sm tracking-normal text-white normal-case"
            />
          </label>
          <button className="min-h-11 rounded-xl bg-[#47e4d3] px-4 text-sm font-bold text-[#0a2321] sm:col-span-2">
            Add to manual queue
          </button>
        </form>
      </details>
      <div className="mt-7 grid gap-4">
        {(tasks ?? []).map((task) => (
          <article key={task.id} className="rounded-2xl border border-white/10 bg-[#151b20] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-bold text-slate-300 capitalize">
                {task.channel}
              </span>
              <span className="text-xs font-bold tracking-wide text-[#47e4d3] uppercase">
                {task.action.replaceAll('_', ' ')}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {task.rationale ?? 'Review this relevant account or conversation.'}
            </p>
            {task.suggested_text ? (
              <blockquote className="mt-3 rounded-xl border-l-2 border-[#47e4d3] bg-white/[.03] p-3 text-sm text-slate-300">
                {task.suggested_text}
              </blockquote>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={task.native_url}
                target="_blank"
                rel="noreferrer"
                className="min-h-11 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#101418]"
              >
                Open natively
              </a>
              <form action={completeEngagementAction}>
                <input type="hidden" name="id" value={task.id} />
                <button
                  name="decision"
                  value="complete"
                  className="min-h-11 rounded-xl border border-emerald-400/30 px-4 text-sm font-bold text-emerald-200"
                >
                  Mark done
                </button>
                <button
                  name="decision"
                  value="dismiss"
                  className="ml-2 min-h-11 rounded-xl border border-white/10 px-4 text-sm font-bold text-slate-400"
                >
                  Dismiss
                </button>
              </form>
            </div>
          </article>
        ))}
        {(tasks ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
            No manual engagement tasks right now.
          </p>
        ) : null}
      </div>
    </div>
  );
}
