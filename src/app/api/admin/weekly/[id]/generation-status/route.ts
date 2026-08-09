import { NextResponse, type NextRequest } from 'next/server';
import { getSocialAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function eventCursor(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSocialAdminSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'invalid_digest_id' }, { status: 400 });
  const after = eventCursor(request.nextUrl.searchParams.get('after'));
  const db = getSupabaseAdmin();
  const jobsResult = await db
    .from('weekly_digest_generation_jobs')
    .select('*')
    .eq('weekly_digest_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (jobsResult.error) {
    return NextResponse.json({ error: 'generation_status_unavailable' }, { status: 503 });
  }
  const jobs = jobsResult.data ?? [];
  const jobIds = jobs.map((job) => job.id);
  if (jobIds.length === 0) {
    return NextResponse.json(
      { jobs: [], attempts: [], events: [], historicalDurations: [], cursor: after ?? 0 },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  let eventsQuery = db
    .from('weekly_digest_generation_events')
    .select('*')
    .in('job_id', jobIds)
    .order('id', { ascending: true })
    .limit(200);
  if (after !== null) eventsQuery = eventsQuery.gt('id', after);
  // A small cross-digest success sample lets the panel render a p50–p95 ETA
  // for the same job/provider/model without making a client request for every
  // row. It contains only timestamps and model identity, never prompts/text.
  const historicalJobsResult = await db
    .from('weekly_digest_generation_jobs')
    .select('id,job_type')
    .eq('status', 'succeeded')
    .order('finished_at', { ascending: false })
    .limit(250);
  const historicalJobIds = (historicalJobsResult.data ?? []).map((job) => job.id);
  const historicalJobTypes = new Map(
    (historicalJobsResult.data ?? []).map((job) => [job.id, job.job_type]),
  );
  const [attemptsResult, eventsResult, historyAttemptsResult] = await Promise.all([
    db
      .from('weekly_digest_generation_attempts')
      .select('*')
      .in('job_id', jobIds)
      .order('started_at', { ascending: false })
      .limit(150),
    eventsQuery,
    historicalJobIds.length > 0
      ? db
          .from('weekly_digest_generation_attempts')
          .select('job_id,provider,model,started_at,finished_at')
          .in('job_id', historicalJobIds)
          .eq('status', 'succeeded')
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(750)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (
    attemptsResult.error ||
    eventsResult.error ||
    historicalJobsResult.error ||
    historyAttemptsResult.error
  ) {
    return NextResponse.json({ error: 'generation_status_unavailable' }, { status: 503 });
  }
  const events = eventsResult.data ?? [];
  const cursor = events.at(-1)?.id ?? after ?? 0;
  const historicalDurations = (historyAttemptsResult.data ?? []).flatMap((attempt) => {
    const jobType = historicalJobTypes.get(attempt.job_id);
    const startedAt = new Date(attempt.started_at).getTime();
    const finishedAt = new Date(attempt.finished_at ?? '').getTime();
    if (
      !jobType ||
      !attempt.provider ||
      !attempt.model ||
      !Number.isFinite(startedAt) ||
      !Number.isFinite(finishedAt) ||
      finishedAt <= startedAt
    ) {
      return [];
    }
    return [
      {
        jobType,
        provider: attempt.provider,
        model: attempt.model,
        durationMs: finishedAt - startedAt,
        completedAt: attempt.finished_at,
      },
    ];
  });
  return NextResponse.json(
    { jobs, attempts: attemptsResult.data ?? [], events, historicalDurations, cursor },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
