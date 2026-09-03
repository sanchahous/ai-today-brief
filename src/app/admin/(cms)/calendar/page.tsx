import Link from 'next/link';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { StatusPill } from '@/components/admin/status-pill';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { packageKindLabel } from '@/lib/social/package-queue';

export const dynamic = 'force-dynamic';

interface PostRow {
  id: string;
  package_id: string | null;
  channel: string;
  status: string;
  scheduled_for: string | null;
  posted_at: string | null;
  post_text: string | null;
  url: string | null;
}

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

function groupByDay(posts: PostRow[], dateField: 'scheduled_for' | 'posted_at') {
  const groups = new Map<string, PostRow[]>();
  for (const post of posts) {
    const day = dayLabel(post[dateField]);
    groups.set(day, [...(groups.get(day) ?? []), post]);
  }
  return groups;
}

function PostGroups({
  groups,
  dateField,
  packagesById,
  emptyLabel,
}: {
  groups: Map<string, PostRow[]>;
  dateField: 'scheduled_for' | 'posted_at';
  packagesById: Map<string, { kind: string; title: string }>;
  emptyLabel: string;
}) {
  if (groups.size === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
        {emptyLabel}
      </p>
    );
  }
  return (
    <div className="grid gap-6">
      {[...groups].map(([day, dayPosts]) => (
        <section key={day}>
          <h3 className="mb-3 text-sm font-bold tracking-wide text-slate-400 uppercase">{day}</h3>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#151b20]">
            {dayPosts.map((post) => {
              const pkg = post.package_id ? packagesById.get(post.package_id) : undefined;
              return (
                <Link
                  key={post.id}
                  href={`/admin/packages/${post.package_id}`}
                  className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-b border-white/8 p-4 last:border-0 hover:bg-white/[.03] sm:grid-cols-[4rem_9rem_minmax(0,1fr)_auto] sm:items-center"
                >
                  <time className="font-mono text-sm text-[#47e4d3]">
                    {timeLabel(post[dateField])}
                  </time>
                  <span className="hidden text-sm font-bold text-white capitalize sm:block">
                    {post.channel}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white capitalize sm:hidden">
                      {post.channel}
                    </p>
                    {pkg ? (
                      <p className="truncate text-xs font-bold tracking-wide text-slate-500 uppercase">
                        {packageKindLabel(pkg.kind)} · {pkg.title}
                      </p>
                    ) : null}
                    <p className="truncate text-sm text-slate-400">{post.post_text}</p>
                  </div>
                  <div className="col-start-2 sm:col-auto">
                    <StatusPill value={post.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default async function CalendarPage() {
  await requireSocialAdmin();
  const supabase = getSupabaseAdmin();

  const [{ data: upcoming }, { data: posted }] = await Promise.all([
    supabase
      .from('social_posts')
      .select('id,package_id,channel,status,scheduled_for,posted_at,post_text,url')
      .not('status', 'in', '(posted,cancelled)')
      .order('scheduled_for', { ascending: true })
      .limit(100),
    supabase
      .from('social_posts')
      .select('id,package_id,channel,status,scheduled_for,posted_at,post_text,url')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(100),
  ]);

  const packageIds = [
    ...new Set(
      [...(upcoming ?? []), ...(posted ?? [])]
        .map((post) => post.package_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: packages } = packageIds.length
    ? await supabase.from('social_packages').select('id,kind,title').in('id', packageIds)
    : { data: [] };
  const packagesById = new Map((packages ?? []).map((pkg) => [pkg.id, pkg]));

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-bold tracking-[.16em] text-[#47e4d3] uppercase">Calendar</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Publishing timeline</h1>
      <p className="mt-2 text-sm text-slate-400">
        All times are shown in Europe/Kyiv and retain DST correctly.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-white">Recently posted</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          The last {posted?.length ?? 0} posts that actually went live, most recent first.
        </p>
        <PostGroups
          groups={groupByDay(posted ?? [], 'posted_at')}
          dateField="posted_at"
          packagesById={packagesById}
          emptyLabel="Nothing has posted yet."
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-white">Upcoming</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          Scheduled, in review, or otherwise not yet live.
        </p>
        <PostGroups
          groups={groupByDay(upcoming ?? [], 'scheduled_for')}
          dateField="scheduled_for"
          packagesById={packagesById}
          emptyLabel="No content yet."
        />
      </section>
    </div>
  );
}
