import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { fetchAnonRestCached } from '@/lib/supabase-anon-fetch';

// Accept several env-var names so it works whichever you set: NEXT_PUBLIC_SUPABASE_*
// (canonical), VITE_SCRAPPER_* (ported from the old Vite app), or SCRAPPER_BASE_*
// (the pipeline / GitHub-secret names). All are read server-side here.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.VITE_SCRAPPER_URL ??
  process.env.SCRAPPER_BASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.VITE_SCRAPPER_ANON_KEY ??
  process.env.SCRAPPER_BASE_ANON_KEY;

let cached: SupabaseClient<Database> | null | undefined;

/**
 * Anon Supabase client for public, RLS-gated reads (server components + browser).
 *
 * GET `/rest/v1/` goes through Next Data Cache (`public-content` tag). Mutations,
 * auth, and Storage are uncached. Never used for writes — those run server-side
 * via Edge Functions with the service role.
 *
 * Returns `null` when the env is absent — e.g. a local build without `.env.local`
 * — so callers fall back gracefully instead of the build crashing.
 */
export function getSupabase(): SupabaseClient<Database> | null {
  if (cached !== undefined) return cached;
  cached =
    url && anonKey
      ? createClient<Database>(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { fetch: fetchAnonRestCached },
        })
      : null;
  return cached;
}
