/**
 * Daily Pipeline pre-flight guard (zero-dependency, runs BEFORE `npm ci`).
 *
 * Mirrors `isPipelineCycleComplete` (pipeline/schedule.ts) using only Node
 * built-ins (global fetch + Intl), so a no-op retry slot can exit in ~3 s
 * instead of paying ~40 s for an install it will never use. Writes
 * `skip=true|false` to GITHUB_OUTPUT; the workflow gates npm ci + the pipeline
 * step on it.
 *
 * Fail-open by design: missing env, a query error, or a timeout all resolve to
 * `skip=false`, so we never skip a progón that has not actually delivered. The
 * authoritative skip still lives in run-daily.ts — this only trims wasted CI
 * minutes when the answer is already known.
 *
 * Kept in sync with pipeline/schedule.ts by hand (it cannot import the TS
 * module pre-install). KYIV_CYCLE_HOURS and the cycle math must match.
 */

import { appendFileSync } from 'node:fs';

const KYIV_CYCLE_HOURS = 4;
const KYIV_CYCLES_PER_DAY = 6;

function kyivMinutesOfDay(now) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function kyivCycleIndex(now) {
  const cycle = Math.floor(kyivMinutesOfDay(now) / (KYIV_CYCLE_HOURS * 60));
  return Math.min(Math.max(cycle, 0), KYIV_CYCLES_PER_DAY - 1);
}

function kyivDate(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function setSkip(value) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) appendFileSync(out, `skip=${value}\n`);
  console.log(`cycle-guard: skip=${value}`);
}

async function main() {
  const base = process.env.SCRAPPER_BASE_URL?.trim();
  const key = process.env.SCRAPPER_SERVICE_KEY?.trim();
  if (!base || !key) {
    console.log('cycle-guard: Supabase env not set — proceeding with full run');
    return setSkip('false');
  }

  const now = new Date();
  const date = kyivDate(now);
  const cycle = kyivCycleIndex(now);

  // PostgREST jsonb containment (@>) — same filter as
  // `.contains('meta', { cycle, cycle_notified: true })` in schedule.ts.
  const filter = encodeURIComponent(JSON.stringify({ cycle, cycle_notified: true }));
  const url =
    `${base.replace(/\/$/, '')}/rest/v1/pipeline_runs` +
    `?select=id&stage=eq.publish&status=eq.ok&date=eq.${date}&meta=cs.${filter}&limit=1`;

  try {
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.log(`cycle-guard: query HTTP ${res.status} — proceeding`);
      return setSkip('false');
    }
    const rows = await res.json();
    const delivered = Array.isArray(rows) && rows.length > 0;
    if (delivered) {
      console.log(`cycle-guard: progón ${cycle} on ${date} already delivered — skipping slot`);
    } else {
      console.log(`cycle-guard: progón ${cycle} on ${date} not yet delivered — running`);
    }
    setSkip(delivered ? 'true' : 'false');
  } catch (e) {
    console.log(`cycle-guard: error (${e instanceof Error ? e.message : String(e)}) — proceeding`);
    setSkip('false');
  }
}

main();
