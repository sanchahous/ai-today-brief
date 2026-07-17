import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { serverEpochMs } from '@/lib/server-clock';

export const dynamic = 'force-dynamic';

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export default async function ResultsPage() {
  await requireSocialAdmin();
  const supabase = getSupabaseAdmin();
  const now = serverEpochMs();
  const since = new Date(now - 30 * 86_400_000).toISOString();
  const [
    { data: posts },
    { data: clicks },
    { data: metrics },
    { data: accounts },
    { data: conversions },
  ] = await Promise.all([
    supabase
      .from('social_posts')
      .select('id,channel,posted_at,scheduled_for,format')
      .eq('status', 'posted')
      .gte('posted_at', since),
    supabase.from('social_click_events').select('social_post_id').gte('clicked_at', since),
    supabase
      .from('social_post_metrics')
      .select('social_post_id,impressions,engagements,likes,comments,shares,saves,clicks')
      .gte('measured_at', since),
    supabase.from('social_accounts').select('id,channel,handle'),
    supabase
      .from('subscribers')
      .select('social_post_id')
      .not('social_post_id', 'is', null)
      .gte('created_at', since),
  ]);
  const accountIds = (accounts ?? []).map((account) => account.id);
  const { data: followerSnapshots } = accountIds.length
    ? await supabase
        .from('social_account_metrics')
        .select('social_account_id,followers_count,measured_at')
        .in('social_account_id', accountIds)
        .gte('measured_at', since)
        .order('measured_at')
    : { data: [] };
  const postIds = new Set((posts ?? []).map((post) => post.id));
  const relevantMetrics = (metrics ?? []).filter((metric) => postIds.has(metric.social_post_id));
  const impressions = sum(relevantMetrics.map((metric) => metric.impressions));
  const engagements = sum(relevantMetrics.map((metric) => metric.engagements));
  const firstPartyClicks = (clicks ?? []).filter((click) =>
    postIds.has(click.social_post_id),
  ).length;
  const channelRows = ['telegram', 'x', 'threads', 'linkedin', 'instagram', 'facebook'].map(
    (channel) => {
      const channelPosts = (posts ?? []).filter((post) => post.channel === channel);
      const channelIds = new Set(channelPosts.map((post) => post.id));
      const channelMetrics = relevantMetrics.filter((metric) =>
        channelIds.has(metric.social_post_id),
      );
      return {
        channel,
        posts: channelPosts.length,
        impressions: sum(channelMetrics.map((metric) => metric.impressions)),
        engagements: sum(channelMetrics.map((metric) => metric.engagements)),
        clicks: (clicks ?? []).filter((click) => channelIds.has(click.social_post_id)).length,
        conversions: (conversions ?? []).filter(
          (conversion) => conversion.social_post_id && channelIds.has(conversion.social_post_id),
        ).length,
      };
    },
  );
  const followerDelta = (accounts ?? []).map((account) => {
    const values = (followerSnapshots ?? [])
      .filter(
        (snapshot) =>
          snapshot.social_account_id === account.id && snapshot.followers_count !== null,
      )
      .map((snapshot) => snapshot.followers_count!);
    return {
      channel: account.channel,
      delta: values.length > 1 ? values.at(-1)! - values[0] : null,
    };
  });
  const engagementByPost = new Map(
    relevantMetrics.map((metric) => [metric.social_post_id, metric.engagements ?? 0]),
  );
  const slotSuggestions = channelRows.flatMap((row) => {
    const channelPosts = (posts ?? []).filter(
      (post) => post.channel === row.channel && post.posted_at,
    );
    const oldest = channelPosts.map((post) => new Date(post.posted_at!).getTime()).sort()[0];
    if (channelPosts.length < 4 || !oldest || now - oldest < 28 * 86_400_000) return [];
    const slots = new Map<string, { total: number; posts: number }>();
    for (const post of channelPosts) {
      const when = new Date(post.scheduled_for ?? post.posted_at!);
      const key = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Kyiv',
        weekday: 'short',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(when);
      const current = slots.get(key) ?? { total: 0, posts: 0 };
      current.total += engagementByPost.get(post.id) ?? 0;
      current.posts += 1;
      slots.set(key, current);
    }
    const best = [...slots]
      .filter(([, value]) => value.posts >= 2)
      .sort((a, b) => b[1].total / b[1].posts - a[1].total / a[1].posts)[0];
    return best
      ? [{ channel: row.channel, slot: best[0], average: best[1].total / best[1].posts }]
      : [];
  });

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-bold tracking-[.16em] text-[#47e4d3] uppercase">Results</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Last 30 days</h1>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Posts', (posts ?? []).length],
          ['Impressions', impressions.toLocaleString()],
          [
            'Engagement rate',
            impressions ? `${((engagements / impressions) * 100).toFixed(1)}%` : '—',
          ],
          ['First-party clicks', firstPartyClicks.toLocaleString()],
          ['Newsletter signups', (conversions ?? []).length.toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-[#151b20] p-5">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </section>
      <section className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-[#151b20]">
        <div className="grid min-w-[34rem] grid-cols-[minmax(6rem,1fr)_repeat(4,minmax(4rem,.7fr))] gap-2 border-b border-white/10 px-4 py-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
          <span>Channel</span>
          <span>Posts</span>
          <span>Engage</span>
          <span>Clicks</span>
          <span>Signups</span>
        </div>
        {channelRows.map((row) => (
          <div
            key={row.channel}
            className="grid min-w-[34rem] grid-cols-[minmax(6rem,1fr)_repeat(4,minmax(4rem,.7fr))] gap-2 border-b border-white/5 px-4 py-4 text-sm last:border-0"
          >
            <span className="font-bold text-white capitalize">{row.channel}</span>
            <span>{row.posts}</span>
            <span>{row.engagements}</span>
            <span>{row.clicks}</span>
            <span>{row.conversions}</span>
          </div>
        ))}
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-bold text-white">Follower delta</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {followerDelta.map((row) => (
            <div key={row.channel} className="rounded-xl border border-white/10 p-4">
              <p className="text-sm font-bold text-slate-300 capitalize">{row.channel}</p>
              <p className="mt-1 text-xl font-bold text-white">
                {row.delta === null
                  ? 'Awaiting snapshots'
                  : `${row.delta >= 0 ? '+' : ''}${row.delta}`}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.02] p-5">
        <h2 className="text-lg font-bold text-white">Timing recommendations</h2>
        <p className="mt-1 text-sm text-slate-500">
          Unlocked after four weeks of own data. Suggestions never change cadence automatically.
        </p>
        {slotSuggestions.length ? (
          <ul className="mt-4 grid gap-2 text-sm text-slate-300">
            {slotSuggestions.map((item) => (
              <li key={item.channel}>
                <strong className="text-white capitalize">{item.channel}</strong>: test {item.slot}{' '}
                Kyiv · avg {item.average.toFixed(1)} engagements/post
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Collecting enough history.</p>
        )}
      </section>
    </div>
  );
}
