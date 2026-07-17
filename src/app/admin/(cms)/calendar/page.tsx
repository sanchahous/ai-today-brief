import Link from 'next/link';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { StatusPill } from '@/components/admin/status-pill';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function dayLabel(value: string | null) {
  if (!value) return 'Unscheduled';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function timeLabel(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default async function CalendarPage() {
  await requireSocialAdmin();
  const { data: posts } = await getSupabaseAdmin()
    .from('social_posts')
    .select('id,package_id,channel,status,scheduled_for,post_text,url')
    .not('status', 'eq', 'cancelled')
    .order('scheduled_for', { ascending: true })
    .limit(100);
  const groups = new Map<string, NonNullable<typeof posts>>();
  for (const post of posts ?? []) {
    const day = dayLabel(post.scheduled_for);
    groups.set(day, [...(groups.get(day) ?? []), post]);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-bold tracking-[.16em] text-[#47e4d3] uppercase">Calendar</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Publishing timeline</h1>
      <p className="mt-2 text-sm text-slate-400">
        All times are shown in Europe/Kyiv and retain DST correctly.
      </p>
      <div className="mt-7 grid gap-6">
        {[...groups].map(([day, dayPosts]) => (
          <section key={day}>
            <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-400 uppercase">{day}</h2>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#151b20]">
              {dayPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/admin/packages/${post.package_id}`}
                  className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-b border-white/8 p-4 last:border-0 hover:bg-white/[.03] sm:grid-cols-[4rem_7rem_minmax(0,1fr)_auto] sm:items-center"
                >
                  <time className="font-mono text-sm text-[#47e4d3]">
                    {timeLabel(post.scheduled_for)}
                  </time>
                  <span className="hidden text-sm font-bold text-white capitalize sm:block">
                    {post.channel}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white capitalize sm:hidden">
                      {post.channel}
                    </p>
                    <p className="truncate text-sm text-slate-400">{post.post_text}</p>
                  </div>
                  <div className="col-start-2 sm:col-auto">
                    <StatusPill value={post.status} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
        {(posts ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
            No content yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
